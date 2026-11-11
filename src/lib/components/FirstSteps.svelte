<script lang="ts">
	// A shop just created has no barbers and no catalog: the admin's first screen says what to do, in order.
	import type { CatalogItem, StaffMember } from '../types.js';

	let { staff, items }: { staff: StaffMember[]; items: CatalogItem[] } = $props();

	// Saved once from Datos del local on this phone.
	const reviewed = (() => {
		try {
			return localStorage.getItem('barbeer-local-reviewed') === '1';
		} catch {
			return false;
		}
	})();

	const steps = $derived([
		{ href: '/admin/equipo', label: 'Crea a los barberos', note: 'Y a la cajera, si no cobras tú.', done: staff.some((s) => s.cuts && s.active) },
		{ href: '/admin/catalogo', label: 'Arma el catálogo', note: 'Servicios con su precio y porcentaje, bebidas y productos.', done: items.length > 0 },
		{ href: '/admin/equipo', label: 'Da los accesos', note: 'Usuario y PIN para la caja y para cada barbero.', done: staff.some((s) => s.role !== 'admin' && s.hasAccess) },
		{ href: '/admin/local', label: 'Revisa la meta y la hora de cierre', note: 'Hasta dónde se llena la jarra y a qué hora termina el día.', done: reviewed }
	]);
	const next = $derived(steps.findIndex((s) => !s.done));
</script>

<section class="first" aria-labelledby="first-title">
	<h2 class="fig" id="first-title">Primeros pasos</h2>
	<p class="note">Con esto la caja queda lista para cobrar el primer corte.</p>
	<ol>
		{#each steps as s, i (s.label)}
			<li class:done={s.done} class:next={i === next}>
				<a href={s.href}>
					<span class="n fig" aria-hidden="true">
						{#if s.done}
							<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10" /></svg>
						{:else}{i + 1}{/if}
					</span>
					<span class="t">{s.label}<small>{s.done ? 'Hecho' : s.note}</small></span>
					<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
				</a>
			</li>
		{/each}
	</ol>
</section>

<style>
	.first {
		margin: 16px var(--gutter) 0;
		padding: 16px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
	}
	h2 {
		font-size: var(--fs-fig-md);
	}
	.note {
		margin: 4px 0 8px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	a {
		display: grid;
		grid-template-columns: 32px 1fr 18px;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		color: inherit;
		text-decoration: none;
	}
	.n {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		font-size: var(--fs-fig-sm);
		color: var(--foam-dim);
	}
	.next .n {
		border-color: var(--foam);
		color: var(--foam);
	}
	.done .n {
		border-color: var(--amber);
		color: var(--amber);
	}
	.n svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.t {
		display: grid;
		font-weight: 700;
	}
	.t small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.done .t {
		color: var(--foam-dim);
	}
	.chev {
		color: var(--foam-dim);
	}
	a:hover .chev {
		color: var(--foam);
	}
</style>
