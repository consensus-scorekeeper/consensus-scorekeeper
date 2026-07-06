// End-to-end (DOM-level) coverage of mixed-format zip uploads:
// processZipBuffer must route each entry to its format adapter, load the
// first pack, background-annotate every entry with a parse verdict, and
// serve cached parses on re-selection. Uses only synthetic STORE zips —
// the .docx is itself a zip holding word/document.xml — so no pdf.js is
// involved.

import { describe, it, expect, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import { state } from '../src/state.js';
import { processZipBuffer } from '../src/loader.js';

// Multi-entry STORE (no compression) zip builder; superset of the builder
// in tests/zip.test.js.
function buildStoredZip(files) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  for (const { name, content } of files) {
    const data = Buffer.from(content);
    const nameBytes = Buffer.from(name);
    const lfh = Buffer.alloc(30 + nameBytes.length);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4);
    lfh.writeUInt16LE(0, 8); // method = STORE
    lfh.writeUInt32LE(data.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(lfh, 30);

    const cdh = Buffer.alloc(46 + nameBytes.length);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4);
    cdh.writeUInt16LE(20, 6);
    cdh.writeUInt32LE(data.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBytes.length, 28);
    cdh.writeUInt32LE(offset, 42);
    nameBytes.copy(cdh, 46);
    centrals.push(cdh);

    parts.push(lfh, data);
    offset += lfh.length + data.length;
  }
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  const buf = Buffer.concat([...parts, ...centrals, eocd]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function txtPack() {
  const lines = ['Set of 10: Letters'];
  WORDS.forEach((w, i) => {
    lines.push(`${i + 1}. Question ${w}?`, `A: ${w}`);
  });
  return lines.join('\n') + '\n';
}

function docxPack() {
  const paras = ['<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Set of 10: Numbers</w:t></w:r></w:p>'];
  for (const w of WORDS) {
    paras.push(`<w:p><w:r><w:t>Question ${w}? ANSWER: ${w}</w:t></w:r></w:p>`);
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${paras.join('')}</w:body></w:document>`;
  return Buffer.from(buildStoredZip([{ name: 'word/document.xml', content: xml }]));
}

const dropdown = () => document.getElementById('zip-pack-dropdown');

async function waitFor(cond, ms = 3000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 10));
  }
}

describe('processZipBuffer — mixed-format zip', () => {
  beforeEach(() => {
    localStorage.clear();
    state.parseIssues = [];
    state.questions = [];
    state.hasQuestions = false;
    state.packName = null;
    state.pdfBytes = null;
  });

  it('lists every supported format, skips junk, and parses via the right adapter', async () => {
    const zip = buildStoredZip([
      { name: 'a-letters.txt', content: txtPack() },
      { name: 'b-numbers.docx', content: docxPack() },
      { name: '__MACOSX/._a-letters.txt', content: 'junk' },
      { name: 'notes.md', content: 'not a pack' },
    ]);
    await processZipBuffer(zip);

    // Only the two real packs are listed; the .txt sorts first and loads.
    expect([...dropdown().options].map(o => o.value)).toEqual(['a-letters.txt', 'b-numbers.docx']);
    expect(state.packName).toBe('a-letters.txt');
    expect(state.hasQuestions).toBe(true);
    expect(state.questions).toHaveLength(10);
    expect(state.questions[0].answer).toBe('one');

    // Background annotation labels both entries (10 slots ≠ 100 → warnings).
    await waitFor(() => [...dropdown().options].every(o => / — /.test(o.textContent)));
    for (const opt of dropdown().options) {
      expect(opt.textContent).toMatch(/ — \d+ warnings?$/);
    }

    // Selecting the docx serves the cached parse through its own adapter.
    dropdown().value = 'b-numbers.docx';
    await dropdown().onchange();
    expect(state.packName).toBe('b-numbers.docx');
    expect(state.questions).toHaveLength(10);
    expect(state.questions[0].question).toBe('Question one?');
    expect(state.questions[0].category).toBe('Set of 10: Numbers');
    expect(state.pdfBytes).toBeNull(); // non-PDF pack: no inline viewer bytes
  });

  it('rejects a zip with no supported packs', async () => {
    const zip = buildStoredZip([{ name: 'readme.md', content: 'nope' }]);
    await processZipBuffer(zip);
    const statusEl = document.getElementById('pdf-status');
    expect(statusEl.textContent).toContain('No .pdf, .docx, or .txt packs found');
  });
});
