import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['assets/boa-logo-2026.png'],
      manifest: {
        name: 'BOA Bar Control',
        short_name: 'Bar Control',
        description: 'Festival inventory, chain of custody, counts and audit.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0D0D12',
        theme_color: '#0D0D12',
        orientation: 'portrait-primary',
        icons: [
          { src: '/assets/boa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase') || id.includes('/ws/') || id.includes('realtime')) return 'supabase'
          if (id.includes('dexie')) return 'offline'
          if (id.includes('lucide-react') || id.includes('qrcode.react')) return 'ui-tools'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['terminal.local', '127.0.0.1', 'localhost']
  },
  preview: {
    host: '0.0.0.0'
  }
})
