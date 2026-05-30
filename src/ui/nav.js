// Bottom tab bar. Icons are emoji to stay dependency-free; swap for inline SVG later.

export const TABS = [
	{ path: '#/', label: 'Accueil', icon: '🏠' },
	{ path: '#/logbook', label: 'Carnet', icon: '📒' },
	{ path: '#/recaps', label: 'Bilans', icon: '📊' },
	{ path: '#/settings', label: 'Réglages', icon: '⚙️' }
];

export function renderTabbar(el) {
	el.innerHTML = TABS.map(
		(t) => `
		<a class="tab" href="${t.path}" data-path="${t.path}">
			<span class="tab__icon" aria-hidden="true">${t.icon}</span>
			<span>${t.label}</span>
		</a>`
	).join('');
}

export function setActiveTab(el, path) {
	for (const a of el.querySelectorAll('.tab')) {
		if (a.getAttribute('data-path') === path) a.setAttribute('aria-current', 'page');
		else a.removeAttribute('aria-current');
	}
}
