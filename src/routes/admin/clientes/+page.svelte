<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { amount, clock, dayLabel, toIsoDate } from '#lib/format.js';
	import { prettyPhone } from '#lib/receipt.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type CustomerStat, type PhotoUsage } from '#lib/types.js';

	// The free plan's file storage; the photos are the only files.
	const FREE = 1024 ** 3;
	let usage = $state<PhotoUsage | null>(null);
	backend.photoUsage().then((u) => (usage = u)).catch(() => {});
	const mb = (b: number) => (b < 1024 ** 2 ? `${Math.max(1, Math.round(b / 1024))} kB` : `${(b / 1024 ** 2).toFixed(b < 100 * 1024 ** 2 ? 1 : 0).replace('.', ',')} MB`);
	const share = $derived(usage ? Math.min(usage.bytes / FREE, 1) : 0);

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
	<p class="note">Quienes dejaron su WhatsApp al pagar o en las fotos de un corte. El teléfono solo se usa para su boleta; promociones, solo a quien las aceptó. Toca un cliente para ver sus fotos y notas.</p>

	{#if usage}
		<div class="usage" class:tight={share > 0.8}>
			<p>
				<b>Fotos de clientes: {mb(usage.bytes)} de 1 GB</b>
				<small>{usage.visits} {usage.visits === 1 ? 'visita' : 'visitas'} de {usage.clients} {usage.clients === 1 ? 'cliente' : 'clientes'} · se guardan las de las últimas 3 visitas de cada uno</small>
			</p>
			<span class="bar" role="meter" aria-label="Espacio usado por las fotos" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(share * 100)}>
				<span style:width="{Math.max(share * 100, usage.bytes ? 1 : 0)}%"></span>
			</span>
			{#if share > 0.8}<small class="warn">Queda poco espacio gratis. Avísale a quien mantiene la app.</small>{/if}
		</div>
	{/if}

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
						<a href="/admin/clientes/{c.id}">
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
						<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
						</a>
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
	li a {
		display: grid;
		grid-template-columns: 1fr auto auto;
		align-items: center;
		gap: 12px;
		color: inherit;
		text-decoration: none;
		min-height: 62px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	li a:hover .who b {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.chev {
		color: var(--foam-dim);
	}
	.usage {
		display: grid;
		gap: 8px;
		margin: 0 0 14px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.usage p {
		display: grid;
		gap: 2px;
	}
	.usage b {
		font-size: var(--fs-sm);
	}
	/* The level bar: wood with a foam fill; red only when the space runs short. */
	.bar {
		display: block;
		height: 8px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--foam-dim);
	}
	.tight .bar span {
		background: var(--red);
	}
	.warn {
		color: var(--danger-text);
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
