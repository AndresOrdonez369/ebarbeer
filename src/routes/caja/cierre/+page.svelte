<script lang="ts">
	import { parsePesos } from '#lib/bill.js';
	import CashOutPanel from '#lib/components/CashOutPanel.svelte';
	import OpenRegister from '#lib/components/OpenRegister.svelte';
	import { addDays, amount, clock, dayLabel, money, moneyNb } from '#lib/format.js';
	import { outbox } from '#lib/outbox.svelte.js';
	import { backend, session } from '#lib/session.svelte.js';
	import { AppError, type CashDay } from '#lib/types.js';

	let today = $state<string | null>(null);
	let date = $state<string | null>(null);
	let day = $state<CashDay | null>(null);
	/** Yesterday, when it was left without a closing. */
	let behind = $state<CashDay | null>(null);
	let loadError = $state('');

	let countedText = $state('');
	let notes = $state('');
	let confirming = $state(false);
	let editingBase = $state(false);
	let busy = $state(false);
	let msg = $state('');

	async function load(d: string) {
		try {
			const r = await backend.cashDay(d);
			if (d === date) day = r;
			loadError = '';
		} catch (e) {
			loadError = e instanceof AppError ? e.message : 'No se pudo cargar la caja.';
		}
	}

	$effect(() => {
		(async () => {
			try {
				today = await backend.businessDate();
				date = today;
				await load(today);
				const y = await backend.cashDay(addDays(today, -1));
				if (!y.closing && y.expectedCash > 0) behind = y;
			} catch (e) {
				loadError = e instanceof AppError ? e.message : 'No se pudo cargar la caja.';
			}
		})();
		// While the day is open, what the drawer should hold follows every sale and void.
		return backend.onSalesChange(() => {
			if (date && !day?.closing) load(date);
		});
	});

	function pick(d: string) {
		date = d;
		day = null;
		countedText = '';
		notes = '';
		confirming = false;
		editingBase = false;
		msg = '';
		load(d);
	}

	function baseSet() {
		editingBase = false;
		confirming = false;
		if (date) load(date);
	}

	const counted = $derived(countedText ? parsePesos(countedText) : null);
	const diff = $derived(day && counted != null ? counted - day.expectedCash : null);
	const pending = $derived(outbox.items.filter((p) => p.status === 'pending').length);

	function onCounted(e: Event & { currentTarget: HTMLInputElement }) {
		const v = e.currentTarget.value;
		countedText = /[0-9]/.test(v) ? amount(parsePesos(v)) : '';
		confirming = false;
		msg = '';
	}

	function ask(e: SubmitEvent) {
		e.preventDefault();
		msg = '';
		if (counted == null) return (msg = 'Escribe cuánto efectivo contaste.');
		confirming = true;
	}

	async function close() {
		if (!date || counted == null) return;
		busy = true;
		msg = '';
		try {
			const c = await backend.closeRegister(date, counted, notes.trim() || null);
			day = { ...day!, date, expectedCash: c.expectedCash, closing: { ...c, closedBy: c.closedBy ?? session.profile?.displayName ?? null } };
			if (behind && behind.date === date) behind = null;
		} catch (err) {
			msg = err instanceof AppError ? err.message : 'No se pudo cerrar la caja.';
			confirming = false;
		} finally {
			busy = false;
		}
	}

	// "Base $ 100.000 + cobrado en efectivo $ 445.000 − pagado a barberos $ 61.000 − salidas $ 20.000",
	// only when there is more than one part.
	const calc = $derived.by(() => {
		if (!day || (day.openingCash <= 0 && day.paidOut <= 0 && day.takenOut <= 0)) return '';
		const s = [
			day.openingCash > 0 ? `Base ${moneyNb(day.openingCash)} + c` : 'C',
			`obrado en efectivo ${moneyNb(day.cashIn)}`,
			day.paidOut > 0 ? ` − pagado a barberos ${moneyNb(day.paidOut)}` : '',
			day.takenOut > 0 ? ` − salidas ${moneyNb(day.takenOut)}` : ''
		];
		return s.join('');
	});
	// A cashier takes cash only from today; the admin also from an earlier day still open.
	const canTake = $derived(date === today || session.profile?.role === 'admin');

	const diffWords = (d: number) => (d === 0 ? 'Cuadra' : d < 0 ? `Faltan ${money(-d)}` : `Sobran ${money(d)}`);
</script>

<svelte:head><title>Cierre · Caja · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Cierre</h1>
	{#if date}<p class="when">{date === today ? 'Hoy' : 'Ayer'} · {dayLabel(date)}</p>{/if}

	{#if behind && date === today && !day?.closing}
		<div class="behind">
			<p>Ayer quedó sin cierre. Ciérralo primero para que cada día tenga su cuenta.</p>
			<button type="button" class="btn btn-outline" onclick={() => pick(behind!.date)}>Cerrar ayer</button>
		</div>
	{:else if date !== today && today && !day?.closing}
		<button type="button" class="back" onclick={() => pick(today!)}>Volver a hoy</button>
	{/if}

	{#if day?.closing}
		{@const c = day.closing}
		<div class="closed">
			<p class="stamp">Caja cerrada</p>
			<dl>
				{#if c.openingCash > 0}<div><dt>Base</dt><dd class="fig">{money(c.openingCash)}</dd></div>{/if}
				{#if c.cashOut > 0}<div><dt>Salidas de efectivo</dt><dd class="fig">−{money(c.cashOut)}</dd></div>{/if}
				<div><dt>Debía haber</dt><dd class="fig">{money(c.expectedCash)}</dd></div>
				<div><dt>Contado</dt><dd class="fig">{money(c.countedCash)}</dd></div>
				<div class="d" class:short={c.difference < 0}>
					<dt>Diferencia</dt>
					<dd class="fig">{diffWords(c.difference)}</dd>
				</div>
			</dl>
			{#if c.notes}<p class="notes">“{c.notes}”</p>{/if}
			<p class="by">Cerró {c.closedBy ?? 'la caja'} · {clock(c.closedAt)}</p>
		</div>
		{#if day.outs.length}
			<div class="closed-outs">
				<CashOutPanel date={day.date} outs={day.outs} available={0} open={false} today={date === today} onchange={() => {}} />
			</div>
		{/if}
		{#if date !== today && today}
			<button type="button" class="btn btn-outline next" onclick={() => pick(today!)}>Ir al cierre de hoy</button>
		{/if}
	{:else if day}
		<div class="expected">
			<span class="label">Debería haber en efectivo</span>
			<span class="fig big">{money(day.expectedCash)}</span>
			{#if calc}<span class="calc">{calc}</span>{/if}
			<span class="hint">{day.openingCash > 0 ? 'La base con que abrió la caja, más lo' : 'Lo'} cobrado en efectivo {date === today ? 'hoy' : 'ese día'}, sin cuentas anuladas{day.paidOut > 0 ? ', menos lo que se les pagó a los barberos en efectivo' : ''}{day.takenOut > 0 ? ', menos lo que se sacó del cajón' : ''}. Transferencias y tarjeta no van en el cajón.</span>
		</div>

		{#if date === today && !day.opening}
			<div class="base-missing">
				<p class="warn-text">Hoy no se abrió la caja. Escribe con cuánto efectivo empezó el cajón para que el cierre cuadre.</p>
				<OpenRegister lastBase={day.lastBase} onopened={baseSet} />
			</div>
		{:else if day.opening}
			{@const o = day.opening}
			<div class="base" class:editing={editingBase}>
				{#if editingBase}
					<OpenRegister lastBase={day.lastBase} current={o.amount} onopened={baseSet} oncancel={() => (editingBase = false)} />
				{:else}
					<p>
						<span class="label">Base del día</span>
						<b class="fig">{money(o.amount)}</b>
						<small>
							Abrió {o.openedBy ?? 'la caja'} · {clock(o.openedAt)}{#if o.changedAt} · cambiada por {o.changedBy ?? 'alguien'} a las {clock(o.changedAt)}{/if}
						</small>
					</p>
					{#if date === today}
						<button type="button" class="btn btn-outline" onclick={() => (editingBase = true)} disabled={busy}>Cambiar</button>
					{/if}
				{/if}
			</div>
		{/if}

		<CashOutPanel
			date={day.date}
			outs={day.outs}
			available={day.expectedCash}
			open={canTake}
			today={date === today}
			onchange={() => date && load(date)}
		/>

		{#if pending && date === today}
			<p class="warn" role="status">
				Hay {pending} {pending === 1 ? 'cuenta' : 'cuentas'} por enviar en este celular. Espera a que se envíen para cerrar, o el
				esperado quedará corto.
			</p>
		{/if}

		<form class="form" onsubmit={ask} novalidate>
			<label class="field">
				<span class="label">Efectivo contado</span>
				<input
					class="input amt"
					value={countedText}
					oninput={onCounted}
					inputmode="numeric"
					autocomplete="off"
					placeholder="0"
					disabled={busy}
				/>
				<span class="hint">Cuenta solo billetes y monedas del cajón.</span>
			</label>

			<p class="diff" class:short={diff != null && diff < 0} class:even={diff === 0} aria-live="polite">
				{#if diff != null}{diffWords(diff)}{:else}&nbsp;{/if}
			</p>

			<label class="field">
				<span class="label">Nota (opcional)</span>
				<textarea class="input notes-in" bind:value={notes} maxlength="300" rows="2" disabled={busy}
					placeholder={diff ? 'Ej.: se pagó un domicilio de la caja' : ''}></textarea>
				{#if diff}<span class="hint">Si no cuadra, cuenta por qué. El administrador lo ve en el historial de cierres.</span>{/if}
			</label>

			<p class="form-msg err" role="alert">{msg}</p>

			{#if confirming && counted != null}
				<div class="confirm">
					<p>¿Cerrar {date === today ? 'hoy' : 'ayer'} con {money(counted)} contado? Después no se puede cambiar.</p>
					<div class="row2">
						<button type="button" class="btn btn-outline" onclick={() => (confirming = false)} disabled={busy}>Cancelar</button>
						<button type="button" class="btn btn-foam" onclick={close} disabled={busy}>{busy ? 'Cerrando…' : 'Sí, cerrar'}</button>
					</div>
				</div>
			{:else}
				<button class="btn btn-foam" type="submit" disabled={busy || (pending > 0 && date === today)}>Cerrar caja</button>
			{/if}
		</form>
	{:else if loadError}
		<p class="form-msg err">{loadError}</p>
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 24px;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.when {
		margin-bottom: 16px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.behind {
		display: grid;
		gap: 10px;
		margin-bottom: 18px;
		padding: 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		font-size: var(--fs-sm);
	}
	.back {
		height: 40px;
		margin: -8px 0 10px -6px;
		padding: 0 6px;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.back:hover {
		color: var(--foam);
	}
	.calc {
		font-size: var(--fs-sm);
		color: var(--foam);
	}
	.base-missing {
		display: grid;
		gap: 10px;
		margin-bottom: 18px;
	}
	.warn-text {
		font-size: var(--fs-sm);
		color: var(--amber);
	}
	.base {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin: -4px 0 18px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--line);
	}
	.base.editing {
		display: block;
	}
	.base p {
		display: grid;
		gap: 2px;
	}
	.base b {
		font-size: var(--fs-fig-sm);
	}
	.base small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.expected {
		display: grid;
		gap: 4px;
		padding: 0 0 16px;
		margin-bottom: 16px;
		border-bottom: 1px solid var(--line);
	}
	.big {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
		line-height: 1;
		color: var(--foam);
	}
	.hint {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 46ch;
	}
	.warn {
		margin-bottom: 14px;
		padding: 10px 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		font-size: var(--fs-sm);
		color: var(--amber);
	}
	.amt {
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
	}
	.diff {
		min-height: 1.6em;
		margin-top: -6px;
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1.2 var(--font-display);
		text-transform: uppercase;
		color: var(--foam);
	}
	.diff.short {
		color: var(--danger-text);
	}
	.notes-in {
		height: auto;
		min-height: 120px;
		padding: 12px 14px;
		font-size: var(--fs-md);
		line-height: 1.5;
		resize: none;
	}
	.confirm {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		font-size: var(--fs-sm);
	}
	.closed {
		padding: 16px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
	}
	.stamp {
		font: 900 var(--fs-fig-md) / 1 var(--font-display);
		text-transform: uppercase;
		color: var(--foam);
	}
	.closed dl {
		display: grid;
		gap: 0;
		margin: 12px 0 0;
	}
	.closed dl div {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		min-height: 44px;
		padding-top: 8px;
		border-bottom: 1px solid var(--line);
	}
	.closed dt {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.closed dd {
		margin: 0;
		font-size: var(--fs-fig-sm);
	}
	.closed .d dd {
		text-transform: uppercase;
	}
	.short dd {
		color: var(--danger-text);
	}
	.notes {
		margin-top: 12px;
		font-size: var(--fs-sm);
	}
	.by {
		margin-top: 12px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.next {
		width: 100%;
		margin-top: 14px;
	}
	.closed-outs {
		margin-top: 22px;
	}
	.sk {
		height: 320px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
