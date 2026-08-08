/**
 * Export helpers — CSV/JSON/NDJSON/Markdown/HTML/SQL serialization.
 * Must:
 *  - follow RFC 4180 for CSV (quote fields with , " \n \r, double internal quotes)
 *  - handle null/undefined as empty in text formats
 *  - serialize NaN/Infinity as NULL in SQL
 *  - properly escape SQL string literals
 */
import { describe, it, expect } from 'vitest';
import {
  serializeCSV,
  serializeJSON,
  serializeNDJSON,
  serializeMarkdown,
  serializeHTML,
  serializeSQL,
  estimateParquetBytes,
  estimateExcelBytes,
  estimateSQLiteBytes,
} from '../export';
import type { QueryResult } from '../duckdb/types';

const sample: QueryResult = {
  columns: ['id', 'name', 'active'],
  columnTypes: ['INTEGER', 'VARCHAR', 'BOOLEAN'],
  rows: [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob, Jr.', active: false },
    { id: 3, name: 'Carol "C"', active: true },
    { id: 4, name: 'Dave\nNewline', active: null },
  ],
  rowCount: 4,
  durationMs: 12,
  bytesScanned: null,
};

describe('serializeCSV', () => {
  it('produces RFC 4180 output with CRLF line endings', () => {
    const out = serializeCSV(sample);
    expect(out.endsWith('\r\n')).toBe(true);
    expect(out).toContain('id,name,active\r\n');
  });

  it('quotes fields containing comma', () => {
    const out = serializeCSV(sample);
    expect(out).toContain('"Bob, Jr."');
  });

  it('escapes internal double-quotes by doubling them', () => {
    const out = serializeCSV(sample);
    expect(out).toContain('"Carol ""C"""');
  });

  it('quotes fields containing newlines', () => {
    const out = serializeCSV(sample);
    expect(out).toContain('"Dave\nNewline"');
  });

  it('emits empty string for null/undefined values', () => {
    const nullish: QueryResult = { ...sample, rows: [{ id: 1, name: null, active: undefined }] };
    const out = serializeCSV(nullish);
    const lines = out.split('\r\n');
    expect(lines[1]).toBe('1,,'); // empty name, empty active
  });

  it('handles empty result set', () => {
    const empty: QueryResult = { ...sample, rows: [] };
    const out = serializeCSV(empty);
    expect(out).toBe('id,name,active\r\n');
  });
});

describe('serializeJSON', () => {
  it('wraps rows in an envelope with metadata', () => {
    const out = serializeJSON(sample, 50);
    const parsed = JSON.parse(out);
    expect(parsed.columns).toEqual(['id', 'name', 'active']);
    expect(parsed.columnTypes).toEqual(['INTEGER', 'VARCHAR', 'BOOLEAN']);
    expect(parsed.rowCount).toBe(4);
    expect(parsed.durationMs).toBe(50);
    expect(parsed.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.rows).toHaveLength(4);
  });
});

describe('serializeNDJSON', () => {
  it('emits one JSON object per line', () => {
    const out = serializeNDJSON(sample);
    const lines = out.trim().split('\n');
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('emits empty string for empty result set', () => {
    const out = serializeNDJSON({ ...sample, rows: [] });
    expect(out).toBe('');
  });
});

describe('serializeMarkdown', () => {
  it('produces a markdown table with header and divider', () => {
    const out = serializeMarkdown(sample);
    const lines = out.split('\n');
    expect(lines[0]).toBe('| id | name | active |');
    expect(lines[1]).toBe('| --- | --- | --- |');
  });

  it('escapes pipe characters in cells', () => {
    const r: QueryResult = { ...sample, rows: [{ id: 1, name: 'a|b', active: true }] };
    expect(serializeMarkdown(r)).toContain('a\\|b');
  });
});

describe('serializeHTML', () => {
  it('produces a complete HTML document with table', () => {
    const out = serializeHTML(sample);
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<table>');
    expect(out).toContain('<th>id</th>');
    expect(out).toContain('<td>Alice</td>');
  });

  it('escapes HTML entities', () => {
    const r: QueryResult = { ...sample, rows: [{ id: 1, name: '<script>', active: true }] };
    const out = serializeHTML(r);
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>');
  });
});

describe('serializeSQL', () => {
  it('emits CREATE TABLE + INSERT statements', () => {
    const out = serializeSQL(sample);
    expect(out).toContain('CREATE TABLE "result" (');
    expect(out).toContain('INSERT INTO "result" VALUES');
  });

  it('serializes NaN and Infinity as NULL (not a number that breaks SQL)', () => {
    const r: QueryResult = {
      ...sample,
      rows: [
        { id: 1, name: 'a', active: NaN as unknown as boolean },
        { id: 2, name: 'b', active: Infinity as unknown as boolean },
      ],
    };
    const out = serializeSQL(r);
    expect(out).toContain('INSERT INTO "result" VALUES (1, \'a\', NULL);');
    expect(out).toContain('INSERT INTO "result" VALUES (2, \'b\', NULL);');
  });

  it('escapes single quotes by doubling them', () => {
    const r: QueryResult = { ...sample, rows: [{ id: 1, name: "O'Brien", active: true }] };
    const out = serializeSQL(r);
    expect(out).toContain("'O''Brien'");
  });

  it('serializes booleans as TRUE/FALSE', () => {
    const out = serializeSQL(sample);
    expect(out).toContain('TRUE');
    expect(out).toContain('FALSE');
  });

  it('serializes null as the SQL keyword NULL', () => {
    const r: QueryResult = { ...sample, rows: [{ id: 1, name: null, active: null }] };
    const out = serializeSQL(r);
    expect(out).toContain('NULL, NULL');
  });

  it('sanitizes unsafe table name', () => {
    const out = serializeSQL(sample, 'bad name!');
    expect(out).toContain('CREATE TABLE "bad_name_" (');
  });
});

describe('byte estimators', () => {
  it('estimateParquetBytes scales with cells', () => {
    expect(estimateParquetBytes({ ...sample, rowCount: 1000 })).toBeGreaterThan(
      estimateParquetBytes({ ...sample, rowCount: 1 }),
    );
  });

  it('estimateExcelBytes scales with cells', () => {
    expect(estimateExcelBytes({ ...sample, rowCount: 1000 })).toBeGreaterThan(
      estimateExcelBytes({ ...sample, rowCount: 1 }),
    );
  });

  it('estimateSQLiteBytes scales with cells', () => {
    expect(estimateSQLiteBytes({ ...sample, rowCount: 1000 })).toBeGreaterThan(
      estimateSQLiteBytes({ ...sample, rowCount: 1 }),
    );
  });
});
