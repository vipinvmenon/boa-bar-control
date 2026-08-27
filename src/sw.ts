/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

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

// BAR-138. This previously matched EVERY same-origin GET, including navigation
// documents that the NavigationRoute above already handles. Caching documents
// here can serve a stale shell, and combined with an update that could never
// activate, a device could be pinned to an old bundle indefinitely. Narrowed to
// same-origin data requests only.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    request.mode !== 'navigate' &&
    request.destination === '' &&
    url.origin === self.location.origin,
  new NetworkFirst({ cacheName: 'boa-data-v1', networkTimeoutSeconds: 3 }),
)

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
