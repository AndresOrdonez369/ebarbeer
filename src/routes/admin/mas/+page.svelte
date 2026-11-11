<script lang="ts">
	const items: { name: string; href?: string; phase?: number }[] = [
		{ name: 'Plantilla de la boleta de WhatsApp', href: '/admin/boleta' },
		{ name: 'Clientes', href: '/admin/clientes' },
		{ name: 'Datos del local', href: '/admin/local' },
		{ name: 'Reportes y CSV', href: '/admin/reportes' },
		{ name: 'Pagos a barberos', href: '/admin/pagos' },
		{ name: 'Bonos', href: '/admin/bonos' },
		{ name: 'Historial de cierres', href: '/admin/cierres' },
		{ name: 'Anulaciones', href: '/admin/anulaciones' },
		{ name: 'Módulos del local', phase: 7 }
	];
</script>

<svelte:head><title>Más · Bar Beer</title></svelte:head>

<section class="wrap">
	<h1 class="fig">Más</h1>
	<ul>
		{#each items as u (u.name)}
			<li>
				{#if u.href}
					<a href={u.href}>
						<span>{u.name}</span>
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
					</a>
				{:else}
					<div class="soon"><span>{u.name}</span><span class="phase">Fase {u.phase}</span></div>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.wrap {
		padding: 8px var(--gutter) 0;
	}
	h1 {
		font-size: var(--fs-fig-lg);
		margin-bottom: 12px;
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
	a,
	.soon {
		display: flex;
		justify-content: space-between;
		align-items: center;
		min-height: 52px;
	}
	a {
		color: var(--foam);
		font-weight: 700;
		text-decoration: none;
	}
	a:hover svg {
		stroke: var(--foam);
	}
	a svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: var(--foam-dim);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: stroke var(--t-fast);
	}
	.soon {
		color: var(--foam-dim);
	}
	.phase {
		font-size: var(--fs-xs);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--foam-faint);
	}
</style>
