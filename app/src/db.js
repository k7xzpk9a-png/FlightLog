// IndexedDB persistence. The entire logbook is a SINGLE JSON document stored
// under one key — simplest model, and the backup unit (file export / git push)
// is exactly this object. Tiny dataset (~5k flights), so whole-doc writes are fine.

const DB_NAME = 'carnet';
const DB_VERSION = 1;
const STORE = 'kv';
const DOC_KEY = 'logbook';

function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx(db, mode) {
	return db.transaction(STORE, mode).objectStore(STORE);
}

/** Read the logbook document, or null if none stored yet. */
export async function readLogbook() {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const req = tx(db, 'readonly').get(DOC_KEY);
		req.onsuccess = () => resolve(req.result || null);
		req.onerror = () => reject(req.error);
		req.transaction.oncomplete = () => db.close();
	});
}

/** Write the logbook document (overwrites). */
export async function writeLogbook(doc) {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const req = tx(db, 'readwrite').put(doc, DOC_KEY);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
		req.transaction.oncomplete = () => db.close();
	});
}
