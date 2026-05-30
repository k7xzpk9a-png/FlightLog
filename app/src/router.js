// Minimal hash-based router. No dependencies; works from any subpath.
//
// A "view" is a module that exports:
//   - render(): string         -> HTML for the page
//   - mount?(root): cleanup?   -> optional: wire listeners; may return a cleanup fn
//
// Returns a controller with rerender() so app state changes can refresh the view.

export function startRouter(cfg) {
	let cleanup;

	function currentPath() {
		const hash = location.hash || cfg.fallback;
		return hash.split('?')[0];
	}

	function renderRoute() {
		if (cleanup) {
			cleanup();
			cleanup = undefined;
		}
		const path = currentPath();
		const view = cfg.routes[path] || cfg.routes[cfg.fallback];
		cfg.outlet.innerHTML = view.render();
		window.scrollTo(0, 0);
		if (view.mount) cleanup = view.mount(cfg.outlet) || undefined;
		if (cfg.onNavigate) cfg.onNavigate(path);
	}

	window.addEventListener('hashchange', renderRoute);
	renderRoute();

	return { rerender: renderRoute };
}
