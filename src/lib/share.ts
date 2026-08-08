/**
 * Shareable Links — encode/decode query+result payloads into URL-safe strings.
 * Uses native CompressionStream('gzip') (Chrome 80+, Firefox 113+, Safari 16.4+)
 * + base64url encoding. No external deps.
 *
 * URL format:  ?q=<encoded payload>   (query only)
 *              ?q=...&r=<encoded>     (query + result preview)
 *
 * The payload is versioned (`v: 1`) so we can evolve the schema without
 * breaking old links.
 */

export const SHARE_VERSION = 1;

export interface SharePayload {
  v: number;
  sql: string;
  t?: string;
}

export interface ShareResultPayload {
  v: number;
  cols: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
}

export interface DecodedShare {
  query: SharePayload;
  result: ShareResultPayload | null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  let padded = s.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function getHasCompressionStream(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.CompressionStream === 'function';
}
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

async function gzipString(s: string): Promise<Uint8Array> {
  if (!getHasCompressionStream()) {
    return new TextEncoder().encode(s);
  }
  const stream = new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipString(bytes: Uint8Array): Promise<string> {
  if (!(bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1)) {
    return new TextDecoder().decode(bytes);
  }
  const stream = new Blob([bytes as any]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = JSON.stringify(payload);
  const gz = await gzipString(json);
  return bytesToBase64Url(gz);
}

export async function encodeShareResult(result: ShareResultPayload): Promise<string> {
  const json = JSON.stringify(result);
  const gz = await gzipString(json);
  return bytesToBase64Url(gz);
}

export async function decodeShare(encoded: string): Promise<SharePayload | null> {
  try {
    const bytes = base64UrlToBytes(encoded);
    const text = await gunzipString(bytes);
    const obj = JSON.parse(text);
    if (typeof obj !== 'object' || obj === null) return null;
    if (obj.v !== SHARE_VERSION) {
      console.warn(`[share] Version mismatch: payload version is ${obj.v}, but app only supports version ${SHARE_VERSION}`);
      return null;
    }
    if (typeof obj.sql !== 'string') return null;
    return obj as SharePayload;
  } catch {
    return null;
  }
}

export async function decodeShareResult(encoded: string): Promise<ShareResultPayload | null> {
  try {
    const bytes = base64UrlToBytes(encoded);
    const text = await gunzipString(bytes);
    const obj = JSON.parse(text);
    if (typeof obj !== 'object' || obj === null) return null;
    if (obj.v !== SHARE_VERSION) {
      console.warn(`[share] Result version mismatch: payload version is ${obj.v}, but app only supports version ${SHARE_VERSION}`);
      return null;
    }
    if (!Array.isArray(obj.cols) || !Array.isArray(obj.rows)) return null;
    return obj as ShareResultPayload;
  } catch {
    return null;
  }
}

const MAX_URL_LENGTH = 8 * 1024;

export async function buildShareUrlAsync(
  origin: string,
  pathname: string,
  payload: SharePayload,
  result: ShareResultPayload | null,
): Promise<{ url: string; length: number }> {
  const params = new URLSearchParams();
  const q = await encodeShare(payload);
  params.set('q', q);
  if (result) {
    const r = await encodeShareResult(result);
    params.set('r', r);
  }
  const url = `${origin}${pathname}?${params.toString()}`;
  if (url.length > MAX_URL_LENGTH) {
    throw new Error(
      `Share URL too long: ${url.length.toLocaleString()} chars exceeds ${MAX_URL_LENGTH.toLocaleString()} limit. ` +
        'Shorten the SQL or reduce the result preview (try a smaller LIMIT).',
    );
  }
  return { url, length: url.length };
}

export function readShareFromSearch(search: string): { q: string | null; r: string | null } {
  const params = new URLSearchParams(search);
  return { q: params.get('q'), r: params.get('r') };
}

export function stripShareFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete('q');
  params.delete('r');
  const s = params.toString();
  return s ? `?${s}` : '';
}
