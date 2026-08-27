// BAR-034. The design uses Oswald 400/500/600/700 — 500 and 700 account for
// most of its UI caps. `font-synthesis: none` is set globally in styles.css, so
// an unloaded weight does not fall back gracefully: it silently renders at the
// wrong weight. All four must be loaded.
import '@fontsource/anton/400.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/500.css'
import '@fontsource/oswald/600.css'
import '@fontsource/oswald/700.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/600.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import { router } from './app/router'
import { DemoStoreProvider } from './lib/demo-store'
import { RepositoryProvider } from './data/RepositoryProvider'
import { startMovementSync } from './lib/offline-db'
import { AuthProvider } from './lib/auth'
import { AuthGate } from './features/AuthGate'
import { setPendingUpdate } from './lib/pwa-update'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
})

// BAR-138. The previous version dispatched an event nothing listened for, so
// `updateSW` was never called and a waiting worker never activated.
const updateSW = registerSW({
  onNeedRefresh() {
    setPendingUpdate(updateSW)
  },
})

startMovementSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <DemoStoreProvider>
            <RepositoryProvider>
              <RouterProvider router={router} />
            </RepositoryProvider>
          </DemoStoreProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
