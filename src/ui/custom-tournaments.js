// User-created tournaments-with-rosters, persisted in localStorage and
// merged with the built-in TOURNAMENTS registry at read time. Only the
// scorekeeper's preset picker sees the merged list — the public stats hub
// and per-tournament stats pages import the built-in registry directly and
// never show custom entries (they have no results/ folder to publish).
//
// Stored shape mirrors a registry entry plus a `custom: true` flag:
//   [{ name, slug, custom: true, rosters: [{ name, players: [string] }] }]
//
// Like game/persistence.js this touches localStorage but never `document`,
// so stats-main.js could import it safely if ever needed.

import { TOURNAMENTS } from './roster-presets.js';
import { slugifyName } from '../util/roster-text.js';

export const CUSTOM_TOURNAMENTS_KEY = 'consensus-custom-tournaments-v1';

function isValidEntry(t) {
  return t && typeof t.name === 'string' && t.name
    && typeof t.slug === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(t.slug)
    && Array.isArray(t.rosters) && t.rosters.length > 0
    && t.rosters.every((r) =>
      r && typeof r.name === 'string' && r.name
      && Array.isArray(r.players) && r.players.length > 0
      && r.players.every((p) => typeof p === 'string' && p));
}

export function loadCustomTournaments() {
  try {
    const raw = localStorage.getItem(CUSTOM_TOURNAMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).map((t) => ({ ...t, custom: true }));
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    localStorage.setItem(CUSTOM_TOURNAMENTS_KEY, JSON.stringify(list));
  } catch { /* storage full/blocked — keep the session working in memory-less mode */ }
}

// Upsert by slug; assigns a fresh collision-free slug when absent.
export function saveCustomTournament(tournament) {
  const list = loadCustomTournaments();
  const entry = { ...tournament, custom: true };
  if (!entry.slug) entry.slug = generateSlug(entry.name);
  const idx = list.findIndex((t) => t.slug === entry.slug);
  if (idx === -1) list.push(entry);
  else list[idx] = entry;
  persist(list);
  return entry;
}

export function deleteCustomTournament(slug) {
  persist(loadCustomTournaments().filter((t) => t.slug !== slug));
}

// slugifyName + -2/-3… suffix until it collides with neither a built-in nor
// another custom entry. Never shadows a built-in: the slug is the identity
// behind consensus-tournament-slug-v1 and export filenames.
export function generateSlug(name) {
  const taken = new Set([...TOURNAMENTS, ...loadCustomTournaments()].map((t) => t.slug));
  const base = slugifyName(name);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

export function getAllTournaments() {
  return [...TOURNAMENTS, ...loadCustomTournaments()];
}

export function getAnyTournamentBySlug(slug) {
  return getAllTournaments().find((t) => t.slug === slug) || null;
}
