<script lang="ts">
	import { onMount } from 'svelte';
	import { backend } from '#lib/session.svelte.js';
	import { AppError } from '#lib/types.js';

	let name = $state('');
	let goalText = $state('');
	let cutoff = $state('04:00');
	let loaded = $state(false);
	let busy = $state(false);
	let msg = $state<{ ok: boolean; text: string } | null>(null);

	onMount(async () => {
		try {
			const s = await backend.shopSettings();
			name = s.name;
			goalText = String(s.dailyCutGoal);
			cutoff = s.dayCutoff;
		} catch (e) {
			msg = { ok: false, text: e instanceof AppError ? e.message : 'No se pudo cargar.' };
		}
		loaded = true;
	});

	const cutoffs = ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00'];

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = null;
		const goal = Number(goalText);
		if (!name.trim()) return (msg = { ok: false, text: 'Escribe el nombre del local.' });
		if (!Number.isInteger(goal) || goal < 1 || goal > 200)
			return (msg = { ok: false, text: 'La meta diaria va de 1 a 200 cortes.' });
		busy = true;
		try {
			await backend.saveShopSettings({ name, dailyCutGoal: goal, dayCutoff: cutoff });
			msg = { ok: true, text: 'Guardado. Las jarras ya usan la nueva meta.' };
			try {
				localStorage.setItem('barbeer-local-reviewed', '1');
			} catch {
				/* storage blocked */
			}
		} catch (err) {
			msg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo guardar.' };
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Datos del local · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Datos del local</h1>

	{#if loaded}
		<form class="form" onsubmit={save} novalidate>
			<label class="field">
				<span class="label">Nombre</span>
				<input class="input" bind:value={name} autocomplete="off" maxlength="60" />
				<span class="hint">Sale en la boleta y en el mensaje de WhatsApp.</span>
			</label>
			<label class="field">
				<span class="label">Meta diaria de cortes</span>
				<input class="input" bind:value={goalText} inputmode="numeric" />
				<span class="hint">Hasta donde se llena la jarra de cada barbero. Cada uno puede tener la suya en Equipo.</span>
			</label>
			<label class="field">
				<span class="label">El día cierra a las</span>
				<select class="input" bind:value={cutoff}>
					{#each cutoffs as c (c)}
						<option value={c}>{c === '00:00' ? 'Medianoche' : `${Number(c.slice(0, 2))}:00 a. m.`}</option>
					{/each}
				</select>
				<span class="hint">Lo cobrado antes de esa hora cuenta para el día anterior. Sirve porque el local abre de noche.</span>
			</label>
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
		</form>
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
		margin-bottom: 14px;
	}
	.sk {
		height: 300px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
