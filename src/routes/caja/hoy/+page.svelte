<script lang="ts">
	import SendReceipt from '#lib/components/SendReceipt.svelte';
	import { amount, clock, methodLabel, money } from '#lib/format.js';
	import { live } from '#lib/live.svelte.js';
	import { flush, outbox, remove } from '#lib/outbox.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type SaleRecord } from '#lib/types.js';

	const sales = live(() => backend.todaySales());
	const totals = live(() => backend.dayTotals());
	const board = live(() => backend.dayBoard());

	const names = $derived(new Map((board.data ?? []).map((r) => [r.staffId, r.name])));
	const list = $derived<SaleRecord[]>([
		...outbox.items.map((p) => ({ ...p.preview, status: p.status, error: p.error })),
		...(sales.data ?? []).filter((s) => !outbox.items.some((p) => p.id === s.id))
	]);
	const byBarber = $derived([...(board.data ?? [])].filter((r) => r.services > 0).sort((a, b) => b.revenue - a.revenue));

	let open = $state<string | null>(null);
	let reason = $state('');
	let voiding = $state(false);
	let voidError = $state('');

	function toggle(id: string) {
		open = open === id ? null : id;
		reason = '';
		voidError = '';
	}

	async function doVoid(id: string) {
		if (reason.trim().length < 3) {
			voidError = 'Escribe el motivo (mínimo 3 letras).';
			return;
		}
		voiding = true;
		voidError = '';
		try {
			await backend.voidSale(id, reason);
			open = null;
			sales.refresh();
			totals.refresh();
			board.refresh();
		} catch (e) {
			voidError = e instanceof AppError ? e.message : 'No se pudo anular.';
		} finally {
			voiding = false;
		}
	}

	const summary = (s: SaleRecord) =>
		s.lines.map((l) => `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''}${l.barberId && names.get(l.barberId) ? ` (${names.get(l.barberId)})` : ''}`).join(', ');
	const methods = (s: SaleRecord) => [...new Set(s.payments.map((p) => methodLabel[p.method]))].join(' + ');
</script>

<svelte:head><title>Hoy · Caja · Bar Beer</title></svelte:head>

<section class="head">
	<h1 class="fig">Hoy</h1>
	{#if totals.data}
		<p class="sum">
			<span class="fig big">{money(totals.data.total)}</span>
			<span class="dim">{totals.data.bills} {totals.data.bills === 1 ? 'cuenta' : 'cuentas'}</span>
		</p>
		<dl class="money">
			<div><dt>Efectivo</dt><dd class="fig">{amount(totals.data.cash)}</dd></div>
			<div><dt>Transferencia</dt><dd class="fig">{amount(totals.data.transfer)}</dd></div>
			<div><dt>Tarjeta</dt><dd class="fig">{amount(totals.data.card)}</dd></div>
		</dl>
	{/if}
</section>

{#if byBarber.length}
	<section class="block">
		<h2 class="fig heading">Por barbero</h2>
		<ul class="barbers">
			{#each byBarber as r (r.staffId)}
				<li>
					<span class="n">{r.name}</span>
					<span class="dim">{r.cuts} {r.cuts === 1 ? 'corte' : 'cortes'}</span>
					<span class="fig">{amount(r.revenue)}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section class="block">
	<h2 class="fig heading">Cuentas</h2>
	{#if outbox.items.some((p) => p.status === 'pending')}
		<button type="button" class="retry" onclick={() => flush()} disabled={outbox.sending}>
			{outbox.sending ? 'Enviando…' : 'Reintentar envío ahora'}
		</button>
	{/if}

	{#if list.length}
		<ul class="sales">
			{#each list as s (s.id)}
				<li class={s.status}>
					<button type="button" class="row" aria-expanded={open === s.id} onclick={() => toggle(s.id)}>
						<span class="no">
							{s.receiptNo ? `N.º ${String(s.receiptNo).padStart(4, '0')}` : 'Sin número'} · {clock(s.createdAt)}
						</span>
						<span class="fig tot">{amount(s.total)}</span>
						<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
						<span class="what">{summary(s)}</span>
						<span class="how">
							{#if s.status === 'void'}Anulada{:else if s.status === 'pending'}Por enviar{:else if s.status === 'failed'}Rechazada{:else}{methods(s)}{/if}
						</span>
					</button>

					{#if open === s.id}
						<div class="detail">
							{#if s.status === 'void'}
								<p>Motivo: {s.voidReason}</p>
							{:else if s.status === 'failed'}
								<p class="bad">{s.error}</p>
								<p>El servidor no aceptó esta cuenta. Vuelve a cobrarla desde Caja y descarta esta.</p>
								<button type="button" class="ghost" onclick={() => remove(s.id)}>Descartar</button>
							{:else if s.status === 'pending'}
								<p>Guardada en este celular. Se envía sola cuando vuelva la conexión. No la cobres de nuevo.</p>
							{:else}
								<ul class="lines">
									{#each s.lines as l, i (i)}
										<li>
											<span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ''}{#if l.barberId}<em>{names.get(l.barberId) ?? ''}</em>{/if}</span>
											<span class="fig">{amount(l.total)}</span>
										</li>
									{/each}
								</ul>
								<p class="pays">
									{#each s.payments as p, i (i)}
										<span>{methodLabel[p.method]} {money(p.amount)}{p.cashReceived && p.cashReceived > p.amount ? ` (recibido ${money(p.cashReceived)})` : ''}</span>
									{/each}
								</p>
								{#if s.receiptToken && s.receiptNo}
									<div class="receipt">
										<SendReceipt
											compact
											sale={{
												id: s.id,
												receiptNo: s.receiptNo,
												receiptToken: s.receiptToken,
												createdAt: s.createdAt,
												total: s.total,
												lines: s.lines.map((l) => ({ ...l, barber: l.barberId ? (names.get(l.barberId) ?? null) : null })),
												payments: s.payments,
												customer: s.customer ?? null,
												receiptSentAt: s.receiptSentAt
											}}
										/>
									</div>
								{/if}
								<label class="reason">
									<span class="label">Motivo para anular</span>
									<input bind:value={reason} placeholder="Ej.: cobrado dos veces" maxlength="120" disabled={voiding} />
								</label>
								<p class="bad" role="alert">{voidError}</p>
								<button type="button" class="voidbtn" onclick={() => doVoid(s.id)} disabled={voiding}>
									{voiding ? 'Anulando…' : 'Anular cuenta'}
								</button>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else if sales.data}
		<p class="dim pad">Todavía no hay cuentas hoy. Las verás aquí apenas cobres la primera.</p>
	{:else if sales.error}
		<p class="bad pad">{sales.error}</p>
	{/if}
</section>

<style>
	.head {
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.sum {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 6px;
	}
	.big {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
	}
	.dim {
		color: var(--foam-dim);
		font-size: var(--fs-sm);
	}
	.money {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 12px 0 0;
		padding: 10px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.money dt {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.money dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-sm);
		font-weight: 900;
		white-space: nowrap;
	}
	.block {
		padding: 20px var(--gutter) 0;
	}
	.heading {
		font-size: 1.25rem;
		margin-bottom: 8px;
	}
	.barbers,
	.sales,
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.barbers li {
		display: grid;
		grid-template-columns: 1fr auto 6rem;
		align-items: baseline;
		gap: 12px;
		min-height: 40px;
		padding-top: 10px;
		border-bottom: 1px solid var(--line);
	}
	.barbers .n {
		font-weight: 700;
	}
	.barbers .fig {
		text-align: right;
		font-size: var(--fs-fig-sm);
	}
	.retry {
		height: 40px;
		margin-bottom: 8px;
		padding: 0 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		background: none;
		color: var(--amber);
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.sales > li {
		border-bottom: 1px solid var(--line);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto 20px;
		gap: 2px 10px;
		width: 100%;
		padding: 12px 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.row:hover .no {
		color: var(--foam);
	}
	.no {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
		transition: color var(--t-fast);
	}
	.chev {
		grid-row: span 2;
		align-self: center;
		width: 20px;
		height: 20px;
		fill: none;
		stroke: var(--foam-dim);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform var(--t-fast);
	}
	.row[aria-expanded='true'] .chev {
		transform: rotate(90deg);
	}
	.tot {
		grid-row: span 2;
		align-self: center;
		font-size: var(--fs-fig-md);
	}
	.what {
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.how {
		grid-column: 1 / -1;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	/* State is carried by form, not only colour. */
	.void .tot,
	.void .what {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
	.void .how,
	.failed .how {
		color: var(--danger-text);
	}
	.pending {
		border: 1px dashed var(--amber-deep) !important;
		border-radius: var(--r);
		padding: 0 10px;
		margin: 6px 0;
	}
	.pending .how {
		color: var(--amber);
	}
	.detail {
		padding: 0 0 14px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		display: grid;
		gap: 8px;
	}
	.lines li {
		display: flex;
		justify-content: space-between;
		min-height: 32px;
		align-items: center;
		color: var(--foam);
		border-bottom: 1px dashed var(--line);
	}
	.lines em {
		font-style: normal;
		color: var(--foam-dim);
		font-size: var(--fs-xs);
		margin-left: 6px;
	}
	.pays {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.receipt {
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.reason {
		display: grid;
		gap: 6px;
		margin-top: 4px;
	}
	.reason input {
		height: 48px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam);
		transition: border-color var(--t-fast);
	}
	.reason input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.bad {
		color: var(--danger-text);
		min-height: 0;
	}
	.voidbtn,
	.ghost {
		height: 48px;
		border-radius: var(--r);
		font-weight: 700;
		font-size: var(--fs-sm);
		background: none;
		transition:
			background-color var(--t-fast),
			color var(--t-fast);
	}
	.voidbtn {
		border: 1px solid var(--red);
		color: var(--danger-text);
	}
	.voidbtn:hover:not(:disabled) {
		background: var(--red);
		color: #fff;
	}
	.ghost {
		border: 1px solid var(--line-strong);
		color: var(--foam);
	}
	.pad {
		padding: 8px 0;
	}
</style>
