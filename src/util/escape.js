// HTML and CSV escaping helpers. Pure string transforms — no DOM, so
// they work in Node (the submission Action imports escapeHtml via
// util/submission.js) as well as the browser. The old DOM-based
// escapeHtml (div.textContent → innerHTML) didn't escape quotes, so
// this is a strict superset: attribute contexts are now safe too.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
