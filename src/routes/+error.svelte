<script lang="ts">
	import { page } from '$app/state';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Plate from '#lib/components/Plate.svelte';
</script>

<svelte:head><title>{page.status === 404 ? 'No encontrada' : 'Algo falló'} · Bar Beer</title></svelte:head>

<section class="wrap">
	<Plate />
	{#if page.status === 404}
		<EmptyState flush title="Esta página no existe">
			<p>Puede que el enlace esté incompleto. Vuelve al inicio y sigue desde ahí.</p>
		</EmptyState>
	{:else}
		<EmptyState flush title="Algo falló">
			<p>La app tuvo un problema al abrir esta pantalla. Ya quedó anotado. Lo cobrado está a salvo.</p>
		</EmptyState>
	{/if}
	<div class="actions">
		<a class="btn btn-foam" href="/">Ir al inicio</a>
		{#if page.status !== 404}
			<button type="button" class="btn btn-outline" onclick={() => location.reload()}>Volver a intentar</button>
		{/if}
	</div>
</section>

<style>
	.wrap {
		display: grid;
		gap: 20px;
		padding: 24px var(--gutter);
	}
	.actions {
		display: grid;
		gap: 10px;
	}
</style>
