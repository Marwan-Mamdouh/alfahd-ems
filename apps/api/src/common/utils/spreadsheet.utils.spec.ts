import { describe, it, expect } from 'vitest';
import { sanitizeSpreadsheetCell } from './spreadsheet.utils.js';

describe('sanitizeSpreadsheetCell', () => {
  it.each(['=', '+', '-', '@'])(
    'prefixes an apostrophe when the value starts with %j',
    (trigger) => {
      expect(sanitizeSpreadsheetCell(`${trigger}cmd|'/c calc'!A1`)).toBe(
        `'${trigger}cmd|'/c calc'!A1`,
      );
    },
  );

  it.each(['\t', '\r', '\n'])(
    'prefixes an apostrophe when whitespace %j hides a formula trigger',
    (ws) => {
      expect(sanitizeSpreadsheetCell(`${ws}=cmd|'/c calc'!A1`)).toBe(`'${ws}=cmd|'/c calc'!A1`);
    },
  );

  it('neutralizes a classic HYPERLINK formula payload', () => {
    const payload = '=HYPERLINK("http://evil.example","click")';
    expect(sanitizeSpreadsheetCell(payload)).toBe(`'${payload}`);
    expect(sanitizeSpreadsheetCell(payload).startsWith('=')).toBe(false);
  });

  it('neutralizes formula triggers hidden behind leading whitespace (SEC-11)', () => {
    // Spreadsheet imports strip leading whitespace before parsing, so these
    // would execute if only text.charAt(0) were inspected.
    expect(sanitizeSpreadsheetCell(' =HYPERLINK("http://evil.example","x")')).toBe(
      '\' =HYPERLINK("http://evil.example","x")',
    );
    expect(sanitizeSpreadsheetCell('\n+cmd')).toBe("'\n+cmd");
    expect(sanitizeSpreadsheetCell('   +1+1')).toBe("'   +1+1");
    expect(sanitizeSpreadsheetCell('\t=1+1')).toBe("'\t=1+1");
  });

  it('treats a solitary dash as a formula trigger', () => {
    expect(sanitizeSpreadsheetCell('-')).toBe(`'-`);
  });

  it('leaves whitespace-only values untouched', () => {
    expect(sanitizeSpreadsheetCell('   ')).toBe('   ');
    expect(sanitizeSpreadsheetCell('\n')).toBe('\n');
  });

  it('returns plain text untouched', () => {
    expect(sanitizeSpreadsheetCell('Ahmed Mostafa')).toBe('Ahmed Mostafa');
    expect(sanitizeSpreadsheetCell('Device GPS glitch at entrance')).toBe(
      'Device GPS glitch at entrance',
    );
  });

  it('returns an empty string for null/undefined', () => {
    expect(sanitizeSpreadsheetCell(null)).toBe('');
    expect(sanitizeSpreadsheetCell(undefined)).toBe('');
  });
});
