/**
 * Characters that spreadsheet engines (Excel, LibreOffice, Google Sheets) treat
 * as the start of a formula or external command when a cell value begins with
 * them (CWE-1236, spreadsheet formula injection).
 */
const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r', '\n']);

/**
 * Sanitizes user-supplied text before writing it into a spreadsheet cell.
 *
 * A leading apostrophe forces Excel to treat the value strictly as literal
 * text, so payloads such as `=HYPERLINK(...)` or `=cmd|'/c calc'!A1` can never
 * execute when an HR manager opens the generated report.
 *
 * The check runs against `trimStart()` of the value: spreadsheet imports strip
 * leading whitespace before parsing, so `" =HYPERLINK(...)"` and `"\n=cmd"`
 * would otherwise bypass a naive first-character check. The apostrophe is
 * prepended to the original (untrimmed) text so no content is lost.
 */
export function sanitizeSpreadsheetCell(value: string | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  const trimmed = text.trimStart();
  if (trimmed.length > 0 && FORMULA_TRIGGERS.has(trimmed.charAt(0))) {
    return `'${text}`;
  }
  return text;
}
