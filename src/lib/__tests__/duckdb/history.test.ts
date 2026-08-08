/**
 * Query history persistence — localStorage ring of 50.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadHistory, pushHistory, clearHistory } from '../../duckdb/history';
import type { QueryHistoryItem } from '../../duckdb/types';

function makeItem(overrides: Partial<QueryHistoryItem> = {}): QueryHistoryItem {
  return {
    id: 'h_' + Math.random().toString(36).slice(2),
    sql: 'SELECT 1',
    virtualNames: [],
    rowCount: 1,
    durationMs: 5,
    ts: Date.now(),
    success: true,
    ...overrides,
  };
}

describe('history', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('returns [] when empty', () => {
    expect(loadHistory()).toEqual([]);
  });

  it('pushHistory prepends and persists', () => {
    const a = makeItem({ id: 'a' });
    const next = pushHistory(a, []);
    expect(next).toEqual([a]);
    expect(loadHistory()).toEqual([a]);
  });

  it('pushHistory dedups by id (move-to-top)', () => {
    const a = makeItem({ id: 'a', sql: 'SELECT 1' });
    const b = makeItem({ id: 'b', sql: 'SELECT 2' });
    const c = makeItem({ id: 'a', sql: 'SELECT 1 NEW' });
    const afterAB = pushHistory(b, pushHistory(a, []));
    const afterC = pushHistory(c, afterAB);
    expect(afterC).toHaveLength(2);
    expect(afterC[0]?.id).toBe('a');
    expect(afterC[0]?.sql).toBe('SELECT 1 NEW');
  });

  it('caps history at 50 items', () => {
    let existing: QueryHistoryItem[] = [];
    for (let i = 0; i < 60; i++) {
      existing = pushHistory(makeItem({ id: 'i' + i }), existing);
    }
    expect(existing).toHaveLength(50);
    expect(existing[0]?.id).toBe('i59');
  });

  it('filters out invalid entries on load', () => {
    localStorage.setItem(
      'querydrop:query-history',
      JSON.stringify([
        { id: 'a', sql: 'x', virtualNames: [], rowCount: 1, durationMs: 1, ts: 1, success: true },
        { missing: 'fields' },
        'not-an-object',
      ]),
    );
    expect(loadHistory()).toHaveLength(1);
  });

  it('clearHistory wipes storage', () => {
    pushHistory(makeItem(), []);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
