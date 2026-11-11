<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import LevelBar from '#lib/components/LevelBar.svelte';
	import MetaStamp from '#lib/components/MetaStamp.svelte';
	import Mug from '#lib/components/Mug.svelte';
	import { amount, dayLabel, money, monthLabel, rangeLabel } from '#lib/format.js';
	import { live, once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import type { Award, Goal } from '#lib/types.js';

	const board = live(() => backend.dayBoard());
	const goals = live(() => backend.myGoals());
	const awards = once(() => backend.myAwards());
	const me = $derived(board.data?.[0] ?? null);

	const periodName = { day: 'Hoy', week: 'Esta semana', month: 'Este mes' } as const;
	const value = (g: Goal, n: number) => (g.metric === 'cuts' ? `${n} ${n === 1 ? 'corte' : 'cortes'}` : money(n));
	const reward = (g: Goal) => (g.rewardType === 'fixed' ? money(g.rewardValue) : `+${g.rewardValue}%`);
	const rewardNote = (g: Goal) => (g.rewardType === 'fixed' ? 'de premio' : 'sobre tu comisión');
	function awardWhen(a: Award) {
		if (a.period === 'week') {
			const e = new Date(a.periodStart + 'T12:00:00');
			e.setDate(e.getDate() + 6);
			const end = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`;
			return `Semana ${rangeLabel(a.periodStart, end)}`;
		}
		return a.period === 'day' ? dayLabel(a.periodStart) : monthLabel(a.periodStart);
	}
</script>

<svelte:head><title>Metas · Barbero · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Metas</h1>

	{#if me}
		<div class="today">
			<div class="mug"><MetaStamp count={me.cuts} goal={me.goal} /><Mug count={me.cuts} goal={me.goal} /></div>
			<div>
				<p class="label">Jarra de hoy</p>
				<p class="fig big">{me.cuts}<span class="of"> / {me.goal} cortes</span></p>
			</div>
		</div>
	{/if}

	<h2 class="fig heading">Bonos</h2>
	{#if goals.data?.length}
		<ul class="goals">
			{#each goals.data as g (g.id)}
				{@const done = g.progress >= g.threshold}
				<li class:done>
					<div class="top">
						<span class="name">{g.name}</span>
						<span class="when">{periodName[g.period]}{g.period !== 'day' ? ` · ${rangeLabel(g.periodStart, g.periodEnd)}` : ''}</span>
					</div>
					<p class="fig progress">
						{#if done}<span class="stamp">META</span>{/if}
						Vas {value(g, g.progress)}{g.metric === 'revenue' ? ' en ventas' : ''}
						<span class="of">de {value(g, g.threshold)}</span>
					</p>
					<LevelBar value={g.progress} max={g.threshold} stamp={false} />
					<p class="foot">
						<span class="prize"><b class="fig">{reward(g)}</b> {rewardNote(g)}</span>
						<span class:ok={done}>
							{done ? 'Cumplida' : `Faltan ${value(g, g.threshold - g.progress)}`}
						</span>
					</p>
				</li>
			{/each}
		</ul>
	{:else if goals.data}
		<EmptyState flush title="Sin bonos activos">
			<p>Cuando el administrador defina bonos (por ejemplo, 40 cortes en la semana), aquí verás tu avance.</p>
		</EmptyState>
	{:else if goals.error}
		<p class="err">{goals.error}</p>
	{/if}

	<h2 class="fig heading">Bonos ganados</h2>
	{#if awards.data?.length}
		<ul class="awards">
			{#each awards.data as a, i (i)}
				<li>
					<span class="name">{a.ruleName}<small>{awardWhen(a)}</small></span>
					<span class="fig money">{amount(a.amount)}</span>
				</li>
			{/each}
		</ul>
	{:else if awards.data}
		<p class="note">Todavía no has ganado bonos. Se registran solos al cerrar cada periodo.</p>
	{/if}
</section>

<style>
	.wrap {
		padding: 8px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.today {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 12px;
		padding: 14px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.today .mug {
		position: relative;
		padding-top: 10px;
		width: 64px;
	}
	.big {
		font-size: var(--fs-fig-lg);
		color: var(--amber);
	}
	.of {
		display: inline-block;
		font-size: var(--fs-fig-sm);
		color: var(--foam-dim);
		white-space: nowrap;
	}
	.heading {
		margin: 24px 0 8px;
		font-size: 1.25rem;
	}
	.goals,
	.awards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.goals li {
		position: relative;
		display: grid;
		gap: 8px;
		padding: 14px;
		background: var(--wood);
		border: 1px solid var(--line);
		border-radius: var(--r);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
	}
	.name {
		display: grid;
		font-weight: 700;
	}
	.when {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		text-align: right;
	}
	.progress {
		font-size: var(--fs-fig-md);
	}
	.done .progress {
		color: var(--amber);
	}
	.stamp {
		display: inline-block;
		margin-right: 8px;
		padding: 1px 6px;
		background: var(--red);
		color: #fff;
		font: 700 var(--fs-xs) / 1.4 var(--font-ui);
		letter-spacing: 0.12em;
		transform: rotate(8deg) translateY(-3px);
	}
	.foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 4px 12px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.prize b {
		font-size: var(--fs-fig-sm);
		color: var(--amber);
		margin-right: 2px;
	}
	.foot > span:last-child {
		white-space: nowrap;
	}
	.foot .ok {
		color: var(--amber);
		font-weight: 700;
	}
	.awards li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 52px;
		border-bottom: 1px solid var(--line);
	}
	.awards small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.awards .money {
		font-size: var(--fs-fig-sm);
		color: var(--amber);
	}
	.note,
	.err {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.err {
		color: var(--danger-text);
	}
</style>
