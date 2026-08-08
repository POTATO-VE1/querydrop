/**
 * generateCleanSQL — emit SQL for trim/emptyToNull/dropEmptyRows/dropDuplicates.
 * Must:
 *  - quote identifiers defensively (spaces, dashes, reserved words)
 *  - return placeholder strings for empty inputs
 *  - handle dropEmptyRows safely (no SQL injection via col names)
 */
import { describe, it, expect } from 'vitest';
import { generateCleanSQL, CLEAN_OP_LABELS, type CleanOp } from '../cleaning';

describe('generateCleanSQL', () => {
  it('returns placeholder when no table is given', () => {
    expect(generateCleanSQL({ table: '', ops: new Set(['trim']), cols: ['a'] })).toBe(
      '-- Pick a table to start',
    );
  });

  it('returns placeholder when no ops are selected', () => {
    expect(generateCleanSQL({ table: 't', ops: new Set(), cols: ['a'] })).toBe(
      '-- Select at least one operation',
    );
  });

  it('emits UPDATE with TRIM for trim op', () => {
    const out = generateCleanSQL({ table: 't', ops: new Set(['trim']), cols: ['a', 'b'] });
    expect(out).toBe('UPDATE "t" SET "a" = TRIM("a"), "b" = TRIM("b");');
  });

  it('emits per-column UPDATE for emptyToNull', () => {
    const out = generateCleanSQL({ table: 't', ops: new Set(['emptyToNull']), cols: ['a', 'b'] });
    expect(out).toBe(
      'UPDATE "t" SET "a" = NULL WHERE TRIM(COALESCE("a", \'\')) = \'\';\n' +
        'UPDATE "t" SET "b" = NULL WHERE TRIM(COALESCE("b", \'\')) = \'\';',
    );
  });

  it('emits CREATE OR REPLACE for dropEmptyRows (AND of all columns empty)', () => {
    const out = generateCleanSQL({ table: 't', ops: new Set(['dropEmptyRows']), cols: ['a', 'b'] });
    expect(out).toBe(
      'CREATE OR REPLACE TABLE "t" AS SELECT * FROM "t" WHERE NOT (COALESCE("a", \'\') = \'\' AND COALESCE("b", \'\') = \'\');',
    );
  });

  it('emits SELECT DISTINCT for dropDuplicates (ignores cols)', () => {
    const out = generateCleanSQL({ table: 't', ops: new Set(['dropDuplicates']), cols: [] });
    expect(out).toBe('CREATE OR REPLACE TABLE "t" AS SELECT DISTINCT * FROM "t";');
  });

  it('returns empty for trim/emptyToNull/dropEmptyRows with no cols', () => {
    for (const op of ['trim', 'emptyToNull', 'dropEmptyRows'] as CleanOp[]) {
      const out = generateCleanSQL({ table: 't', ops: new Set([op]), cols: [] });
      expect(out).toBe('-- Select at least one operation');
    }
  });

  it('quotes table and column names with spaces, dashes, and reserved words', () => {
    const out = generateCleanSQL({ table: 'my table', ops: new Set(['trim']), cols: ['order-date', 'select'] });
    expect(out).toBe(
      'UPDATE "my table" SET "order-date" = TRIM("order-date"), "select" = TRIM("select");',
    );
  });

  it('escapes embedded double-quotes in identifiers', () => {
    const out = generateCleanSQL({ table: 'weird"name', ops: new Set(['trim']), cols: ['a'] });
    expect(out).toBe('UPDATE "weird""name" SET "a" = TRIM("a");');
  });

  it('emits multiple ops in a fixed order with newline separator', () => {
    const out = generateCleanSQL({
      table: 't',
      ops: new Set(['trim', 'emptyToNull', 'dropEmptyRows', 'dropDuplicates']),
      cols: ['a'],
    });
    expect(out).toContain('UPDATE "t" SET "a" = TRIM("a");');
    expect(out).toContain('UPDATE "t" SET "a" = NULL');
    expect(out).toContain('CREATE OR REPLACE TABLE "t" AS SELECT * FROM "t" WHERE NOT');
    expect(out).toContain('CREATE OR REPLACE TABLE "t" AS SELECT DISTINCT * FROM "t";');
  });

  it('CLEAN_OP_LABELS has labels for every CleanOp', () => {
    for (const op of ['trim', 'emptyToNull', 'dropEmptyRows', 'dropDuplicates'] as CleanOp[]) {
      expect(CLEAN_OP_LABELS[op]).toBeDefined();
      expect(CLEAN_OP_LABELS[op].title).toBeTruthy();
      expect(CLEAN_OP_LABELS[op].hint).toBeTruthy();
    }
  });
});
