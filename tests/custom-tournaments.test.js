// Storage tests for user-created tournaments.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CUSTOM_TOURNAMENTS_KEY,
  loadCustomTournaments,
  saveCustomTournament,
  deleteCustomTournament,
  generateSlug,
  getCustomTournamentBySlug,
} from '../src/ui/custom-tournaments.js';
import { TOURNAMENTS } from '../src/ui/roster-presets.js';

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
  it('suffixes on collision with a built-in registry slug', () => {
    const builtIn = TOURNAMENTS[0];
    expect(generateSlug(builtIn.name)).not.toBe(builtIn.slug);
    expect(generateSlug(builtIn.name)).toBe(`${builtIn.slug}-2`);
  });

  it('increments among custom entries', () => {
    saveCustomTournament({ ...SAMPLE });
    expect(generateSlug(SAMPLE.name)).toBe('my-invitational-2027-2');
    saveCustomTournament({ ...SAMPLE, slug: 'my-invitational-2027-2' });
    expect(generateSlug(SAMPLE.name)).toBe('my-invitational-2027-3');
  });
});

describe('getCustomTournamentBySlug', () => {
  it('resolves custom entries only — never the built-in registry', () => {
    const saved = saveCustomTournament({ ...SAMPLE });
    expect(getCustomTournamentBySlug(saved.slug).name).toBe(SAMPLE.name);
    expect(getCustomTournamentBySlug(TOURNAMENTS[0].slug)).toBeNull();
    expect(getCustomTournamentBySlug('nope')).toBeNull();
  });
});
