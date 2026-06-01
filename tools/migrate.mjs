// One-time migration: parse the source `carnet de vol.xlsx` (Vols+Simus sheet)
// into the app's logbook JSON, ready to import via Réglages → Importer (JSON).
//
// Zero npm deps: shells out to `unzip`, then parses the sheet XML by regex.
// Usage: node tools/migrate.mjs ["carnet de vol.xlsx"] [out.json]

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const xlsxPath = process.argv[2] || 'carnet de vol.xlsx';
const outPath = process.argv[3] || 'carnet-migrated.json';

// ---- unzip ----
const dir = mkdtempSync(join(tmpdir(), 'carnet-'));
execSync(`unzip -o ${JSON.stringify(xlsxPath)} -d ${JSON.stringify(dir)}`, { stdio: 'ignore' });

// ---- shared strings ----
const ssXml = readFileSync(join(dir, 'xl/sharedStrings.xml'), 'utf8');
const shared = [];
for (const si of ssXml.match(/<si>[\s\S]*?<\/si>/g) || []) {
	const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
	shared.push(unescapeXml(parts.join('')));
}

function unescapeXml(s) {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#10;/g, ' ')
		.replace(/&apos;/g, "'")
		.replace(/&quot;/g, '"');
}

// ---- locate Vols+Simus by its header text (robust to empty header cells) ----
function row1Text(xml) {
	const row1 = (xml.match(/<row r="1"[^>]*>([\s\S]*?)<\/row>/) || [])[1] || '';
	const parts = [];
	for (const m of row1.matchAll(/<c[^>]*?t="s"[^>]*?><v>(\d+)<\/v><\/c>/g)) parts.push(shared[+m[1]] || '');
	return parts.join(' | ');
}
let sheetXml = null;
for (let i = 1; i <= 30; i++) {
	let xml;
	try {
		xml = readFileSync(join(dir, `xl/worksheets/sheet${i}.xml`), 'utf8');
	} catch {
		continue;
	}
	if (row1Text(xml).includes('SIMU/VOL')) {
		sheetXml = xml;
		break;
	}
}
if (!sheetXml) throw new Error('Could not find the Vols+Simus sheet (header "SIMU/VOL").');

// ---- parse cells into rows: { rowNum: { COL: value } } ----
// Parse per-row, then per-cell. (A single whole-sheet regex is fragile: it
// silently skipped rows — handle each <row> in isolation.)
const rows = {};
const rowRe = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
let rm;
while ((rm = rowRe.exec(sheetXml))) {
	const rowNum = +rm[1];
	const body = rm[2];
	const cells = {};
	let cm;
	cellRe.lastIndex = 0;
	while ((cm = cellRe.exec(body))) {
		const col = cm[1];
		const attrs = cm[2] || '';
		const inner = cm[3]; // undefined when the cell is self-closing (empty)
		if (inner == null) {
			cells[col] = '';
			continue;
		}
		const t = (attrs.match(/\bt="([^"]+)"/) || [])[1] || '';
		const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/); // value, after any <f>…</f>
		const isMatch = inner.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
		let val = '';
		if (vMatch) val = t === 's' ? shared[+vMatch[1]] ?? '' : vMatch[1];
		else if (isMatch) val = unescapeXml(isMatch[1]);
		cells[col] = val;
	}
	rows[rowNum] = cells;
}

// ---- helpers ----
const numv = (x) => {
	if (x === '' || x == null) return 0;
	const n = parseFloat(String(x).replace(',', '.'));
	return Number.isFinite(n) ? n : 0;
};
// A single flight can't exceed 24 h. Some source cells hold stray Excel date
// serials (e.g. the "IFR" column has 3 accidental dates like 44033) — reject
// any implausible "hours" value so those typos don't poison the totals.
const hours = (x) => {
	const n = numv(x);
	return n >= 0 && n < 24 ? n : 0;
};
const pickHours = (r, ...cols) => {
	for (const c of cols) {
		const h = hours(r[c]);
		if (h) return h;
	}
	return 0;
};
const serialToISO = (serial) => {
	const s = numv(serial);
	if (!s) return '';
	const ms = Math.round((s - 25569) * 86400000); // 25569 = 1899-12-30 → 1970-01-01
	return new Date(ms).toISOString().slice(0, 10);
};

// Mission-event counters to preserve verbatim (col → label).
const EVENT_COLS = {
	X: 'PS J', Y: 'PS N', Z: 'SCA J', AA: 'SCA N', AB: 'TAG J', AC: 'TAG N',
	AD: 'CL J', AE: 'CL N', AF: 'Grappe J', AG: 'Grappe N', AH: 'Rappel J', AI: 'Rappel N',
	AJ: 'L.Plongeurs J', AK: 'L.Plongeurs N', AL: 'Sling J', AM: 'Sling N', AN: 'Treuil J', AO: 'Treuil N',
	AT: 'VICAM',
	BC: 'PS J2', BD: 'PS N2', BE: 'SCA J2', BF: 'SCA N2', BG: 'TAG J2', BH: 'TAG N2',
	BI: 'CL J2', BJ: 'CL N2', BK: 'Grappe J2', BL: 'Grappe N2', BM: 'Rappel J2', BN: 'Rappel N2',
	BO: 'Nacelle J2', BP: 'Nacelle N2', BQ: 'Sling J2', BR: 'Sling N2', BS: 'Treuil J(2)', BT: 'Treuil N(2)'
};

// ---- build flights ----
const flights = [];
let totalDay = 0, totalNight = 0;
const rowNums = Object.keys(rows).map(Number).sort((a, b) => a - b);

for (const rn of rowNums) {
	if (rn === 1) continue; // header
	const r = rows[rn];
	const date = serialToISO(r.A);
	if (!date) continue; // skip non-data rows

	const hoursDay = pickHours(r, 'K', 'AP');
	const hoursNight = pickHours(r, 'L', 'AQ');

	const events = {};
	for (const [col, label] of Object.entries(EVENT_COLS)) {
		const val = numv(r[col]);
		if (val) events[label] = val;
	}

	const flight = {
		id: 'mig-' + rn,
		createdAt: Date.parse(date) || 0,
		date,
		kind: String(r.C || '').toUpperCase().includes('SIMU') ? 'simu' : 'vol',
		mission: (r.B || '').trim(),
		machineType: (r.D || '').trim(),
		machineNumber: (r.E || '').toString().trim(),
		role: (r.F || '').trim(),
		pilotName: (r.G || '').trim(), // "Grade + Nom"
		code: (r.H || '').toString().trim(),
		hoursDay,
		hoursNight,
		hoursSil: pickHours(r, 'M', 'AR'),
		// IFR (instrument/VSV) = CAG (N) + CAM (O). The source "IFR" column AS
		// held only 3 stray date serials, so it's ignored.
		hoursIFR: hours(r.N) + hours(r.O),
		hoursMEDay: pickHours(r, 'P', 'AU'),
		hoursMENight: pickHours(r, 'Q', 'AV'),
		apprILS: numv(r.S) + numv(r.AX),
		apprVOR: numv(r.T) + numv(r.AY),
		apprNDB: numv(r.U) + numv(r.AZ),
		apprGCAPAR: numv(r.V) + numv(r.BA),
		apprPOA: numv(r.W) + numv(r.BB),
		notes: ''
	};
	if (Object.keys(events).length) flight.events = events;

	flights.push(flight);
	totalDay += hoursDay;
	totalNight += hoursNight;
}

const doc = { version: 1, flights, updatedAt: Date.now() };
writeFileSync(outPath, JSON.stringify(doc, null, 2));
rmSync(dir, { recursive: true, force: true });

const round = (n) => Math.round(n * 10) / 10;
console.log(`Migrated ${flights.length} flights → ${outPath}`);
console.log(`  dates: ${flights[0]?.date} → ${flights[flights.length - 1]?.date}`);
console.log(`  hours: ${round(totalDay)} J + ${round(totalNight)} N = ${round(totalDay + totalNight)} total`);
console.log(`  vols: ${flights.filter((f) => f.kind === 'vol').length}, simus: ${flights.filter((f) => f.kind === 'simu').length}`);
