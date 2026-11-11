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
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { needsSetup } from '#lib/config.js';
	import { backend, canEnter, homeFor, initSession, session } from '#lib/session.svelte.js';

	let { children } = $props();

	onMount(() => {
		if (needsSetup) return;
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
	{#if needsSetup}
		<div class="setup">
			<Plate size="lg" />
			<EmptyState flush title="Falta conectar la base de datos">
				<p>Esta copia de la app no tiene las variables de Supabase, así que no puede cargar el local.</p>
				<p>En Vercel: Settings → Environment Variables, agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, y vuelve a publicar desde Deployments → Redeploy.</p>
			</EmptyState>
		</div>
	{:else if allowed}
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
	.setup {
		display: grid;
		gap: 24px;
		justify-items: center;
		padding: 48px var(--gutter);
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
