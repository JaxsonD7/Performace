import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { execSync } from 'node:child_process';

/** Short commit of the deployed build, so Settings can show what is running. */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'local';
  }
}

/**
 * GitHub Pages serves a project site from a subdirectory, so the app is built
 * against `/Performace/`. Override with BASE_PATH=/ when serving from a domain
 * root (Netlify, Cloudflare Pages, a local static server, …).
 */
const base = process.env.BASE_PATH ?? '/Performace/';

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_COMMIT__: JSON.stringify(commit()),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a new build should never reload the page out
      // from under you mid-sentence. The app shows an "Update ready" banner and
      // applies it when you say so.
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        id: base,
        name: 'Performace — Personal Performance Tracker',
        short_name: 'Performace',
        description:
          'Track diet, sleep, gym, reading, school, meetings, and your Orthodox rule of life — and turn all of it into a real daily schedule.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f9f9f7',
        theme_color: '#f9f9f7',
        lang: 'en',
        categories: ['productivity', 'health', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Long-press the installed icon to jump straight to a page.
        shortcuts: [
          { name: 'Today', url: `${base}#/`, description: "Today's dashboard" },
          { name: 'Schedule', url: `${base}#/schedule`, description: 'Plan the day' },
          { name: 'Metrics', url: `${base}#/metrics`, description: 'This week' },
        ],
      },
      workbox: {
        // The whole app is precached, so it opens instantly and works with no
        // network at all — which is the point of a local-first tracker.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 5173, open: false },
});
