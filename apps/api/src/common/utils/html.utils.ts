/**
 * Escapes the five HTML metacharacters into entities so untrusted text (e.g.
 * an employee name supplied at registration) can be interpolated into an HTML
 * email template without allowing HTML injection or script payloads.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
