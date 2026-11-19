<!-- The logo as a lockup: the bearded E in foam over the BAR BEER blade, for photos and the splash. -->
<script lang="ts">
	import Plate from './Plate.svelte';

	let { size = 'md' }: { size?: 'md' | 'lg' } = $props();
</script>

<span class="mark {size}" role="img" aria-label="Bar Beer">
	<img src="/brand/emblema.webp" alt="" width="280" height="390" decoding="async" />
	<span class="blade" aria-hidden="true"><Plate size="lg" /></span>
</span>

<style>
	.mark {
		display: inline-grid;
		justify-items: center;
		gap: 10px;
	}
	img {
		display: block;
		width: auto;
		height: 72px;
		/* Lifts the foam E off whatever photo is behind it. */
		filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.75));
	}
	.lg img {
		height: 96px;
	}
	.blade {
		display: flex;
	}
</style>
