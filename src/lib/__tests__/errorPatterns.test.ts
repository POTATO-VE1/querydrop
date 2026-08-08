/**
 * Error pattern DB — match DuckDB error strings to developer-written explanations.
 * The first matching pattern wins; patterns are tried in order.
 */
import { describe, it, expect } from 'vitest';
import { ERROR_PATTERNS, matchErrorPattern } from '../errorPatterns';

describe('matchErrorPattern', () => {
  it('matches a missing-table error and returns the captures', () => {
    const out = matchErrorPattern('Catalog Error: Table with name "foo" does not exist');
    expect(out).not.toBeNull();
    expect(out?.pattern.id).toBe('table-missing');
    expect(out?.captures[0]).toBe('foo');
  });

  it('matches a column-not-found error', () => {
    const out = matchErrorPattern('Binder Error: Referenced column "user_id" not found in FROM clause');
    expect(out?.pattern.id).toBe('column-not-found');
    expect(out?.captures[0]).toBe('user_id');
  });

  it('matches an ambiguous column error', () => {
    const out = matchErrorPattern('Binder Error: Ambiguous reference to column "id"');
    expect(out?.pattern.id).toBe('column-ambiguous');
  });

  it('matches a syntax error', () => {
    const out = matchErrorPattern('Parser Error: syntax error at or near "FROM"');
    expect(out?.pattern.id).toBe('syntax-error');
    expect(out?.captures[0]).toBe('FROM');
  });

  it('matches a division-by-zero error', () => {
    const out = matchErrorPattern('Runtime Error: Division by zero');
    expect(out?.pattern.id).toBe('division-by-zero');
  });

  it('matches an OOM error', () => {
    const out = matchErrorPattern('Out of Memory Error');
    expect(out?.pattern.id).toBe('oom');
  });

  it('matches a conversion error', () => {
    const out = matchErrorPattern('Conversion Error: Could not convert string "abc" to INT32');
    expect(out?.pattern.id).toBe('conversion-string');
    expect(out?.captures[0]).toBe('abc');
    expect(out?.captures[1]).toBe('INT32');
  });

  it('matches the fallback conversion-fail pattern', () => {
    const out = matchErrorPattern('Conversion Error: Could not convert whatever');
    expect(out?.pattern.id).toBe('conversion-fail');
  });

  it('matches a date function on a non-date column', () => {
    const out = matchErrorPattern('Catalog Error: VARCHAR is not a date');
    expect(out?.pattern.id).toBe('not-a-date');
  });

  it('matches an IO file missing error', () => {
    const out = matchErrorPattern('IO Error: No such file or directory: /x/y.csv');
    expect(out?.pattern.id).toBe('io-file-missing');
  });

  it('matches an IO HTTP error', () => {
    const out = matchErrorPattern('IO Error: HTTP 404 Not Found');
    expect(out?.pattern.id).toBe('io-http');
  });

  it('matches an aggregate-outside error', () => {
    const out = matchErrorPattern('Binder Error: Aggregate function SUM() found outside aggregate');
    expect(out?.pattern.id).toBe('aggregate-outside');
  });

  it('returns null for an unrecognized error', () => {
    expect(matchErrorPattern('some completely unknown error')).toBeNull();
  });

  it('every pattern has a unique id', () => {
    const ids = ERROR_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every pattern has title, explanation, and fix populated', () => {
    for (const p of ERROR_PATTERNS) {
      expect(p.title).toBeTruthy();
      expect(p.explanation).toBeTruthy();
      expect(p.fix).toBeTruthy();
    }
  });
});
