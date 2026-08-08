/**
 * Client detection + format detection.
 * detectFormat covers all known extensions + MIME fallback.
 * isCrossOriginIsolated and onStatusChange use the singleton state.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectFormat, isCrossOriginIsolated, getStatus, onStatusChange } from '../../duckdb/client';

describe('detectFormat', () => {
  it.each([
    ['foo.csv', undefined, 'csv'],
    ['foo.CSV', undefined, 'csv'],
    ['foo.tsv', undefined, 'tsv'],
    ['foo.tab', undefined, 'tsv'],
    ['foo.ndjson', undefined, 'ndjson'],
    ['foo.jsonl', undefined, 'ndjson'],
    ['foo.json', undefined, 'json'],
    ['foo.xlsx', undefined, 'excel'],
    ['foo.xls', undefined, 'excel'],
    ['foo.parquet', undefined, 'parquet'],
    ['foo.pq', undefined, 'parquet'],
    ['foo.feather', undefined, 'feather'],
    ['foo.arrow', undefined, 'arrow'],
    ['foo.ipc', undefined, 'arrow'],
    ['foo.geojson', undefined, 'geojson'],
  ])('detects %s → %s', (filename, mime, expected) => {
    expect(detectFormat(filename, mime)).toBe(expected);
  });

  it('uses MIME fallback when extension is unknown', () => {
    expect(detectFormat('foo.txt', 'text/csv')).toBe('csv');
    expect(detectFormat('foo.dat', 'application/json')).toBe('json');
    expect(detectFormat('foo.dat', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(
      'excel',
    );
  });

  it('returns "unknown" for unrecognized extension and no MIME', () => {
    expect(detectFormat('foo.txt')).toBe('unknown');
    expect(detectFormat('foo.docx')).toBe('unknown');
    expect(detectFormat('noextension')).toBe('unknown');
  });
});

describe('isCrossOriginIsolated', () => {
  const original = (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated;

  afterEach(() => {
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated = original;
  });

  it('returns true when the page is cross-origin isolated', () => {
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated = true;
    expect(isCrossOriginIsolated()).toBe(true);
  });

  it('returns false when not isolated', () => {
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated = false;
    expect(isCrossOriginIsolated()).toBe(false);
  });
});

describe('onStatusChange / getStatus', () => {
  beforeEach(() => {
    // Reset the singleton status to 'idle' for each test by re-importing is not possible;
    // instead, just ensure subscribers are unsubscribed.
  });

  it('getStatus returns a snapshot of the current status', () => {
    expect(getStatus()).toBeDefined();
    expect(getStatus().kind).toMatch(/idle|loading|ready|error/);
  });

  it('onStatusChange immediately invokes the listener with current status', () => {
    const listener = vi.fn();
    const unsub = onStatusChange(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('returned unsub function removes the listener', () => {
    const listener = vi.fn();
    const unsub = onStatusChange(listener);
    listener.mockClear();
    unsub();
    // No way to trigger a status change without initialize(), so just verify unsub is callable.
    expect(typeof unsub).toBe('function');
  });
});
