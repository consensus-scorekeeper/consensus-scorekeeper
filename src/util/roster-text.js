// Parse/serialize the plain-text roster format used by the roster manager
// (create/upload/export of custom tournaments). Pure string logic — no DOM,
// no storage — so it stays unit-testable like the rest of util/.
//
// Format:
//   Tournament: <name>     <- optional header, first non-blank line only
//                             ("Tournament:" matched case-insensitively)
//   <blank line>
//   Team Name              <- first line of a block
//   Player One             <- every following non-blank line is a player
//   Player Two
//   <blank line(s)>        <- one or more blank lines separate team blocks
//   Next Team
//   ...
//
// serializeRosterText always emits the header, one blank line between
// blocks, and a trailing newline; parseRosterText(serializeRosterText(t))
// round-trips exactly.

export function parseRosterText(text) {
  const lines = String(text ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  const errors = [];
  let name = null;

  // Optional "Tournament: <name>" header — only honored as the first
  // non-blank line, so a team can still legally be named "Tournament: X"
  // further down (nobody should, but the rule stays unambiguous).
  let start = 0;
  while (start < lines.length && !lines[start]) start++;
  const headerMatch = start < lines.length && lines[start].match(/^tournament:\s*(.*)$/i);
  if (headerMatch) {
    name = headerMatch[1].trim();
    if (!name) {
      errors.push('Tournament name is empty — put a name after "Tournament:".');
      name = null;
    }
    start++;
  }

  // Split the rest into blank-line-separated blocks.
  const rosters = [];
  let block = [];
  const flushBlock = () => {
    if (!block.length) return;
    const [teamName, ...players] = block;
    if (!players.length) {
      errors.push(`Team "${teamName}" has no players.`);
    } else {
      const seen = new Set();
      for (const p of players) {
        const key = p.toLowerCase();
        if (seen.has(key)) errors.push(`Player "${p}" is listed twice on team "${teamName}".`);
        seen.add(key);
      }
      rosters.push({ name: teamName, players });
    }
    block = [];
  };
  for (let i = start; i < lines.length; i++) {
    if (lines[i]) block.push(lines[i]);
    else flushBlock();
  }
  flushBlock();

  if (!rosters.length && !errors.length) {
    errors.push('No teams found — each team is a block of lines: team name first, then one player per line.');
  }

  const teamSeen = new Set();
  for (const r of rosters) {
    const key = r.name.toLowerCase();
    if (teamSeen.has(key)) errors.push(`Duplicate team name "${r.name}".`);
    teamSeen.add(key);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, name, rosters };
}

export function serializeRosterText({ name, rosters }) {
  const blocks = rosters.map((r) => [r.name, ...r.players].join('\n'));
  return `Tournament: ${name}\n\n${blocks.join('\n\n')}\n`;
}

// Kebab-case a tournament name into the registry's slug alphabet
// (/^[a-z0-9][a-z0-9-]*$/). Collision handling lives in the caller
// (custom-tournaments.js), which knows every existing slug.
export function slugifyName(name) {
  const slug = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'custom-tournament';
}
