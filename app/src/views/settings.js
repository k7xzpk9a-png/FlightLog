// Réglages — storage persistence, JSON backup export/import. (Git-push backup later.)
import { exportJSON, importJSON, getFlights } from '../state.js';

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

		<p class="section-label">Données</p>
		<div class="card">
			<button class="btn btn--block" type="button" disabled>Importer « carnet de vol.xlsx »</button>
			<p class="view__subtitle" style="margin-top:12px">Migration des 689 vols — à venir.</p>
		</div>

		<p class="section-label">À propos</p>
		<div class="card">
			<div>Carnet de vol — prototype</div>
			<p class="view__subtitle">Application hors-ligne · sans serveur</p>
		</div>
	</section>`;
}

export function mount(root) {
	wirePersistence(root);
	wireBackup(root);
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
