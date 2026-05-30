// Nouveau / Modifier un vol — fast-entry form. Edit mode via #/add?id=…
import { addFlight, updateFlight, getFlights } from '../state.js';
import { newFlight, num, HOUR_FIELDS, COUNT_FIELDS, MACHINES, ROLES } from '../model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const todayIso = new Date().toISOString().slice(0, 10);

function editId() {
	return new URLSearchParams(location.hash.split('?')[1] || '').get('id');
}

const numField = (f) =>
	`<div class="field">
		<label for="fld-${f.key}">${f.label}</label>
		<input id="fld-${f.key}" inputmode="decimal" placeholder="0" />
	</div>`;

const mainHours = HOUR_FIELDS.filter((f) => f.key === 'hoursDay' || f.key === 'hoursNight');
const moreHours = HOUR_FIELDS.filter((f) => !mainHours.includes(f));
const mainCounts = COUNT_FIELDS.filter((f) => f.key === 'landings');
const moreCounts = COUNT_FIELDS.filter((f) => !mainCounts.includes(f));

const rows = (fields) => {
	let html = '';
	for (let i = 0; i < fields.length; i += 2) {
		html += `<div class="field-row">${numField(fields[i])}${fields[i + 1] ? numField(fields[i + 1]) : '<div></div>'}</div>`;
	}
	return html;
};

export function render() {
	const editing = !!editId();
	return `
	<header class="topbar">
		<a class="iconbtn" href="#/" aria-label="Annuler">‹</a>
		<span class="topbar__title">${editing ? 'Modifier le vol' : 'Nouveau vol'}</span>
		<span class="topbar__spacer"></span>
		<button class="btn btn--primary" id="save-btn" type="button">Enregistrer</button>
	</header>

	<section class="view">
		<div class="field-row">
			<div class="field">
				<label for="fld-date">Date</label>
				<input id="fld-date" type="date" value="${todayIso}" />
			</div>
			<div class="field">
				<label>Type</label>
				<div class="segmented" id="kind-seg">
					<button type="button" data-kind="vol" aria-selected="true">Vol</button>
					<button type="button" data-kind="simu" aria-selected="false">Simu</button>
				</div>
			</div>
		</div>

		<div class="field-row">
			<div class="field">
				<label for="fld-machineType">Machine</label>
				<select id="fld-machineType">
					<option value="" disabled selected>—</option>
					${MACHINES.map((m) => `<option>${esc(m)}</option>`).join('')}
				</select>
			</div>
			<div class="field">
				<label for="fld-machineNumber">N° machine</label>
				<input id="fld-machineNumber" inputmode="numeric" placeholder="ex. 1234" />
			</div>
		</div>

		<div class="field">
			<label for="fld-role">Fonction à bord</label>
			<select id="fld-role">
				<option value="" disabled selected>—</option>
				${ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}
			</select>
		</div>

		<div class="field">
			<label for="fld-mission">Intitulé / Mission</label>
			<input id="fld-mission" placeholder="ex. Navigation tactique" />
		</div>

		<div class="field">
			<label for="fld-crewName">Coéquipier</label>
			<input id="fld-crewName" placeholder="Nom" />
		</div>

		<p class="section-label">Heures</p>
		${rows(mainHours)}
		<details class="card" style="padding:12px 16px">
			<summary class="view__subtitle">Autres heures (Sil, IFR, CAG, CAM, ME…)</summary>
			<div style="margin-top:12px">${rows(moreHours)}</div>
		</details>

		<p class="section-label">Posers &amp; approches</p>
		${rows(mainCounts)}
		<details class="card" style="padding:12px 16px">
			<summary class="view__subtitle">Approches</summary>
			<div style="margin-top:12px">${rows(moreCounts)}</div>
		</details>

		<div class="field">
			<label for="fld-notes">Remarques</label>
			<textarea id="fld-notes" rows="3" placeholder="Équipage, évènements…"></textarea>
		</div>

		<button class="btn btn--primary btn--block" id="save-btn-bottom" type="button">Enregistrer le vol</button>
		<p class="view__subtitle" id="save-msg" style="text-align:center"></p>
	</section>`;
}

// Ensure a <select> can show a value even if it's not one of the preset options.
function setSelect(sel, value) {
	if (!sel) return;
	if (value && ![...sel.options].some((o) => o.value === value)) {
		const opt = document.createElement('option');
		opt.textContent = value;
		sel.appendChild(opt);
	}
	sel.value = value || '';
}

export function mount(root) {
	let kind = 'vol';
	const setText = (id, v) => {
		const el = root.querySelector('#fld-' + id);
		if (el) el.value = v ?? '';
	};

	// Prefill in edit mode.
	const id = editId();
	if (id) {
		const f = getFlights().find((x) => x.id === id);
		if (f) {
			kind = f.kind || 'vol';
			for (const b of root.querySelectorAll('#kind-seg button'))
				b.setAttribute('aria-selected', String(b.getAttribute('data-kind') === kind));
			setText('date', f.date);
			setText('machineNumber', f.machineNumber);
			setText('mission', f.mission);
			setText('crewName', f.crewName);
			setText('notes', f.notes);
			setSelect(root.querySelector('#fld-machineType'), f.machineType);
			setSelect(root.querySelector('#fld-role'), f.role);
			for (const { key } of [...HOUR_FIELDS, ...COUNT_FIELDS]) if (num(f[key])) setText(key, f[key]);
		}
	}

	root.querySelector('#kind-seg')?.addEventListener('click', (e) => {
		const btn = e.target.closest('button[data-kind]');
		if (!btn) return;
		kind = btn.getAttribute('data-kind');
		for (const b of root.querySelectorAll('#kind-seg button')) b.setAttribute('aria-selected', String(b === btn));
	});

	const val = (k) => (root.querySelector('#fld-' + k)?.value || '').trim();

	async function save() {
		const base = id ? getFlights().find((x) => x.id === id) || newFlight() : newFlight();
		const f = { ...base };
		f.date = val('date') || todayIso;
		f.kind = kind;
		f.machineType = val('machineType');
		f.machineNumber = val('machineNumber');
		f.role = val('role');
		f.mission = val('mission');
		f.crewName = val('crewName');
		f.notes = val('notes');
		for (const { key } of HOUR_FIELDS) f[key] = num(val(key));
		for (const { key } of COUNT_FIELDS) f[key] = num(val(key));

		const msg = root.querySelector('#save-msg');
		try {
			if (id) {
				await updateFlight(id, f);
				location.hash = '#/flight?id=' + encodeURIComponent(id);
			} else {
				await addFlight(f);
				location.hash = '#/logbook';
			}
		} catch (err) {
			if (msg) msg.textContent = 'Erreur lors de l’enregistrement : ' + err.message;
		}
	}

	root.querySelector('#save-btn')?.addEventListener('click', save);
	root.querySelector('#save-btn-bottom')?.addEventListener('click', save);
}
