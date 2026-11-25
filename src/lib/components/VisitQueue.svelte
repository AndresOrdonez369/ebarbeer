<!-- Visits saved on this phone that have not reached the server yet: waiting for signal, or refused. -->
<script lang="ts">
	import { net } from '../network.svelte.js';
	import { discardVisit, retryVisit, visits } from '../visit-queue.svelte.js';

	let asking = $state<string | null>(null);
	const pending = $derived(visits.items.filter((x) => x.status === 'pending').length);
	const failed = $derived(visits.items.filter((x) => x.status === 'failed'));
</script>

{#if pending}
	<p class="queue" role="status">
		{pending === 1 ? '1 visita por subir' : `${pending} visitas por subir`} · {visits.sending ? 'subiendo' : net.online ? 'en espera' : 'sin conexión, se sube sola'}
	</p>
{/if}
{#each failed as f (f.draft.id)}
	<div class="queue bad" role="alert">
		<p><b>No se subió la visita de {f.label}.</b> {f.error}</p>
		{#if asking === f.draft.id}
			<div class="row2">
				<button type="button" class="btn btn-outline" onclick={() => (asking = null)}>Conservar</button>
				<button type="button" class="btn btn-danger" onclick={() => discardVisit(f.draft.id)}>Descartar fotos</button>
			</div>
		{:else}
			<div class="row2">
				<button type="button" class="btn btn-outline" onclick={() => (asking = f.draft.id)}>Descartar</button>
				<button type="button" class="btn btn-outline" onclick={() => retryVisit(f.draft.id)}>Reintentar</button>
			</div>
		{/if}
	</div>
{/each}

<style>
	.queue {
		margin: 0 0 12px;
		padding: 8px 12px;
		border: 1px dashed var(--amber-deep);
		border-radius: var(--r);
		color: var(--amber);
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.bad {
		display: grid;
		gap: 10px;
		border-color: var(--danger-text);
		color: var(--danger-text);
		font-weight: 500;
	}
</style>
