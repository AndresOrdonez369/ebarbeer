<!-- Red META stamp for a barber who reached the day's goal. Slams in only at the moment the
     count crosses the goal; on any other render it is simply there. -->
<script lang="ts">
	let { count, goal, size = 'sm' }: { count: number; goal: number; size?: 'sm' | 'lg' } = $props();

	const met = $derived(count >= goal && goal > 0);
	let slam = $state(false);
	let prev: number | null = null;

	$effect(() => {
		const c = count;
		if (prev !== null && prev < goal && c >= goal) {
			slam = true;
			const t = setTimeout(() => (slam = false), 600);
			prev = c;
			return () => clearTimeout(t);
		}
		prev = c;
	});
</script>

{#if met}<span class="meta {size}" class:slam>META</span>{/if}

<style>
	.meta {
		position: absolute;
		z-index: 2;
		top: -4px;
		right: -2px;
		padding: 1px 5px;
		font: 700 10px/1.4 var(--font-ui);
		letter-spacing: 0.12em;
		color: #fff;
		background: var(--red);
		transform: rotate(8deg);
	}
	.lg {
		top: 0;
		right: -8px;
		padding: 2px 8px;
		font-size: 14px;
		letter-spacing: 0.14em;
	}
	.slam {
		animation: slam var(--t-move) var(--ease-out) both;
	}
	@keyframes slam {
		from {
			transform: rotate(-14deg) scale(2.4);
			opacity: 0;
		}
	}
</style>
