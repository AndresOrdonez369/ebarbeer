<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import VisitQueue from '#lib/components/VisitQueue.svelte';
	import { clock, dayLabel, toIsoDate } from '#lib/format.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type ClientMatch } from '#lib/types.js';

	const queued = page.url.searchParams.has('pendiente');
	let q = $state('');
	let rows = $state<ClientMatch[] | null>(null);
	let error = $state('');

	$effect(() => {
		const query = q;
		const t = setTimeout(
			() => {
				backend
					.findClients(query)
					.then((r) => {
						if (query !== q) return;
						rows = r;
						error = '';
					})
					.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar los clientes.'));
			},
			query ? 250 : 0
		);
		return () => clearTimeout(t);
	});

	const short = $derived(q.trim() !== '' && q.replace(/[^0-9]/g, '').length < 4 && q.trim().length < 2);
	const when = (iso: string) => {
		const d = toIsoDate(new Date(iso));
		return d === toIsoDate(new Date()) ? `hoy ${clock(iso)}` : dayLabel(d);
	};
</script>

<svelte:head><title>Clientes · Barbero · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Clientes</h1>
	<p class="lead">Al terminar un corte, guarda sus fotos y una nota. La próxima vez, cualquiera del equipo ve qué se le hizo.</p>

	<a class="btn btn-foam new" href="/barbero/clientes/nueva">Fotos de un corte</a>

	{#if queued}<p class="form-msg ok saved" role="status">Visita guardada en el teléfono. Se sube sola cuando vuelva la señal.</p>{/if}
	<VisitQueue />

	<label class="field search">
		<span class="sr-only">Buscar por WhatsApp o nombre</span>
		<input class="input" type="search" bind:value={q} placeholder="Buscar por WhatsApp o nombre" autocomplete="off" />
	</label>

	{#if error}
		<p class="err">{error}</p>
	{:else if short}
		<p class="hint">Escribe al menos 4 números o 2 letras.</p>
	{:else if rows}
		{#if rows.length}
			{#if !q}<h2 class="label sub">Últimos con registro</h2>{/if}
			<ul>
				{#each rows as c (c.id)}
					<li>
						<a href="/barbero/clientes/{c.id}">
							<span class="who">
								<b>{c.name ?? 'Sin nombre'}</b>
								<small>{c.phone}</small>
							</span>
							<span class="stats">
								<b>{c.visits} {c.visits === 1 ? 'visita' : 'visitas'}</b>
								<small>{c.lastVisit ? when(c.lastVisit) : 'Sin registro'}</small>
							</span>
							<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
						</a>
					</li>
				{/each}
			</ul>
		{:else if q}
			<EmptyState flush title="Sin coincidencias"><p>Nadie coincide con «{q}». Prueba con los últimos números del WhatsApp.</p></EmptyState>
		{:else}
			<EmptyState flush title="Todavía sin registros"><p>Cuando guardes las fotos de un corte, el cliente aparece aquí.</p></EmptyState>
		{/if}
	{:else}
		<div class="sk" aria-busy="true"></div>
	{/if}
</section>

<style>
	.wrap {
		display: grid;
		padding: 16px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.lead {
		margin: 6px 0 14px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 46ch;
	}
	.new {
		margin-bottom: 16px;
	}
	.saved {
		margin-bottom: 10px;
	}
	.search {
		margin-bottom: 10px;
	}
	.sub {
		margin: 6px 0 6px;
	}
	.hint,
	.err {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.err {
		color: var(--danger-text);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li a {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 12px;
		min-height: 62px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
		color: inherit;
		text-decoration: none;
	}
	li a:hover .who b {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.who,
	.stats {
		display: grid;
		gap: 2px;
	}
	.who b,
	.stats b {
		font-size: var(--fs-sm);
	}
	.stats {
		text-align: right;
	}
	small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.chev {
		color: var(--foam-dim);
	}
	.sk {
		height: 200px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
