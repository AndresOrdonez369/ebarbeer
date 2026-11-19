<script lang="ts">
	import SalesList from '#lib/components/SalesList.svelte';
	import { amount, money } from '#lib/format.js';
	import { live } from '#lib/live.svelte.js';
	import { flush, outbox } from '#lib/outbox.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import type { SaleRecord } from '#lib/types.js';

	const sales = live(() => backend.todaySales());
	const totals = live(() => backend.dayTotals());
	const board = live(() => backend.dayBoard());

	const names = $derived(new Map((board.data ?? []).map((r) => [r.staffId, r.name])));
	const list = $derived<SaleRecord[]>([
		...outbox.items.map((p) => ({ ...p.preview, status: p.status, error: p.error })),
		...(sales.data ?? []).filter((s) => !outbox.items.some((p) => p.id === s.id))
	]);
	const byBarber = $derived([...(board.data ?? [])].filter((r) => r.services > 0).sort((a, b) => b.revenue - a.revenue));

	function refreshAll() {
		sales.refresh();
		totals.refresh();
		board.refresh();
	}
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
		<p class="dim tip">Toca una cuenta para ver el detalle, enviar la boleta o anularla si se cobró por error.</p>
		<SalesList {list} {names} onvoided={refreshAll} />
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
	.barbers {
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
	.tip {
		margin-bottom: 4px;
		font-size: var(--fs-xs);
	}
	.bad {
		color: var(--danger-text);
	}
	.pad {
		padding: 8px 0;
	}
</style>
