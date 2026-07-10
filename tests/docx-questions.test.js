import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseDocxBuffer, parseDocxParagraphs, inferStreakCap } from '../src/parser/docx-questions.js';

describe('inferStreakCap', () => {
  it('uses the prompt cap when present', () => {
    expect(inferStreakCap('name up to all six of the highest-rated…', 6)).toBe(6);
    expect(inferStreakCap('Give the nicknames of up to all six…', 6)).toBe(6);
    expect(inferStreakCap('Name up to all five colors on the Olympic flag.', 5)).toBe(5);
    expect(inferStreakCap('Name up to all four…', 4)).toBe(4);
  });
  it('uses prompt cap even when more answers are listed', () => {
    // Writer listed 11 acceptable answers but the prompt caps at five.
    expect(inferStreakCap('Name up to all five US presidents…', 11)).toBe(5);
  });
  it('handles digit caps', () => {
    expect(inferStreakCap('Name up to 8 things', 8)).toBe(8);
  });
  it('falls back to the answer count when no cap pattern matches', () => {
    expect(inferStreakCap('List as many as you can.', 6)).toBe(6);
    expect(inferStreakCap('Name up to every Pixar film with a name in its title.', 7)).toBe(7);
  });
});

// ==================== synthetic paragraphs ====================
// Each paragraph is an array of { text, bold } runs, exactly what
// extractDocxParagraphs yields — so these cases cover the transpiler +
// universal core without needing a real .docx on disk.

const para = (text, bold = false) => [{ text, bold: !!bold }];

describe('parseDocxParagraphs — set of 4', () => {
  const { questions, issues } = parseDocxParagraphs([
    para('FIRST QUARTER'),
    para('Set of 4: Fairy Tales', true),
    para('Which princess pricked her finger? ANSWER: Aurora'),
    para('Who climbed the beanstalk? ANSWER: Jack'),
    para('Who lost a glass slipper? ANSWER: Cinderella'),
    para('Whose hair was let down? ANSWER: Rapunzel'),
  ]);

  it('numbers the questions sequentially from 1', () => {
    expect(questions.map(q => q.num)).toEqual([1, 2, 3, 4]);
  });
  it('splits question from ANSWER:', () => {
    expect(questions[0].question).toBe('Which princess pricked her finger?');
    expect(questions[0].answer).toBe('Aurora');
  });
  it('attaches the category with positions', () => {
    for (const q of questions) expect(q.category).toBe('Set of 4: Fairy Tales');
    expect(questions.map(q => q.posInCategory)).toEqual([1, 2, 3, 4]);
  });
  it('reports no issues', () => expect(issues).toEqual([]));
  it('leaves pageNum/yPos null (no backing PDF)', () => {
    expect(questions[0].pageNum).toBeNull();
    expect(questions[0].yPos).toBeNull();
  });
});

describe('parseDocxParagraphs — jackpot propagation', () => {
  const { questions } = parseDocxParagraphs([
    para('Jackpot', true),
    para('Part One: A very vague clue.'),
    para('Part Two: Slightly clearer.'),
    para('Part Three: Clearer still.'),
    para('Part Four: Obvious. ANSWER: Rumpelstiltskin'),
  ]);

  it('numbers all four parts', () => {
    expect(questions.map(q => q.num)).toEqual([1, 2, 3, 4]);
  });
  it('propagates the shared answer to every part', () => {
    for (const q of questions) expect(q.answer).toBe('Rumpelstiltskin');
  });
  it('categorizes all parts as Jackpot', () => {
    for (const q of questions) expect(q.category).toBe('Jackpot');
  });
});

describe('parseDocxParagraphs — streak span from prompt cap', () => {
  const { questions, issues } = parseDocxParagraphs([
    para('Streak', true),
    para('Name up to all six wives of Henry VIII.'),
    para('A: Catherine of Aragon'),
    para('A: Anne Boleyn'),
    para('A: Jane Seymour'),
    para('A: Anne of Cleves'),
    para('A: Catherine Howard'),
    para('A: Catherine Parr'),
    para('Set of 1: End', true),
    para('Done? ANSWER: yes'),
  ]);
  const streak = questions.find(q => q.streakRange);

  it('encodes the span as a number gap: cap 6 → 3 slots', () => {
    expect(streak.num).toBe(1);
    expect(streak.streakRange).toEqual({ start: 1, end: 3 });
    expect(questions.find(q => q.category === 'Set of 1: End').num).toBe(4);
  });
  it('joins the answers with " | "', () => {
    expect(streak.answer.split(' | ')).toHaveLength(6);
  });
  it('reports no issues (prompt states its cap)', () => {
    expect(issues).toEqual([]);
  });
});

describe('parseDocxParagraphs — streak without a stated cap', () => {
  const { questions, issues } = parseDocxParagraphs([
    para('Streak', true),
    para('Name up to every prime number below ten.'),
    para('A: 2'),
    para('A: 3'),
    para('A: 5'),
    para('A: 7'),
    para('Set of 1: End', true),
    para('Done? ANSWER: yes'),
  ]);
  it('spans slots from the answer count without warning (capless prompts are standard)', () => {
    const streak = questions.find(q => q.streakRange);
    expect(streak.streakRange).toEqual({ start: 1, end: 2 });
    expect(issues).toEqual([]);
  });
});

describe('parseDocxParagraphs — two odd-capped streaks share a slot', () => {
  const streakBlock = (prompt, answers) => [
    para('Streak', true),
    para(prompt),
    ...answers.map(a => para(`A: ${a}`)),
  ];
  const { questions, issues } = parseDocxParagraphs([
    ...streakBlock('Name up to all five colors on the Olympic flag.',
      ['Blue', 'Yellow', 'Black', 'Green', 'Red']),
    ...streakBlock('Name up to all five Great Lakes.',
      ['Superior', 'Michigan', 'Huron', 'Erie', 'Ontario']),
    para('Set of 1: End', true),
    para('Done? ANSWER: yes'),
  ]);
  const streaks = questions.filter(q => q.streakRange);

  it('allocates 5 slots total (5 + 5 half-point answers), not ceil-each 6', () => {
    expect(streaks[0].streakRange).toEqual({ start: 1, end: 3 });
    expect(streaks[1].streakRange).toEqual({ start: 4, end: 5 });
    expect(questions.find(q => q.category === 'Set of 1: End').num).toBe(6);
  });
  it('reports no issues', () => expect(issues).toEqual([]));
});

describe('parseDocxParagraphs — mystery reveal note', () => {
  const { questions, issues } = parseDocxParagraphs([
    para('Set of 2: Mystery', true),
    para('What number was worn during Linsanity by Jeremy Lin? ANSWER: 17'),
    para('What direction lies between NNE and WNW? ANSWER: north-northwest'),
    para('(The theme was Alfred Hitchcock films.)'),
    para('Set of 1: End', true),
    para('Done? ANSWER: yes'),
  ]);

  it('attaches the reveal to the set\'s last question instead of warning', () => {
    expect(questions[1].categoryReveal).toBe('(The theme was Alfred Hitchcock films.)');
    expect(questions[1].answer).toBe('north-northwest');
    expect(issues).toEqual([]);
  });
  it('still warns on non-parenthesized stray text', () => {
    const { issues: strayIssues } = parseDocxParagraphs([
      para('Set of 1: Plain', true),
      para('Q? ANSWER: a'),
      para('This sentence is not a reveal note.'),
    ]);
    expect(strayIssues.some(i => i.code === 'docx-stray-text')).toBe(true);
  });
});

describe('parseDocxParagraphs — reveal after a streak', () => {
  const { questions, issues } = parseDocxParagraphs([
    para('Streak', true),
    para('Name up to all four suits in a deck of cards.'),
    para('A: Hearts'),
    para('A: Diamonds'),
    para('A: Clubs'),
    para('A: Spades'),
    para('(The theme was card games.)'),
    para('Set of 1: End', true),
    para('Done? ANSWER: yes'),
  ]);
  it('flushes the streak first, then attaches the reveal to it', () => {
    const streak = questions.find(q => q.streakRange);
    expect(streak.streakRange).toEqual({ start: 1, end: 2 });
    expect(streak.categoryReveal).toBe('(The theme was card games.)');
    expect(streak.answer.split(' | ')).toHaveLength(4);
    expect(streak.answer).not.toContain('card games');
    expect(issues).toEqual([]);
  });
});

describe('parseDocxParagraphs — splits', () => {
  const qa = (q, a) => para(`${q} ANSWER: ${a}`);
  const { questions } = parseDocxParagraphs([
    para('Splits', true),
    para('Gothic Literature'),
    qa('Q1?', 'a'), qa('Q2?', 'b'), qa('Q3?', 'c'), qa('Q4?', 'd'),
    para('Mountaineering'),
    qa('Q5?', 'e'), qa('Q6?', 'f'), qa('Q7?', 'g'), qa('Q8?', 'h'),
  ]);

  it('labels sub-categories like the PDF path does', () => {
    expect(questions.slice(0, 4).every(q => q.category === 'Splits 1: Gothic Literature')).toBe(true);
    expect(questions.slice(4).every(q => q.category === 'Splits 2: Mountaineering')).toBe(true);
  });
});

describe('parseDocxParagraphs — bold answer runs become <b><u>', () => {
  const { questions } = parseDocxParagraphs([
    para('Set of 1: Authors', true),
    [
      { text: 'Who wrote Hamlet? ANSWER: ', bold: false },
      { text: 'Shakespeare', bold: true },
    ],
  ]);
  it('renders the bold run in answerHtml', () => {
    expect(questions[0].answerHtml).toContain('<b><u>Shakespeare</u></b>');
    expect(questions[0].answer).toBe('Shakespeare');
  });
});

describe('parseDocxParagraphs — consecutive DJ headers continue one block', () => {
  const { questions } = parseDocxParagraphs([
    para('DJ', true),
    para('First? ANSWER: a'),
    para('Second? ANSWER: b'),
    para('DJ', true),
    para('Third? ANSWER: c'),
    para('Fourth? ANSWER: d'),
  ]);
  it('keeps all four in Double Jump with continuous positions', () => {
    for (const q of questions) expect(q.category).toBe('Double Jump');
    expect(questions.map(q => q.posInCategory)).toEqual([1, 2, 3, 4]);
  });
});

// ==================== real packet (gated on a local file) ====================

const PACKET = 'C:\\Users\\denis\\Downloads\\drive-download-20260624T034000Z-3-001\\Copy of mCons packet 1.docx';

function tryRead() {
  try { return readFileSync(PACKET); } catch { return null; }
}

const buf = tryRead();
const describeOrSkip = buf ? describe : describe.skip;

describeOrSkip('parseDocxBuffer — packet 1', () => {
  let questions;
  it('parses without throwing', async () => {
    ({ questions } = await parseDocxBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
    expect(Array.isArray(questions)).toBe(true);
  });
  it('produces ~96 questions (matches the old state-machine parser)', () => {
    expect(questions.length).toBeGreaterThanOrEqual(90);
    expect(questions.length).toBeLessThanOrEqual(100);
  });
  it('emits PDF-parser-compatible shape', () => {
    const q = questions[0];
    expect(q).toHaveProperty('num');
    expect(q).toHaveProperty('question');
    expect(q).toHaveProperty('answer');
    expect(q).toHaveProperty('answerHtml');
    expect(q).toHaveProperty('category');
    expect(q).toHaveProperty('posInCategory');
    expect(q).toHaveProperty('categoryInstructions');
    expect(q).toHaveProperty('streakRange');
    expect(q).toHaveProperty('pageNum');
    expect(q).toHaveProperty('yPos');
    expect(q.pageNum).toBeNull();
    expect(q.yPos).toBeNull();
  });
  it('finds Q1 = Mona Lisa → Louvre', () => {
    const q1 = questions.find(q => q.num === 1);
    expect(q1.question).toMatch(/Mona Lisa/);
    expect(q1.answer).toMatch(/Louvre/);
    expect(q1.answerHtml).toContain('<b><u>Louvre</u></b>');
  });
  it('attaches Jackpot answer to every part', () => {
    const jackpotParts = questions.filter(q => q.category === 'Jackpot');
    expect(jackpotParts.length).toBeGreaterThan(0);
    for (const q of jackpotParts) {
      expect(q.answer).toMatch(/Weill/);
    }
  });
  it('emits streak with multi-answer (" | "-joined) and a slot range', () => {
    const streaks = questions.filter(q => q.streakRange);
    expect(streaks.length).toBe(2);
    const nakamura = streaks.find(q => q.answer.includes('Nakamura'));
    expect(nakamura).toBeDefined();
    expect(nakamura.answer.split(' | ').length).toBe(6);
    // Prompt says "up to all six" — cap 6, half points → 3 slots.
    expect(nakamura.streakRange.end - nakamura.streakRange.start).toBe(2);
    expect(nakamura.answerHtml).toContain('<div>Answer:');
  });
  it('assigns sequential num across streak slots', () => {
    // Numbers must be strictly increasing — streaks bump num by their span.
    let prev = 0;
    for (const q of questions) {
      expect(q.num).toBeGreaterThan(prev);
      prev = q.num;
    }
  });
  it('captures Splits sub-categories like the PDF path', () => {
    const splits = questions.filter(q => /^Splits [12]: /.test(q.category || ''));
    const subs = new Set(splits.map(q => q.category));
    expect(subs.size).toBeGreaterThanOrEqual(2);
  });
});
