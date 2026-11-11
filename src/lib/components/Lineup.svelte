<!-- Who is cutting today: one mug per barber. Selectable at the register, read-only elsewhere. -->
<script lang="ts">
	import MetaStamp from './MetaStamp.svelte';
	import Mug from './Mug.svelte';
	import type { BoardRow } from '../types.js';

	let {
		rows,
		selected = null,
		onselect
	}: { rows: BoardRow[]; selected?: string | null; onselect?: (id: string) => void } = $props();

	const cols = $derived(Math.min(Math.max(rows.length, 1), 6));
</script>

<div class="lineup" style:--cols={cols} role={onselect ? 'group' : undefined} aria-label={onselect ? 'Barbero' : undefined}>
	{#each rows as r (r.staffId)}
		{#if onselect}
			<button
				type="button"
				class="tile"
				class:on={selected === r.staffId}
				aria-pressed={selected === r.staffId}
				onclick={() => onselect(r.staffId)}
			>
				{@render tile(r)}
			</button>
		{:else}
			<div class="tile">{@render tile(r)}</div>
		{/if}
	{/each}
</div>

{#snippet tile(r: BoardRow)}
	<MetaStamp count={r.cuts} goal={r.goal} />
	<Mug count={r.cuts} goal={r.goal} />
	<span class="name">{r.name}</span>
	<span class="count fig" aria-hidden="true">{r.cuts}<span class="of">/{r.goal}</span></span>
	<span class="sr-only">{r.cuts} de {r.goal} cortes</span>
{/snippet}

<style>
	.lineup {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 4px;
	}
	.tile {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 10px 0 6px;
		border: 1px solid transparent;
		border-radius: var(--r);
		background: none;
		text-align: center;
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	button.tile:hover {
		background: var(--wood);
		border-color: var(--line);
	}
	button.tile:active {
		background: var(--wood-raised);
	}
	.tile.on,
	button.tile.on:hover {
		background: var(--blue);
		border-color: rgb(255 255 255 / 0.25);
	}
	.tile :global(.mug) {
		margin-bottom: 6px;
		transform: translateX(-5px);
	}
	.name {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 2px;
		font-weight: 700;
		font-size: var(--fs-xs);
	}
	.count {
		font-size: var(--fs-fig-sm);
	}
	.of {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.on .of {
		color: var(--blue-ink);
	}
</style>
