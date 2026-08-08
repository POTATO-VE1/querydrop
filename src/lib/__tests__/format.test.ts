import { describe, it, expect } from 'vitest';
import { formatBytes, formatSQL } from '../format';

describe('formatBytes', () => {
  it('formats bytes correctly across tiers', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1500)).toBe('1.5 KB');
    expect(formatBytes(1500000)).toBe('1.4 MB');
    expect(formatBytes(1500000000)).toBe('1.40 GB');
  });
});

describe('formatSQL', () => {
  it('capitalizes SQL keywords and wraps them correctly', () => {
    const raw = 'select id, name, value from sales where id = 1;';
    const expected = 'SELECT\n  id,\n  name,\n  value\nFROM sales\nWHERE id = 1;\n';
    expect(formatSQL(raw)).toBe(expected);
  });

  it('keeps function arguments on the same line', () => {
    const raw = 'select round(value, 2), coalesce(name, \'N/A\') from sales;';
    const expected = 'SELECT\n  round( value, 2 ),\n  coalesce( name, \'N/A\' )\nFROM sales;\n';
    expect(formatSQL(raw)).toBe(expected);
  });

  it('handles double-quoted identifiers and single-quoted strings', () => {
    const raw = 'select "first name", \'string with SELECT inside\' from "my table";';
    const expected = 'SELECT\n  "first name",\n  \'string with SELECT inside\'\nFROM "my table";\n';
    expect(formatSQL(raw)).toBe(expected);
  });

  it('preserves SQL comments', () => {
    const raw = '-- test comment\nselect 1; /* block comment */';
    const expected = '-- test comment\n\nSELECT\n  1;\n\n/* block comment */\n';
    expect(formatSQL(raw)).toBe(expected);
  });
});
