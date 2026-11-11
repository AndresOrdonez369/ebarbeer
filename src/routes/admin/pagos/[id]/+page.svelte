<script lang="ts">
	import { page } from '$app/state';
	import Settle from '#lib/components/Settle.svelte';
	import type { PeriodKind } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';

	const today = once(() => backend.businessDate());
	// The list passes its period along, so the record opens on the same day, week or month.
	const k = page.url.searchParams.get('k');
	const kind: PeriodKind = k === 'day' || k === 'month' ? k : 'week';
	const offset = Math.min(0, Number(page.url.searchParams.get('o')) || 0);
	const back = `/admin/pagos?k=${kind}&o=${offset}`;
</script>

<svelte:head><title>Pagar al barbero · Bar Beer</title></svelte:head>

{#if today.data}
	<Settle staffId={page.params.id ?? ''} today={today.data} backHref={back} backLabel="Pagos" initialKind={kind} initialOffset={offset} />
{/if}
