// Échéances — currency (auto from logbook), tests & medical (manual dates).
// Each item shows a status dot + expiry; manual items have an inline date input.
import { getFlights, getEcheances, setEcheanceDate } from '../state.js';
import { ECHEANCES, ECHEANCE_FAMILIES, computeEcheance, fmtDate } from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DOT = { ok: 'dot--good', alert: 'dot--warn', expired: 'dot--bad', none: '' };
const SEV = { expired: 0, alert: 1, ok: 2, none: 3 };

function statusText(r) {
	if (r.status === 'none') return 'jamais';
	if (r.status === 'expired') return `expiré depuis le ${fmtDate(r.expiry)}`;
	const days = `${r.daysLeft} j`;
	return `expire le ${fmtDate(r.expiry)} · ${days}`;
}

function row(def, r) {
	const detail =
		def.kind === 'auto'
			? `<span class="view__subtitle">D'après le carnet${r.refDate ? ` · dernier vol ${fmtDate(r.refDate)}` : ''}</span>`
			: `<input class="ech-date" type="date" data-id="${def.id}" value="${esc(r.refDate)}" aria-label="Date ${esc(def.label)}" />`;
	return `
	<div class="card" style="padding:12px 16px">
		<div class="view__head">
			<strong><span class="dot ${DOT[r.status]}"></span> ${esc(def.label)}</strong>
			<span class="view__subtitle">${statusText(r)}</span>
		</div>
		<div style="margin-top:8px">${detail}</div>
	</div>`;
}

function familyHTML(fam, flights, store) {
	const items = ECHEANCES.filter((d) => d.family === fam.key)
		.map((def) => ({ def, r: computeEcheance(def, flights, store) }))
		.sort((a, b) => SEV[a.r.status] - SEV[b.r.status] || (a.r.daysLeft || 0) - (b.r.daysLeft || 0));
	if (!items.length) return '';
	return `<p class="section-label">${esc(fam.label)}</p>${items.map(({ def, r }) => row(def, r)).join('')}`;
}

export function render() {
	const flights = getFlights();
	const store = getEcheances();
	return `
	<section class="view">
		<header class="view__head">
			<div>
				<h1 class="view__title">Échéances</h1>
				<p class="view__subtitle">Validités &amp; aguerrissement</p>
			</div>
		</header>
		${ECHEANCE_FAMILIES.map((fam) => familyHTML(fam, flights, store)).join('')}
	</section>`;
}

export function mount(root) {
	root.querySelectorAll('.ech-date').forEach((input) => {
		input.addEventListener('change', () => {
			setEcheanceDate(input.getAttribute('data-id'), input.value);
		});
	});
}
