/**
 * Share URL encode/decode — round-trip + version checking + 8KB cap.
 * Uses native CompressionStream ('gzip') + base64url.
 */
import { describe, it, expect } from 'vitest';
import {
  encodeShare,
  decodeShare,
  encodeShareResult,
  decodeShareResult,
  buildShareUrlAsync,
  readShareFromSearch,
  stripShareFromSearch,
  SHARE_VERSION,
} from '../share';

describe('share encode/decode', () => {
  it('round-trips a simple payload', async () => {
    const payload = { v: SHARE_VERSION, sql: 'SELECT 1', t: 't' };
    const encoded = await encodeShare(payload);
    const decoded = await decodeShare(encoded);
    expect(decoded).toEqual(payload);
  });

  it('round-trips a large SQL string with special characters', async () => {
    const sql = `SELECT * FROM "my-table" WHERE name = 'O''Brien' AND age > 18 -- comment\n/* block */ ; SELECT 2`;
    const payload = { v: SHARE_VERSION, sql };
    const encoded = await encodeShare(payload);
    const decoded = await decodeShare(encoded);
    expect(decoded?.sql).toBe(sql);
  });

  it('round-trips a result payload', async () => {
    const result = {
      v: SHARE_VERSION,
      cols: [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'VARCHAR' },
      ],
      rows: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    };
    const encoded = await encodeShareResult(result);
    const decoded = await decodeShareResult(encoded);
    expect(decoded).toEqual(result);
  });

  it('returns null for malformed base64', async () => {
    const decoded = await decodeShare('!!not-base64!!');
    expect(decoded).toBeNull();
  });

  it('returns null for wrong version', async () => {
    const bad = { v: 999, sql: 'SELECT 1' };
    const encoded = await encodeShare(bad as { v: number; sql: string });
    // Decode with the version check: it should still come back, but the version guard rejects it.
    // Since encode doesn't enforce the version, we need to test the guard directly:
    const decoded = await decodeShare(encoded);
    expect(decoded).toBeNull(); // because v !== SHARE_VERSION
  });

  it('returns null for non-string sql', async () => {
    // We can't produce a bad payload via the public encode (no schema enforcement),
    // so simulate by hand-crafting a bad gzip+base64 string:
    const stream = new Blob([JSON.stringify({ v: SHARE_VERSION, sql: 42 })]).stream().pipeThrough(
      new CompressionStream('gzip'),
    );
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const decoded = await decodeShare(b64);
    expect(decoded).toBeNull();
  });
});

describe('buildShareUrlAsync', () => {
  it('builds a URL with q parameter', async () => {
    const { url, length } = await buildShareUrlAsync(
      'https://querydrop.com',
      '/tool',
      { v: SHARE_VERSION, sql: 'SELECT 1' },
      null,
    );
    expect(url).toMatch(/^https:\/\/querydrop\.com\/tool\?q=/);
    expect(length).toBe(url.length);
  });

  it('builds a URL with q and r parameters when result is provided', async () => {
    const { url } = await buildShareUrlAsync(
      'https://querydrop.com',
      '/tool',
      { v: SHARE_VERSION, sql: 'SELECT 1' },
      { v: SHARE_VERSION, cols: [{ name: 'a', type: 'INT' }], rows: [{ a: 1 }] },
    );
    expect(url).toMatch(/\?q=.*&r=/);
  });

  it('throws when URL exceeds 8KB cap', async () => {
    const bigSql =
      'SELECT * FROM t WHERE ' +
      Array.from({ length: 2000 }, (_, i) =>
        `c${i} = '${(i * 7919).toString(36)}${(i * 6151).toString(36)}'`,
      ).join(' OR ');
    await expect(
      buildShareUrlAsync(
        'https://querydrop.com',
        '/tool',
        { v: SHARE_VERSION, sql: bigSql },
        null,
      ),
    ).rejects.toThrow(/Share URL too long/);
  });
});

describe('readShareFromSearch', () => {
  it('reads q and r from a search string', () => {
    expect(readShareFromSearch('?q=abc&r=def')).toEqual({ q: 'abc', r: 'def' });
  });

  it('returns null for missing params', () => {
    expect(readShareFromSearch('')).toEqual({ q: null, r: null });
    expect(readShareFromSearch('?q=abc')).toEqual({ q: 'abc', r: null });
  });
});

describe('stripShareFromSearch', () => {
  it('strips q and r but keeps other params', () => {
    expect(stripShareFromSearch('?q=abc&r=def&keep=yes')).toBe('?keep=yes');
  });

  it('returns empty string when only q/r were present', () => {
    expect(stripShareFromSearch('?q=abc&r=def')).toBe('');
  });

  it('preserves the search string unchanged if neither present', () => {
    expect(stripShareFromSearch('?foo=bar')).toBe('?foo=bar');
  });
});
