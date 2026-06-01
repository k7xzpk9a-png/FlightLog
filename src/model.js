// Flight data model. Plain objects; keys are camelCase versions of the source
// xlsx (Vols+Simus / sheet6) columns. Derived columns (Mois/Année/Total/Coef…)
// are COMPUTED here, never stored.

// Hour fields. `total` (Jour + Nuit) is the only one summed for career totals;
// the rest are overlapping categories logged separately.
// (Mapping to the source xlsx columns lives in tools/migrate.mjs.)
export const HOUR_FIELDS = [
	{ key: 'hoursDay', label: 'Jour' },
	{ key: 'hoursNight', label: 'Nuit' },
	{ key: 'hoursSil', label: 'Sil' },
	{ key: 'hoursIFR', label: 'IFR' },
	{ key: 'hoursCAG', label: 'CAG' },
	{ key: 'hoursCAM', label: 'CAM' },
	{ key: 'hoursMEDay', label: 'ME Jour' },
	{ key: 'hoursMENight', label: 'ME Nuit' }
];

// Counters (integers): landings + instrument approaches.
export const COUNT_FIELDS = [
	{ key: 'landings', label: 'Atterrissages' },
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
	const t = { count: 0, vols: 0, simus: 0, hoursDay: 0, hoursNight: 0, hoursIFR: 0, total: 0, landings: 0 };
	for (const f of flights) {
		t.count++;
		if (f.kind === 'simu') t.simus++;
		else t.vols++;
		t.hoursDay += num(f.hoursDay);
		t.hoursNight += num(f.hoursNight);
		t.hoursIFR += num(f.hoursIFR);
		t.landings += num(f.landings);
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
