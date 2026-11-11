<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { amount, clock, dayLabel, toIsoDate } from '#lib/format.js';
	import { prettyPhone } from '#lib/receipt.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type CustomerStat } from '#lib/types.js';

	let q = $state('');
	let rows = $state<CustomerStat[] | null>(null);
	let error = $state('');

	$effect(() => {
		const query = q;
		const t = setTimeout(
			() => {
				backend
					.customers(query)
					.then((r) => {
						rows = r;
						error = '';
					})
					.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudieron cargar los clientes.'));
			},
			query ? 250 : 0
		);
		return () => clearTimeout(t);
	});

	const optedIn = $derived((rows ?? []).filter((r) => r.promo).length);
	const when = (iso: string) => {
		const d = new Date(iso);
		return toIsoDate(d) === toIsoDate(new Date()) ? `Hoy ${clock(iso)}` : dayLabel(toIsoDate(d));
	};
</script>

<svelte:head><title>Clientes · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/mas">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Más
	</a>
	<h1 class="fig">Clientes</h1>
	<p class="note">Quienes dejaron su WhatsApp al pagar. El teléfono solo se usa para su boleta; promociones, solo a quien las aceptó.</p>

	<label class="field search">
		<span class="sr-only">Buscar por nombre o número</span>
		<input class="input" type="search" bind:value={q} placeholder="Buscar por nombre o número" autocomplete="off" />
	</label>

	{#if error}
		<p class="err">{error}</p>
	{:else if rows}
		<p class="count">
			{rows.length} {rows.length === 1 ? 'cliente' : 'clientes'}{#if rows.length}{' · '}{optedIn} {optedIn === 1 ? 'acepta' : 'aceptan'} promociones{/if}
		</p>
		{#if rows.length}
			<ul>
				{#each rows as c (c.id)}
					<li>
						<span class="who">
							<b>{c.name ?? 'Sin nombre'}</b>
							<small>{prettyPhone(c.phone)}{c.promo ? ' · acepta promociones' : ''}</small>
						</span>
						<span class="stats">
							{#if c.visits}<b class="fig">{amount(c.spent)}</b>{:else}<span class="none">Sin compras</span>{/if}
							<small>
								{#if c.visits}{c.visits} {c.visits === 1 ? 'visita' : 'visitas'}{c.lastVisit ? ` · ${when(c.lastVisit)}` : ''}{:else}Registrado sin cuentas{/if}
							</small>
						</span>
					</li>
				{/each}
			</ul>
		{:else}
			{#if q}
				<EmptyState flush title="Sin coincidencias"><p>Nadie coincide con «{q}». Prueba con menos letras o con los últimos dígitos del número.</p></EmptyState>
			{:else}
				<EmptyState flush title="Todavía sin clientes"><p>Aparecen aquí cuando la caja anota el WhatsApp de alguien al cobrar.</p></EmptyState>
			{/if}
		{/if}
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
	.note {
		margin: 6px 0 12px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.search {
		margin: 4px 0 10px;
	}
	.count {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		margin-bottom: 4px;
	}
	.err {
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 62px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	.who,
	.stats {
		display: grid;
		gap: 2px;
	}
	.who b {
		font-size: var(--fs-sm);
	}
	.stats {
		text-align: right;
	}
	/* Sales money stays foam, as everywhere else; amber is what a barber earns. */
	.stats b {
		font-size: var(--fs-fig-sm);
	}
	.none {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.sk {
		height: 240px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
