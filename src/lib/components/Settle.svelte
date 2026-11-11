<!--
	Paying one barber ("liquidar"): what he did in a day, week or month, what he earned, what was
	already paid and what he is owed, with one button to pay it. Used by the register and the admin.
-->
<script lang="ts">
	import RangePicker from './RangePicker.svelte';
	import { amount, clock, dayLabel, money, moneyNb, periodLabel, periodRange, type PeriodKind } from '../format.js';
	import { backend, session } from '../session.svelte.js';
	import { AppError, type PayoutMethod, type PayResult, type Settlement } from '../types.js';

	let {
		staffId,
		today,
		backHref,
		backLabel,
		initialKind = 'day',
		initialOffset = 0
	}: {
		staffId: string;
		today: string;
		backHref: string;
		backLabel: string;
		initialKind?: PeriodKind;
		initialOffset?: number;
	} = $props();

	// Only the starting period comes from the caller; after that the tabs own it.
	// svelte-ignore state_referenced_locally
	let kind = $state<PeriodKind>(initialKind);
	// svelte-ignore state_referenced_locally
	let offset = $state(initialOffset);
	/** "Todo lo pendiente": from the oldest unpaid day to today, outside the day/week/month tabs. */
	let pending = $state<{ from: string; to: string } | null>(null);
	const range = $derived(pending ?? periodRange(today, kind, offset));

	let data = $state<Settlement | null>(null);
	let error = $state('');
	let method = $state<PayoutMethod>('cash');
	let confirming = $state(false);
	let busy = $state(false);
	let msg = $state('');
	let done = $state<PayResult | null>(null);

	async function load(r: { from: string; to: string }) {
		try {
			const d = await backend.settleSummary(staffId, r.from, r.to);
			if (range === r) data = d;
			error = '';
		} catch (e) {
			error = e instanceof AppError ? e.message : 'No se pudo cargar la liquidación.';
		}
	}

	$effect(() => {
		const r = range;
		data = null;
		confirming = false;
		msg = '';
		load(r);
		// New sales of this barber show up while the cashier looks.
		return backend.onSalesChange(() => load(r));
	});

	const commissionOwed = $derived(data ? data.commission - data.commissionPaid : 0);
	const bonusOwed = $derived(data ? data.bonus - data.bonusPaid : 0);
	const owed = $derived(commissionOwed + bonusOwed);
	const paid = $derived(data ? data.commissionPaid + data.bonusPaid : 0);
	const canPay = $derived(session.profile?.role === 'admin' || session.profile?.role === 'cashier');
	const label = $derived(pending ? `Todo lo pendiente · desde ${dayLabel(pending.from)}` : periodLabel(kind, offset, range));
	const methodWord: Record<PayoutMethod, string> = { cash: 'efectivo', transfer: 'transferencia' };

	async function pay() {
		busy = true;
		msg = '';
		try {
			// A running week or month is paid up to today. The server refuses if the amount changed.
			done = await backend.payBarber(staffId, range.from, range.to < today ? range.to : today, method, owed);
			confirming = false;
			await load(range);
		} catch (e) {
			msg = e instanceof AppError ? e.message : 'No se pudo registrar el pago.';
			confirming = false;
			await load(range);
		} finally {
			busy = false;
		}
	}

	function seeAllPending() {
		if (!data?.owedFrom) return;
		pending = { from: data.owedFrom, to: today };
	}

	function whatsapp(p: PayResult) {
		if (!data) return '#';
		const lines = [
			`*${session.profile?.shopName || 'Bar Beer'}* · Pago a ${data.name}`,
			kind === 'day' && !pending ? dayLabel(range.from) : label,
			`Cortes: ${data.cuts} · Servicios: ${data.services}`,
			`Comisión: ${money(p.commission)}`,
			...(p.bonus ? [`Bonos: ${money(p.bonus)}`] : []),
			`Pagado: ${money(p.total)} en ${methodWord[p.method]}${p.paidBy ? ` (${p.paidBy}, ${clock(p.paidAt)})` : ''}`
		];
		return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
	}
</script>

<section class="wrap">
	<a class="back-link" href={backHref}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		{backLabel}
	</a>
	<h1 class="fig">{data?.name ?? ' '}</h1>

	{#if pending}
		<div class="pending-head">
			<p class="now">{label}</p>
			<button type="button" class="link" onclick={() => (pending = null)}>Volver a {periodLabel(kind, offset, periodRange(today, kind, offset)).split(' · ')[0].toLowerCase()}</button>
		</div>
	{:else}
		<RangePicker {today} bind:kind bind:offset />
	{/if}

	{#if error}
		<p class="form-msg err">{error}</p>
	{:else if data}
		{#if done}
			<div class="done" role="status">
				<p class="stamp">Pagado</p>
				<p class="fig paid-fig">{money(done.total)}</p>
				<p class="dim">
					{done.cuts} {done.cuts === 1 ? 'corte' : 'cortes'} · en {methodWord[done.method]} · {clock(done.paidAt)}{done.paidBy ? ` · ${done.paidBy}` : ''}
				</p>
				<a class="btn btn-outline wa" href={whatsapp(done)} target="_blank" rel="noopener">
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8L4 20z" /></svg>
					Enviarle el resumen por WhatsApp
				</a>
				<button type="button" class="link" onclick={() => (done = null)}>Cerrar comprobante</button>
			</div>
		{/if}

		<div class="owed">
			<span class="label">{owed > 0 ? 'Le toca' : paid > 0 ? 'Al día' : 'Sin nada por pagar'}</span>
			<span class="fig big" class:zero={owed <= 0}>{money(Math.max(owed, 0))}</span>
			<span class="sum">
				Comisión {moneyNb(data.commission)}{data.bonus ? ` + bonos ${moneyNb(data.bonus)}` : ''}{paid ? ` − ya pagado ${moneyNb(paid)}` : ''}
			</span>
		</div>

		<dl class="strip">
			<div><dt class="label">Cortes</dt><dd class="fig">{amount(data.cuts)}</dd></div>
			<div><dt class="label">Servicios</dt><dd class="fig">{amount(data.services)}</dd></div>
			<div><dt class="label">Vendió</dt><dd class="fig">{amount(data.revenue)}</dd></div>
		</dl>

		{#if data.owedBefore > 0 && !pending && data.owedFrom}
			<div class="before">
				<p>Además le quedan {moneyNb(data.owedBefore)} de antes, desde el {dayLabel(data.owedFrom).toLowerCase()}.</p>
				<button type="button" class="btn btn-outline" onclick={seeAllPending}>Ver todo lo pendiente</button>
			</div>
		{/if}

		{#if canPay && owed > 0}
			<div class="pay">
				<div class="field">
					<span class="label" id="method-label">Cómo se le paga</span>
					<div class="choice" role="radiogroup" aria-labelledby="method-label" style:--n="2">
						<button type="button" role="radio" aria-checked={method === 'cash'} onclick={() => ((method = 'cash'), (confirming = false))}>Efectivo</button>
						<button type="button" role="radio" aria-checked={method === 'transfer'} onclick={() => ((method = 'transfer'), (confirming = false))}>Transferencia</button>
					</div>
				</div>
				<p class="form-msg err" role="alert">{msg}</p>
				{#if confirming}
					<div class="confirm">
						<p>
							¿Le entregaste {money(owed)} a {data.name} en {methodWord[method]}?
							{method === 'cash' ? 'Sale del cajón y se descuenta del cierre de hoy.' : 'No toca el efectivo del cajón.'}
						</p>
						<div class="row2">
							<button type="button" class="btn btn-outline" onclick={() => (confirming = false)} disabled={busy}>Cancelar</button>
							<button type="button" class="btn btn-foam" onclick={pay} disabled={busy}>{busy ? 'Guardando…' : 'Sí, pagado'}</button>
						</div>
					</div>
				{:else}
					<button type="button" class="btn btn-foam" onclick={() => ((confirming = true), (done = null), (msg = ''))}>Pagar {money(owed)}</button>
				{/if}
			</div>
		{/if}

		{#if data.items.length}
			<h2 class="fig heading">Lo que hizo</h2>
			<ul class="rows">
				{#each data.items as i (i.name)}
					<li>
						<span class="n">{i.name}{i.qty > 1 ? ` × ${i.qty}` : ''}<small>de {money(i.revenue)}</small></span>
						<span class="fig earn">{amount(i.commission)}</span>
					</li>
				{/each}
			</ul>
			<p class="legend">En ámbar, lo que le deja cada servicio.</p>
		{:else}
			<p class="empty">Sin servicios en {kind === 'day' ? 'este día' : 'este periodo'}.</p>
		{/if}

		{#if data.bonuses.length}
			<h2 class="fig heading">Bonos</h2>
			<ul class="rows">
				{#each data.bonuses as b (b.name + b.periodStart)}
					<li>
						<span class="n">
							{b.name}<small>{b.paid ? 'Pagado' : !b.payable ? 'Cumplido hoy · se calcula al cerrar el día' : b.today ? 'Cumplido hoy · se paga con el día' : 'Por pagar'}</small>
						</span>
						<span class="fig" class:earn={b.payable}>{amount(b.amount)}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if data.payouts.length}
			<h2 class="fig heading">Pagos</h2>
			<ul class="rows">
				{#each data.payouts.slice(0, 12) as p (p.id)}
					<li>
						<span class="n">
							{p.from === p.to ? dayLabel(p.from) : `${dayLabel(p.from)} a ${dayLabel(p.to)}`}
							<small>{clock(p.paidAt)} · {p.method === 'cash' ? 'Efectivo' : 'Transferencia'}{p.paidBy ? ` · ${p.paidBy}` : ''}</small>
						</span>
						<span class="fig">{amount(p.total)}</span>
					</li>
				{/each}
			</ul>
			{#if data.payouts.length > 12}<p class="legend">Y {data.payouts.length - 12} pagos más en este periodo.</p>{/if}
		{/if}
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
		min-height: 1em;
	}
	.owed {
		display: grid;
		gap: 2px;
		padding-bottom: 12px;
	}
	.big {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
		line-height: 1;
		color: var(--amber);
	}
	.big.zero {
		color: var(--foam-dim);
	}
	.sum,
	.dim {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.strip {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 0;
		padding: 10px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.strip dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-sm);
		font-weight: 900;
		white-space: nowrap;
	}
	.before {
		display: grid;
		gap: 10px;
		margin-top: 14px;
		padding: 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		font-size: var(--fs-sm);
		color: var(--amber);
	}
	.before .btn {
		justify-self: start;
	}
	.pay {
		display: grid;
		gap: 12px;
		margin-top: 16px;
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
	.pay .form-msg:empty {
		display: none;
	}
	.pending-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: var(--tap);
		margin: 12px 0 14px;
	}
	.pending-head .now {
		font-weight: 700;
		font-size: var(--fs-sm);
		color: var(--amber);
	}
	.done {
		display: grid;
		gap: 6px;
		margin-bottom: 16px;
		padding: 16px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
	}
	.stamp {
		font: 900 var(--fs-fig-md) / 1 var(--font-display);
		text-transform: uppercase;
	}
	.paid-fig {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
		color: var(--amber);
	}
	.wa {
		margin-top: 6px;
	}
	.wa svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linejoin: round;
	}
	.link {
		justify-self: start;
		height: 40px;
		padding: 0;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-size: var(--fs-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.link:hover {
		color: var(--foam);
	}
	.heading {
		margin: 22px 0 4px;
		font-size: var(--fs-fig-sm);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.rows li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		border-bottom: 1px solid var(--line);
	}
	.n {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.n small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.rows .fig {
		font-size: var(--fs-fig-sm);
		white-space: nowrap;
	}
	.earn {
		color: var(--amber);
	}
	.legend,
	.empty {
		margin-top: 8px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.empty {
		margin-top: 18px;
		font-size: var(--fs-sm);
	}
	.sk {
		height: 360px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
