import { describe, it, expect } from 'vitest';
import { escapeHtml } from './html.utils.js';

describe('escapeHtml', () => {
  it('escapes all five HTML metacharacters', () => {
    expect(escapeHtml(`& < > " '`)).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('neutralizes a script/img payload in a name field', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes quotes so attributes cannot be broken out of', () => {
    expect(escapeHtml('" onmouseover="steal()')).toBe('&quot; onmouseover=&quot;steal()');
  });

  it('keeps plain names readable', () => {
    expect(escapeHtml('Ahmed Mostafa')).toBe('Ahmed Mostafa');
  });

  it('escapes ampersands first so entities are not double-escaped', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
