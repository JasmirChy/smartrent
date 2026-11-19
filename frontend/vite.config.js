import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'my-house.jpeg'],
      manifest: {
        name: 'SmartRent — House & Tenant Portal',
        short_name: 'SmartRent',
        description: 'Transparent sub-metered electricity, digital billing, and tenant management.',
        theme_color: '#4F46E5',
        background_color: '#F8FAFC',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/logo.png?v=3',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo.png?v=3',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/logo.png?v=3',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api/, /^\/media/],
      },
    }),
  ],
})