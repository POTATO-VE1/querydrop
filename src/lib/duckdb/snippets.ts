/**
 * Saved query snippets — user-named, persistent queries.
 * Stored in localStorage under a separate key from query history so the two
 * concerns stay clean (ephemeral execution log vs intentional reusable queries).
 *
 * All mutator functions are pure: they take the existing array + new data and
 * return a new array. The caller is responsible for setState.
 */

import type { QuerySnippet } from './types';

const KEY = 'querydrop:snippets';
const MAX_ITEMS = 100;
const MAX_NAME = 50;

function isValidSnippet(value: unknown): value is QuerySnippet {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.sql === 'string' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number'
  );
}

export function loadSnippets(): QuerySnippet[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidSnippet).slice(0, MAX_ITEMS);
  } catch {
    // localStorage may throw (Safari private mode, SecurityError); JSON may be corrupt.
    return [];
  }
}

function persist(snippets: QuerySnippet[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snippets));
  } catch {
    // localStorage may be full or disabled — silent.
  }
}

function normalizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME) || 'Untitled';
}

export function saveSnippet(
  name: string,
  sql: string,
  existing: QuerySnippet[],
): { snippets: QuerySnippet[]; created: QuerySnippet } {
  const now = Date.now();
  const trimmedSql = sql.trim();
  if (!trimmedSql) throw new Error('Cannot save a snippet with empty SQL');
  const created: QuerySnippet = {
    id: crypto.randomUUID(),
    name: normalizeName(name),
    sql: trimmedSql,
    createdAt: now,
    updatedAt: now,
  };
  // Newest first; cap at MAX_ITEMS.
  const next = [created, ...existing].slice(0, MAX_ITEMS);
  persist(next);
  return { snippets: next, created };
}

export function deleteSnippet(id: string, existing: QuerySnippet[]): QuerySnippet[] {
  const next = existing.filter((s) => s.id !== id);
  persist(next);
  return next;
}

export function renameSnippet(
  id: string,
  name: string,
  existing: QuerySnippet[],
): QuerySnippet[] {
  const next = existing.map((s) =>
    s.id === id ? { ...s, name: normalizeName(name), updatedAt: Date.now() } : s,
  );
  persist(next);
  return next;
}
