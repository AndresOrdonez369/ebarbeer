<!--
  The mug turned on its side: a beer level for progress that is not "today's cuts" (a weekly
  goal, a day in the history). Amber fill with the mug's bubbles and a foam head with body at the
  level; pours once per session like the mugs; when the goal is met the foam spills past the end
  of the glass and the META stamp sits on it.
-->
<script module lang="ts">
	let poured = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		value,
		max,
		size = 'md',
		stamp = true
	}: { value: number; max: number; size?: 'sm' | 'md'; stamp?: boolean } = $props();

	const level = $derived(Math.max(0, Math.min(value / Math.max(max, 1), 1)));
	const full = $derived(value >= max && max > 0);
	const pour = !poured;

	onMount(() => {
		const t = setTimeout(() => (poured = true), 900);
		return () => clearTimeout(t);
	});
</script>

<span class="bar {size}" class:full class:pour aria-hidden="true">
	<span class="glass"><span class="beer" style:--level={level}></span></span>
	{#if full}
		<span class="spill"></span>
		{#if stamp && size === 'md'}<span class="meta">META</span>{/if}
	{/if}
</span>

<style>
	.bar {
		position: relative;
		display: block;
		--h: 16px;
		--foam-w: 10px;
		height: var(--h);
	}
	.sm {
		--h: 8px;
		--foam-w: 5px;
	}
	.glass {
		position: absolute;
		inset: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--bg);
		overflow: hidden;
	}
	.sm .glass {
		border-color: var(--line);
		border-radius: 2px;
	}
	.beer {
		position: absolute;
		inset: 0 auto 0 0;
		width: calc(var(--level) * 100%);
		background:
			radial-gradient(circle, rgb(255 255 255 / 0.45) 1px, transparent 1.6px) 0 0 / 11px 8px,
			linear-gradient(var(--amber-light), var(--amber-deep));
		transition: width var(--t-move) var(--ease-out);
	}
	.sm .beer {
		background: linear-gradient(var(--amber-light), var(--amber-deep));
	}
	.pour .beer {
		animation: pour 900ms var(--ease-out) both;
	}
	/* The foam head: a cream band with body at the leading edge of the level. */
	.beer::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: var(--foam-w);
		background: var(--foam);
		border-radius: 0 calc(var(--h) / 2) calc(var(--h) / 2) 0;
		opacity: min(1, calc(var(--level) * 30));
	}
	/* Goal met: foam heaps over the rim at the end of the glass and a drip runs down its end face,
	   the same foam and corner logic as the mug's overflowing head. */
	.spill {
		position: absolute;
		top: -5px;
		right: -3px;
		width: calc(var(--foam-w) * 2.6);
		height: calc(var(--h) * 0.55 + 5px);
		background: var(--foam);
		border-radius: 9px 7px 3px 6px / 7px 8px 2px 3px;
		transform-origin: 70% 100%;
		animation: overflow var(--t-move) var(--ease-out) both;
	}
	/* On the first paint the foam spills once the pour reaches the end. */
	.pour .spill {
		animation-delay: 800ms;
	}
	.spill::before {
		content: '';
		position: absolute;
		left: 18%;
		top: -3px;
		width: 45%;
		height: 6px;
		background: var(--foam);
		border-radius: 6px 6px 0 0;
	}
	.spill::after {
		content: '';
		position: absolute;
		right: 0;
		top: 60%;
		width: 4px;
		height: calc(var(--h) * 0.7);
		background: var(--foam);
		border-radius: 0 0 3px 3px;
	}
	.sm .spill {
		top: -3px;
		right: -2px;
		height: calc(var(--h) * 0.6 + 3px);
		border-radius: 5px 4px 2px 3px / 4px 5px 1px 2px;
	}
	.sm .spill::before {
		top: -2px;
		height: 3px;
	}
	.sm .spill::after {
		width: 2px;
	}
	.meta {
		position: absolute;
		right: 4px;
		top: calc(var(--h) * -1 - 6px);
		padding: 1px 6px;
		background: var(--red);
		color: #fff;
		font: 700 10px/1.4 var(--font-ui);
		letter-spacing: 0.12em;
		transform: rotate(8deg);
	}
	@keyframes overflow {
		0% {
			transform: scale(0.3, 0.2);
			opacity: 0;
		}
		60% {
			transform: scale(1.1, 1.25);
			opacity: 1;
		}
		100% {
			transform: none;
		}
	}
	@keyframes pour {
		from {
			width: 0;
		}
	}
</style>
