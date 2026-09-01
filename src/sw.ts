/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<never> }

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
  }),
)

registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({ cacheName: 'boa-static-v1' }),
)

registerRoute(
  ({ request }) => request.destination === 'image' || request.destination === 'font',
  new CacheFirst({
    cacheName: 'boa-assets-v1',
    plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// BAR-076. Cache only non-positional reference reads needed to open the app
// during a network outage. Snapshots, memberships, people, dockets, counts,
// ledger reads, RPCs, and every write remain network-only so a cached response
// cannot reveal the expected position to a counting user.
const supabaseOrigin = import.meta.env.VITE_SUPABASE_URL
  ? new URL(import.meta.env.VITE_SUPABASE_URL).origin
  : null
const referencePaths = new Set(['/rest/v1/boa_bar_sku', '/rest/v1/boa_bar_location'])

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    request.mode !== 'navigate' &&
    url.origin === supabaseOrigin &&
    referencePaths.has(url.pathname),
  new StaleWhileRevalidate({ cacheName: 'boa-reference-v1' }),
)

// Remove caches created by the previous broad data/page routes after the safer
// worker activates on a shared festival device.
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.delete('boa-data-v1'),
    caches.delete('boa-pages-v1'),
  ]))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
