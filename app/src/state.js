// In-memory app state over the IndexedDB document. Views read via getFlights()
// and subscribe() to re-render after any change. No framework — just a tiny
// observable.

import { readLogbook, writeLogbook } from './db.js';

const SCHEMA_VERSION = 1;

/** @type {{version:number, flights:any[], updatedAt:number|null}} */
let logbook = { version: SCHEMA_VERSION, flights: [], updatedAt: null };

const listeners = new Set();

export async function initState() {
	const stored = await readLogbook();
	if (stored && Array.isArray(stored.flights)) logbook = stored;
}

export function getLogbook() {
	return logbook;
}
export function getFlights() {
	return logbook.flights;
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
	logbook = { version: parsed.version || SCHEMA_VERSION, flights: parsed.flights, updatedAt: Date.now() };
	await writeLogbook(logbook);
	emit();
	return logbook.flights.length;
}
