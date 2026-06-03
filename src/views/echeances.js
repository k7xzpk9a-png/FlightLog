// Échéances — currency (auto from logbook), tests & medical (manual dates).
// Each item shows a status dot + expiry; manual items have an inline date input.
import { getFlights, getEcheances, setEcheanceDate } from '../state.js';
import { ECHEANCES, ECHEANCE_FAMILIES, computeEcheance, machinesFlown, fmtDate } from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DOT = { ok: 'dot--good', alert: 'dot--warn', expired: 'dot--bad', none: '' };
const SEV = { expired: 0, alert: 1, ok: 2, none: 3 };

function statusText(r) {
	if (r.status === 'none') return 'jamais';
	if (r.status === 'expired') return `expiré depuis le ${fmtDate(r.expiry)}`;
	const days = `${r.daysLeft} j`;
	return `expire le ${fmtDate(r.expiry)} · ${days}`;
}

// One row. `label` is the displayed name, `key` the échéance store key (= def.id,
// or `def.id::machine` for per-machine items) used as the date input's data-id.
function row(def, label, key, r) {
	const detail =
		def.kind === 'auto'
			? `<span class="view__subtitle">D'après le carnet${r.refDate ? ` · dernier vol ${fmtDate(r.refDate)}` : ''}</span>`
			: `<input class="ech-date" type="date" data-id="${esc(key)}" value="${esc(r.refDate)}" aria-label="Date ${esc(label)}" />`;
	return `
	<div class="card" style="padding:12px 16px">
		<div class="view__head">
			<strong><span class="dot ${DOT[r.status]}"></span> ${esc(label)}</strong>
			<span class="view__subtitle">${statusText(r)}</span>
		</div>
		<div style="margin-top:8px">${detail}</div>
	</div>`;
}

// Flatten a family's échéances into individual rows, expanding per-machine items
// (PU) into one entry per machine flown.
function rowsForFamily(fam, flights, store) {
	const machines = machinesFlown(flights);
	const items = [];
	for (const def of ECHEANCES.filter((d) => d.family === fam.key)) {
		if (def.perMachine) {
			for (const m of machines) {
				const key = `${def.id}::${m}`;
				items.push({ def, label: `${def.label} — ${m}`, key, r: computeEcheance(def, flights, store, undefined, key) });
			}
		} else {
			items.push({ def, label: def.label, key: def.id, r: computeEcheance(def, flights, store) });
		}
	}
	return items;
}

function familyHTML(fam, flights, store) {
	const items = rowsForFamily(fam, flights, store).sort(
		(a, b) => SEV[a.r.status] - SEV[b.r.status] || (a.r.daysLeft || 0) - (b.r.daysLeft || 0)
	);
	if (!items.length) return '';
	return `<p class="section-label">${esc(fam.label)}</p>${items.map((it) => row(it.def, it.label, it.key, it.r)).join('')}`;
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
