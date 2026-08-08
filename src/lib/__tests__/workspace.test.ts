/**
 * Workspace save/load/delete — localStorage persistence, size guard, JSON I/O.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadWorkspaces,
  saveWorkspace,
  deleteWorkspace,
  workspaceSizeOf,
  exportWorkspaceToFile,
  importWorkspaceFromFile,
  rewriteSqlTableRef,
  WORKSPACE_VERSION,
} from '../workspace';

const sampleFiles = [
  { name: 'a.csv', size: 100, format: 'csv' as const, tableName: 'a' },
  { name: 'b.json', size: 200, format: 'json' as const, tableName: 'b' },
];

describe('loadWorkspaces / saveWorkspace', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('returns [] when nothing saved', () => {
    expect(loadWorkspaces()).toEqual([]);
  });

  it('saves and loads a workspace', () => {
    const entry = saveWorkspace('My WS', sampleFiles, 'SELECT 1');
    const all = loadWorkspaces();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(entry.id);
    expect(all[0]?.name).toBe('My WS');
    expect(all[0]?.sql).toBe('SELECT 1');
    expect(all[0]?.files).toEqual(sampleFiles);
    expect(all[0]?.v).toBe(WORKSPACE_VERSION);
  });

  it('uses a default name when blank', () => {
    const entry = saveWorkspace('   ', [], 'SELECT 1');
    expect(entry.name).toMatch(/^Workspace /);
  });

  it('trims name to 80 chars', () => {
    const longName = 'x'.repeat(200);
    const entry = saveWorkspace(longName, [], 'SELECT 1');
    expect(entry.name.length).toBe(80);
  });

  it('rejects workspaces over the 1 MB hard limit', () => {
    const hugeSql = 'SELECT \'' + 'x'.repeat(2_000_000) + '\'';
    expect(() => saveWorkspace('big', [], hugeSql)).toThrow(/Workspace too large/);
  });

  it('returns the saved entry first (newest first)', () => {
    const a = saveWorkspace('A', [], 'SELECT 1');
    const b = saveWorkspace('B', [], 'SELECT 2');
    const all = loadWorkspaces();
    expect(all[0]?.id).toBe(b.id);
    expect(all[1]?.id).toBe(a.id);
  });

  it('filters out invalid entries on load', () => {
    localStorage.setItem('querydrop:workspaces:v1', JSON.stringify([
      { id: 'ok', name: 'OK', sql: '', files: [], v: 1, createdAt: 0, updatedAt: 0 },
      { name: 'missing-id' },
      'not-an-object',
    ]));
    const all = loadWorkspaces();
    expect(all).toHaveLength(1);
  });
});

describe('deleteWorkspace', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('removes the workspace by id', () => {
    const a = saveWorkspace('A', [], 'SELECT 1');
    const b = saveWorkspace('B', [], 'SELECT 2');
    deleteWorkspace(a.id);
    const all = loadWorkspaces();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(b.id);
  });

  it('no-ops when the id does not exist', () => {
    saveWorkspace('A', [], 'SELECT 1');
    deleteWorkspace('non-existent');
    expect(loadWorkspaces()).toHaveLength(1);
  });
});

describe('workspaceSizeOf', () => {
  it('returns warn=false / hard=false for small payloads', () => {
    const info = workspaceSizeOf(sampleFiles, 'SELECT 1');
    expect(info.warn).toBe(false);
    expect(info.hard).toBe(false);
    expect(info.bytes).toBeGreaterThan(0);
  });
});

describe('exportWorkspaceToFile / importWorkspaceFromFile', () => {
  it('round-trips a workspace through JSON', async () => {
    const entry = saveWorkspace('RoundTrip', sampleFiles, 'SELECT * FROM t');
    // Capture the file contents via a click hijack.
    const captured: string[] = [];
    const origCreate = document.createElement.bind(document);
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.href.startsWith('blob:')) {
        captured.push(this.href);
      }
    };
    try {
      exportWorkspaceToFile(entry);
      expect(captured).toHaveLength(1);
      const url = captured[0]!;
      const blob = await (await fetch(url)).blob();
      const text = await blob.text();
      const file = new File([text], 'ws.json', { type: 'application/json' });
      
      if (typeof localStorage !== 'undefined') localStorage.clear();
      const imported = await importWorkspaceFromFile(file);
      expect(imported.id).toBe(entry.id);
      expect(imported.name).toBe('RoundTrip');
      
      const all = loadWorkspaces();
      expect(all).toHaveLength(1);
      expect(all[0]?.id).toBe(entry.id);
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
  });

  it('rejects non-JSON file', async () => {
    const file = new File(['not json at all'], 'bad.json', { type: 'application/json' });
    await expect(importWorkspaceFromFile(file)).rejects.toThrow(/Not valid JSON/);
  });

  it('rejects JSON that is not a valid workspace', async () => {
    const file = new File([JSON.stringify({ foo: 'bar' })], 'bad.json', { type: 'application/json' });
    await expect(importWorkspaceFromFile(file)).rejects.toThrow(/Not a valid QueryDrop workspace/);
  });
});

describe('rewriteSqlTableRef', () => {
  it('rewrites FROM clause', () => {
    expect(rewriteSqlTableRef('SELECT * FROM old', 'old', 'new')).toBe('SELECT * FROM new');
  });

  it('rewrites JOIN clauses', () => {
    expect(rewriteSqlTableRef('SELECT * FROM a JOIN b ON a.id = b.aid', 'a', 'alpha')).toBe(
      'SELECT * FROM alpha JOIN b ON alpha.id = b.aid',
    );
  });

  it('does not rewrite substring matches', () => {
    // 'old' should not match inside 'older'
    expect(rewriteSqlTableRef('SELECT * FROM older', 'old', 'new')).toBe('SELECT * FROM older');
  });

  it('returns SQL unchanged if from === to', () => {
    expect(rewriteSqlTableRef('SELECT * FROM t', 't', 't')).toBe('SELECT * FROM t');
  });
});
