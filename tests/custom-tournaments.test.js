// Storage + merged-registry tests for user-created tournaments.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CUSTOM_TOURNAMENTS_KEY,
  loadCustomTournaments,
  saveCustomTournament,
  deleteCustomTournament,
  generateSlug,
  getAllTournaments,
  getAnyTournamentBySlug,
} from '../src/ui/custom-tournaments.js';
import { TOURNAMENTS, DEFAULT_TOURNAMENT } from '../src/ui/roster-presets.js';

const SAMPLE = {
  name: 'My Invitational 2027',
  rosters: [
    { name: 'Alpha', players: ['Alice Aa', 'Bob Bb'] },
    { name: 'Beta', players: ['Carol Cc'] },
  ],
};

beforeEach(() => {
  localStorage.removeItem(CUSTOM_TOURNAMENTS_KEY);
});

describe('CRUD', () => {
  it('save assigns a slug and load round-trips', () => {
    const saved = saveCustomTournament({ ...SAMPLE });
    expect(saved.slug).toBe('my-invitational-2027');
    expect(saved.custom).toBe(true);
    expect(loadCustomTournaments()).toEqual([saved]);
  });

  it('rename keeps the slug stable (upsert by slug)', () => {
    const saved = saveCustomTournament({ ...SAMPLE });
    const renamed = saveCustomTournament({ ...saved, name: 'Renamed Cup' });
    expect(renamed.slug).toBe(saved.slug);
    const list = loadCustomTournaments();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Renamed Cup');
  });

  it('delete removes only the matching slug', () => {
    const a = saveCustomTournament({ ...SAMPLE });
    const b = saveCustomTournament({ ...SAMPLE, name: 'Other Cup' });
    deleteCustomTournament(a.slug);
    expect(loadCustomTournaments().map((t) => t.slug)).toEqual([b.slug]);
  });
});

describe('corrupt storage', () => {
  it('returns [] on invalid JSON', () => {
    localStorage.setItem(CUSTOM_TOURNAMENTS_KEY, '{not json');
    expect(loadCustomTournaments()).toEqual([]);
  });

  it('returns [] on non-array JSON and drops shape-invalid entries', () => {
    localStorage.setItem(CUSTOM_TOURNAMENTS_KEY, '{"a":1}');
    expect(loadCustomTournaments()).toEqual([]);
    const good = { name: 'Good', slug: 'good', rosters: [{ name: 'T', players: ['P'] }] };
    localStorage.setItem(CUSTOM_TOURNAMENTS_KEY, JSON.stringify([
      good,
      { name: 'No rosters', slug: 'bad-1', rosters: [] },
      { name: 'Empty team', slug: 'bad-2', rosters: [{ name: 'T', players: [] }] },
      { name: 'Bad slug', slug: 'Bad Slug!', rosters: [{ name: 'T', players: ['P'] }] },
      'not-an-object',
    ]));
    expect(loadCustomTournaments().map((t) => t.slug)).toEqual(['good']);
  });
});

describe('generateSlug', () => {
  it('suffixes on collision with a built-in slug', () => {
    expect(generateSlug(DEFAULT_TOURNAMENT.name)).not.toBe(DEFAULT_TOURNAMENT.slug);
    expect(generateSlug(DEFAULT_TOURNAMENT.name)).toBe(`${DEFAULT_TOURNAMENT.slug}-2`);
  });

  it('increments among custom entries', () => {
    saveCustomTournament({ ...SAMPLE });
    expect(generateSlug(SAMPLE.name)).toBe('my-invitational-2027-2');
    saveCustomTournament({ ...SAMPLE, slug: 'my-invitational-2027-2' });
    expect(generateSlug(SAMPLE.name)).toBe('my-invitational-2027-3');
  });
});

describe('merged registry', () => {
  it('getAllTournaments lists built-ins first and every entry passes registry invariants', () => {
    saveCustomTournament({ ...SAMPLE });
    const all = getAllTournaments();
    expect(all.slice(0, TOURNAMENTS.length)).toEqual(TOURNAMENTS);
    for (const t of all) {
      expect(t.name).toBeTruthy();
      expect(t.slug).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(Array.isArray(t.rosters)).toBe(true);
      for (const r of t.rosters) {
        expect(r.name).toBeTruthy();
        expect(r.players.length).toBeGreaterThan(0);
      }
    }
    expect(new Set(all.map((t) => t.slug)).size).toBe(all.length);
  });

  it('getAnyTournamentBySlug resolves built-ins and customs, null otherwise', () => {
    const saved = saveCustomTournament({ ...SAMPLE });
    expect(getAnyTournamentBySlug(DEFAULT_TOURNAMENT.slug)).toBe(getAllTournaments()[0]);
    expect(getAnyTournamentBySlug(saved.slug).name).toBe(SAMPLE.name);
    expect(getAnyTournamentBySlug('nope')).toBeNull();
  });
});
