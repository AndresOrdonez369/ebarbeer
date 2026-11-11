<script lang="ts">
	import { periodLabel, periodRange, type PeriodKind } from '../format.js';

	// Period tabs (they navigate, so the chosen one fills with foam) and a stepper to walk back in time.
	let {
		today,
		kind = $bindable<PeriodKind>('month'),
		offset = $bindable(0),
		kinds = ['day', 'week', 'month'] as PeriodKind[],
		startOffset = 0
	}: { today: string; kind?: PeriodKind; offset?: number; kinds?: PeriodKind[]; startOffset?: number } = $props();

	const names: Record<PeriodKind, string> = { day: 'Día', week: 'Semana', month: 'Mes' };
	const range = $derived(periodRange(today, kind, offset));
</script>

<div class="picker">
	{#if kinds.length > 1}
		<div class="seg" role="tablist" aria-label="Periodo" style:--n={kinds.length}>
			{#each kinds as k (k)}
				<button
					type="button"
					role="tab"
					aria-selected={kind === k}
					onclick={() => {
						kind = k;
						offset = startOffset;
					}}>{names[k]}</button
				>
			{/each}
		</div>
	{/if}
	<div class="step">
		<button type="button" class="arrow" aria-label="Periodo anterior" onclick={() => (offset -= 1)}>
			<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		</button>
		<p class="now" aria-live="polite">{periodLabel(kind, offset, range)}</p>
		<button type="button" class="arrow" aria-label="Periodo siguiente" onclick={() => (offset += 1)} disabled={offset >= 0}>
			<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
		</button>
	</div>
</div>

<style>
	.picker {
		display: grid;
		gap: 6px;
		margin: 12px 0 14px;
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 6px;
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
	.step {
		display: grid;
		grid-template-columns: var(--tap) 1fr var(--tap);
		align-items: center;
	}
	.now {
		text-align: center;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.arrow {
		display: grid;
		place-items: center;
		height: var(--tap);
		border: 0;
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		transition:
			background-color var(--t-fast),
			color var(--t-fast);
	}
	.arrow:hover:not(:disabled) {
		background: var(--wood);
		color: var(--foam);
	}
	.arrow:disabled {
		opacity: 0.3;
	}
	.arrow .chev {
		width: 20px;
		height: 20px;
	}
</style>
