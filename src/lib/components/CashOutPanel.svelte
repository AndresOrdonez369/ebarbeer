<!-- Cash taken out of the drawer ("sacar efectivo"): record one with what it was for, see the day's,
     and void one registered by mistake while the day is open. -->
<script lang="ts">
	import { parsePesos } from '../bill.js';
	import { amount, clock, money } from '../format.js';
	import { backend } from '../session.svelte.js';
	import { AppError, type CashOut } from '../types.js';

	let {
		date,
		outs,
		available,
		open,
		today,
		onchange
	}: {
		date: string;
		outs: CashOut[];
		/** What the drawer should hold right now. */
		available: number;
		/** The day is not closed: salidas can be taken and voided. */
		open: boolean;
		today: boolean;
		onchange: () => void;
	} = $props();

	const reasons = ['Gastos del local', 'Cigarrillos', 'Compras', 'Retiro del dueño'];

	let taking = $state(false);
	let amountText = $state('');
	let reason = $state('');
	let busy = $state(false);
	let error = $state('');
	let done = $state('');
	let voiding = $state<string | null>(null);
	let voidReason = $state('');
	let voidError = $state('');

	const qty = $derived(amountText ? parsePesos(amountText) : null);
	const left = $derived(available - (qty ?? 0));
	const total = $derived(outs.reduce((s, o) => s + (o.voidedAt ? 0 : o.amount), 0));

	function typed(e: Event & { currentTarget: HTMLInputElement }) {
		const v = e.currentTarget.value;
		amountText = /[0-9]/.test(v) ? amount(parsePesos(v)) : '';
		error = '';
	}

	function start() {
		taking = true;
		done = '';
		error = '';
	}

	function cancel() {
		taking = false;
		amountText = '';
		reason = '';
		error = '';
	}

	async function take(e: SubmitEvent) {
		e.preventDefault();
		if (!qty) return (error = 'Escribe cuánto efectivo sacas.');
		if (reason.trim().length < 3) return (error = 'Escribe para qué se saca el efectivo.');
		if (qty > available)
			return (error = `En la caja debería haber ${money(Math.max(available, 0))} y no se puede sacar más. Si hay más efectivo, revisa la base o las cuentas.`);
		busy = true;
		error = '';
		try {
			const o = await backend.takeCash(qty, reason.trim(), date);
			done = `Salida registrada: ${money(o.amount)} · ${o.reason}.`;
			cancel();
			onchange();
		} catch (err) {
			error = err instanceof AppError ? err.message : 'No se pudo registrar la salida.';
		} finally {
			busy = false;
		}
	}

	function askVoid(id: string) {
		voiding = voiding === id ? null : id;
		voidReason = '';
		voidError = '';
		done = '';
	}

	async function doVoid(id: string) {
		if (voidReason.trim().length < 3) return (voidError = 'Escribe por qué se anula (mínimo 3 letras).');
		busy = true;
		voidError = '';
		try {
			await backend.voidCashOut(id, voidReason.trim());
			voiding = null;
			onchange();
		} catch (err) {
			voidError = err instanceof AppError ? err.message : 'No se pudo anular la salida.';
		} finally {
			busy = false;
		}
	}
</script>

<section class="outs" aria-labelledby="outs-title">
	<div class="head">
		<h2 id="outs-title" class="fig">Salidas de efectivo</h2>
		{#if total > 0}<span class="fig sum">−{amount(total)}</span>{/if}
	</div>

	{#if outs.length}
		<ul class="list">
			{#each outs as o (o.id)}
				<li class:void={!!o.voidedAt}>
					<div class="row">
						<span class="what">
							{o.reason}
							<small>{o.takenBy ?? 'Caja'} · {clock(o.takenAt)}</small>
						</span>
						<span class="fig amt-out">{amount(o.amount)}</span>
					</div>
					{#if o.voidedAt}
						<p class="voided">Anulada por {o.voidedBy ?? 'alguien'} a las {clock(o.voidedAt)} · {o.voidReason}</p>
					{:else if open}
						{#if voiding === o.id}
							<div class="confirm">
								<label class="field">
									<span class="label">Motivo para anular</span>
									<input class="input" bind:value={voidReason} maxlength="120" placeholder="Ej.: se anotó dos veces" disabled={busy} />
								</label>
								<p class="form-msg err" role="alert">{voidError}</p>
								<div class="row2">
									<button type="button" class="btn btn-outline" onclick={() => askVoid(o.id)} disabled={busy}>Cancelar</button>
									<button type="button" class="btn btn-danger" onclick={() => doVoid(o.id)} disabled={busy}>
										{busy ? 'Anulando…' : 'Anular salida'}
									</button>
								</div>
							</div>
						{:else}
							<button type="button" class="link" onclick={() => askVoid(o.id)} disabled={busy}>Anular</button>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{:else if !taking}
		<p class="none">Nada ha salido del cajón {today ? 'hoy' : 'ese día'}.</p>
	{/if}

	{#if done}<p class="form-msg ok" role="status">{done}</p>{/if}

	{#if open}
		{#if taking}
			<form class="take" onsubmit={take} novalidate>
				<label class="field">
					<span class="label">Cuánto sacas</span>
					<input class="input amt" value={amountText} oninput={typed} inputmode="numeric" autocomplete="off" placeholder="0" disabled={busy} />
					<span class="hint" class:over={qty != null && left < 0}>
						{qty ? `Quedarán en el cajón ${money(left)}` : `En el cajón debería haber ${money(available)}`}
					</span>
				</label>
				<div class="chips" role="group" aria-label="Para qué, rápido">
					{#each reasons as r (r)}
						<button type="button" class="chip" aria-pressed={reason === r} onclick={() => ((reason = r), (error = ''))} disabled={busy}>{r}</button>
					{/each}
				</div>
				<label class="field">
					<span class="label">Para qué</span>
					<input class="input" bind:value={reason} maxlength="120" placeholder="Ej.: bolsas, domicilio, cigarrillos" disabled={busy} />
				</label>
				<p class="form-msg err" role="alert">{error}</p>
				<div class="row2">
					<button type="button" class="btn btn-outline" onclick={cancel} disabled={busy}>Cancelar</button>
					<button type="submit" class="go" disabled={busy}>{busy ? 'Guardando…' : qty ? `Sacar ${money(qty)}` : 'Sacar'}</button>
				</div>
			</form>
		{:else}
			<button type="button" class="btn btn-outline add" onclick={start} disabled={busy}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
				Sacar efectivo
			</button>
		{/if}
	{/if}
</section>

<style>
	.outs {
		display: grid;
		gap: 10px;
		margin: -4px 0 18px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.head h2 {
		font-size: var(--fs-fig-sm);
	}
	.sum {
		font-size: var(--fs-fig-sm);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.list li {
		display: grid;
		gap: 6px;
		padding: 10px 0;
		border-bottom: 1px dashed var(--line);
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 36px;
	}
	.what {
		display: grid;
		gap: 2px;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.what small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.amt-out {
		font-size: var(--fs-fig-sm);
	}
	.void .what,
	.void .amt-out {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
	.voided {
		font-size: var(--fs-xs);
		color: var(--danger-text);
	}
	.none {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.link {
		justify-self: start;
		height: 32px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-xs);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.link:hover:not(:disabled) {
		color: var(--foam);
	}
	.confirm {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--red);
		border-radius: var(--r);
	}
	.take {
		display: grid;
		gap: 12px;
		padding-top: 4px;
	}
	.amt {
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
	}
	.hint.over {
		color: var(--danger-text);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		min-height: 40px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-weight: 700;
		font-size: var(--fs-xs);
		transition:
			border-color var(--t-fast),
			color var(--t-fast);
	}
	.chip:hover:not(:disabled) {
		border-color: var(--foam-faint);
	}
	.chip[aria-pressed='true'] {
		border-color: var(--amber);
		color: var(--amber);
	}
	/* Foam outline: the screen already has its foam action (Cerrar caja). */
	.go {
		min-height: 48px;
		border: 1px solid var(--foam);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
		text-transform: uppercase;
		transition:
			background-color var(--t-fast),
			transform var(--t-fast);
	}
	.go:hover:not(:disabled) {
		background: var(--wood-raised);
	}
	.go:active:not(:disabled) {
		transform: scale(0.98);
	}
	.go:disabled {
		opacity: 0.6;
	}
	.add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
	}
	.add svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
	}
</style>
