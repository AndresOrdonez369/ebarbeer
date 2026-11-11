<script lang="ts">
	import { page } from '$app/state';
	import Settle from '#lib/components/Settle.svelte';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';

	const today = once(() => backend.businessDate());
</script>

<svelte:head><title>Pagar al barbero · Caja · Bar Beer</title></svelte:head>

{#if today.data}
	{#key page.params.id}
		<Settle staffId={page.params.id ?? ''} today={today.data} backHref="/caja/barberos" backLabel="Barberos" />
	{/key}
{/if}
