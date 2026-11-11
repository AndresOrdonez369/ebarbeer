<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import { clock, dayLabel, money, periodRange, type PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type VoidedSale } from '#lib/types.js';

	const today = once(() => backend.businessDate());
	let kind = $state<PeriodKind>('month');
	let offset = $state(0);
	const range = $derived(today.data ? periodRange(today.data, kind, offset) : null);

	let rows = $state<VoidedSale[] | null>(null);
	let error = $state('');

	$effect(() => {
		const r = range;
		if (!r) return;
		rows = null;
		error = '';
		backend
			.voidedSales(r.from, r.to)
			.then((d) => {
				if (range === r) rows = d;
			})
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar las anulaciones.'));
	});

	const total = $derived((rows ?? []).reduce((s, v) => s + v.total, 0));
</script>

<svelte:head><title>Anulaciones · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Anulaciones</h1>

	{#if today.data}
		<RangePicker today={today.data} bind:kind bind:offset kinds={['week', 'month']} />
	{/if}

	{#if error}
		<p class="form-msg err">{error}</p>
	{:else if rows}
		{#if !rows.length}
			<EmptyState flush title="Ninguna anulada">
				<p>En este periodo no se anuló ninguna cuenta. Cuando la caja anula una, aquí queda quién, cuándo y por qué.</p>
			</EmptyState>
		{:else}
			<p class="sum">
				<span class="fig">{rows.length} {rows.length === 1 ? 'cuenta' : 'cuentas'}</span>
				<span class="dim">por {money(total)} que no se cobraron</span>
			</p>
			<ul class="rows">
				{#each rows as v (v.id)}
					<li>
						<span class="no">
							{v.receiptNo ? `N.º ${String(v.receiptNo).padStart(4, '0')}` : 'Sin número'} · {dayLabel(v.date)} · {clock(v.createdAt)}
						</span>
						<span class="fig tot">{money(v.total)}</span>
						<span class="why">{v.reason ?? 'Sin motivo'}</span>
						<span class="who">
							Anulada{v.voidedBy ? ` por ${v.voidedBy}` : ''}{v.voidedAt ? ` a las ${clock(v.voidedAt)}` : ''}{v.cashier && v.cashier !== v.voidedBy ? ` · cobró ${v.cashier}` : ''}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
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
	}
	.sum {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		padding-bottom: 10px;
	}
	.sum .fig {
		font-size: var(--fs-fig-md);
	}
	.dim {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.rows li {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 12px;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}
	.no {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
	}
	.tot {
		grid-row: span 2;
		align-self: center;
		font-size: var(--fs-fig-sm);
		color: var(--foam-dim);
		text-decoration: line-through;
	}
	.why {
		font-size: var(--fs-sm);
		font-weight: 700;
	}
	.who {
		grid-column: 1 / -1;
		font-size: var(--fs-xs);
		color: var(--danger-text);
	}
	.sk {
		height: 240px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
