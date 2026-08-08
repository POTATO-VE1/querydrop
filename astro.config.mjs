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
        res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
        next();
      });
    },
  };
}

// QueryDrop — fully client-side SQL analytics tool
// Deployed to Cloudflare Pages (static output).
// site: = Cloudflare default while no custom domain is owned. When the real
// domain is bought, change this one value (and the emails in privacy.astro /
// index.astro) and rebuild. The Cloudflare Pages project MUST be named
// "querydrop" for this default to match.
export default defineConfig({
  site: 'https://querydrop.pages.dev',
  output: 'static',
  integrations: [
    react(),
    sitemap({
      filter: (page) => page !== 'https://querydrop.pages.dev/tool' && page !== 'https://querydrop.pages.dev/tool/',
    }),
  ],
  vite: {
    // @ts-ignore
    plugins: [coopCoepPlugin(), tailwindcss()],
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['@duckdb/duckdb-wasm', 'apache-arrow'] },
    server: {
      // Cross-Origin Isolation for DuckDB-WASM high-perf mode (SharedArrayBuffer + pthreads).
      // credentialless (not require-corp) so third-party ad iframes still load.
      // Production uses public/_headers — see that file.
      // https://web.dev/articles/coop-coep
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'credentialless',
      },
    },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  prefetch: { defaultStrategy: 'viewport' },
  experimental: {},
});

