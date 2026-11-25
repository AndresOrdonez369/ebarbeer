<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, preloadCode } from '$app/navigation';
	import { page } from '$app/state';
	import VisitCapture from '#lib/components/VisitCapture.svelte';
	import { backend } from '#lib/session.svelte.js';
	import type { ClientMatch } from '#lib/types.js';

	// ?c=<id>: the barber came from the customer's page.
	const id = page.url.searchParams.get('c');
	let known = $state<ClientMatch | null>(null);
	let ready = $state(!id);
	let error = $state('');

	if (id)
		backend
			.clientFile(id)
			.then((f) => {
				if (f)
					known = {
						id: f.id,
						name: f.name,
						phone: f.phone,
						visits: f.visits.length,
						lastVisit: f.visits[0]?.at ?? null,
						consent: !!f.consentAt
					};
				else error = 'Ese cliente no está en el local.';
			})
			.catch(() => (error = 'No se pudo abrir el cliente. Revisa la conexión.'))
			.finally(() => (ready = true));

	// Saving can happen without signal: the screens it returns to must already be on the phone.
	onMount(() => {
		preloadCode('/barbero/clientes').catch(() => {});
		preloadCode(`/barbero/clientes/${id ?? 'x'}` as '/barbero/clientes').catch(() => {});
	});

	function onsaved(customerId: string | null) {
		goto(customerId ? `/barbero/clientes/${customerId}?guardada=1` : '/barbero/clientes?pendiente=1', { replaceState: true });
	}
</script>

<svelte:head><title>Fotos de un corte · Barbero · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href={id ? `/barbero/clientes/${id}` : '/barbero/clientes'}>
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		{id ? 'Cliente' : 'Clientes'}
	</a>
	<h1 class="fig">Fotos del corte</h1>
	<p class="lead">Frente, izquierda, derecha y atrás. Toma las que sirvan: todas son opcionales.</p>
	{#if error}
		<p class="err">{error}</p>
	{:else if ready}
		<VisitCapture {known} {onsaved} />
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
	.lead {
		margin: 6px 0 16px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 44ch;
	}
	.err {
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.sk {
		height: 320px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
