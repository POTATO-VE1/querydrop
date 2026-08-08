/**
 * splitStatements — split a SQL string into individual statements.
 * Critical edge cases:
 *  - semicolons inside string literals
 *  - '' escape inside single-quoted strings
 *  - -- line comments
 *  - /* block comments *​/
 *  - $$ dollar-quoted strings (DuckDB/PG)
 *  - $tag$...$tag$ tagged dollar strings
 *  - empty / whitespace-only input
 *  - trailing semicolon (no trailing empty stmt)
 *  - leading semicolons / multiple semicolons
 */
import { describe, it, expect } from 'vitest';
import { splitStatements } from '../../duckdb/split';

describe('splitStatements', () => {
  it('returns empty array for empty input', () => {
    expect(splitStatements('')).toEqual([]);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(splitStatements('   \n\t  ')).toEqual([]);
  });

  it('returns single statement for input without semicolons', () => {
    expect(splitStatements('SELECT 1')).toEqual(['SELECT 1']);
  });

  it('trims whitespace from each statement', () => {
    expect(splitStatements('  SELECT 1  ;  SELECT 2  ')).toEqual(['SELECT 1', 'SELECT 2']);
  });

  it('drops trailing empty statement (trailing semicolon)', () => {
    expect(splitStatements('SELECT 1;')).toEqual(['SELECT 1']);
    expect(splitStatements('SELECT 1;\n')).toEqual(['SELECT 1']);
  });

  it('does not split on semicolons inside single-quoted strings', () => {
    const sql = `SELECT 'a;b;c' AS x`;
    expect(splitStatements(sql)).toEqual([`SELECT 'a;b;c' AS x`]);
  });

  it('handles SQL-standard single-quote escape (two single quotes) inside strings', () => {
    const sql = `SELECT 'it''s ok; really' AS x`;
    expect(splitStatements(sql)).toEqual([`SELECT 'it''s ok; really' AS x`]);
  });

  it('does not split on semicolons inside double-quoted identifiers', () => {
    const sql = `SELECT "col;name" FROM t`;
    expect(splitStatements(sql)).toEqual([`SELECT "col;name" FROM t`]);
  });

  it('handles "" escape inside double-quoted identifiers', () => {
    const sql = `SELECT "weird""name;x" FROM t`;
    expect(splitStatements(sql)).toEqual([`SELECT "weird""name;x" FROM t`]);
  });

  it('skips -- line comments (including comment-only chunks)', () => {
    const sql = `-- this is a comment\nSELECT 1; -- trailing\nSELECT 2;`;
    expect(splitStatements(sql)).toEqual(['-- this is a comment\nSELECT 1', '-- trailing\nSELECT 2']);
  });

  it('skips /* */ block comments', () => {
    const sql = `/* multi\nline */ SELECT 1; SELECT 2;`;
    expect(splitStatements(sql)).toEqual(['/* multi\nline */ SELECT 1', 'SELECT 2']);
  });

  it('handles semicolons inside block comments', () => {
    const sql = `/* a;b;c */ SELECT 1`;
    expect(splitStatements(sql)).toEqual([`/* a;b;c */ SELECT 1`]);
  });

  it('handles nested block comments (DuckDB feature)', () => {
    const sql = `/* outer /* inner; */ outer; */ SELECT 1;`;
    expect(splitStatements(sql)).toEqual([`/* outer /* inner; */ outer; */ SELECT 1`]);
  });

  it('handles $$ dollar-quoted strings (DuckDB/PG)', () => {
    const sql = `SELECT $$hello; world$$ AS x; SELECT 1`;
    expect(splitStatements(sql)).toEqual([`SELECT $$hello; world$$ AS x`, 'SELECT 1']);
  });

  it('handles $tag$ dollar-quoted strings', () => {
    const sql = `SELECT $tag$hello; world$tag$ AS x; SELECT 1`;
    expect(splitStatements(sql)).toEqual([`SELECT $tag$hello; world$tag$ AS x`, 'SELECT 1']);
  });

  it('handles multi-statement SQL with mixed constructs', () => {
    const sql = `
      CREATE TABLE t (a INT);
      INSERT INTO t VALUES (1), (2);
      SELECT * FROM t WHERE a > 0;
    `;
    const out = splitStatements(sql);
    expect(out).toHaveLength(3);
    expect(out[0]).toMatch(/^CREATE TABLE t/);
    expect(out[1]).toMatch(/^INSERT INTO t/);
    expect(out[2]).toMatch(/^SELECT \* FROM t/);
  });

  it('drops empty chunks from multiple consecutive semicolons', () => {
    expect(splitStatements(';;;SELECT 1;;;')).toEqual(['SELECT 1']);
  });
});
