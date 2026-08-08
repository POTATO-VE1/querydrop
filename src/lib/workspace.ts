/**
 * Save Workspace — persist the current session (files metadata + SQL) to
 * localStorage so the user can resume later, and export/import as JSON for
 * cross-device sync. File CONTENTS are never saved — only metadata — for
 * privacy and to stay under the 5 MB localStorage limit.
 *
 * Schema is versioned (`v: 1`) so future evolution does not break old saves.
 */

import type { FileFormat } from './duckdb/types';

export const WORKSPACE_VERSION = 1;
const STORAGE_KEY = 'querydrop:workspaces:v1';
const SIZE_WARN = 100 * 1024;
const SIZE_HARD = 1024 * 1024;
const MAX_WORKSPACES = 50;

export interface WorkspaceFile {
  name: string;
  size: number;
  format: FileFormat;
  tableName: string;
}

export interface Workspace {
  id: string;
  v: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: WorkspaceFile[];
  sql: string;
}

export interface WorkspaceSizeInfo {
  bytes: number;
  warn: boolean;
  hard: boolean;
}

function isValidWorkspace(w: unknown): w is Workspace {
  if (!w || typeof w !== 'object') return false;
  const o = w as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  if (o.v !== WORKSPACE_VERSION) return false;
  if (typeof o.name !== 'string') return false;
  if (typeof o.sql !== 'string') return false;
  if (!Array.isArray(o.files)) return false;
  for (const f of o.files) {
    if (!f || typeof f !== 'object') return false;
    const file = f as Record<string, unknown>;
    if (typeof file.name !== 'string') return false;
    if (typeof file.size !== 'number') return false;
    if (typeof file.format !== 'string') return false;
    if (typeof file.tableName !== 'string') return false;
  }
  return true;
}

export function loadWorkspaces(): Workspace[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidWorkspace);
  } catch {
    return [];
  }
}

export function saveWorkspace(name: string, files: WorkspaceFile[], sql: string): Workspace {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage unavailable');
  }
  const trimmed = name.trim() || `Workspace ${new Date().toLocaleString()}`;
  const all = loadWorkspaces();
  const now = Date.now();
  const entry: Workspace = {
    id: `ws_${now}_${Math.random().toString(36).slice(2, 8)}`,
    v: WORKSPACE_VERSION,
    name: trimmed.slice(0, 80),
    createdAt: now,
    updatedAt: now,
    files,
    sql,
  };
  const json = JSON.stringify([entry, ...all].slice(0, MAX_WORKSPACES));
  if (json.length > SIZE_HARD) {
    throw new Error(
      `Workspace too large to save (${(json.length / 1024).toFixed(0)} KB exceeds 1 MB limit). Try shortening the SQL or removing files.`,
    );
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (e) {
    throw new Error(
      `Browser storage full or denied: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return entry;
}

export function deleteWorkspace(id: string): void {
  if (typeof localStorage === 'undefined') return;
  const all = loadWorkspaces().filter((w) => w.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    throw new Error(
      `Browser storage full or denied: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export function workspaceSizeOf(files: WorkspaceFile[], sql: string): WorkspaceSizeInfo {
  const bytes = new TextEncoder().encode(JSON.stringify({ files, sql })).length;
  return { bytes, warn: bytes > SIZE_WARN, hard: bytes > SIZE_HARD };
}

export function exportWorkspaceToFile(workspace: Workspace): void {
  const json = JSON.stringify(workspace, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = workspace.name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'workspace';
  a.download = `querydrop-${safeName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function importWorkspaceFromFile(file: File): Promise<Workspace> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not valid JSON');
  }
  if (!isValidWorkspace(parsed)) {
    throw new Error('Not a valid QueryDrop workspace file');
  }
  if (typeof localStorage !== 'undefined') {
    const all = loadWorkspaces();
    if (!all.some((w) => w.id === parsed.id)) {
      const updated = [parsed, ...all].slice(0, MAX_WORKSPACES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  }
  return parsed;
}

export function escapeIdentForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function rewriteSqlTableRef(sql: string, from: string, to: string): string {
  if (from === to) return sql;
  return sql.replace(new RegExp(`\\b${escapeIdentForRegex(from)}\\b`, 'g'), to);
}
