<!-- Add or edit a service, drink or product. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { parsePesos } from '#lib/bill.js';
	import { amount } from '#lib/format.js';
	import { backend } from '#lib/session.svelte.js';
	import { AppError, type CatalogItem, type ItemKind } from '#lib/types.js';

	const isNew = $derived(page.params.id === 'nuevo');

	let all = $state<CatalogItem[]>([]);
	let item = $state<CatalogItem | null>(null);
	let loaded = $state(false);
	let missing = $state(false);

	let kind = $state<ItemKind>('service');
	let name = $state('');
	let priceText = $state('');
	let pctText = $state('50');
	let countsAsCut = $state(false);
	let active = $state(true);
	let busy = $state(false);
	let msg = $state<{ ok: boolean; text: string } | null>(null);

	onMount(async () => {
		try {
			all = await backend.catalogAll();
			if (!isNew) {
				const it = all.find((i) => i.id === page.params.id);
				if (!it) missing = true;
				else fill(it);
			}
		} catch (e) {
			msg = { ok: false, text: e instanceof AppError ? e.message : 'No se pudo cargar.' };
		}
		loaded = true;
	});

	function fill(it: CatalogItem) {
		item = it;
		kind = it.kind;
		name = it.name;
		priceText = amount(it.price);
		pctText = String(it.commissionPct);
		countsAsCut = it.countsAsCut;
		active = it.active !== false;
	}

	const siblings = $derived(all.filter((i) => i.kind === kind).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
	const position = $derived(item ? siblings.findIndex((i) => i.id === item!.id) : -1);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		msg = null;
		const price = parsePesos(priceText);
		const pct = Number(pctText.replace(',', '.'));
		if (!name.trim()) return (msg = { ok: false, text: 'Escribe el nombre.' });
		if (!price) return (msg = { ok: false, text: 'Escribe el precio.' });
		if (!(pct >= 0 && pct <= 100)) return (msg = { ok: false, text: 'La comisión va de 0 a 100 %.' });
		busy = true;
		try {
			const maxOrder = Math.max(-1, ...all.map((i) => i.sortOrder ?? 0));
			const saved = await backend.saveItem({
				id: item?.id,
				kind,
				name,
				price,
				commissionPct: pct,
				countsAsCut: kind === 'service' && countsAsCut,
				active,
				sortOrder: item && item.kind === kind ? (item.sortOrder ?? 0) : maxOrder + 1
			});
			all = await backend.catalogAll();
			if (isNew) {
				await goto(`/admin/catalogo/${saved.id}`, { replaceState: true });
				msg = { ok: true, text: 'Agregado. Ya sale en la caja.' };
			} else {
				msg = { ok: true, text: active ? 'Guardado. Aplica desde el próximo cobro.' : 'Guardado y oculto en la caja.' };
			}
			fill(saved);
		} catch (err) {
			msg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo guardar.' };
		} finally {
			busy = false;
		}
	}

	async function move(dir: -1 | 1) {
		if (!item) return;
		const other = siblings[position + dir];
		if (!other) return;
		busy = true;
		try {
			const a = item.sortOrder ?? 0;
			const b = other.sortOrder ?? 0;
			await backend.saveItem({ ...other, active: other.active !== false, sortOrder: a === b ? a - dir : a });
			const saved = await backend.saveItem({
				...item,
				active: item.active !== false,
				sortOrder: b
			});
			all = await backend.catalogAll();
			fill(saved);
			msg = { ok: true, text: `Ahora es el ${position + 1} de ${siblings.length} en ${kindLabel[kind].toLowerCase()}.` };
		} catch (err) {
			msg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo mover.' };
		} finally {
			busy = false;
		}
	}

	const kindLabel: Record<ItemKind, string> = { service: 'Servicios', drink: 'Bebidas', product: 'Productos' };
</script>

<svelte:head><title>{isNew ? 'Nuevo ítem' : (item?.name ?? 'Ítem')} · Catálogo · Bar Beer</title></svelte:head>

<section class="wrap">
	<a class="back-link" href="/admin/catalogo">
		<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
		Catálogo
	</a>

	{#if missing}
		<h1 class="fig">No encontrado</h1>
	{:else if loaded}
		<h1 class="fig">{isNew ? 'Nuevo ítem' : item?.name}</h1>

		<form class="form block" onsubmit={save} novalidate>
			<div class="field">
				<span class="label" id="kind-label">Pestaña de la caja</span>
				<div class="choice" role="radiogroup" aria-labelledby="kind-label">
					{#each Object.entries(kindLabel) as [k, label] (k)}
						<button type="button" role="radio" aria-checked={kind === k} onclick={() => (kind = k as ItemKind)}>{label}</button>
					{/each}
				</div>
			</div>
			<label class="field">
				<span class="label">Nombre</span>
				<input class="input" bind:value={name} autocomplete="off" autocapitalize="sentences" placeholder="Corte + barba" maxlength="40" />
			</label>
			<div class="row2">
				<label class="field">
					<span class="label">Precio</span>
					<input
						class="input"
						inputmode="numeric"
						value={priceText}
						oninput={(e) => {
							const n = parsePesos(e.currentTarget.value);
							priceText = n ? amount(n) : '';
						}}
						placeholder="20.000"
					/>
				</label>
				<label class="field">
					<span class="label">Comisión %</span>
					<input class="input" inputmode="decimal" bind:value={pctText} placeholder="50" />
				</label>
			</div>
			<p class="hint">
				{#if kind === 'service'}Lo que gana el barbero que hace el servicio. Cada barbero puede tener su propio porcentaje en Equipo.{:else}Pon 0 si nadie gana comisión por venderlo.{/if}
			</p>
			{#if kind === 'service'}
				<label class="check">
					<input type="checkbox" bind:checked={countsAsCut} />
					<span>Cuenta como corte<small>Suma a la jarra del barbero y a los bonos por cortes</small></span>
				</label>
			{/if}
			{#if !isNew}
				<label class="check">
					<input type="checkbox" bind:checked={active} />
					<span>Visible en la caja<small>Oculto conserva su historial en reportes</small></span>
				</label>
			{/if}
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={busy}>{busy ? 'Guardando…' : isNew ? 'Agregar' : 'Guardar'}</button>
		</form>

		{#if item && item.active !== false && siblings.length > 1}
			<section class="block">
				<h2 class="fig heading">Orden en la caja</h2>
				<p class="hint">Es el {position + 1} de {siblings.length} en {kindLabel[kind].toLowerCase()}.</p>
				<div class="row2 moves">
					<button class="btn btn-outline" type="button" disabled={busy || position <= 0} onclick={() => move(-1)}>Subir</button>
					<button class="btn btn-outline" type="button" disabled={busy || position >= siblings.length - 1} onclick={() => move(1)}>Bajar</button>
				</div>
			</section>
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
	.block {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.heading {
		font-size: 1.25rem;
		margin-bottom: 4px;
	}
	.hint {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.moves {
		margin-top: 10px;
	}
	.sk {
		height: 320px;
		margin-top: 16px;
		border-radius: var(--r);
		background: var(--wood);
	}
</style>
