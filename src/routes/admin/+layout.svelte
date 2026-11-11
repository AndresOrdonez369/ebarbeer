<script lang="ts">
	import AppHeader from '#lib/components/AppHeader.svelte';
	import TabBar from '#lib/components/TabBar.svelte';

	let { children } = $props();

	const tabs = [
		{ href: '/admin', label: 'En vivo' },
		{ href: '/admin/equipo', label: 'Equipo' },
		{ href: '/admin/catalogo', label: 'Catálogo' },
		{ href: '/admin/mas', label: 'Más', also: ['/admin/boleta', '/admin/clientes', '/admin/local', '/admin/reportes', '/admin/pagos', '/admin/bonos', '/admin/cierres', '/admin/anulaciones'] }
	];
</script>

<AppHeader section="Admin" />
<div class="page">{@render children()}</div>
<TabBar items={tabs} />

<style>
	.page {
		padding-bottom: calc(var(--tabbar-h) + 16px);
	}
</style>
