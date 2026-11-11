<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import RangePicker from '#lib/components/RangePicker.svelte';
	import { clock, dayLabel, money, periodRange, type PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type Closing } from '#lib/types.js';

	const today = once(() => backend.businessDate());
	let kind = $state<PeriodKind>('month');
	let offset = $state(0);
	const range = $derived(today.data ? periodRange(today.data, kind, offset) : null);

	let rows = $state<Closing[] | null>(null);
	let error = $state('');

	$effect(() => {
		const r = range;
		if (!r) return;
		rows = null;
		error = '';
		backend
			.closings(r.from, r.to)
			.then((d) => {
				if (range === r) rows = d;
			})
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar los cierres.'));
	});

	const net = $derived((rows ?? []).reduce((s, c) => s + c.difference, 0));
	const off = $derived((rows ?? []).filter((c) => c.difference !== 0).length);
	const diffWords = (d: number) => (d === 0 ? 'Cuadró' : d < 0 ? `Faltó ${money(-d)}` : `Sobró ${money(d)}`);
</script>

<svelte:head><title>Cierres · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Cierres</h1>

	{#if today.data}
		<RangePicker today={today.data} bind:kind bind:offset kinds={['month']} />
	{/if}

	{#if error}
		<p class="form-msg err">{error}</p>
	{:else if rows}
		{#if !rows.length}
			<EmptyState flush title="Sin cierres en este mes">
				<p>La caja cierra cada noche desde Caja · Cierre: cuenta el efectivo y aquí queda lo que debía haber y lo que hubo.</p>
			</EmptyState>
		{:else}
			<dl class="strip">
				<div><dt class="label">Cierres</dt><dd class="fig">{rows.length}</dd></div>
				<div><dt class="label">No cuadraron</dt><dd class="fig">{off}</dd></div>
				<div class:short={net < 0}><dt class="label">Diferencia neta</dt><dd class="fig">{net === 0 ? money(0) : `${net > 0 ? '+' : '−'}${money(Math.abs(net))}`}</dd></div>
			</dl>
			<ul class="rows">
				{#each rows as c (c.date)}
					<li class:short={c.difference < 0}>
						<span class="n">{dayLabel(c.date)}<small>{c.closedBy ?? 'Caja'} · {clock(c.closedAt)}</small></span>
						<span class="cash">
							<span class="fig">{money(c.countedCash)}</span>
							<small>de {money(c.expectedCash)}</small>
						</span>
						<span class="d">{diffWords(c.difference)}</span>
						{#if c.notes}<p class="notes">“{c.notes}”</p>{/if}
					</li>
				{/each}
			</ul>
			<p class="legend">Contado en el cajón frente a lo que debía haber en efectivo según las cuentas cobradas.</p>
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
	.strip {
		display: grid;
		grid-template-columns: 0.8fr 1fr 1.2fr;
		gap: 12px;
		margin: 0 0 4px;
		padding: 10px 0;
		border-top: 1px solid var(--line);
	}
	.strip dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-sm);
		font-weight: 900;
		white-space: nowrap;
	}
	.strip .short dd {
		color: var(--danger-text);
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
		align-items: center;
		min-height: 60px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
	}
	.n {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.n small,
	.cash small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.cash {
		display: grid;
		justify-items: end;
		grid-row: span 2;
	}
	.cash .fig {
		font-size: var(--fs-fig-sm);
	}
	.d {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
	}
	.short .d {
		color: var(--danger-text);
	}
	.notes {
		grid-column: 1 / -1;
		font-size: var(--fs-xs);
		color: var(--foam);
	}
	.legend {
		margin-top: 8px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.sk {
		height: 360px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
