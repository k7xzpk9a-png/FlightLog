// Carnet — list of flights from stored data, with search + type filter.
import { getVisibleFlights, getPilotOnly, setPilotOnly } from '../state.js';
import { flightTotalHours, fmtHours, fmtDate } from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FILTERS = [
	{ key: 'all', label: 'Tous' },
	{ key: 'vol', label: 'Vols' },
	{ key: 'simu', label: 'Simu' }
];

// View-local UI state, preserved across re-renders within a session.
let filter = 'all';
let query = '';

const byDateDesc = (a, b) =>
	a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1;

function matches(f) {
	if (filter !== 'all' && f.kind !== filter) return false;
	if (!query) return true;
	const hay = [f.mission, f.machineType, f.machineNumber, f.role, f.date, f.crewName].join(' ').toLowerCase();
	return hay.includes(query.toLowerCase());
}

function row(f) {
	const machine = [f.machineType, f.machineNumber].filter(Boolean).join(' · ');
	return `
	<a class="card card--tap" href="#/flight?id=${encodeURIComponent(f.id)}" style="padding:12px 16px;display:block;text-decoration:none;color:inherit">
		<div class="view__head">
			<strong>${esc(f.mission) || (f.kind === 'simu' ? 'Simulateur' : 'Vol')}</strong>
			<span class="view__subtitle">${esc(fmtDate(f.date))}</span>
		</div>
		<div class="view__head" style="margin-top:4px">
			<span class="view__subtitle">${esc(machine) || '—'}${f.role ? ' · ' + esc(f.role) : ''}</span>
			<span class="view__subtitle">${fmtHours(flightTotalHours(f))}</span>
		</div>
	</a>`;
}

function listHTML() {
	const all = getVisibleFlights();
	const list = all.filter(matches).sort(byDateDesc);
	if (list.length) return list.map(row).join('');
	return `<div class="card"><div class="empty"><div class="empty__icon">📒</div>
		<p>${all.length ? 'Aucun résultat.' : 'Le carnet est vide.<br />Touchez « + » pour ajouter un vol.'}</p>
		</div></div>`;
}

export function render() {
	const all = getVisibleFlights();
	return `
	<section class="view">
		<header class="view__head">
			<div>
				<h1 class="view__title">Carnet</h1>
				<p class="view__subtitle">${all.length} entrée${all.length > 1 ? 's' : ''}</p>
			</div>
		</header>

		<div class="field">
			<input id="lb-search" type="search" placeholder="Rechercher (machine, mission, date…)" value="${esc(query)}" />
		</div>

		<div class="chips">
			<button class="chip" id="lb-pilot-toggle" type="button" aria-pressed="${getPilotOnly()}" style="cursor:pointer">
				<span class="dot ${getPilotOnly() ? 'dot--good' : ''}"></span>Pilote seulement
			</button>
		</div>

		<div class="chips" id="lb-filters">
			${FILTERS.map(
				(f) =>
					`<button class="chip" data-filter="${f.key}" style="cursor:pointer">
						<span class="dot ${f.key === filter ? 'dot--good' : ''}"></span>${f.label}
					</button>`
			).join('')}
		</div>

		<div id="lb-list">${listHTML()}</div>
	</section>`;
}

export function mount(root) {
	const listEl = root.querySelector('#lb-list');
	const refresh = () => {
		if (listEl) listEl.innerHTML = listHTML();
	};

	const search = root.querySelector('#lb-search');
	if (search) {
		search.addEventListener('input', () => {
			query = search.value;
			refresh();
		});
	}

	// Toggling the pilot filter mutates persisted global state, which emits and
	// triggers a full re-render of this view (no manual refresh needed).
	root.querySelector('#lb-pilot-toggle')?.addEventListener('click', () => {
		setPilotOnly(!getPilotOnly());
	});

	root.querySelector('#lb-filters')?.addEventListener('click', (e) => {
		const btn = e.target.closest('[data-filter]');
		if (!btn) return;
		filter = btn.getAttribute('data-filter');
		for (const b of root.querySelectorAll('#lb-filters .dot')) b.classList.remove('dot--good');
		btn.querySelector('.dot')?.classList.add('dot--good');
		refresh();
	});
}
