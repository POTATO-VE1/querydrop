import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { CompressionStream as NodeCompressionStream, DecompressionStream as NodeDecompressionStream } from 'node:stream/web';
import { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { afterEach, vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  vi.stubGlobal('localStorage', createMemoryStorage());
}
if (typeof globalThis.sessionStorage === 'undefined') {
  vi.stubGlobal('sessionStorage', createMemoryStorage());
}

if (typeof window !== 'undefined' && !window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: globalThis.localStorage,
    writable: true,
    configurable: true,
  });
}

if (typeof Blob !== 'undefined' && typeof File !== 'undefined') {
  if (!Blob.prototype.text) {
    Blob.prototype.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  if (!File.prototype.text) {
    File.prototype.text = function (): Promise<string> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(this);
      });
    };
  }
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  if (!Blob.prototype.stream) {
    Blob.prototype.stream = function (): any {
      const blob = this;
      return new NodeReadableStream({
        start(controller) {
          const reader = new FileReader();
          reader.onload = () => {
            controller.enqueue(new Uint8Array(reader.result as ArrayBuffer));
            controller.close();
          };
          reader.onerror = () => controller.error(reader.error);
          reader.readAsArrayBuffer(blob);
        },
      }) as unknown as ReadableStream<Uint8Array>;
    };
  }
}

if (typeof globalThis.CompressionStream === 'undefined') {
  vi.stubGlobal('CompressionStream', NodeCompressionStream);
}
if (typeof globalThis.DecompressionStream === 'undefined') {
  vi.stubGlobal('DecompressionStream', NodeDecompressionStream);
}

if (typeof URL.createObjectURL !== 'function') {
  let counter = 0;
  const objectUrlStore = new Map<string, Blob>();
  Object.defineProperty(URL, 'createObjectURL', {
    value: (blob: Blob): string => {
      const id = `blob:mock-${++counter}`;
      objectUrlStore.set(id, blob);
      return id;
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: (url: string): void => {
      objectUrlStore.delete(url);
    },
    writable: true,
    configurable: true,
  });
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.startsWith('blob:mock-')) {
      const blob = objectUrlStore.get(url);
      if (blob) {
        const body = await blob.text();
        return new Response(body, { status: 200 });
      }
    }
    return origFetch(input, init);
  };
}

beforeEach(() => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}
});



