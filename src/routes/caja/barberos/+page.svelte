<script lang="ts">
	import PayoutList from '#lib/components/PayoutList.svelte';
	import { live } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';

	const rows = live(async () => {
		const d = await backend.businessDate();
		return backend.payoutSummary(d, d);
	});
</script>

<svelte:head><title>Barberos · Caja · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Barberos</h1>
	<p class="note">Cuando un barbero termina su jornada, tócalo: ves sus cortes y lo que le toca, y le pagas desde aquí.</p>
	{#if rows.data}
		<PayoutList rows={rows.data} href={(r) => `/caja/barberos/${r.staffId}`} />
	{:else if rows.error}
		<p class="form-msg err">{rows.error}</p>
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.note {
		margin: 4px 0 14px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 46ch;
	}
	.sk {
		height: 280px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
