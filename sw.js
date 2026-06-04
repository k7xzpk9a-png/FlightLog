// Hand-written service worker — no Workbox, no build step.
// Strategy:
//   - Precache the app shell on install (so the app opens fully offline).
//   - Navigations: network-first, falling back to the cached shell when offline.
//   - Other GETs: cache-first, then network, caching successful responses.
//
// Bump CACHE_VERSION whenever shell files change to retire the old cache.
const CACHE_VERSION = 'v7';
const CACHE_NAME = 'carnet-' + CACHE_VERSION;

// Relative to the service worker scope, so this works at any GitHub Pages subpath.
const SHELL = [
	'./',
	'./index.html',
	'./manifest.webmanifest',
	'./styles.css',
	'./src/app.js',
	'./src/router.js',
	'./src/model.js',
	'./src/db.js',
	'./src/state.js',
	'./src/github.js',
	'./src/ui/nav.js',
	'./src/views/dashboard.js',
	'./src/views/logbook.js',
	'./src/views/add-flight.js',
	'./src/views/flight.js',
	'./src/views/echeances.js',
	'./src/views/recaps.js',
	'./src/views/settings.js',
	'./assets/icons/icon-192.png',
	'./assets/icons/icon-512.png',
	'./assets/icons/icon-512-maskable.png',
	'./assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	// App navigations → network-first, fall back to cached shell offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request).catch(() => caches.match('./index.html', { ignoreSearch: true }))
		);
		return;
	}

	// Everything else → cache-first, then network (and cache it).
	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response.ok && response.type === 'basic') {
					const copy = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
				}
				return response;
			});
		})
	);
});
