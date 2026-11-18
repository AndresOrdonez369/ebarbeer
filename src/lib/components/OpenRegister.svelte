<!-- "Abrir caja": the cash the drawer starts the day with. The day's expected cash counts from here. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { parsePesos } from '../bill.js';
	import { amount, money } from '../format.js';
	import { backend } from '../session.svelte.js';
	import { AppError, type Opening } from '../types.js';

	let {
		lastBase,
		current = null,
		onopened,
		oncancel
	}: {
		/** The base of the last day opened, offered as a one-tap answer. */
		lastBase: number | null;
		/** The base already set, when correcting it. */
		current?: number | null;
		onopened: (o: Opening) => void;
		oncancel?: () => void;
	} = $props();

	const editing = $derived(current != null);
	// Starts from the base already set; after that it is the cashier's text.
	let text = $state(untrack(() => (current != null ? amount(current) : '')));
	let busy = $state(false);
	let msg = $state('');

	const value = $derived(parsePesos(text));
	const offerLast = $derived(lastBase != null && lastBase > 0 && value !== lastBase && !editing);

	function typed(e: Event & { currentTarget: HTMLInputElement }) {
		const v = e.currentTarget.value;
		text = /[0-9]/.test(v) ? amount(parsePesos(v)) : '';
		msg = '';
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (busy) return;
		busy = true;
		msg = '';
		try {
			onopened(await backend.openRegister(value));
		} catch (err) {
			msg = err instanceof AppError ? err.message : 'No se pudo abrir la caja.';
		} finally {
			busy = false;
		}
	}
</script>

<form class="open" class:editing onsubmit={submit} novalidate aria-labelledby="open-title">
	{#if !editing}
		<p class="label">Abrir caja</p>
		<h2 id="open-title" class="fig">¿Con cuánto efectivo empieza el cajón?</h2>
	{:else}
		<h2 id="open-title" class="sr-only">Cambiar la base</h2>
	{/if}

	<label class="field">
		<span class={editing ? 'label' : 'sr-only'}>Base del día</span>
		<input
			class="input base-amt"
			value={text}
			oninput={typed}
			inputmode="numeric"
			autocomplete="off"
			placeholder="0"
			disabled={busy}
		/>
	</label>

	{#if offerLast}
		<button type="button" class="last" onclick={() => (text = amount(lastBase!))} disabled={busy}>
			Igual que la última vez · <b class="fig">{amount(lastBase!)}</b>
		</button>
	{/if}

	{#if !editing}
		<p class="hint">Cuenta billetes y monedas antes del primer cobro. El cierre de la noche se calcula desde aquí.</p>
	{/if}

	<p class="form-msg err" role="alert">{msg}</p>

	{#if editing}
		<div class="row2">
			<button type="button" class="btn btn-outline" onclick={oncancel} disabled={busy}>Cancelar</button>
			<button type="submit" class="btn btn-foam" disabled={busy || value === current}>{busy ? 'Guardando…' : 'Guardar base'}</button>
		</div>
	{:else}
		<button type="submit" class="btn btn-foam" disabled={busy}>{busy ? 'Abriendo…' : `Abrir caja con ${money(value)}`}</button>
	{/if}
</form>

<style>
	.open {
		display: grid;
		gap: 10px;
	}
	.open:not(.editing) {
		padding: 14px;
		border: 1px solid var(--amber-deep);
		border-radius: var(--r);
		background: var(--wood);
	}
	h2 {
		font-size: var(--fs-fig-md);
		line-height: 1.05;
	}
	.base-amt {
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
	}
	.last {
		justify-self: start;
		min-height: var(--tap);
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			color var(--t-fast),
			border-color var(--t-fast);
	}
	.last b {
		color: var(--foam);
		font-size: 1.05rem;
	}
	.last:hover:not(:disabled) {
		color: var(--foam);
		border-color: var(--foam-faint);
	}
	.hint {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 46ch;
	}
	.form-msg:empty {
		display: none;
	}
	.btn {
		width: 100%;
	}
</style>
