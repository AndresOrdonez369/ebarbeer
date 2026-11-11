<script lang="ts">
	import AppHeader from '#lib/components/AppHeader.svelte';
	import TabBar from '#lib/components/TabBar.svelte';
	import { net } from '#lib/network.svelte.js';
	import { outbox, startOutbox } from '#lib/outbox.svelte.js';
	import { session } from '#lib/session.svelte.js';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(startOutbox);
	const waiting = $derived(outbox.items.filter((x) => x.status === 'pending').length);
	const failed = $derived(outbox.items.filter((x) => x.status === 'failed').length);

	const tabs = $derived([
		{ href: '/caja', label: 'Caja' },
		{ href: '/caja/hoy', label: 'Hoy' },
		{ href: '/caja/barberos', label: 'Barberos' },
		{ href: '/caja/cierre', label: 'Cierre' },
		...(session.profile?.role === 'admin' ? [{ href: '/admin', label: 'Admin' }] : [])
	]);
</script>

<AppHeader section="Caja" offline={!waiting || !!failed} />
{#if waiting || failed}
	<a class="queue" class:bad={failed} href="/caja/hoy">
		{#if failed}{failed} {failed === 1 ? 'cuenta rechazada' : 'cuentas rechazadas'} · revisar{:else}{waiting} {waiting === 1 ? 'cuenta' : 'cuentas'} por enviar · {net.online ? 'enviando' : 'sin conexión'}{/if}
	</a>
{/if}
<div class="page">{@render children()}</div>
<TabBar items={tabs} />

<style>
	.queue {
		display: block;
		margin: 0 var(--gutter) 8px;
		padding: 8px 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		color: var(--amber);
		font-size: var(--fs-sm);
		font-weight: 700;
		text-decoration: none;
	}
	.queue.bad {
		border-color: var(--danger-text);
		color: var(--danger-text);
	}
	.page {
		padding-bottom: calc(var(--tabbar-h) + 16px);
	}
	/* The register's own sticky Cobrar bar already clears the tab bar. */
	.page:has(:global(.charge)) {
		padding-bottom: var(--tabbar-h);
	}
</style>
