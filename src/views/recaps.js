// Bilans — totals, monthly trend, and per-machine breakdown, all from stored data.
import { getFlights } from '../state.js';
import {
	computeTotals,
	computeByMachine,
	computeMonthly,
	filterByPeriod,
	flightTotalHours,
	fmtHours
} from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const PERIODS = [
	{ key: 'mois', label: 'Mois' },
	{ key: 'annee', label: 'Année' },
	{ key: '12dm', label: '12DM' },
	{ key: 'carriere', label: 'Carrière' }
];

// View-local selection, preserved across re-renders.
let period = 'carriere';

function statsHTML(flights) {
	const t = computeTotals(flights);
	const cells = [
		['Heures totales', fmtHours(t.total)],
		['Jour', fmtHours(t.hoursDay)],
		['Nuit', fmtHours(t.hoursNight)],
		['IFR', fmtHours(t.hoursIFR)],
		['Atterrissages', t.landings],
		['Vols', t.vols]
	];
	if (t.simus) cells.push(['Simu', t.simus]);
	return cells
		.map(
			([label, val]) =>
				`<div class="stat"><div class="stat__value">${val}</div><div class="stat__label">${label}</div></div>`
		)
		.join('');
}

// Tiny dependency-free bar chart of monthly hours (12 months).
function trendHTML(flights) {
	const data = computeMonthly(flights, 12);
	const max = Math.max(1, ...data.map((d) => d.hours));
	const bars = data
		.map((d) => {
			const h = Math.round((d.hours / max) * 100);
			return `<div class="bar" title="${d.label} : ${fmtHours(d.hours)}">
				<div class="bar__fill" style="height:${h}%"></div>
				<div class="bar__lbl">${esc(d.label[0])}</div>
			</div>`;
		})
		.join('');
	return `<div class="bars">${bars}</div>`;
}

function byMachineHTML(flights) {
	const rows = computeByMachine(flights).filter((m) => m.hours > 0);
	if (!rows.length) return `<div class="card"><div class="empty">Aucune donnée.</div></div>`;
	const max = Math.max(...rows.map((m) => m.hours));
	return rows
		.map((m) => {
			const pct = Math.round((m.hours / max) * 100);
			return `
		<div class="card" style="padding:12px 16px">
			<div class="view__head">
				<strong>${esc(m.machine)}</strong>
				<span class="view__subtitle">${fmtHours(m.hours)} · ${m.count} vol${m.count > 1 ? 's' : ''}</span>
			</div>
			<div class="meter" style="margin-top:8px"><div class="meter__fill" style="width:${pct}%"></div></div>
		</div>`;
		})
		.join('');
}

function bodyHTML() {
	const flights = filterByPeriod(getFlights(), period);
	return `
		<div class="stat-grid">${statsHTML(flights)}</div>
		<p class="section-label">Activité (12 derniers mois)</p>
		${trendHTML(getFlights())}
		<p class="section-label">Par machine</p>
		${byMachineHTML(flights)}`;
}

export function render() {
	return `
	<section class="view">
		<header class="view__head">
			<div>
				<h1 class="view__title">Bilans</h1>
				<p class="view__subtitle">Heures et activité</p>
			</div>
		</header>

		<div class="segmented" role="tablist">
			${PERIODS.map(
				(p) =>
					`<button role="tab" data-period="${p.key}" aria-selected="${p.key === period}">${p.label}</button>`
			).join('')}
		</div>

		<div id="recap-body">${bodyHTML()}</div>
	</section>`;
}

export function mount(root) {
	const seg = root.querySelector('.segmented');
	const body = root.querySelector('#recap-body');
	seg?.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-period]');
		if (!btn) return;
		period = btn.getAttribute('data-period');
		for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-selected', String(b === btn));
		if (body) body.innerHTML = bodyHTML();
	});
}
