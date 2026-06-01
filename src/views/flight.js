// Détail d'un vol — view all fields, with edit & delete. Route: #/flight?id=…
import { getFlights, deleteFlight } from '../state.js';
import { HOUR_FIELDS, COUNT_FIELDS, flightTotalHours, fmtHours, fmtDate, num } from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function currentId() {
	return new URLSearchParams(location.hash.split('?')[1] || '').get('id');
}

function chip(label, val) {
	return `<span class="chip">${esc(label)} ${esc(val)}</span>`;
}

function rowLine(label, val) {
	return `<div class="view__head"><span class="view__subtitle">${esc(label)}</span><span>${esc(val)}</span></div>`;
}

export function render() {
	const f = getFlights().find((x) => x.id === currentId());
	const back = `<a class="iconbtn" href="#/logbook" aria-label="Retour">‹</a>`;

	if (!f) {
		return `
		<header class="topbar">${back}<span class="topbar__title">Vol</span></header>
		<section class="view"><div class="card"><div class="empty">Vol introuvable.</div></div></section>`;
	}

	const machine = [f.machineType, f.machineNumber].filter(Boolean).join(' · ');
	const hours = HOUR_FIELDS.filter((h) => num(f[h.key]) > 0).map((h) => chip(h.label, fmtHours(f[h.key])));
	const counts = COUNT_FIELDS.filter((c) => num(f[c.key]) > 0).map((c) => chip(c.label, num(f[c.key])));
	const events = f.events ? Object.entries(f.events).map(([k, v]) => chip(k, v)) : [];

	return `
	<header class="topbar">
		${back}
		<span class="topbar__title">${esc(fmtDate(f.date))}</span>
		<span class="topbar__spacer"></span>
		<a class="btn" href="#/add?id=${encodeURIComponent(f.id)}">Modifier</a>
	</header>

	<section class="view">
		<div class="card">
			<div class="view__head">
				<strong>${esc(f.mission) || (f.kind === 'simu' ? 'Simulateur' : 'Vol')}</strong>
				<span class="chip">${fmtHours(flightTotalHours(f))}</span>
			</div>
			<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
				${rowLine('Type', f.kind === 'simu' ? 'Simulateur' : 'Vol')}
				${rowLine('Machine', machine || '—')}
				${rowLine('Fonction', f.role || '—')}
				${f.pilotName ? rowLine('Équipage', f.pilotName) : ''}
				${f.crewName ? rowLine('Coéquipier', f.crewName) : ''}
				${f.code ? rowLine('Code', f.code) : ''}
			</div>
		</div>

		${hours.length ? `<p class="section-label">Heures</p><div class="chips">${hours.join('')}</div>` : ''}
		${counts.length ? `<p class="section-label">Approches</p><div class="chips">${counts.join('')}</div>` : ''}
		${events.length ? `<p class="section-label">Activités</p><div class="chips">${events.join('')}</div>` : ''}
		${f.notes ? `<p class="section-label">Remarques</p><div class="card">${esc(f.notes)}</div>` : ''}

		<button class="btn btn--block" id="del-btn" type="button" style="color:var(--bad)">Supprimer ce vol</button>
	</section>`;
}

export function mount(root) {
	const id = currentId();
	root.querySelector('#del-btn')?.addEventListener('click', async () => {
		if (confirm('Supprimer ce vol ? Cette action est définitive.')) {
			await deleteFlight(id);
			location.hash = '#/logbook';
		}
	});
}
