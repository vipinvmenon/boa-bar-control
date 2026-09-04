// `vitest/config` rather than `vite`, because the `test` block below is Vitest's
// and `vite`'s own `defineConfig` does not type it.
import { defineConfig } from 'vitest/config'
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
  },
  /*
     The gate must measure this repository, not copies of it.

     Agents working in isolated git worktrees check out under
     `.claude/worktrees/`, which is inside the project root, so Vitest's default
     discovery collected every worktree's tests as well as this tree's: one run
     reported 755 passing tests where the suite has 151. A gate that counts five
     copies of itself cannot tell you whether the code in front of you passes,
     and on this project a verification that did not measure what it claimed to
     measure is the original defect, not a nuisance.
  */
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/worktrees/**'],
  },
})
