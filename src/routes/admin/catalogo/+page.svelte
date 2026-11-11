<script lang="ts">
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { amount } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import type { ItemKind } from '#lib/types.js';

	const catalog = once(() => backend.catalogAll());
	const groups: { kind: ItemKind; label: string }[] = [
		{ kind: 'service', label: 'Servicios' },
		{ kind: 'drink', label: 'Bebidas' },
		{ kind: 'product', label: 'Productos' }
	];
</script>

<svelte:head><title>Catálogo · Bar Beer</title></svelte:head>

<section class="wrap">
	<div class="head">
		<h1 class="fig">Catálogo</h1>
		<a class="btn btn-outline" href="/admin/catalogo/nuevo">
			<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			Agregar
		</a>
	</div>
	<p class="note">En el orden en que salen en la caja. Toca uno para cambiar precio, porcentaje u ocultarlo. Un cambio nunca mueve lo ya cobrado.</p>

	{#if catalog.data}
		{#each groups as g (g.kind)}
			{@const list = catalog.data.filter((i) => i.kind === g.kind)}
			<h2 class="fig heading">{g.label}</h2>
			{#if list.length}
				<ul>
					{#each list as i (i.id)}
						<li class:off={i.active === false}>
							<a href={`/admin/catalogo/${i.id}`}>
								<span class="name">
									{i.name}
									<small>
										{#if i.active === false}Oculto en la caja{:else}Comisión {i.commissionPct}%{i.countsAsCut ? ' · cuenta como corte' : ''}{/if}
									</small>
								</span>
								<span class="fig price">{amount(i.price)}</span>
								<svg class="chev go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<EmptyState flush title={`Sin ${g.label.toLowerCase()}`}><p>Agrega uno con el botón de arriba para que salga en la caja.</p></EmptyState>
			{/if}
		{/each}
	{:else if catalog.error}
		<p class="note err">{catalog.error}</p>
	{/if}
</section>

<style>
	.wrap {
		padding: 8px var(--gutter) 0;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	h1 {
		font-size: var(--fs-fig-lg);
	}
	.heading {
		margin: 20px 0 4px;
		font-size: 1.25rem;
	}
	.note {
		margin: 6px 0 4px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		max-width: 50ch;
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
	li {
		border-bottom: 1px solid var(--line);
	}
	a:not(.btn) {
		display: grid;
		grid-template-columns: 1fr auto 20px;
		align-items: center;
		gap: 10px;
		min-height: 58px;
		padding: 6px 0;
		color: inherit;
		text-decoration: none;
	}
	.name {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.name small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.price {
		font-size: var(--fs-fig-sm);
	}
	.go {
		color: var(--foam-dim);
	}
	.off .name,
	.off .price {
		color: var(--foam-dim);
	}
	.off .price {
		text-decoration: line-through;
	}
</style>
