// Réglages — storage persistence, JSON export/import, and GitHub auto-backup.
import { exportJSON, importJSON, getFlights } from '../state.js';
import * as gh from '../github.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmtWhen(ts) {
	if (!ts) return 'jamais';
	return new Date(ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function render() {
	const count = getFlights().length;
	return `
	<section class="view">
		<header class="view__head">
			<div>
				<h1 class="view__title">Réglages</h1>
				<p class="view__subtitle">Stockage et sauvegardes</p>
			</div>
		</header>

		<p class="section-label">Stockage</p>
		<div class="card field" style="gap:12px">
			<div>
				<div>Stockage persistant : <strong id="persist-state">vérification…</strong></div>
				<p class="view__subtitle" id="storage-usage">—</p>
			</div>
			<button class="btn btn--primary" id="persist-btn" type="button">Demander la persistance</button>
			<p class="view__subtitle">
				Empêche le navigateur d'effacer le carnet sous contrainte d'espace.
				(Ne protège pas si l'app est désinstallée — d'où la sauvegarde ci-dessous.)
			</p>
		</div>

		<p class="section-label">Sauvegarde</p>
		<div class="card">
			<div class="btn-row">
				<button class="btn" id="export-btn" type="button">Exporter (JSON)</button>
				<button class="btn" id="import-btn" type="button">Importer (JSON)</button>
			</div>
			<input id="import-file" type="file" accept="application/json,.json" hidden />
			<p class="view__subtitle" id="backup-msg" style="margin-top:12px">${count} vol${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}.</p>
		</div>

		<p class="section-label">Sauvegarde GitHub (automatique)</p>
		${githubCardHTML()}

		<p class="section-label">À propos</p>
		<div class="card">
			<div>Carnet de vol — prototype</div>
			<p class="view__subtitle">Application hors-ligne · sans serveur</p>
		</div>
	</section>`;
}

function githubCardHTML() {
	const c = gh.getConfig();
	const configured = gh.isConfigured();
	return `
	<div class="card field" style="gap:12px">
		<div class="field">
			<label for="gh-owner">Propriétaire (owner)</label>
			<input id="gh-owner" placeholder="k7xzpk9a-png" value="${esc(c.owner || '')}" autocapitalize="off" autocorrect="off" />
		</div>
		<div class="field">
			<label for="gh-repo">Dépôt privé (repo)</label>
			<input id="gh-repo" placeholder="flightlog-data" value="${esc(c.repo || '')}" autocapitalize="off" autocorrect="off" />
		</div>
		<div class="field">
			<label for="gh-path">Fichier</label>
			<input id="gh-path" placeholder="carnet.json" value="${esc(c.path || 'carnet.json')}" autocapitalize="off" autocorrect="off" />
		</div>
		<div class="field">
			<label for="gh-token">Token (PAT fine-grained, Contents: read/write)</label>
			<input id="gh-token" type="password" placeholder="${configured ? '•••••• (enregistré)' : 'github_pat_…'}" autocapitalize="off" autocorrect="off" />
		</div>
		<div class="btn-row">
			<button class="btn" id="gh-save" type="button">Enregistrer</button>
			<button class="btn" id="gh-test" type="button">Tester</button>
		</div>
		<div class="btn-row">
			<button class="btn btn--primary" id="gh-push" type="button" ${configured ? '' : 'disabled'}>Sauvegarder maintenant</button>
			<button class="btn" id="gh-pull" type="button" ${configured ? '' : 'disabled'}>Restaurer</button>
		</div>
		<p class="view__subtitle" id="gh-msg">${configured ? 'Dernière sauvegarde : ' + esc(fmtWhen(c.lastBackup)) : 'Non configuré. La sauvegarde se lance automatiquement après chaque modification une fois configurée.'}</p>
	</div>`;
}

export function mount(root) {
	wirePersistence(root);
	wireBackup(root);
	wireGithub(root);
}

function wireGithub(root) {
	const msg = root.querySelector('#gh-msg');
	const say = (t) => { if (msg) msg.textContent = t; };
	const read = () => ({
		owner: root.querySelector('#gh-owner').value.trim(),
		repo: root.querySelector('#gh-repo').value.trim(),
		path: root.querySelector('#gh-path').value.trim() || 'carnet.json'
	});

	function saveConfig() {
		const cur = gh.getConfig();
		const next = { ...cur, ...read() };
		const tok = root.querySelector('#gh-token').value.trim();
		if (tok) next.token = tok; // keep existing token if field left blank
		gh.setConfig(next);
		return next;
	}

	root.querySelector('#gh-save')?.addEventListener('click', () => {
		saveConfig();
		root.querySelector('#gh-token').value = '';
		say('Configuration enregistrée.');
		// Re-enable push/pull without a full re-render.
		for (const id of ['#gh-push', '#gh-pull']) {
			const b = root.querySelector(id);
			if (b) b.disabled = !gh.isConfigured();
		}
	});

	root.querySelector('#gh-test')?.addEventListener('click', async () => {
		saveConfig();
		say('Test en cours…');
		try {
			const info = await gh.test();
			say(`OK : ${info.full_name}${info.private ? ' (privé ✓)' : ' (⚠ public !)'}`);
		} catch (err) {
			say('Échec : ' + err.message);
		}
	});

	root.querySelector('#gh-push')?.addEventListener('click', async () => {
		saveConfig();
		say('Sauvegarde…');
		try {
			await gh.push(exportJSON());
			say('Sauvegardé : ' + fmtWhen(gh.getConfig().lastBackup));
		} catch (err) {
			say('Échec : ' + err.message);
		}
	});

	root.querySelector('#gh-pull')?.addEventListener('click', async () => {
		saveConfig();
		if (!confirm('Restaurer remplacera le carnet local par la sauvegarde GitHub. Continuer ?')) return;
		say('Restauration…');
		try {
			const text = await gh.pull();
			if (text == null) return say('Aucune sauvegarde trouvée sur GitHub.');
			const n = await importJSON(text);
			say(`Restauré : ${n} vol(s).`);
		} catch (err) {
			say('Échec : ' + err.message);
		}
	});
}

function wirePersistence(root) {
	const stateEl = root.querySelector('#persist-state');
	const usageEl = root.querySelector('#storage-usage');
	const btn = root.querySelector('#persist-btn');

	async function refresh() {
		if (!stateEl) return;
		if (navigator.storage && navigator.storage.persisted) {
			const persisted = await navigator.storage.persisted();
			stateEl.textContent = persisted ? 'activé ✓' : 'non activé';
			if (btn) btn.disabled = persisted;
		} else {
			stateEl.textContent = 'non pris en charge';
			if (btn) btn.disabled = true;
		}
		if (usageEl && navigator.storage && navigator.storage.estimate) {
			const est = await navigator.storage.estimate();
			const mb = (n) => ((n || 0) / 1024 / 1024).toFixed(1);
			usageEl.textContent = `Utilisé : ${mb(est.usage)} Mo sur ~${mb(est.quota)} Mo`;
		}
	}

	if (btn) {
		btn.addEventListener('click', async () => {
			if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
			refresh();
		});
	}
	refresh();
}

function wireBackup(root) {
	const msg = root.querySelector('#backup-msg');

	root.querySelector('#export-btn')?.addEventListener('click', () => {
		const blob = new Blob([exportJSON()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `carnet-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	});

	const fileInput = root.querySelector('#import-file');
	root.querySelector('#import-btn')?.addEventListener('click', () => fileInput?.click());
	fileInput?.addEventListener('change', async () => {
		const file = fileInput.files && fileInput.files[0];
		if (!file) return;
		if (!confirm('Remplacer le carnet actuel par le contenu du fichier ?')) {
			fileInput.value = '';
			return;
		}
		try {
			const text = await file.text();
			const n = await importJSON(text);
			if (msg) msg.textContent = `Importé : ${n} vol(s).`;
		} catch (err) {
			if (msg) msg.textContent = 'Échec de l’import : ' + err.message;
		} finally {
			fileInput.value = '';
		}
	});
}
