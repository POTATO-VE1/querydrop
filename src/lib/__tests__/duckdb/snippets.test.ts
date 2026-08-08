/**
 * Saved snippets — name/sql persistence with dedup, cap, and rename.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSnippets, saveSnippet, deleteSnippet, renameSnippet } from '../../duckdb/snippets';
import type { QuerySnippet } from '../../duckdb/types';

describe('snippets', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('returns [] when empty', () => {
    expect(loadSnippets()).toEqual([]);
  });

  it('saveSnippet adds a new entry, newest first', () => {
    const { snippets: a, created } = saveSnippet('A', 'SELECT 1', []);
    const { snippets: b } = saveSnippet('B', 'SELECT 2', a);
    expect(b).toHaveLength(2);
    expect(b[0]?.name).toBe('B');
    expect(b[1]?.name).toBe('A');
    expect(created.id).toBeTruthy();
    expect(loadSnippets()).toEqual(b);
  });

  it('saveSnippet normalizes blank name to "Untitled"', () => {
    const { created } = saveSnippet('   ', 'SELECT 1', []);
    expect(created.name).toBe('Untitled');
  });

  it('saveSnippet caps name at 50 chars', () => {
    const { created } = saveSnippet('x'.repeat(200), 'SELECT 1', []);
    expect(created.name.length).toBe(50);
  });

  it('saveSnippet caps total at 100 items', () => {
    let existing: QuerySnippet[] = [];
    for (let i = 0; i < 120; i++) {
      const r = saveSnippet('s' + i, 'SELECT ' + i, existing);
      existing = r.snippets;
    }
    expect(existing).toHaveLength(100);
  });

  it('deleteSnippet removes by id', () => {
    const { snippets: a, created } = saveSnippet('A', 'SELECT 1', []);
    const { snippets: b } = saveSnippet('B', 'SELECT 2', a);
    const after = deleteSnippet(created.id, b);
    expect(after).toHaveLength(1);
    expect(after[0]?.name).toBe('B');
  });

  it('renameSnippet updates name and updatedAt', async () => {
    const { snippets, created } = saveSnippet('A', 'SELECT 1', []);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const after = renameSnippet(created.id, 'A renamed', snippets);
    expect(after[0]?.name).toBe('A renamed');
    expect(after[0]?.updatedAt).toBeGreaterThan(before);
  });

  it('renameSnippet leaves other entries untouched', () => {
    const { snippets: a } = saveSnippet('A', 'SELECT 1', []);
    const { snippets: b, created: bEntry } = saveSnippet('B', 'SELECT 2', a);
    const after = renameSnippet(bEntry.id, 'B renamed', b);
    expect(after[0]?.name).toBe('B renamed');
    expect(after[1]?.name).toBe('A');
  });

  it('filters out invalid entries on load', () => {
    localStorage.setItem(
      'querydrop:snippets',
      JSON.stringify([
        { id: 'ok', name: 'OK', sql: 'SELECT 1', createdAt: 0, updatedAt: 0 },
        { name: 'no-id' },
      ]),
    );
    const out = loadSnippets();
    expect(out).toHaveLength(1);
  });
});
