<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import LevelBar from '#lib/components/LevelBar.svelte';
	import { amount, dayLabel, fromIsoDate, longDate, money, monthLabel, toIsoDate } from '#lib/format.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type DayRow, type MyTotals } from '#lib/types.js';

	type Range = 'week' | 'month' | 'all';
	const ranges: { id: Range; label: string }[] = [
		{ id: 'week', label: 'Semana' },
		{ id: 'month', label: 'Mes' },
		{ id: 'all', label: 'Todo' }
	];

	let range = $state<Range>('week');
	let rows = $state<DayRow[] | null>(null);
	let totals = $state<MyTotals | null>(null);
	let goal = $state(8);
	let error = $state('');

	$effect(() => {
		backend.dayBoard().then((b) => (goal = b[0]?.goal ?? 8)).catch(() => {});
	});

	$effect(() => {
		const r = range;
		rows = null;
		error = '';
		(async () => {
			try {
				const today = await backend.businessDate();
				const t = fromIsoDate(today);
				let from: string;
				if (r === 'week') {
					const s = new Date(t);
					s.setDate(t.getDate() - ((t.getDay() + 6) % 7));
					from = toIsoDate(s);
				} else if (r === 'month') {
					from = today.slice(0, 8) + '01';
				} else {
					totals = await backend.myTotals();
					from = totals.hiredOn;
				}
				const data = await backend.myHistory(from, today);
				if (range === r) rows = data;
			} catch (e) {
				error = e instanceof AppError ? e.message : 'No se pudo cargar tu historial.';
			}
		})();
	});

	const sum = $derived(
		(rows ?? []).reduce(
			(a, x) => ({ cuts: a.cuts + x.cuts, commission: a.commission + x.commission, days: a.days + 1 }),
			{ cuts: 0, commission: 0, days: 0 }
		)
	);
	const months = $derived.by(() => {
		const map = new Map<string, { month: string; cuts: number; commission: number; days: number }>();
		for (const r of rows ?? []) {
			const k = r.date.slice(0, 7) + '-01';
			const m = map.get(k) ?? { month: k, cuts: 0, commission: 0, days: 0 };
			m.cuts += r.cuts;
			m.commission += r.commission;
			m.days += 1;
			map.set(k, m);
		}
		return [...map.values()];
	});
</script>

<svelte:head><title>Historial · Barbero · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Historial</h1>

	<div class="seg" role="tablist" aria-label="Periodo">
		{#each ranges as r (r.id)}
			<button type="button" role="tab" aria-selected={range === r.id} onclick={() => (range = r.id)}>{r.label}</button>
		{/each}
	</div>

	{#if error}
		<p class="err">{error}</p>
	{:else if rows}
		<dl class="sum">
			<div><dt class="label">Cortes</dt><dd class="fig">{amount(sum.cuts)}</dd></div>
			<div><dt class="label">Ganado</dt><dd class="fig earn">{money(sum.commission)}</dd></div>
			<div><dt class="label">Días</dt><dd class="fig">{amount(sum.days)}</dd></div>
		</dl>
		{#if range === 'all' && totals}
			<p class="since">Desde el {longDate(totals.hiredOn)}&nbsp;· promedio {sum.days ? Math.round(sum.cuts / sum.days) : 0} cortes por día</p>
		{/if}

		{#if !rows.length}
			<EmptyState flush title="Sin días en este periodo">
				<p>Cuando la caja te asigne servicios, cada día trabajado aparece aquí con sus cortes y lo ganado.</p>
			</EmptyState>
		{:else if range === 'all'}
			<p class="legend">La barra es tu jarra promedio por día trabajado en ese mes: llena = {goal} cortes.</p>
			<ul class="rows">
				{#each months as m (m.month)}
					<li>
						<span class="when">{monthLabel(m.month)}<small>{m.days} {m.days === 1 ? 'día' : 'días'}</small></span>
						<span class="level"><LevelBar value={m.cuts / m.days} max={goal} size="sm" /></span>
						<span class="n fig">{amount(m.cuts)}</span>
						<span class="money fig">{amount(m.commission)}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="legend">La barra es tu jarra del día: llena = {goal} cortes.</p>
			<ul class="rows">
				{#each rows as d (d.date)}
					<li>
						<span class="when">{dayLabel(d.date)}<small>{d.services} {d.services === 1 ? 'servicio' : 'servicios'}</small></span>
						<span class="level"><LevelBar value={d.cuts} max={goal} size="sm" /></span>
						<span class="n fig" class:met={d.cuts >= goal}>{d.cuts}</span>
						<span class="money fig">{amount(d.commission)}</span>
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
		padding: 8px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
		margin: 12px 0 16px;
	}
	.seg button {
		height: var(--tap);
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			background-color var(--t-fast),
			color var(--t-fast);
	}
	.seg button:hover {
		color: var(--foam);
		border-color: var(--line-strong);
	}
	.seg button[aria-selected='true'] {
		background: var(--foam);
		border-color: var(--foam);
		color: var(--bg);
	}
	.sum {
		display: grid;
		grid-template-columns: 0.8fr 1.4fr 0.6fr;
		gap: 12px;
		margin: 0;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}

	.sum dd {
		margin: 2px 0 0;
		font-size: var(--fs-fig-md);
		font-weight: 900;
		white-space: nowrap;
	}
	.earn {
		color: var(--amber);
	}
	.since {
		text-wrap: balance;
		margin-top: 8px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.rows {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.rows li {
		display: grid;
		grid-template-columns: 8.5rem minmax(2.5rem, 1fr) 2.6rem 5.5rem;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		border-bottom: 1px solid var(--line);
	}
	.when {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
		white-space: nowrap;
	}
	.when small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.n {
		font-size: var(--fs-fig-sm);
		text-align: right;
	}
	.n.met {
		color: var(--amber);
	}
	.money {
		font-size: var(--fs-fig-sm);
		text-align: right;
	}
	.legend {
		margin: 12px 0 2px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.err {
		color: var(--danger-text);
		font-size: var(--fs-sm);
	}
	.sk {
		height: 280px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
