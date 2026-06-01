// Accueil — last flight + career totals from stored data.
import { getVisibleFlights } from '../state.js';
import { computeTotals, lastFlight, flightTotalHours, fmtHours, fmtDate } from '../model.js';

const CURRENCIES = ['VAV', 'IFR', 'Sil', 'Treuil'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function lastFlightCard(f) {
	if (!f) {
		return `<div class="card"><div class="empty"><div class="empty__icon">🚁</div>
			<p>Aucun vol enregistré pour l'instant.</p></div></div>`;
	}
	const machine = [f.machineType, f.machineNumber].filter(Boolean).join(' · ');
	return `
	<a class="card card--tap" href="#/flight?id=${encodeURIComponent(f.id)}" style="text-decoration:none;color:inherit">
		<div class="view__head">
			<strong>${esc(f.mission) || (f.kind === 'simu' ? 'Simulateur' : 'Vol')}</strong>
			<span class="view__subtitle">${esc(fmtDate(f.date))}</span>
		</div>
		<p class="view__subtitle">${esc(machine) || '—'} · ${esc(f.role) || '—'}</p>
		<div class="chips" style="margin-top:10px">
			<span class="chip">${fmtHours(flightTotalHours(f))}</span>
			<span class="chip">Jour ${fmtHours(f.hoursDay)}</span>
			<span class="chip">Nuit ${fmtHours(f.hoursNight)}</span>
		</div>
	</a>`;
}

export function render() {
	const flights = getVisibleFlights();
	const t = computeTotals(flights);
	const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

	return `
	<section class="view">
		<header class="view__head">
			<div>
				<h1 class="view__title">Carnet de vol</h1>
				<p class="view__subtitle">${today}</p>
			</div>
		</header>

		<p class="section-label">Dernier vol</p>
		${lastFlightCard(lastFlight(flights))}

		<p class="section-label">Échéances</p>
		<div class="chips">
			${CURRENCIES.map((c) => `<span class="chip"><span class="dot"></span>${c}</span>`).join('')}
		</div>

		<p class="section-label">Totaux carrière</p>
		<div class="stat-grid">
			<div class="stat"><div class="stat__value">${fmtHours(t.total)}</div><div class="stat__label">Heures totales</div></div>
			<div class="stat"><div class="stat__value">${fmtHours(t.hoursDay)}</div><div class="stat__label">Jour</div></div>
			<div class="stat"><div class="stat__value">${fmtHours(t.hoursNight)}</div><div class="stat__label">Nuit</div></div>
			<div class="stat"><div class="stat__value">${fmtHours(t.hoursIFR)}</div><div class="stat__label">IFR</div></div>
			<div class="stat"><div class="stat__value">${t.vols}</div><div class="stat__label">Vols</div></div>
		</div>
	</section>`;
}
