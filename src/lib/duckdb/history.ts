/**
 * Query history persistence — localStorage-backed ring of the last 50 queries.
 * Used by the HistoryDropdown in the SQL editor toolbar.
 */

import type { QueryHistoryItem } from './types';

const KEY = 'querydrop:query-history';
const MAX_ITEMS = 50;

function isValidItem(x: unknown): x is QueryHistoryItem {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    typeof o['sql'] === 'string' &&
    typeof o['ts'] === 'number' &&
    typeof o['success'] === 'boolean' &&
    typeof o['durationMs'] === 'number' &&
    Array.isArray(o['virtualNames']) &&
    (o['rowCount'] === null || typeof o['rowCount'] === 'number')
  );
}

/** Read the persisted history. Returns [] on missing/corrupt/disabled storage. */
export function loadHistory(): QueryHistoryItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

/** Insert (or move-to-top) an item, dedup by id, cap at 50, persist. */
export function pushHistory(
  item: QueryHistoryItem,
  existing: QueryHistoryItem[],
): QueryHistoryItem[] {
  const filtered = existing.filter((h) => h.id !== item.id);
  const next = [item, ...filtered].slice(0, MAX_ITEMS);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Quota exceeded or storage disabled — keep in-memory state but don't throw.
    }
  }
  return next;
}

/** Wipe the persisted history. In-memory state is the caller's responsibility. */
export function clearHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
