<!-- After the cut: who the customer is, their consent (asked once), up to four photos and a note.
     Photos are shrunk on the phone as they are taken; saving keeps them on the phone first, so a
     dropped signal never loses them. -->
<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { ANGLES, shrink } from '../photo.js';
	import { backend } from '../session.svelte.js';
	import { AppError, type ClientMatch, type PhotoAngle, type ShotFile } from '../types.js';
	import { saveVisit } from '../visit-queue.svelte.js';

	let {
		known = null,
		onsaved
	}: {
		/** The customer, when the barber came from their page. */
		known?: ClientMatch | null;
		/** Customer id when it went up, null when it waits for the network. */
		onsaved: (customerId: string | null) => void;
	} = $props();

	let phone = $state('');
	let name = $state('');
	let match = $state<ClientMatch | null>(null);
	let looking = $state(false);
	let consent = $state(false);
	let minor = $state(false);
	let note = $state('');
	let shots = $state<Partial<Record<PhotoAngle, { file: ShotFile; url: string }>>>({});
	let shrinking = $state<PhotoAngle | null>(null);
	let busy = $state(false);
	let error = $state('');

	const who = $derived(known ?? match);
	const digits = $derived(phone.replace(/[^0-9]/g, ''));
	const hasConsent = $derived(!!who?.consent);
	const canShoot = $derived(hasConsent || consent);
	const count = $derived(Object.keys(shots).length);

	// The name filled in from a match, cleared again if the number changes to someone else.
	let autoName = '';

	// Looks the number up once it is long enough, so a returning customer is recognised.
	$effect(() => {
		if (known) return;
		const d = digits;
		match = null;
		looking = false;
		untrack(() => {
			if (autoName && name === autoName) name = '';
			autoName = '';
		});
		if (d.length < 10) return;
		const t = setTimeout(() => {
			looking = true;
			backend
				.findClients(d)
				.then((r) => {
					if (digits !== d) return;
					// The search already matched every digit typed.
					match = r[0] ?? null;
					if (match?.name && !name.trim()) name = autoName = match.name;
				})
				.catch(() => {})
				.finally(() => {
					if (digits === d) looking = false;
				});
		}, 300);
		return () => clearTimeout(t);
	});

	async function take(angle: PhotoAngle, e: Event & { currentTarget: HTMLInputElement }) {
		const f = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (!f) return;
		error = '';
		shrinking = angle;
		try {
			const file = await shrink(f, angle);
			drop(angle);
			shots[angle] = { file, url: URL.createObjectURL(file.thumb) };
		} catch {
			error = 'No se pudo leer esa foto. Tómala de nuevo.';
		} finally {
			shrinking = null;
		}
	}

	function drop(angle: PhotoAngle) {
		const s = shots[angle];
		if (s) URL.revokeObjectURL(s.url);
		delete shots[angle];
	}

	onDestroy(() => Object.values(shots).forEach((s) => s && URL.revokeObjectURL(s.url)));

	async function save(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (!known && digits.length < 7) return (error = 'Escribe el WhatsApp del cliente.');
		if (count && !canShoot) return (error = 'Marca la autorización del cliente para guardar sus fotos.');
		if (!count && !note.trim()) return (error = 'Toma al menos una foto o escribe una nota.');
		busy = true;
		const customer = who ? { id: who.id, name: name.trim() || null } : { phone, name: name.trim() || null };
		const photos = ANGLES.map((a) => shots[a.angle]?.file).filter((x): x is ShotFile => !!x);
		const label = who?.name ?? (name.trim() || phone);
		try {
			const id = await saveVisit(
				{ id: crypto.randomUUID(), customer, note: note.trim() || null, consent: !hasConsent && consent, minor, photos, at: new Date().toISOString() },
				label
			);
			onsaved(id);
		} catch (err) {
			error = err instanceof AppError ? err.message : 'No se pudo guardar la visita.';
		} finally {
			busy = false;
		}
	}
</script>

<form class="capture" onsubmit={save} novalidate>
	{#if known}
		<p class="who-known">
			<b>{known.name ?? 'Cliente sin nombre'}</b>
			<small>{known.phone}</small>
		</p>
	{:else}
		<label class="field">
			<span class="label">WhatsApp del cliente</span>
			<input class="input" bind:value={phone} inputmode="tel" autocomplete="off" placeholder="300 555 0147" disabled={busy} />
			<span class="hint">
				{#if looking}Buscando…{:else if match}Ya es cliente: {match.visits} {match.visits === 1 ? 'visita' : 'visitas'} con registro.{:else if digits.length >= 10}Cliente nuevo.{:else}Con el número lo encuentras la próxima vez.{/if}
			</span>
		</label>
		<label class="field">
			<span class="label">Nombre</span>
			<input class="input" bind:value={name} maxlength="60" autocomplete="off" placeholder="Opcional" disabled={busy} />
		</label>
	{/if}

	{#if hasConsent}
		<p class="consented">Autorizó guardar sus fotos.</p>
	{:else}
		<div class="consent">
			<label class="check">
				<input type="checkbox" bind:checked={consent} disabled={busy} />
				<span>El cliente autoriza guardar sus fotos en su registro de Bar Beer</span>
			</label>
			<p class="fine">Solo las ve el equipo del local. Puede pedir que se borren cuando quiera.</p>
			{#if consent}
				<label class="check">
					<input type="checkbox" bind:checked={minor} disabled={busy} />
					<span>Es menor de edad y su acudiente lo autoriza</span>
				</label>
			{/if}
		</div>
	{/if}

	<fieldset class="shots" disabled={!canShoot || busy}>
		<legend class="label">Fotos {count ? `· ${count} de 4` : '· opcionales'}</legend>
		<div class="grid">
			{#each ANGLES as a (a.angle)}
				{@const s = shots[a.angle]}
				<div class="slot" class:filled={!!s}>
					<label class="shoot">
						<input
							class="sr-only"
							type="file"
							accept="image/*"
							capture="environment"
							aria-label="{s ? 'Repetir' : 'Tomar'} foto: {a.label}"
							onchange={(e) => take(a.angle, e)}
						/>
						{#if s}
							<img src={s.url} alt="" />
						{:else}
							<svg viewBox="0 0 24 24" aria-hidden="true">
								<path d="M4 8h3l2-3h6l2 3h3v11H4z" />
								<circle cx="12" cy="13" r="3.5" />
							</svg>
						{/if}
						<span class="name">{shrinking === a.angle ? 'Achicando…' : a.label}</span>
					</label>
					{#if s}
						<button type="button" class="quit" onclick={() => drop(a.angle)} aria-label="Quitar foto: {a.label}">×</button>
					{/if}
				</div>
			{/each}
		</div>
		{#if !canShoot}<p class="fine">Para tomar fotos, marca primero la autorización.</p>{/if}
	</fieldset>

	<label class="field">
		<span class="label">Nota del corte</span>
		<textarea class="input area" bind:value={note} maxlength="280" rows="3" placeholder="Ej.: degradado bajo, 1 a los lados, barba perfilada" disabled={busy}></textarea>
	</label>

	<p class="form-msg err" role="alert">{error}</p>
	<button type="submit" class="btn btn-foam" disabled={busy || !!shrinking}>{busy ? 'Guardando…' : 'Guardar visita'}</button>
</form>

<style>
	.capture {
		display: grid;
		gap: 14px;
	}
	.who-known {
		display: grid;
		gap: 2px;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--line);
	}
	.who-known small,
	.fine,
	.consented {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.consent {
		display: grid;
		gap: 2px;
	}
	.consent .fine {
		padding-left: 34px;
		margin-bottom: 4px;
	}
	.shots {
		display: grid;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: 0;
		min-width: 0;
	}
	.shots legend {
		padding: 0;
		margin-bottom: 8px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.slot {
		position: relative;
	}
	.shoot {
		position: relative;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 6px;
		aspect-ratio: 3 / 4;
		overflow: hidden;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam-dim);
		cursor: pointer;
		transition:
			border-color var(--t-fast),
			color var(--t-fast);
	}
	.shoot:hover,
	.shoot:focus-within {
		border-color: var(--foam-faint);
		color: var(--foam);
	}
	.shoot:focus-within {
		outline: 2px solid var(--foam);
		outline-offset: 2px;
	}
	.filled .shoot {
		border-style: solid;
		border-color: var(--line);
	}
	.shoot img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.shoot svg {
		width: 30px;
		height: 30px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linejoin: round;
	}
	.name {
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.filled .name {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 18px 8px 6px;
		background: linear-gradient(transparent, rgb(12 9 6 / 0.85));
		color: var(--foam);
		text-align: left;
	}
	.quit {
		position: absolute;
		top: 4px;
		right: 4px;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: rgb(12 9 6 / 0.8);
		color: var(--foam);
		font-size: 1.25rem;
		line-height: 1;
	}
	.quit:hover {
		border-color: var(--foam-faint);
	}
	.shots:disabled .shoot {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.area {
		height: auto;
		min-height: 88px;
		padding-top: 12px;
		padding-bottom: 12px;
		resize: vertical;
		line-height: 1.4;
	}
</style>
