const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text für die Ausgabe in HTML maskieren (Ortsnamen kommen aus fremden APIs). */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
