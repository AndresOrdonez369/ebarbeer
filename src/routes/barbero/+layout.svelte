<script lang="ts">
	import AppHeader from '#lib/components/AppHeader.svelte';
	import TabBar from '#lib/components/TabBar.svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/barbero', label: 'Hoy' },
		{ href: '/barbero/historial', label: 'Historial' },
		{ href: '/barbero/metas', label: 'Metas' }
	];
</script>

<AppHeader section="Barbero" />
<div class="page">{@render children()}</div>
<TabBar items={tabs} />

<style>
	.page {
		padding-bottom: calc(var(--tabbar-h) + 16px);
	}
</style>
