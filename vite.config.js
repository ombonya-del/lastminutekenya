import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// LastMinuteKenya — ONE codebase, THREE installable PWAs.
// Build with VITE_APP=public|network|admin (see package.json scripts). Each
// build gets its own manifest, theme colour and service worker, and deploys to
// its own subdomain — so each installs independently on mobile + desktop and
// the three stay isolated (separate origins = separate auth, storage, SW).
//
//   public   → app.lastminutekenya.com      clients (coral/gold)
//   network  → network.lastminutekenya.com  providers (green/teal)
//   admin    → admin.lastminutekenya.com     operations + assessors (indigo)

const APP = process.env.VITE_APP || 'public'

const APPS = {
  public: {
    name: 'LastMinute Kenya — We Save the Day',
    short_name: 'LastMinute',
    description:
      'When your event provider flops, we save the day. Raise an SOS, track the rescue, and shop last-minute Save-The-Day gifts.',
    theme: '#ff7a2f',
    background: '#fff8f2',
  },
  network: {
    name: 'LMK Network — You Are the Rescue',
    short_name: 'LMK Network',
    description:
      'The Last Minute Network for vetted providers. Go on standby, catch pre-dispatch alerts near you, and accept rescue jobs.',
    theme: '#0ea678',
    background: '#f1fbf6',
  },
  admin: {
    name: 'LMK Command — Operations',
    short_name: 'LMK Command',
    description:
      'Operations for LastMinute Kenya: dispatch rescues, review scorecards, manage the Network, and preview every stakeholder surface.',
    theme: '#5468ff',
    background: '#f3f5ff',
  },
}
const meta = APPS[APP] || APPS.public

export default defineConfig({
  define: {
    // Make the flag available to client code (import.meta.env.VITE_APP).
    'import.meta.env.VITE_APP': JSON.stringify(APP),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // per-app service worker + manifest file so the three don't collide
      filename: `sw-${APP}.js`,
      manifestFilename: `manifest-${APP}.webmanifest`,
      includeAssets: ['favicon.svg', 'icons/icon.svg', 'privacy.html'],
      manifest: {
        name: meta.name,
        short_name: meta.short_name,
        description: meta.description,
        theme_color: meta.theme,
        background_color: meta.background,
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        id: `/?app=${APP}`,
        categories: ['business', 'productivity', 'lifestyle'],
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
      },
      workbox: {
        // privacy.html is a real static page, not an SPA route.
        navigateFallbackDenylist: [/^\/privacy\.html$/],
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2}'],
      },
    }),
  ],
})
