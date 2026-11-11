<!--
  The signature: a chrome beer mug that fills with today's cuts toward the goal.
  Pours to its level once per session; afterwards it only rises one step when a cut lands.
  Bubbles move only while something is changing, then rest (battery). When the count crosses
  the goal, the foam overflows once.
-->
<script module lang="ts">
	// The first screen of the session pours; later screens show mugs already full to their level.
	let poured = false;
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	let {
		count,
		goal,
		size = 'sm'
	}: { count: number; goal: number; size?: 'sm' | 'lg' } = $props();

	const level = $derived(Math.min(count / Math.max(goal, 1), 1));
	const full = $derived(count >= goal && goal > 0);

	const pour = !poured;
	let fizzing = $state(pour);
	let crossed = $state(false);
	let prev: number | null = null;

	onMount(() => {
		const t = setTimeout(() => (poured = true), 900);
		return () => clearTimeout(t);
	});

	$effect(() => {
		const c = count;
		if (prev === null) {
			prev = c;
			if (!pour) return;
		} else if (c !== prev) {
			crossed = prev < goal && c >= goal;
			prev = c;
		} else {
			return;
		}
		fizzing = true;
		const t = setTimeout(() => {
			fizzing = false;
			crossed = false;
		}, 1600);
		return () => clearTimeout(t);
	});
</script>

<span class="mug {size}" class:pour class:full class:crossed class:fizzing aria-hidden="true">
	<span class="glass">
		<span class="beer" style:--level={level}></span>
	</span>
	<span class="handle"></span>
</span>

<style>
	.mug {
		--w: 40px;
		--h: 60px;
		--edge: 2px;
		position: relative;
		display: block;
		width: calc(var(--w) + var(--w) * 0.32);
		height: var(--h);
		margin: 0 auto;
	}
	.lg {
		--w: 112px;
		--h: 164px;
		--edge: 4px;
	}
	.glass {
		position: absolute;
		left: 0;
		top: 0;
		width: var(--w);
		height: var(--h);
		border: var(--edge) solid var(--chrome);
		border-top: 0;
		border-radius: 0 0 calc(var(--w) * 0.15) calc(var(--w) * 0.15);
		background: linear-gradient(90deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0.02) 40%, rgb(255 255 255 / 0.06));
	}
	.handle {
		position: absolute;
		left: calc(var(--w) - var(--edge));
		top: calc(var(--h) * 0.2);
		width: calc(var(--w) * 0.3);
		height: calc(var(--h) * 0.46);
		border: var(--edge) solid var(--chrome);
		border-left: 0;
		border-radius: 0 calc(var(--w) * 0.2) calc(var(--w) * 0.2) 0;
	}
	.beer {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: calc(var(--level) * 100%);
		border-radius: 0 0 calc(var(--w) * 0.12) calc(var(--w) * 0.12);
		background: linear-gradient(var(--amber-light), var(--amber-deep));
		transition: height var(--t-move) var(--ease-out);
	}
	.pour .beer {
		animation: pour 900ms var(--ease-out) both;
	}
	/* Bubbles live on their own layer so toggling them never restarts the pour. */
	.beer::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: radial-gradient(circle, rgb(255 255 255 / 0.5) 1px, transparent 1.6px) 0 0 / 9px 13px;
	}
	.lg .beer::after {
		background-image: radial-gradient(circle, rgb(255 255 255 / 0.5) 1.5px, transparent 2.4px);
		background-size: 18px 24px;
	}
	.fizzing .beer::after {
		animation: fizz 1.2s linear infinite;
	}
	/* Foam cap */
	.beer::before {
		content: '';
		position: absolute;
		left: -1px;
		right: -1px;
		top: calc(var(--h) * -0.11);
		height: calc(var(--h) * 0.14);
		background: var(--foam);
		border-radius: calc(var(--w) * 0.12) calc(var(--w) * 0.15) 2px 2px;
		opacity: min(1, calc(var(--level) * 20));
	}
	.full .beer::before {
		left: calc(var(--w) * -0.1);
		right: calc(var(--w) * -0.1);
		top: calc(var(--h) * -0.17);
		height: calc(var(--h) * 0.2);
		border-radius: calc(var(--w) * 0.2);
	}
	.crossed .beer::before {
		animation: overflow var(--t-move) var(--ease-out) both;
	}
	@keyframes pour {
		from {
			height: 0;
		}
	}
	@keyframes fizz {
		to {
			background-position: 0 -26px;
		}
	}
	@keyframes overflow {
		0% {
			transform: scaleY(0.4);
		}
		50% {
			transform: scaleY(1.25) translateY(-2px);
		}
		100% {
			transform: none;
		}
	}
</style>
