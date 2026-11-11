<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import MetaStamp from '#lib/components/MetaStamp.svelte';
	import Mug from '#lib/components/Mug.svelte';
	import { amount, clock, money } from '#lib/format.js';
	import { live } from '#lib/live.svelte.js';
	import { backend, session } from '#lib/session.svelte.js';

	const board = live(() => backend.dayBoard());
	const lines = live(() => backend.myDayLines());
	// What the register already paid him today, and what is still to collect.
	const settle = live(async () => {
		const d = await backend.businessDate();
		return backend.settleSummary(session.profile?.staffId ?? '', d, d);
	});
	const toCollect = $derived(settle.data ? settle.data.commission - settle.data.commissionPaid + settle.data.bonus - settle.data.bonusPaid : 0);
	const collected = $derived(settle.data ? settle.data.commissionPaid + settle.data.bonusPaid : 0);
	const me = $derived(board.data?.[0] ?? null);
	const left = $derived(me ? Math.max(me.goal - me.cuts, 0) : 0);
</script>

<svelte:head><title>Hoy · Barbero · Bar Beer</title></svelte:head>

{#if me}
	<section class="hero" aria-label="Tu día">
		<div class="mugwrap">
			<MetaStamp count={me.cuts} goal={me.goal} size="lg" />
			<Mug count={me.cuts} goal={me.goal} size="lg" />
		</div>
		<div class="figs">
			<span class="label">Cortes hoy</span>
			<span class="fig count">{me.cuts}<span class="of"> / {me.goal}</span></span>
			<p class="togo">
				{#if left === 0}
					Jarra llena. Meta del día cumplida.
				{:else}
					Te {left === 1 ? 'falta 1 corte' : `faltan ${left} cortes`} para la meta.
				{/if}
			</p>
		</div>
	</section>

	<dl class="stats">
		<div>
			<dt class="label">Ganado hoy</dt>
			<dd class="fig earn">{money(me.commission)}</dd>
		</div>
		<div>
			<dt class="label">Servicios</dt>
			<dd class="fig">{me.services}</dd>
		</div>
		<div>
			<dt class="label">Vendido</dt>
			<dd class="fig">{money(me.revenue)}</dd>
		</div>
	</dl>

	{#if settle.data && (toCollect > 0 || collected > 0 || settle.data.owedBefore > 0)}
		<p class="collect" class:done={toCollect <= 0}>
			{#if toCollect > 0}
				Por cobrar en caja: <b class="fig">{money(toCollect)}</b>{#if settle.data.bonusToday}<span> (incluye {money(settle.data.bonusToday)} de bono)</span>{/if}
			{:else if collected > 0}
				Ya te pagaron hoy: <b class="fig">{money(collected)}</b>
			{/if}
			{#if settle.data.owedBefore > 0}
				<span class="old">Y te quedan {money(settle.data.owedBefore)} de días anteriores por cobrar.</span>
			{/if}
		</p>
	{/if}

	<section class="block" aria-labelledby="svc-title">
		<h2 id="svc-title" class="fig heading">Tus servicios de hoy</h2>
		{#if lines.data?.length}
			<ul class="lines">
				{#each lines.data as l, i (i)}
					<li class:void={l.status === 'void'}>
						<span class="time">{clock(l.at)}</span>
						<span class="what">
							<span class="nm">{l.name}{l.qty > 1 ? ` × ${l.qty}` : ''}</span>
							{#if l.status === 'void'}<em>Anulado</em>{:else if l.cut}<em>+{l.qty} a la jarra</em>{/if}
						</span>
						<span class="earn-col">
							<b class="fig">{amount(l.commission)}</b>
							<small>de {amount(l.total)}</small>
						</span>
					</li>
				{/each}
			</ul>
		{:else if lines.data}
			<EmptyState flush title="Todavía nada hoy">
				<p>Cada servicio que la caja te asigne aparece aquí con su hora y lo que te deja. Tu jarra se llena sola.</p>
			</EmptyState>
		{:else if lines.error}
			<p class="msg err">{lines.error}</p>
		{/if}
	</section>
{:else if board.error}
	<p class="msg err">{board.error}</p>
{:else if board.data}
	<p class="msg">Tu usuario no está marcado como barbero. Pídele al administrador que lo active en Equipo.</p>
{:else}
	<div class="sk" aria-busy="true"></div>
{/if}

<style>
	.hero {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: end;
		gap: 20px;
		padding: 28px var(--gutter) 20px;
		border-bottom: 1px solid var(--line);
	}
	.mugwrap {
		position: relative;
		padding-top: 22px;
	}
	.figs {
		display: grid;
		gap: 4px;
		padding-bottom: 4px;
	}
	.count {
		font-size: var(--fs-fig-xl);
		color: var(--amber);
	}
	.of {
		font-size: var(--fs-fig-md);
		color: var(--foam-dim);
	}
	.togo {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 28ch;
		text-wrap: balance;
	}
	.stats {
		display: grid;
		grid-template-columns: 1.25fr 0.75fr 1.3fr;
		margin: 0;
		border-bottom: 1px solid var(--line);
	}
	.stats > div {
		display: grid;
		gap: 6px;
		padding: 14px var(--gutter);
	}
	.stats > div + div {
		border-left: 1px solid var(--line);
	}
	dd {
		margin: 0;
		font-size: 1.5rem;
		white-space: nowrap;
	}
	.earn {
		color: var(--amber);
	}
	.block {
		padding: 20px var(--gutter) 0;
	}
	.heading {
		font-size: 1.25rem;
		margin-bottom: 4px;
	}
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.lines li {
		display: grid;
		grid-template-columns: 4.8rem 1fr auto;
		align-items: center;
		gap: 10px;
		min-height: 56px;
		border-bottom: 1px solid var(--line);
	}
	.time {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
		white-space: nowrap;
	}
	.what {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.what em {
		font-style: normal;
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.earn-col {
		display: grid;
		justify-items: end;
	}
	.earn-col b {
		font-size: var(--fs-fig-sm);
		color: var(--amber);
	}
	.earn-col small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	/* Voided: struck through, never hidden. */
	.void .nm,
	.void .earn-col b {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
	.void .what em {
		color: var(--danger-text);
	}
	.msg {
		padding: 16px var(--gutter);
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 52ch;
	}
	.err {
		color: var(--danger-text);
	}
	.sk {
		height: 220px;
		margin: 24px var(--gutter);
		border-radius: var(--r);
		background: var(--wood);
	}
	.collect {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 8px;
		margin: 0 var(--gutter);
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.collect b {
		font-size: var(--fs-fig-sm);
		color: var(--amber);
	}
	.collect.done b {
		color: var(--foam);
	}
	.collect span {
		font-size: var(--fs-xs);
	}
	.collect .old {
		flex-basis: 100%;
		color: var(--amber);
		font-weight: 700;
	}
</style>
