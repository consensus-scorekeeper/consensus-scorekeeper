// PDF adapter: given a pdf.js document, walk every page and produce the
// RichDoc (see parser/rich-doc.js) that parseQuestions consumes. Each
// logical PDF line becomes one RichDoc line carrying its rich runs
// ({ text, bold }) plus the page number and y coordinate that drive the
// inline PDF viewer's scroll-to-question.
//
// The "bold font" is detected heuristically as the second-most-used font
// (the most-used one being normal body text).

import { makeLine } from './rich-doc.js';

export async function extractRichDocFromPdf(pdf) {
  // Step 1: Extract all text items with font info, sorted top-to-bottom and
  // left-to-right within each y-grouped line. pdf.js returns items in
  // content-stream order, which is NOT always spatial order (e.g., bold
  // overlay items can appear before the underlying text).
  const lineGroups = []; // { page, y, items: [{ str, font }] }
  const fontUsage = {}; // font -> count of non-whitespace chars

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    if (content.items.length === 0) continue;

    const itemsWithPos = content.items
      .filter(it => it.str !== undefined)
      .map(it => ({
        str: it.str,
        font: it.fontName,
        y: Math.round(it.transform[5]),
        x: it.transform[4],
      }));

    const groups = []; // { y, items: [] }
    for (const it of itemsWithPos) {
      const g = groups.find(g => Math.abs(g.y - it.y) <= 3);
      if (g) g.items.push(it);
      else groups.push({ y: it.y, items: [it] });
    }
    groups.sort((a, b) => b.y - a.y); // top of page first

    for (const g of groups) {
      g.items.sort((a, b) => a.x - b.x);
      for (const it of g.items) {
        if (it.str) {
          fontUsage[it.font] = (fontUsage[it.font] || 0) + it.str.replace(/\s/g, '').length;
        }
      }
      lineGroups.push({ page: i, y: g.y, items: g.items });
    }
  }

  // Step 2: Detect which font is "bold". Heuristic: second-highest usage.
  const boldFonts = new Set();
  const sorted = Object.entries(fontUsage).sort((a, b) => b[1] - a[1]);
  if (sorted.length >= 2) boldFonts.add(sorted[1][0]);

  // Step 3: Turn each y-group into a RichDoc line. Rich runs merge adjacent
  // same-bold items; a space is inserted between items that don't already
  // touch with one (inheriting the run's bold when both sides agree, else a
  // standalone non-bold space — this keeps <b><u> spans contiguous across
  // items of the same font). A line is "bold" iff every non-whitespace char
  // came from a bold font.
  const lines = [];
  for (const g of lineGroups) {
    const runs = [];
    let boldChars = 0;
    let nonBoldChars = 0;
    for (const it of g.items) {
      const bold = it.font ? boldFonts.has(it.font) : false;
      const nonWs = it.str.replace(/\s/g, '').length;
      if (bold) boldChars += nonWs;
      else nonBoldChars += nonWs;

      const last = runs[runs.length - 1];
      if (last && !last.text.endsWith(' ') && !it.str.startsWith(' ')) {
        if (last.bold === bold) last.text += ' ';
        else runs.push({ text: ' ', bold: false });
      }
      const tail = runs[runs.length - 1];
      if (tail && tail.bold === bold) tail.text += it.str;
      else runs.push({ text: it.str, bold });
    }

    // Trim the line: strip leading/trailing whitespace off the run list so
    // the joined runs equal the trimmed line text. Blank lines are dropped.
    while (runs.length) {
      runs[0].text = runs[0].text.replace(/^\s+/, '');
      if (runs[0].text) break;
      runs.shift();
    }
    while (runs.length) {
      runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/\s+$/, '');
      if (runs[runs.length - 1].text) break;
      runs.pop();
    }
    if (!runs.length) continue;

    const text = runs.map(r => r.text).join('');
    lines.push(makeLine(text, {
      segments: runs,
      isBold: boldChars > 0 && nonBoldChars === 0,
      page: g.page,
      y: g.y,
    }));
  }

  const adapterIssues = [];
  if (boldFonts.size === 0 && lines.length > 0) {
    adapterIssues.push({
      severity: 'warn',
      code: 'pdf-no-bold-font',
      message: 'No bold font detected in this PDF — category titles may not be recognized (the parser identifies categories by bold text).',
    });
  }

  return { doc: { source: 'pdf', lines }, adapterIssues };
}
