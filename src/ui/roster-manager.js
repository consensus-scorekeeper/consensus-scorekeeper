// "My tournaments" modal — create / edit / delete / export / import custom
// tournament roster sets (see ui/custom-tournaments.js for storage and
// util/roster-text.js for the text format). Modeled on ui/format-pack.js:
// visibility via the 'open' class, backdrop-click + Escape to close, and an
// actions object spread into main.js's ACTION_HANDLERS.
//
// One modal, two views toggled by data-view="list"|"editor" on the card
// (CSS shows/hides the matching <section>). The editor is a single textarea
// holding the full text format — the "Tournament:" header line IS the name
// field, so what you see is exactly what Export writes.

import { escapeHtml } from '../util/escape.js';
import { parseRosterText, serializeRosterText } from '../util/roster-text.js';
import {
  loadCustomTournaments,
  saveCustomTournament,
  deleteCustomTournament,
} from './custom-tournaments.js';
import { refreshTournamentPicker } from './setup.js';

let editingSlug = null;       // null = creating a new tournament
let fileTarget = 'import';    // where the next picked file goes: 'import' | 'editor'

const $ = (id) => document.getElementById(id);

function setStatus(el, message, kind) {
  if (!el) return;
  el.textContent = message;
  el.className = 'format-modal-status' + (kind ? ` ${kind}` : '');
}

function showView(view) {
  const card = $('roster-manager-card');
  if (card) card.dataset.view = view;
}

function renderList() {
  const list = $('roster-manager-list');
  if (!list) return;
  const customs = loadCustomTournaments();
  if (!customs.length) {
    list.innerHTML = '<li class="roster-manager-empty">No custom tournaments yet — create one or import a .txt file.</li>';
    return;
  }
  list.innerHTML = customs.map((t) => {
    const players = t.rosters.reduce((sum, r) => sum + r.players.length, 0);
    return `<li class="roster-manager-row" data-slug="${escapeHtml(t.slug)}">` +
      `<span class="roster-manager-name">${escapeHtml(t.name)}</span>` +
      `<span class="roster-manager-meta">${t.rosters.length} teams · ${players} players</span>` +
      `<span class="roster-manager-row-actions">` +
        `<button type="button" class="btn" data-roster-action="edit">Edit</button>` +
        `<button type="button" class="btn" data-roster-action="export">Export</button>` +
        `<button type="button" class="btn" data-roster-action="delete" title="Delete this tournament">Delete</button>` +
      `</span>` +
    `</li>`;
  }).join('');
}

function openEditor(slug) {
  editingSlug = slug;
  const textarea = $('roster-editor-text');
  if (textarea) {
    const entry = slug ? loadCustomTournaments().find((t) => t.slug === slug) : null;
    textarea.value = entry ? serializeRosterText(entry) : '';
  }
  updateEditorPreview();
  showView('editor');
  setTimeout(() => textarea && textarea.focus(), 0);
}

// Live validation line under the editor: parse errors, or a short summary.
function updateEditorPreview() {
  const textarea = $('roster-editor-text');
  const status = $('roster-editor-status');
  if (!textarea || !status) return;
  if (!textarea.value.trim()) { setStatus(status, ''); return; }
  const parsed = parseRosterText(textarea.value);
  if (!parsed.ok) { setStatus(status, parsed.errors.join(' '), 'error'); return; }
  if (!parsed.name) {
    setStatus(status, 'Add a first line "Tournament: <name>" to name this tournament.', 'error');
    return;
  }
  const players = parsed.rosters.reduce((sum, r) => sum + r.players.length, 0);
  setStatus(status, `${parsed.name} — ${parsed.rosters.length} teams, ${players} players`, 'success');
}

function saveFromEditor() {
  const textarea = $('roster-editor-text');
  const status = $('roster-editor-status');
  const parsed = parseRosterText(textarea ? textarea.value : '');
  if (!parsed.ok) { setStatus(status, parsed.errors.join(' '), 'error'); return; }
  if (!parsed.name) {
    setStatus(status, 'First line must be "Tournament: <name>".', 'error');
    return;
  }
  const saved = saveCustomTournament({
    name: parsed.name,
    slug: editingSlug || undefined,   // undefined → storage assigns a fresh slug
    rosters: parsed.rosters,
  });
  refreshTournamentPicker({ mutatedSlug: saved.slug });
  renderList();
  showView('list');
  setStatus($('roster-list-status'), `Saved "${saved.name}".`, 'success');
}

function exportTournament(slug) {
  const entry = loadCustomTournaments().find((t) => t.slug === slug);
  if (!entry) return;
  const blob = new Blob([serializeRosterText(entry)], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${entry.slug}.rosters.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function removeTournament(slug) {
  const entry = loadCustomTournaments().find((t) => t.slug === slug);
  if (!entry) return;
  if (!confirm(`Delete tournament "${entry.name}" and its rosters? This cannot be undone.`)) return;
  deleteCustomTournament(slug);
  refreshTournamentPicker();
  renderList();
  setStatus($('roster-list-status'), `Deleted "${entry.name}".`, 'success');
}

async function handlePickedFile(file) {
  const text = await file.text();
  if (fileTarget === 'editor') {
    const textarea = $('roster-editor-text');
    if (textarea) textarea.value = text;
    updateEditorPreview();
    return;
  }

  // Import from the list view: parse and save directly.
  const status = $('roster-list-status');
  const parsed = parseRosterText(text);
  if (!parsed.ok) { setStatus(status, parsed.errors.join(' '), 'error'); return; }
  // Headerless files fall back to the filename stem for the name.
  let name = parsed.name || file.name.replace(/\.rosters\.txt$|\.txt$/i, '').trim() || 'Imported tournament';
  let slug;   // undefined → new entry with a fresh slug
  const existing = loadCustomTournaments().find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    if (confirm(`Replace existing tournament "${existing.name}" with this file?`)) {
      slug = existing.slug;
    } else {
      name = `${name} (2)`;
    }
  }
  const saved = saveCustomTournament({ name, slug, rosters: parsed.rosters });
  refreshTournamentPicker({ mutatedSlug: saved.slug });
  renderList();
  setStatus(status, `Imported "${saved.name}".`, 'success');
}

function openRosterManager() {
  const modal = $('roster-manager-modal');
  if (!modal) return;
  setStatus($('roster-list-status'), '');
  renderList();
  showView('list');
  modal.classList.add('open');
}

function closeRosterManager() {
  const modal = $('roster-manager-modal');
  if (modal) modal.classList.remove('open');
}

function pickFile(target) {
  fileTarget = target;
  const input = $('roster-file-input');
  if (input) input.click();
}

export function setupRosterManager() {
  const modal = $('roster-manager-modal');
  if (!modal) return;

  modal.addEventListener('click', (e) => { if (e.target === modal) closeRosterManager(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeRosterManager();
  });

  // Rows are re-rendered via innerHTML, so per-row buttons go through one
  // delegated listener on the list container (same convention as rosters).
  const list = $('roster-manager-list');
  if (list) {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-roster-action]');
      if (!btn) return;
      const slug = btn.closest('li[data-slug]')?.dataset.slug;
      if (!slug) return;
      if (btn.dataset.rosterAction === 'edit') openEditor(slug);
      else if (btn.dataset.rosterAction === 'export') exportTournament(slug);
      else if (btn.dataset.rosterAction === 'delete') removeTournament(slug);
    });
  }

  const fileInput = $('roster-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';   // allow re-picking the same file
      if (file) await handlePickedFile(file);
    });
  }

  const textarea = $('roster-editor-text');
  if (textarea) textarea.addEventListener('input', updateEditorPreview);
}

export const rosterManagerActions = {
  'open-roster-manager': () => openRosterManager(),
  'close-roster-manager': () => closeRosterManager(),
  'new-custom-tournament': () => openEditor(null),
  'save-custom-tournament': () => saveFromEditor(),
  'cancel-roster-editor': () => showView('list'),
  'import-roster-file': () => pickFile('import'),
  'load-roster-file': () => pickFile('editor'),
};
