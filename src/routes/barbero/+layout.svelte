<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import { flushVisits } from '#lib/visit-queue.svelte.js';

	let { children } = $props();

	const tabs = [
		{ href: '/barbero', label: 'Hoy' },
		{ href: '/barbero/clientes', label: 'Clientes' },
		{ href: '/barbero/historial', label: 'Historial' },
		{ href: '/barbero/metas', label: 'Metas' }
	];

	// Visits saved without signal go up by themselves when it returns.
	onMount(() => {
		flushVisits();
		const again = () => flushVisits();
		addEventListener('online', again);
		return () => removeEventListener('online', again);
	});
</script>

<AppHeader section="Barbero" />
<div class="page">{@render children()}</div>
<TabBar items={tabs} />

<style>
	.page {
		padding-bottom: calc(var(--tabbar-h) + 16px);
	}
</style>
