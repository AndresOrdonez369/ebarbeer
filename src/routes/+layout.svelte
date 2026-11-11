<script lang="ts">
	import '@fontsource/big-shoulders-display/latin-800';
	import '@fontsource/big-shoulders-display/latin-900';
	import '@fontsource/chakra-petch/latin-500';
	import '@fontsource/chakra-petch/latin-700';
	import '../app.css';

	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Plate from '#lib/components/Plate.svelte';
	import { backend, canEnter, homeFor, initSession, session } from '#lib/session.svelte.js';

	let { children } = $props();

	onMount(() => {
		initSession();
		if (!import.meta.env.DEV) {
			import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
		}
		const onError = (e: ErrorEvent) => backend.reportError(e.message, { src: e.filename, line: e.lineno });
		const onRejection = (e: PromiseRejectionEvent) => backend.reportError(String(e.reason));
		addEventListener('error', onError);
		addEventListener('unhandledrejection', onRejection);
		return () => {
			removeEventListener('error', onError);
			removeEventListener('unhandledrejection', onRejection);
		};
	});

	const path = $derived(page.url.pathname);
	// Receipts are public: the customer opens them from WhatsApp without an account.
	const isPublic = $derived(path.startsWith('/b/'));
	const allowed = $derived(
		isPublic
			? true
			: session.status === 'out'
				? path === '/ingreso'
				: session.status === 'in' && session.profile
					? path !== '/ingreso' && path !== '/' && canEnter(session.profile.role, path)
					: false
	);

	$effect(() => {
		if (session.status === 'loading' || allowed) return;
		if (session.status === 'out') goto('/ingreso', { replaceState: true });
		else if (session.profile) goto(homeFor(session.profile.role), { replaceState: true });
	});
</script>

<div class="app">
	{#if allowed}
		{@render children()}
	{:else}
		<div class="splash" aria-busy="true" aria-label="Cargando">
			<Plate size="lg" />
		</div>
	{/if}
</div>

<style>
	.app {
		--app-max: 520px;
		max-width: var(--app-max);
		min-height: 100dvh;
		margin: 0 auto;
	}
	.splash {
		display: grid;
		place-items: center;
		min-height: 100dvh;
		animation: breathe 1.6s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.55;
		}
	}
</style>
