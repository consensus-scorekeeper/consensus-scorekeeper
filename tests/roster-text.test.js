// Pure parse/serialize tests for the roster-manager text format.

import { describe, it, expect } from 'vitest';
import { parseRosterText, serializeRosterText, slugifyName } from '../src/util/roster-text.js';

const SAMPLE = `Tournament: Stanford Spring 2027

Wookiee
Danny Han
Denis Liu
Ethan Bosita

Sarlacc
Alice Chen
Bob Park
`;

describe('parseRosterText', () => {
  it('parses header + team blocks', () => {
    const r = parseRosterText(SAMPLE);
    expect(r.ok).toBe(true);
    expect(r.name).toBe('Stanford Spring 2027');
    expect(r.rosters).toEqual([
      { name: 'Wookiee', players: ['Danny Han', 'Denis Liu', 'Ethan Bosita'] },
      { name: 'Sarlacc', players: ['Alice Chen', 'Bob Park'] },
    ]);
  });

  it('header is optional — name comes back null', () => {
    const r = parseRosterText('Wookiee\nDanny Han');
    expect(r.ok).toBe(true);
    expect(r.name).toBeNull();
    expect(r.rosters).toEqual([{ name: 'Wookiee', players: ['Danny Han'] }]);
  });

  it('matches the header keyword case-insensitively', () => {
    const r = parseRosterText('TOURNAMENT:  My Cup \n\nTeam\nPlayer');
    expect(r.ok).toBe(true);
    expect(r.name).toBe('My Cup');
  });

  it('normalizes CRLF, runs of blank lines, and padded whitespace', () => {
    const messy = 'Tournament: X\r\n\r\n\r\n  Wookiee  \r\n  Danny Han \r\n\r\n\r\n\r\nSarlacc\r\nAlice Chen\r\n';
    const r = parseRosterText(messy);
    expect(r.ok).toBe(true);
    expect(r.rosters).toEqual([
      { name: 'Wookiee', players: ['Danny Han'] },
      { name: 'Sarlacc', players: ['Alice Chen'] },
    ]);
  });

  it('rejects empty input', () => {
    const r = parseRosterText('   \n \n');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/No teams found/);
  });

  it('rejects a team with no players', () => {
    const r = parseRosterText('Lonely Team\n\nFull Team\nSomeone');
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual(['Team "Lonely Team" has no players.']);
  });

  it('rejects duplicate team names case-insensitively', () => {
    const r = parseRosterText('Wookiee\nA\n\nwookiee\nB');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/Duplicate team name/);
  });

  it('rejects the same player twice on one team', () => {
    const r = parseRosterText('Wookiee\nDanny Han\ndanny han');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/listed twice/);
  });

  it('allows the same player on two different teams', () => {
    const r = parseRosterText('TeamA\nSub Player\n\nTeamB\nSub Player');
    expect(r.ok).toBe(true);
  });

  it('rejects an empty name after Tournament:', () => {
    const r = parseRosterText('Tournament:\n\nTeam\nPlayer');
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/name is empty/);
  });

  it('collects multiple errors in one pass', () => {
    const r = parseRosterText('Tournament:\n\nEmpty Team\n\nDupes\nA\na');
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBe(3);
  });
});

describe('serializeRosterText', () => {
  const tournament = {
    name: 'Stanford Spring 2027',
    rosters: [
      { name: 'Wookiee', players: ['Danny Han', 'Denis Liu', 'Ethan Bosita'] },
      { name: 'Sarlacc', players: ['Alice Chen', 'Bob Park'] },
    ],
  };

  it('emits header, blank-line-separated blocks, trailing newline', () => {
    expect(serializeRosterText(tournament)).toBe(SAMPLE);
  });

  it('round-trips through parseRosterText', () => {
    const r = parseRosterText(serializeRosterText(tournament));
    expect(r.ok).toBe(true);
    expect(r.name).toBe(tournament.name);
    expect(r.rosters).toEqual(tournament.rosters);
  });
});

describe('slugifyName', () => {
  it('kebab-cases and strips punctuation', () => {
    expect(slugifyName('Stanford Spring 2027')).toBe('stanford-spring-2027');
    expect(slugifyName("  Alice & Bob's  Cup!! ")).toBe('alice-bob-s-cup');
  });

  it('falls back when nothing survives', () => {
    expect(slugifyName('***')).toBe('custom-tournament');
    expect(slugifyName('')).toBe('custom-tournament');
  });

  it('always satisfies the registry slug pattern', () => {
    for (const input of ['Stanford Spring 2027', '---x---', 'ÜBER Cüp', '42', '***']) {
      expect(slugifyName(input)).toMatch(/^[a-z0-9][a-z0-9-]*$/);
    }
  });
});
