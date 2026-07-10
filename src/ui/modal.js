// Shared plumbing for setup-screen modals (currently the roster manager).
// Markup conventions: visibility via the 'open' class on the backdrop
// element and a status line styled by .format-modal-status.

export function setStatus(el, message, kind) {
  if (!el) return;
  el.textContent = message;
  el.className = 'format-modal-status' + (kind ? ` ${kind}` : '');
}

// Backdrop click closes; clicks inside the card don't bubble out. Escape
// closes only while the modal is open.
export function wireModalDismiss(modal, close) {
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });
}
