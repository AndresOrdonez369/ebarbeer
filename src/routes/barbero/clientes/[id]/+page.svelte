<script lang="ts">
	import { page } from '$app/state';
	import ClientHistory from '#lib/components/ClientHistory.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type ClientFile } from '#lib/types.js';

	const id = $derived(page.params.id ?? '');
	const justSaved = page.url.searchParams.has('guardada');
	let file = $state<ClientFile | null | undefined>(undefined);
	let error = $state('');

	$effect(() => {
		const c = id;
		file = undefined;
		backend
			.clientFile(c)
			.then((f) => (file = f))
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudo abrir el cliente.'));
	});
</script>

<svelte:head><title>{file?.name ?? 'Cliente'} · Barbero · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/barbero/clientes">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Clientes
	</a>
	{#if error}
		<p class="err">{error}</p>
	{:else if file === null}
		<EmptyState flush title="Cliente no encontrado"><p>Ese cliente no está en el local.</p></EmptyState>
	{:else if file}
		<h1 class="fig">{file.name ?? 'Sin nombre'}</h1>
		<p class="meta">
			{file.phone} · {file.consentAt ? 'autorizó sus fotos' : 'sin autorización de fotos'}{file.minor ? ' (acudiente)' : ''}
		</p>
		{#if justSaved}<p class="form-msg ok" role="status">Visita guardada.</p>{/if}
		<a class="btn btn-foam new" href="/barbero/clientes/nueva?c={file.id}">Fotos de hoy</a>
		{#if file.visits.length}
			<ClientHistory visits={file.visits} />
		{:else}
			<EmptyState flush title="Sin visitas con registro"><p>Las fotos y notas de sus cortes aparecen aquí.</p></EmptyState>
		{/if}
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		display: grid;
		padding: 4px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.meta {
		margin: 4px 0 12px;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.new {
		margin: 4px 0 16px;
	}
	.err {
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.sk {
		height: 280px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
