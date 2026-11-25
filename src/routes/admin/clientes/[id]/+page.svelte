<script lang="ts">
	import { page } from '$app/state';
	import ClientHistory from '#lib/components/ClientHistory.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import { longDate, toIsoDate } from '#lib/format.js';
	import { prettyPhone } from '#lib/receipt.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type ClientFile } from '#lib/types.js';

	const id = $derived(page.params.id ?? '');
	let file = $state<ClientFile | null | undefined>(undefined);
	let error = $state('');
	let asking = $state(false);
	let busy = $state(false);
	let done = $state('');
	let forgetError = $state('');

	function load(c: string) {
		backend
			.clientFile(c)
			.then((f) => (file = f))
			.catch((e) => (error = e instanceof AppError ? e.message : 'No se pudo abrir el cliente.'));
	}
	$effect(() => {
		file = undefined;
		load(id);
	});

	const photos = $derived(file ? file.visits.reduce((s, v) => s + v.photos.length, 0) : 0);

	async function forget() {
		busy = true;
		forgetError = '';
		try {
			await backend.forgetClientPhotos(id);
			asking = false;
			done = 'Fotos borradas. Sus visitas y notas siguen, y ya no tiene autorización de fotos.';
			load(id);
		} catch (e) {
			forgetError = e instanceof AppError ? e.message : 'No se pudieron borrar las fotos.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>{file?.name ?? 'Cliente'} · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/clientes">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Clientes
	</a>
	{#if error}
		<p class="err">{error}</p>
	{:else if file === null}
		<EmptyState flush title="Cliente no encontrado"><p>Ese cliente no está en el local.</p></EmptyState>
	{:else if file}
		<h1 class="fig">{file.name ?? 'Sin nombre'}</h1>
		<p class="meta">{prettyPhone(file.phone)}</p>
		<p class="consent">
			{#if file.consentAt}
				Autorizó guardar sus fotos el {longDate(toIsoDate(new Date(file.consentAt)))}{file.minor ? ', con su acudiente (menor de edad)' : ''}.
			{:else}
				No ha autorizado fotos. El barbero se lo pregunta la próxima vez.
			{/if}
		</p>
		{#if done}<p class="form-msg ok" role="status">{done}</p>{/if}

		{#if file.visits.length}
			<h2 class="label sub">Visitas con registro</h2>
			<ClientHistory visits={file.visits} />
		{:else}
			<EmptyState flush title="Sin visitas con registro"><p>Las fotos y notas que guarden los barberos aparecen aquí.</p></EmptyState>
		{/if}

		{#if photos || file.consentAt}
			<div class="forget">
				{#if asking}
					<div class="confirm">
						<p>
							Se borran {photos === 1 ? 'la foto' : `las ${photos} fotos`} de {file.name ?? 'este cliente'} y su autorización. Las visitas y notas quedan. No se puede deshacer.
						</p>
						<p class="form-msg err" role="alert">{forgetError}</p>
						<div class="row2">
							<button type="button" class="btn btn-outline" onclick={() => (asking = false)} disabled={busy}>Cancelar</button>
							<button type="button" class="btn btn-danger" onclick={forget} disabled={busy}>{busy ? 'Borrando…' : 'Borrar fotos'}</button>
						</div>
					</div>
				{:else}
					<button type="button" class="btn btn-outline" onclick={() => ((asking = true), (done = ''))}>Borrar fotos del cliente</button>
					<p class="fine">Si el cliente lo pide (o retira su autorización).</p>
				{/if}
			</div>
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
	.meta,
	.fine {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.consent {
		margin: 8px 0 14px;
		font-size: var(--fs-sm);
		max-width: 48ch;
	}
	.sub {
		margin: 6px 0;
	}
	.forget {
		display: grid;
		gap: 6px;
		margin-top: 20px;
	}
	.confirm {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--red);
		border-radius: var(--r);
		font-size: var(--fs-sm);
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
