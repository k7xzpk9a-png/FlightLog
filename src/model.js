// Flight data model. Plain objects; keys are camelCase versions of the source
// xlsx (Vols+Simus / sheet6) columns. Derived columns (Mois/Année/Total/Coef…)
// are COMPUTED here, never stored.

// Hour fields. `total` (Jour + Nuit) is the only one summed for career totals;
// the rest are overlapping categories logged separately.
// (Mapping to the source xlsx columns lives in tools/migrate.mjs.)
// `hoursIFR` is the total instrument time (VSV). In the source xlsx it was
// logged across two columns, CAG (général) + CAM (militaire); migration sums
// them into this single field. (The source "IFR" column AS was empty/garbage.)
export const HOUR_FIELDS = [
	{ key: 'hoursDay', label: 'Jour' },
	{ key: 'hoursNight', label: 'Nuit' },
	{ key: 'hoursSil', label: 'Sil' },
	{ key: 'hoursIFR', label: 'IFR' },
	{ key: 'hoursMEDay', label: 'ME Jour' },
	{ key: 'hoursMENight', label: 'ME Nuit' }
];

// Counters (integers): instrument approaches. (Landings aren't tracked —
// helicopter pilots don't log them, and the source column was empty/garbage.)
export const COUNT_FIELDS = [
	{ key: 'apprILS', label: 'ILS' },
	{ key: 'apprVOR', label: 'VOR' },
	{ key: 'apprNDB', label: 'NDB' },
	{ key: 'apprGCAPAR', label: 'GCA/PAR' },
	{ key: 'apprPOA', label: 'POA' }
];

// Common machine types and crew roles (from the source `Données` lookups).
export const MACHINES = ['EC120', 'AS555 Fennec', 'AS532 Puma', 'EC225 / H225', 'NH90', 'CH47'];
export const ROLES = ['PIL', 'EP', 'PCE', 'APE', 'OBS', 'ME', 'VIG', 'MOS1'];

// Roles flown as the operating pilot (PIL = pilote, EP = élève pilote). Every
// other logged role (PCE, APE, OBS, ME, VIG, MOS1, …) is a passenger /
// non-flying seat and is hidden by the "Pilote seulement" filter.
export const PILOT_ROLES = ['PIL', 'EP'];

/** True if this flight was logged in a flying (pilot) role. */
export function isPilotFlight(f) {
	return PILOT_ROLES.includes(String(f.role || '').trim().toUpperCase());
}

/** A blank flight with sensible defaults (today, type "vol", zeros). */
export function newFlight() {
	const f = {
		id: '',
		date: new Date().toISOString().slice(0, 10),
		kind: 'vol', // 'vol' | 'simu'
		mission: '',
		machineType: '',
		machineNumber: '',
		role: '',
		grade: '',
		pilotName: '',
		code: '',
		crewName: '',
		crewRole: '',
		notes: ''
	};
	for (const { key } of HOUR_FIELDS) f[key] = 0;
	for (const { key } of COUNT_FIELDS) f[key] = 0;
	return f;
}

/** Total flown hours for one flight = Jour + Nuit. */
export function flightTotalHours(f) {
	return num(f.hoursDay) + num(f.hoursNight);
}

/** Aggregate totals across a list of flights. */
export function computeTotals(flights) {
	const t = { count: 0, vols: 0, simus: 0, hoursDay: 0, hoursNight: 0, hoursIFR: 0, total: 0 };
	for (const f of flights) {
		t.count++;
		if (f.kind === 'simu') t.simus++;
		else t.vols++;
		t.hoursDay += num(f.hoursDay);
		t.hoursNight += num(f.hoursNight);
		t.hoursIFR += num(f.hoursIFR);
	}
	t.total = t.hoursDay + t.hoursNight;
	return t;
}

/** Breakdown of hours + flight count per machine type, sorted by hours desc. */
export function computeByMachine(flights) {
	const map = new Map();
	for (const f of flights) {
		const key = f.machineType || '—';
		const e = map.get(key) || { machine: key, hours: 0, count: 0 };
		e.hours += flightTotalHours(f);
		e.count++;
		map.set(key, e);
	}
	return [...map.values()].sort((a, b) => b.hours - a.hours);
}

/** Monthly hours for the last `months` months (oldest→newest), for a sparkline. */
export function computeMonthly(flights, months = 12, today = new Date()) {
	const out = [];
	for (let i = months - 1; i >= 0; i--) {
		const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
		const ym = d.toISOString().slice(0, 7);
		out.push({ ym, label: d.toLocaleDateString('fr-FR', { month: 'short' }), hours: 0 });
	}
	const idx = new Map(out.map((o, i) => [o.ym, i]));
	for (const f of flights) {
		const i = idx.get((f.date || '').slice(0, 7));
		if (i != null) out[i].hours += flightTotalHours(f);
	}
	return out;
}

/**
 * Bars for the Bilans trend chart, adapted to the selected period so the chart
 * covers the SAME window as the stats above it:
 *   mois     → one bar per day of the current month
 *   annee    → 12 bars, Jan→Dec of the current year
 *   12dm     → rolling last 12 months (oldest→newest)
 *   carriere → one bar per calendar year, first→last flight
 * Each bar: { label (full, for tooltip), tick (short axis label), hours }.
 */
export function computeTrend(flights, period, today = new Date()) {
	const fill = (out, idx, sliceFn) => {
		for (const f of flights) {
			const i = idx.get(sliceFn(f.date || ''));
			if (i != null) out[i].hours += flightTotalHours(f);
		}
		return out;
	};

	if (period === 'mois') {
		const y = today.getFullYear();
		const m = today.getMonth();
		const days = new Date(y, m + 1, 0).getDate();
		const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
		const out = [];
		for (let d = 1; d <= days; d++) {
			// Label only every 5th day (+ the 1st) to avoid crowding ~30 bars.
			out.push({ label: `${d}`, tick: d === 1 || d % 5 === 0 ? `${d}` : '', hours: 0 });
		}
		const idx = new Map(out.map((o, i) => [String(i + 1).padStart(2, '0'), i]));
		return fill(out, idx, (date) => (date.startsWith(prefix) ? date.slice(8, 10) : ''));
	}

	if (period === 'annee') {
		const y = today.getFullYear();
		const out = [];
		for (let m = 0; m < 12; m++) {
			const label = new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'short' });
			out.push({ label, tick: label[0], hours: 0 });
		}
		const idx = new Map(out.map((o, i) => [`${y}-${String(i + 1).padStart(2, '0')}`, i]));
		return fill(out, idx, (date) => date.slice(0, 7));
	}

	if (period === 'carriere') {
		const years = flights.map((f) => (f.date || '').slice(0, 4)).filter(Boolean).map(Number);
		if (!years.length) return [];
		const min = Math.min(...years);
		const max = Math.max(...years);
		const out = [];
		for (let yr = min; yr <= max; yr++) out.push({ label: `${yr}`, tick: `'${String(yr).slice(2)}`, hours: 0 });
		const idx = new Map(out.map((o, i) => [String(min + i), i]));
		return fill(out, idx, (date) => date.slice(0, 4));
	}

	// '12dm' (default): rolling last 12 months.
	return computeMonthly(flights, 12, today).map((o) => ({ label: o.label, tick: o.label[0], hours: o.hours }));
}

/** Filter flights by period key: 'mois' | 'annee' | '12dm' | 'carriere'. */
export function filterByPeriod(flights, period, today = new Date()) {
	if (period === 'carriere') return flights;
	const iso = today.toISOString();
	if (period === 'mois') return flights.filter((f) => (f.date || '').slice(0, 7) === iso.slice(0, 7));
	if (period === 'annee') return flights.filter((f) => (f.date || '').slice(0, 4) === iso.slice(0, 4));
	if (period === '12dm') {
		const c = new Date(today);
		c.setMonth(c.getMonth() - 12);
		const cutoff = c.toISOString().slice(0, 10);
		return flights.filter((f) => (f.date || '') >= cutoff);
	}
	return flights;
}

/** Most recent flight by date (then by creation order). */
export function lastFlight(flights) {
	if (!flights.length) return null;
	return [...flights].sort((a, b) =>
		a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1
	)[0];
}

/** Coerce a possibly-string/empty value to a number. */
export function num(v) {
	if (v === '' || v == null) return 0;
	const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
}

/** Format hours as "1 h 30" (decimal hours -> h/min). */
export function fmtHours(decimal) {
	const total = Math.round(num(decimal) * 60);
	const h = Math.floor(total / 60);
	const m = total % 60;
	return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** Format an ISO date (YYYY-MM-DD) for display. */
export function fmtDate(iso) {
	if (!iso) return '';
	const [y, m, d] = iso.split('-');
	return `${d}/${m}/${y}`;
}

// ---- Échéances (currency / checks / medical) -------------------------------
// Each item expires `validityDays` after a reference date; within `alertDays`
// of expiry it turns amber. kind 'auto' → reference = date of the last logbook
// flight with hours in `field`; kind 'manual' → a user-entered pass/exam date.

export const ECHEANCE_FAMILIES = [
	{ key: 'currency', label: 'Activité (carnet)' },
	{ key: 'test', label: 'Tests / contrôles' },
	{ key: 'medical', label: 'Médical / administratif' }
];

export const ECHEANCES = [
	{ id: 'cur-jour', family: 'currency', kind: 'auto', label: 'Jour', field: 'hoursDay', validityDays: 92, alertDays: 31 },
	{ id: 'cur-nuit', family: 'currency', kind: 'auto', label: 'Nuit', field: 'hoursNight', validityDays: 92, alertDays: 31 },
	{ id: 'cur-sil', family: 'currency', kind: 'auto', label: 'Sil', field: 'hoursSil', validityDays: 92, alertDays: 31 },
	{ id: 'cur-vi', family: 'currency', kind: 'auto', label: 'VI (IFR)', field: 'hoursIFR', validityDays: 92, alertDays: 31 },
	{ id: 'test-vav', family: 'test', kind: 'manual', label: 'VAV', validityDays: 366, alertDays: 31 },
	// PU is machine-specific: one reference date per machine type flown. The view
	// expands this into one row per machine (store key `test-pu::<machine>`).
	{ id: 'test-pu', family: 'test', kind: 'manual', label: 'PU', validityDays: 182, alertDays: 31, perMachine: true },
	{ id: 'test-sil', family: 'test', kind: 'manual', label: 'SIL', validityDays: 366, alertDays: 31 },
	{ id: 'test-vi', family: 'test', kind: 'manual', label: 'VI', validityDays: 366, alertDays: 31 },
	{ id: 'test-ifr', family: 'test', kind: 'manual', label: 'IFR', validityDays: 60, alertDays: 31 },
	// CEMPN/VUPN need a booked appointment, so they alert further ahead (4 / 2 months).
	{ id: 'med-cempn', family: 'medical', kind: 'manual', label: 'CEMPN', validityDays: 730, alertDays: 120 },
	{ id: 'med-vupn', family: 'medical', kind: 'manual', label: 'VUPN', validityDays: 182, alertDays: 60 }
];

/** Distinct machine types flown as pilot, sorted — used for per-machine échéances (PU). */
export function machinesFlown(flights) {
	const set = new Set();
	for (const f of flights) {
		if (isPilotFlight(f) && f.machineType) set.add(f.machineType);
	}
	return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** ISO date of the most recent flight with hours logged in `field`, else ''. */
export function lastFlightDateForField(flights, field) {
	let best = '';
	for (const f of flights) {
		if (num(f[field]) > 0 && (f.date || '') > best) best = f.date || '';
	}
	return best;
}

function addDays(iso, days) {
	const d = new Date(iso + 'T00:00:00');
	d.setDate(d.getDate() + days);
	return d.toISOString().slice(0, 10);
}

function daysBetween(aIso, bIso) {
	return Math.round((new Date(bIso + 'T00:00:00') - new Date(aIso + 'T00:00:00')) / 86400000);
}

/**
 * Status of one échéance.
 * @param store map of manual reference dates keyed by échéance id.
 * @param key  store key for manual items (defaults to def.id; per-machine items
 *             pass `test-pu::<machine>`).
 * @returns {{refDate:string, expiry:string, daysLeft:number, status:'ok'|'alert'|'expired'|'none'}}
 */
export function computeEcheance(def, flights, store, today = new Date(), key = def.id) {
	const refDate = def.kind === 'auto' ? lastFlightDateForField(flights, def.field) : (store?.[key] || '');
	if (!refDate) return { refDate: '', expiry: '', daysLeft: NaN, status: 'none' };
	const expiry = addDays(refDate, def.validityDays);
	const daysLeft = daysBetween(today.toISOString().slice(0, 10), expiry);
	let status = 'ok';
	if (daysLeft < 0) status = 'expired';
	else if (daysLeft <= def.alertDays) status = 'alert';
	return { refDate, expiry, daysLeft, status };
}
