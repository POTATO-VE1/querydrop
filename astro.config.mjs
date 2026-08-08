// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/** Vite plugin: inject COOP/COEP headers for DuckDB-WASM cross-origin isolation. */
function coopCoepPlugin() {
  return {
    name: 'coop-coep-headers',
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        next();
      });
    },
  };
}

// QueryDrop — fully client-side SQL analytics tool
// Deployed to Cloudflare Pages (static output)
export default defineConfig({
  site: 'https://querydrop.com',
  output: 'static',
  integrations: [
    react(),
    sitemap({
      filter: (page) => page !== 'https://querydrop.com/tool' && page !== 'https://querydrop.com/tool/',
    }),
  ],
  vite: {
    // @ts-ignore
    plugins: [coopCoepPlugin(), tailwindcss()],
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@duckdb/duckdb-wasm', 'apache-arrow'] },
    server: {
      // Cross-Origin Isolation for DuckDB-WASM high-perf mode (SharedArrayBuffer + pthreads).
      // Production uses public/_headers — see that file.
      // https://web.dev/articles/coop-coep
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
      },
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  prefetch: { defaultStrategy: 'viewport' },
  experimental: {},
});

