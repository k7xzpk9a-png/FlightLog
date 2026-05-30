// GitHub backup via the REST Contents API — no SDK, no server. The whole
// logbook JSON is PUT to a file in a (private) repo; each push is a commit, so
// you get free version history. Config + token live in localStorage on-device.
//
// Token: a fine-grained PAT scoped to ONLY the backup repo, with
// Contents: Read and write. Stored locally; never sent anywhere but GitHub.

const LS_KEY = 'carnet.github';
const API = 'https://api.github.com';

export function getConfig() {
	try {
		return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
	} catch {
		return {};
	}
}

export function setConfig(cfg) {
	localStorage.setItem(LS_KEY, JSON.stringify(cfg));
}

export function isConfigured() {
	const c = getConfig();
	return !!(c.owner && c.repo && c.token);
}

function path(c) {
	return (c.path || 'carnet.json').replace(/^\/+/, '');
}

function headers(c) {
	return {
		Authorization: 'Bearer ' + c.token,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28'
	};
}

// Base64 that survives non-Latin1 (accents) — btoa alone would throw.
function b64encode(str) {
	const bytes = new TextEncoder().encode(str);
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}
function b64decode(b64) {
	const bin = atob((b64 || '').replace(/\s/g, ''));
	const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

// Get the current remote file's sha (needed to update) + decoded text.
// Returns { sha: null, text: null } when the file doesn't exist yet.
async function getRemote(c) {
	const res = await fetch(`${API}/repos/${c.owner}/${c.repo}/contents/${path(c)}`, {
		headers: headers(c),
		cache: 'no-store'
	});
	if (res.status === 404) return { sha: null, text: null };
	if (!res.ok) throw new Error(await errMsg(res));
	const json = await res.json();
	return { sha: json.sha, text: json.content ? b64decode(json.content) : null };
}

async function errMsg(res) {
	let detail = '';
	try {
		detail = (await res.json()).message || '';
	} catch {}
	return `GitHub ${res.status}${detail ? ' : ' + detail : ''}`;
}

/** Push the given JSON text to the configured repo file. Returns commit info. */
export async function push(jsonText) {
	const c = getConfig();
	if (!isConfigured()) throw new Error('Sauvegarde GitHub non configurée.');
	const { sha } = await getRemote(c);
	const body = {
		message: `carnet: sauvegarde ${new Date().toISOString()}`,
		content: b64encode(jsonText)
	};
	if (sha) body.sha = sha;
	const res = await fetch(`${API}/repos/${c.owner}/${c.repo}/contents/${path(c)}`, {
		method: 'PUT',
		headers: { ...headers(c), 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(await errMsg(res));
	const json = await res.json();
	const cfg = getConfig();
	cfg.lastBackup = Date.now();
	setConfig(cfg);
	return { sha: json.content && json.content.sha, commit: json.commit && json.commit.sha };
}

/** Fetch the backup file's JSON text (or null if none). */
export async function pull() {
	const c = getConfig();
	if (!isConfigured()) throw new Error('Sauvegarde GitHub non configurée.');
	const { text } = await getRemote(c);
	return text;
}

/** Verify the token + repo are reachable. Returns true or throws. */
export async function test() {
	const c = getConfig();
	if (!isConfigured()) throw new Error('Champs manquants.');
	const res = await fetch(`${API}/repos/${c.owner}/${c.repo}`, { headers: headers(c), cache: 'no-store' });
	if (!res.ok) throw new Error(await errMsg(res));
	const json = await res.json();
	return { private: json.private, full_name: json.full_name };
}

// --- Debounced auto-backup ----------------------------------------------
let timer = null;
let lastError = null;

export function getLastError() {
	return lastError;
}

/** Schedule a debounced backup of `jsonTextProvider()` if configured + online. */
export function scheduleBackup(jsonTextProvider, delay = 4000) {
	if (!isConfigured()) return;
	if (timer) clearTimeout(timer);
	timer = setTimeout(async () => {
		timer = null;
		if (!navigator.onLine) return; // try again after the next change
		try {
			await push(jsonTextProvider());
			lastError = null;
			window.dispatchEvent(new CustomEvent('carnet:backup', { detail: { ok: true } }));
		} catch (err) {
			lastError = err.message;
			window.dispatchEvent(new CustomEvent('carnet:backup', { detail: { ok: false, error: err.message } }));
		}
	}, delay);
}
