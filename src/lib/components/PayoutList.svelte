<!-- Every barber in a range: what he is owed, or that he is paid. Each row opens his settlement. -->
<script lang="ts">
	import EmptyState from './EmptyState.svelte';
	import { amount, clock, money } from '../format.js';
	import type { PayoutRow } from '../types.js';

	let { rows, href, when = 'hoy' }: { rows: PayoutRow[]; href: (r: PayoutRow) => string; when?: string } = $props();

	const owed = $derived(rows.reduce((s, r) => s + Math.max(r.owed, 0), 0));
	const paid = $derived(rows.reduce((s, r) => s + r.paid, 0));
	const before = $derived(rows.reduce((s, r) => s + Math.max(r.owedBefore, 0), 0));
</script>

{#if rows.length}
	<div class="total">
		<span class="label">{owed > 0 ? `Por pagar ${when}` : paid > 0 ? `Todo pagado ${when}` : `Nada por pagar ${when}`}</span>
		<span class="fig big" class:zero={owed <= 0}>{money(owed > 0 ? owed : paid)}</span>
		{#if paid > 0 && owed > 0}<span class="dim">Ya pagado {money(paid)}</span>{/if}
		{#if before > 0}<span class="before">Y {money(before)} pendientes de antes</span>{/if}
	</div>
	<ul class="rows">
		{#each rows as r (r.staffId)}
			<li class:settled={r.owed <= 0}>
				<a href={href(r)}>
					<span class="n">
						{r.name}<small>{amount(r.cuts)} {r.cuts === 1 ? 'corte' : 'cortes'}{r.lastPaidAt ? ` · pagado ${clock(r.lastPaidAt)}` : ''}</small>
						{#if r.owedBefore > 0}<small class="old">+ {money(r.owedBefore)} de antes</small>{/if}
					</span>
					<span class="v">
						{#if r.owed > 0}
							<span class="fig earn">{amount(r.owed)}</span><small>le toca</small>
						{:else if r.paid > 0}
							<span class="ok">
								<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Pagado
							</span><small>{money(r.paid)}</small>
						{:else}
							<small>Sin servicios</small>
						{/if}
					</span>
					<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
				</a>
			</li>
		{/each}
	</ul>
{:else}
	<EmptyState flush title="Sin barberos">
		<p>El administrador los crea en Equipo. Cuando atiendan clientes, aquí sale lo que se le paga a cada uno.</p>
	</EmptyState>
{/if}

<style>
	.total {
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
		border-bottom: 1px solid var(--line);
	}
	a {
		display: grid;
		grid-template-columns: 1fr auto 18px;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		color: inherit;
		text-decoration: none;
	}
	.n {
		display: grid;
		font-weight: 700;
	}
	small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.v {
		display: grid;
		justify-items: end;
	}
	.v .fig {
		font-size: var(--fs-fig-md);
	}
	.earn {
		color: var(--amber);
	}
	.ok {
		display: flex;
		align-items: center;
		gap: 4px;
		font-weight: 700;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.ok svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.chev {
		color: var(--foam-dim);
	}
	a:hover .chev {
		color: var(--foam);
	}
	.settled .n {
		color: var(--foam-dim);
	}
	.before,
	.old {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--amber);
	}
</style>
