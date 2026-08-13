/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// Switched from VitePWA's generateSW to injectManifest -- generateSW
// auto-writes the whole service worker from config and has no hook for a
// custom `push` event listener, which push notifications need. This file
// replicates every runtime-caching rule the old generateSW config had
// (same cache names/strategies/expiration) so existing offline/caching
// behavior doesn't regress, then adds push handling on top.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

self.skipWaiting();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Always try the network first for navigation (the HTML shell) so a fixed
// deploy is visible on the very next load instead of getting stuck behind
// a service worker serving a precached shell from before the fix. Falls
// back to the cached shell only when genuinely offline. Must stay first:
// Workbox checks routes in registration order.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'html-shell', networkTimeoutSeconds: 3 }),
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-api',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })],
  }),
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
  new CacheFirst({
    cacheName: 'supabase-storage',
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Tenant logos & branded assets (any image, any host) -- instant on return visits
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'branded-images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
);

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Push notifications ---

interface PushPayload {
  title: string;
  body: string;
  referenceId?: string | null;
}

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/pwa-icon-512.png',
      badge: '/pwa-icon-512.png',
      data: { referenceId: payload.referenceId ?? null },
    }),
  );
});

// Focuses an already-open tab if one exists rather than always opening a
// new one -- most users will have the PWA open in the background already.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});
