// Entry point: loads state, wires the router, tab bar, FAB, and service worker.
import { startRouter } from './router.js';
import { renderTabbar, setActiveTab } from './ui/nav.js';
import { initState, subscribe } from './state.js';
import * as dashboard from './views/dashboard.js';
import * as logbook from './views/logbook.js';
import * as addFlight from './views/add-flight.js';
import * as flight from './views/flight.js';
import * as recaps from './views/recaps.js';
import * as settings from './views/settings.js';

const outlet = document.getElementById('app');
const tabbar = document.getElementById('tabbar');

renderTabbar(tabbar);

const routes = {
	'#/': dashboard,
	'#/logbook': logbook,
	'#/add': addFlight,
	'#/flight': flight,
	'#/recaps': recaps,
	'#/settings': settings
};

// Full-screen sub-pages (no tab bar, no FAB).
const SUBPAGES = new Set(['#/add', '#/flight']);

// Global floating "+" button (hidden on the add screen itself).
const fab = document.createElement('button');
fab.className = 'fab';
fab.type = 'button';
fab.textContent = '+';
fab.setAttribute('aria-label', 'Nouveau vol');
fab.addEventListener('click', () => {
	location.hash = '#/add';
});
document.body.appendChild(fab);

async function main() {
	await initState();

	const router = startRouter({
		outlet,
		routes,
		fallback: '#/',
		onNavigate(path) {
			const isSubpage = SUBPAGES.has(path);
			setActiveTab(tabbar, path);
			document.body.classList.toggle('is-subpage', isSubpage);
			fab.hidden = isSubpage;
		}
	});

	// Re-render the current view whenever the logbook changes.
	subscribe(() => router.rerender());
}

main();

// Register the service worker. Resolve relative to this module so it works at
// any GitHub Pages subpath; scope defaults to the app/ directory.
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		const swUrl = new URL('../sw.js', import.meta.url);
		navigator.serviceWorker.register(swUrl).catch((err) => console.warn('SW registration failed', err));
	});
}
