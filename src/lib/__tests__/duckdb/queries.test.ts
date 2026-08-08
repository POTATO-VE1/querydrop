/**
 * Query helpers — sqlForFile generation, categorizeType, generatePivotSQL.
 * runQuery is tested with a real DuckDB-WASM instance (E2E) — not here.
 */
import { describe, it, expect } from 'vitest';
import { sqlForFile, categorizeType, generatePivotSQL } from '../../duckdb/queries';

describe('sqlForFile', () => {
  it('emits read_csv_auto for csv', () => {
    expect(sqlForFile('foo.csv', 'csv')).toBe("SELECT * FROM read_csv_auto('foo.csv')");
  });

  it('emits read_csv_auto with delim=tab for tsv', () => {
    expect(sqlForFile('foo.tsv', 'tsv')).toBe("SELECT * FROM read_csv_auto('foo.tsv', delim='\\t')");
  });

  it('emits read_json_auto for json', () => {
    expect(sqlForFile('foo.json', 'json')).toBe("SELECT * FROM read_json_auto('foo.json')");
  });

  it('emits read_json_auto newline_delimited for ndjson', () => {
    expect(sqlForFile('foo.ndjson', 'ndjson')).toBe(
      "SELECT * FROM read_json_auto('foo.ndjson', format='newline_delimited')",
    );
  });

  it('emits read_parquet for parquet', () => {
    expect(sqlForFile('foo.parquet', 'parquet')).toBe("SELECT * FROM read_parquet('foo.parquet')");
  });

  it('throws for formats that need pre-conversion', () => {
    expect(() => sqlForFile('foo.xlsx', 'excel')).toThrow(/Cannot generate SQL for format/);
    expect(() => sqlForFile('foo.arrow', 'arrow')).toThrow();
    expect(() => sqlForFile('foo.geojson', 'geojson')).toThrow();
    expect(() => sqlForFile('foo.feather', 'feather')).toThrow();
  });
});

describe('categorizeType', () => {
  it('maps integer types', () => {
    for (const t of ['TINYINT', 'SMALLINT', 'INTEGER', 'BIGINT', 'HUGEINT', 'UTINYINT', 'USMALLINT', 'UINTEGER', 'UBIGINT']) {
      expect(categorizeType(t)).toBe('integer');
    }
  });

  it('maps number types', () => {
    for (const t of ['REAL', 'DOUBLE', 'FLOAT', 'DECIMAL', 'NUMERIC']) {
      expect(categorizeType(t)).toBe('number');
    }
  });

  it('maps text types', () => {
    for (const t of ['VARCHAR', 'TEXT', 'STRING', 'BPCHAR', 'CHAR']) {
      expect(categorizeType(t)).toBe('text');
    }
  });

  it('maps boolean types', () => {
    expect(categorizeType('BOOLEAN')).toBe('boolean');
    expect(categorizeType('BOOL')).toBe('boolean');
  });

  it('maps date/time types', () => {
    expect(categorizeType('DATE')).toBe('date');
    expect(categorizeType('TIMESTAMP')).toBe('datetime');
    expect(categorizeType('TIMESTAMP WITH TIME ZONE')).toBe('datetime');
    expect(categorizeType('TIME')).toBe('time');
  });

  it('maps complex types', () => {
    for (const t of ['JSON', 'STRUCT', 'LIST', 'MAP', 'ARRAY', 'UNION']) {
      expect(categorizeType(t)).toBe('complex');
    }
  });

  it('maps blob/uuid/null', () => {
    expect(categorizeType('BLOB')).toBe('blob');
    expect(categorizeType('UUID')).toBe('uuid');
    expect(categorizeType('NULL')).toBe('null');
  });

  it('returns "other" for unknown', () => {
    expect(categorizeType('GEOMETRY')).toBe('other');
    expect(categorizeType('')).toBe('other');
  });

  it('is case-insensitive', () => {
    expect(categorizeType('bigint')).toBe('integer');
    expect(categorizeType('VarChar')).toBe('text');
  });

  it('handles parameterized types and type modifiers', () => {
    expect(categorizeType('DECIMAL(10,2)')).toBe('number');
    expect(categorizeType('VARCHAR(255)')).toBe('text');
    expect(categorizeType('TIMESTAMP(6) WITH TIME ZONE')).toBe('datetime');
  });

  it('handles array and bracketed types', () => {
    expect(categorizeType('INTEGER[]')).toBe('complex');
    expect(categorizeType('VARCHAR(255)[]')).toBe('complex');
  });
});

describe('generatePivotSQL', () => {
  it('generates a PIVOT statement with quoted identifiers', () => {
    const sql = generatePivotSQL('t', {
      rowColumn: 'region',
      colColumn: 'product',
      valueColumn: 'sales',
      aggregation: 'SUM',
      maxCols: 10,
    });
    expect(sql).toMatch(/SELECT \* FROM "t" PIVOT \(SUM\("sales"\) FOR "product" IN \(/);
    expect(sql).toContain('SELECT "product" FROM "t" GROUP BY "product" ORDER BY COUNT(*) DESC LIMIT 10');
  });

  it('uses default maxCols=20 when not specified', () => {
    const sql = generatePivotSQL('t', {
      rowColumn: 'a',
      colColumn: 'b',
      valueColumn: 'c',
      aggregation: 'COUNT',
    });
    expect(sql).toContain('LIMIT 20');
  });

  it('quotes identifiers with spaces and reserved words', () => {
    const sql = generatePivotSQL('my table', {
      rowColumn: 'order-date',
      colColumn: 'select',
      valueColumn: 'value',
      aggregation: 'AVG',
    });
    expect(sql).toContain('FROM "my table" PIVOT');
    expect(sql).toContain('AVG("value") FOR "select"');
  });
});
