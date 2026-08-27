import '@fontsource/anton/400.css'
import '@fontsource/oswald/400.css'
import '@fontsource/oswald/600.css'
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/600.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { registerSW } from 'virtual:pwa-register'
import { router } from './app/router'
import { DemoStoreProvider } from './lib/demo-store'
import { startMovementSync } from './lib/offline-db'
import { AuthProvider } from './lib/auth'
import { AuthGate } from './features/AuthGate'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
})

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('boa:pwa-update', { detail: updateSW }))
  },
})

startMovementSync()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <DemoStoreProvider>
            <RouterProvider router={router} />
          </DemoStoreProvider>
        </AuthGate>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
