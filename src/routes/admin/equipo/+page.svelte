<script lang="ts">
	import { roleLabel } from '#lib/format.js';
	import { once } from '#lib/live.svelte.js';
	import { backend } from '#lib/session.svelte.js';

	const team = once(() => backend.staff());
	const ordered = $derived(
		[...(team.data ?? [])].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
	);
</script>

<svelte:head><title>Equipo · Bar Beer</title></svelte:head>

<section class="wrap">
	<div class="head">
		<h1 class="fig">Equipo</h1>
		<a class="btn btn-outline" href="/admin/equipo/nuevo">
			<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
			Agregar persona
		</a>
	</div>
	<p class="note">Toca una persona para editar sus datos, darle acceso, cambiar su PIN o sus porcentajes.</p>

	{#if team.data}
		<ul>
			{#each ordered as s (s.id)}
				<li class:off={!s.active}>
					<a href={`/admin/equipo/${s.id}`}>
						<span class="name">{s.name}</span>
						<span class="role">{roleLabel[s.role]}{s.role === 'admin' && s.cuts ? ' · también corta' : ''}</span>
						<span class="access" class:yes={s.hasAccess}>
							{#if !s.active}Inactivo{:else if s.hasAccess}Usuario {s.username}{:else}Sin acceso{/if}
						</span>
						<svg class="chev go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
					</a>
				</li>
			{/each}
		</ul>
	{:else if team.error}
		<p class="note err">{team.error}</p>
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
	.note {
		margin: 6px 0 14px;
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
		grid-template-areas: 'name access go' 'role access go';
		align-items: center;
		column-gap: 10px;
		min-height: 60px;
		padding: 8px 0;
		color: inherit;
		text-decoration: none;
	}
	a:not(.btn):hover .name {
		color: #fff;
	}
	.name {
		grid-area: name;
		font-weight: 700;
	}
	.role {
		grid-area: role;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.access {
		grid-area: access;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		text-align: right;
	}
	.access.yes {
		color: var(--foam);
	}
	.go {
		grid-area: go;
		color: var(--foam-dim);
	}
	.off .name {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
</style>
