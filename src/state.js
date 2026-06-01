// In-memory app state over the IndexedDB document. Views read via getFlights()
// and subscribe() to re-render after any change. No framework — just a tiny
// observable.

import { readLogbook, writeLogbook } from './db.js';
import { isPilotFlight } from './model.js';

const SCHEMA_VERSION = 2;

/** @type {{version:number, flights:any[], echeances:Object, updatedAt:number|null}} */
let logbook = { version: SCHEMA_VERSION, flights: [], echeances: {}, updatedAt: null };

const listeners = new Set();

// "Pilote seulement" filter: when on (default), passenger flights are hidden
// from lists and excluded from totals. Persisted across sessions.
const PILOT_ONLY_KEY = 'flightlog.pilotOnly';
let pilotOnly = loadPilotOnly();

function loadPilotOnly() {
	try {
		const v = localStorage.getItem(PILOT_ONLY_KEY);
		return v === null ? true : v === '1';
	} catch {
		return true;
	}
}

export function getPilotOnly() {
	return pilotOnly;
}

export function setPilotOnly(on) {
	pilotOnly = !!on;
	try {
		localStorage.setItem(PILOT_ONLY_KEY, pilotOnly ? '1' : '0');
	} catch {
		/* storage unavailable — keep in-memory only */
	}
	emit();
}

/** Flights for display: full list, or pilot-only when the filter is on. */
export function getVisibleFlights() {
	return pilotOnly ? logbook.flights.filter(isPilotFlight) : logbook.flights;
}

export async function initState() {
	const stored = await readLogbook();
	if (stored && Array.isArray(stored.flights)) logbook = stored;
	if (!logbook.echeances) logbook.echeances = {};
}

export function getLogbook() {
	return logbook;
}
export function getFlights() {
	return logbook.flights;
}

/** Manual échéance reference dates, keyed by échéance id. */
export function getEcheances() {
	return logbook.echeances || {};
}

/** Set (or clear, when date is empty) a manual échéance reference date. */
export async function setEcheanceDate(id, date) {
	if (!logbook.echeances) logbook.echeances = {};
	if (date) logbook.echeances[id] = date;
	else delete logbook.echeances[id];
	await persist();
}

export function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

function emit() {
	for (const fn of listeners) fn();
}

async function persist() {
	logbook.updatedAt = Date.now();
	await writeLogbook(logbook);
	emit();
}

function uid() {
	return crypto.randomUUID ? crypto.randomUUID() : 'f' + Date.now() + Math.random().toString(16).slice(2);
}

export async function addFlight(flight) {
	const record = { ...flight, id: uid(), createdAt: Date.now() };
	logbook.flights.push(record);
	await persist();
	return record;
}

export async function updateFlight(id, patch) {
	const f = logbook.flights.find((x) => x.id === id);
	if (!f) return;
	Object.assign(f, patch);
	await persist();
}

export async function deleteFlight(id) {
	logbook.flights = logbook.flights.filter((x) => x.id !== id);
	await persist();
}

/** Serialize the whole logbook for backup (file export / git push). */
export function exportJSON() {
	return JSON.stringify(logbook, null, 2);
}

/** Replace the entire logbook from imported JSON text. Throws on bad input. */
export async function importJSON(text) {
	const parsed = JSON.parse(text);
	if (!parsed || !Array.isArray(parsed.flights)) throw new Error('Format invalide : "flights" manquant.');
	logbook = {
		version: parsed.version || SCHEMA_VERSION,
		flights: parsed.flights,
		echeances: parsed.echeances || {},
		updatedAt: Date.now()
	};
	await writeLogbook(logbook);
	emit();
	return logbook.flights.length;
}
