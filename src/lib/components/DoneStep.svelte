<!--
  Third step: the bill is charged. The barbers who served raise their mugs right here, the
  moment the money lands (or the foam overflows and META slams if this cut met the goal).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import MetaStamp from './MetaStamp.svelte';
	import Mug from './Mug.svelte';
	import SendReceipt from './SendReceipt.svelte';
	import { money } from '../format.js';

	let {
		receiptNo,
		queued,
		total,
		change,
		served,
		sale,
		onnew
	}: {
		receiptNo: number | null;
		queued: boolean;
		total: number;
		change: number;
		served: { id: string; name: string; before: number; after: number; goal: number }[];
		sale: import('svelte').ComponentProps<typeof SendReceipt>['sale'] | null;
		onnew: () => void;
	} = $props();

	let landed = $state(false);
	onMount(() => {
		const t = setTimeout(() => (landed = true), 350);
		return () => clearTimeout(t);
	});
</script>

<section class="done" class:hasChange={change > 0} aria-labelledby="done-title">
	<h1 id="done-title" class="fig">{queued ? 'Por enviar' : 'Cobrada'}</h1>
	<p class="sub">
		<span class="fig">{money(total)}</span>
		{#if !queued}<span>· Boleta N.º {String(receiptNo ?? '').padStart(4, '0')}</span>{/if}
	</p>

	{#if change > 0}
		<p class="change"><span class="label">Entrega de vueltas</span><span class="fig">{money(change)}</span></p>
	{/if}

	{#if queued}
		<p class="note">Guardada sin conexión en este celular. Se envía sola apenas vuelva internet. No la cobres de nuevo.</p>
	{/if}

	{#if served.length}
		{@const size = served.length === 1 ? 'lg' : 'sm'}
		<div class="mugs" class:solo={served.length === 1} style:--n={served.length}>
			{#each served as s (s.id)}
				{@const count = landed ? s.after : s.before}
				<div class="who">
					<MetaStamp {count} goal={s.goal} {size} />
					<Mug {count} goal={s.goal} {size} />
					<span class="name">{s.name}</span>
					<span class="fig n" aria-hidden="true">{count}<span class="of">/{s.goal}</span></span>
					<span class="sr-only">{s.after} de {s.goal} cortes</span>
				</div>
			{/each}
		</div>
	{/if}

	<div class="receipt">
		{#if sale}
			<SendReceipt {sale} collapsible />
		{:else}
			<p class="note">La boleta se podrá enviar desde Hoy apenas la cuenta llegue al servidor.</p>
		{/if}
	</div>

	<button type="button" class="new fig" onclick={onnew}>Nueva cuenta</button>
</section>

<style>
	.done {
		padding: 20px var(--gutter) 0;
		animation: step-in var(--t-fast) var(--ease-out);
	}
	h1 {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
	}
	/* With change to hand back, the change is the number the cashier acts on. */
	.hasChange h1 {
		font-size: var(--fs-fig-lg);
	}
	.sub {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-top: 4px;
		color: var(--foam-dim);
		font-size: var(--fs-sm);
	}
	.sub .fig {
		font-size: var(--fs-fig-md);
	}
	.change {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 18px;
		padding: 14px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.change {
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.change .fig {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
		color: var(--amber);
	}
	.mugs {
		display: grid;
		grid-template-columns: repeat(min(var(--n), 5), minmax(0, 72px));
		justify-content: center;
		gap: 8px;
		margin-top: 22px;
	}
	.mugs.solo {
		grid-template-columns: auto;
	}
	.solo .who {
		padding-top: 24px;
	}
	.solo .name {
		font-size: var(--fs-sm);
	}
	.solo .n {
		font-size: var(--fs-fig-md);
	}
	.who {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding-top: 10px;
	}
	.who :global(.mug) {
		margin-bottom: 6px;
		transform: translateX(-5px);
	}
	.solo .who :global(.mug) {
		transform: translateX(-14px);
	}
	.name {
		font-weight: 700;
		font-size: var(--fs-xs);
	}
	.n {
		font-size: var(--fs-fig-sm);
	}
	.of {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.note {
		margin-top: 16px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 46ch;
	}
	.receipt {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.new {
		width: 100%;
		min-height: 56px;
		margin-top: 16px;
		border: 1px solid var(--foam);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-size: var(--fs-fig-sm);
		transition:
			background-color var(--t-fast),
			transform var(--t-fast);
	}
	.new:hover {
		background: var(--wood-raised);
	}
	.new:active {
		transform: scale(0.98);
	}
	@keyframes step-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
