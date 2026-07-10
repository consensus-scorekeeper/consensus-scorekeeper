// Integration tests for custom tournaments in the setup screen: the
// Tournament Mode picker, delete/edit fallbacks, and the roster-manager
// modal (wired through main.js's real data-action dispatcher).

import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/main.js';
import { getRosterMode, toggleRosterMode, refreshTournamentPicker } from '../src/ui/setup.js';
import {
  CUSTOM_TOURNAMENTS_KEY,
  loadCustomTournaments,
  saveCustomTournament,
  deleteCustomTournament,
} from '../src/ui/custom-tournaments.js';
import { resetState } from './helpers.js';

function ensurePresetMode() {
  if (getRosterMode() !== 'preset') toggleRosterMode();
}

const CUSTOM = {
  name: 'Test Cup 2027',
  rosters: [
    { name: 'Zeta', players: ['P One', 'P Two'] },
    { name: 'Eta', players: ['Q One'] },
  ],
};

function pickerSel() { return document.getElementById('roster-tournament-select'); }
function pickTournament(slug) {
  const sel = pickerSel();
  sel.value = slug;
  sel.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  localStorage.removeItem(CUSTOM_TOURNAMENTS_KEY);
  resetState();
  ensurePresetMode();
  refreshTournamentPicker();
});

describe('Tournament Mode picker (customs only)', () => {
  it('starts empty and disabled until a tournament exists', () => {
    const sel = pickerSel();
    expect(sel.disabled).toBe(true);
    expect(sel.options).toHaveLength(1);
    expect(sel.options[0].textContent).toMatch(/Manage/);
    // The team-name select carries only its placeholder.
    const teamSel = document.getElementById('team-a-name');
    expect(Array.from(teamSel.options).map((o) => o.value)).toEqual(['']);
  });

  it('lists a saved tournament (and never the built-in registry) and applies its rosters', () => {
    const saved = saveCustomTournament({ ...CUSTOM });
    refreshTournamentPicker();

    const sel = pickerSel();
    expect(sel.disabled).toBe(false);
    expect(Array.from(sel.options).map((o) => o.value)).toEqual([saved.slug]);
    expect(sel.querySelector('optgroup')).toBeNull();

    pickTournament(saved.slug);
    const teamSel = document.getElementById('team-a-name');
    expect(Array.from(teamSel.options).map((o) => o.value)).toContain('Zeta');

    teamSel.value = 'Zeta';
    teamSel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(state.teamA.name).toBe('Zeta');
    expect(state.teamA.players.map((p) => p.name)).toEqual(['P One', 'P Two']);
  });

  it('scopes the add-player autocomplete to the selected tournament', () => {
    saveCustomTournament({ ...CUSTOM });
    const other = saveCustomTournament({
      name: 'Other Cup',
      rosters: [{ name: 'Theta', players: ['R One'] }],
    });
    refreshTournamentPicker();

    const dl = document.getElementById('player-suggestions');
    pickTournament(other.slug);
    expect(dl.innerHTML).toContain('R One');
    expect(dl.innerHTML).not.toContain('P One');

    pickTournament(loadCustomTournaments()[0].slug);
    expect(dl.innerHTML).toContain('P One');
    expect(dl.innerHTML).not.toContain('R One');
  });

  it('deleting the selected tournament falls back to the first remaining one and clears teams', () => {
    const first = saveCustomTournament({ ...CUSTOM });
    const second = saveCustomTournament({
      name: 'Other Cup',
      rosters: [{ name: 'Theta', players: ['R One'] }],
    });
    refreshTournamentPicker();
    pickTournament(second.slug);
    const teamSel = document.getElementById('team-a-name');
    teamSel.value = 'Theta';
    teamSel.dispatchEvent(new Event('change', { bubbles: true }));

    deleteCustomTournament(second.slug);
    refreshTournamentPicker();

    expect(pickerSel().value).toBe(first.slug);
    expect(state.teamA.name).toBe('');
    expect(state.teamA.players).toEqual([]);
    expect(Array.from(document.getElementById('team-a-name').options).map((o) => o.value))
      .not.toContain('Theta');
  });

  it('deleting the last tournament empties the picker and the team dropdowns', () => {
    const saved = saveCustomTournament({ ...CUSTOM });
    refreshTournamentPicker();
    pickTournament(saved.slug);

    deleteCustomTournament(saved.slug);
    refreshTournamentPicker();

    expect(pickerSel().disabled).toBe(true);
    expect(Array.from(document.getElementById('team-a-name').options).map((o) => o.value)).toEqual(['']);
    expect(state.teamA.players).toEqual([]);
  });

  it('editing the selected tournament repopulates the team dropdowns', () => {
    const saved = saveCustomTournament({
      name: CUSTOM.name,
      rosters: [{ name: 'Zeta', players: ['P One'] }],
    });
    refreshTournamentPicker();
    pickTournament(saved.slug);
    let opts = Array.from(document.getElementById('team-a-name').options).map((o) => o.value);
    expect(opts).not.toContain('Eta');

    saveCustomTournament({ ...saved, rosters: CUSTOM.rosters });
    refreshTournamentPicker({ mutatedSlug: saved.slug });

    opts = Array.from(document.getElementById('team-a-name').options).map((o) => o.value);
    expect(opts).toContain('Eta');
  });
});

describe('roster-manager modal (via the real data-action dispatcher)', () => {
  const modal = () => document.getElementById('roster-manager-modal');
  const click = (action) =>
    document.querySelector(`[data-action="${action}"]`).click();

  it('opens on the list view and closes', () => {
    click('open-roster-manager');
    expect(modal().classList.contains('open')).toBe(true);
    expect(document.getElementById('roster-manager-card').dataset.view).toBe('list');
    click('close-roster-manager');
    expect(modal().classList.contains('open')).toBe(false);
  });

  it('creates a tournament from the editor and returns to the list', () => {
    click('open-roster-manager');
    click('new-custom-tournament');
    expect(document.getElementById('roster-manager-card').dataset.view).toBe('editor');

    document.getElementById('roster-editor-text').value =
      'Tournament: Editor Cup\n\nAlpha\nAda A\nBen B\n\nBeta\nCy C';
    click('save-custom-tournament');

    const customs = loadCustomTournaments();
    expect(customs.length).toBe(1);
    expect(customs[0].name).toBe('Editor Cup');
    expect(customs[0].rosters.length).toBe(2);
    expect(document.getElementById('roster-manager-card').dataset.view).toBe('list');
    expect(Array.from(pickerSel().options).map((o) => o.value)).toContain(customs[0].slug);
    expect(document.getElementById('roster-manager-list').textContent).toContain('Editor Cup');
  });

  it('rejects a save with parse errors and stays on the editor', () => {
    click('open-roster-manager');
    click('new-custom-tournament');
    document.getElementById('roster-editor-text').value = 'Lonely Team';
    click('save-custom-tournament');

    expect(loadCustomTournaments()).toEqual([]);
    expect(document.getElementById('roster-manager-card').dataset.view).toBe('editor');
    expect(document.getElementById('roster-editor-status').textContent).toMatch(/no players/);
  });
});
