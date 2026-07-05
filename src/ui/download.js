// Trigger a browser download of in-memory text. The content itself comes
// from pure builders (util/csv.js, util/roster-text.js); this owns the
// Blob + anchor-click dance the browser needs to actually save a file.

export function downloadTextFile(filename, text, mime = 'text/plain;charset=utf-8;') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
