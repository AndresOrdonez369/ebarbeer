<!-- Inventory of one drink or product: what is left, what arrived, counts, and every change. -->
<script lang="ts">
	import { parsePesos } from '../bill.js';
	import { amount, clock, dayLabel, toIsoDate } from '../format.js';
	import { backend } from '../session.svelte.js';
	import { stockState, stockWords, units } from '../stock.js';
	import { AppError, type CatalogItem, type StockMove } from '../types.js';

	let { item, onchange }: { item: CatalogItem; onchange: (stock: number | null) => void } = $props();

	let mode = $state<'in' | 'count'>('in');
	let qtyText = $state('');
	let note = $state('');
	let busy = $state(false);
	let msg = $state<{ ok: boolean; text: string } | null>(null);
	let moves = $state<StockMove[] | null>(null);
	let confirmOff = $state(false);

	const tracked = $derived(item.stock != null);
	const level = $derived(stockState(item));
	const qty = $derived(qtyText ? parsePesos(qtyText) : null);

	async function loadMoves() {
		try {
			moves = await backend.stockMoves(item.id);
		} catch {
			moves = [];
		}
	}
	$effect(() => {
		void item.id;
		loadMoves();
	});

	function typed(e: Event & { currentTarget: HTMLInputElement }) {
		const v = e.currentTarget.value;
		qtyText = /[0-9]/.test(v) ? amount(parsePesos(v)) : '';
		msg = null;
	}

	async function run(kind: 'in' | 'count' | 'off', n: number | null) {
		busy = true;
		msg = null;
		try {
			const after = await backend.adjustStock(item.id, kind, n, kind === 'off' ? null : note.trim() || null);
			onchange(after);
			msg = {
				ok: true,
				text:
					kind === 'off'
						? 'Ya no se lleva inventario de este producto.'
						: kind === 'in'
							? `Sumadas ${units(n!)}. Ahora quedan ${after}.`
							: `Conteo guardado: ${units(after ?? 0)}.`
			};
			qtyText = '';
			note = '';
			confirmOff = false;
			await loadMoves();
		} catch (err) {
			msg = { ok: false, text: err instanceof AppError ? err.message : 'No se pudo cambiar el inventario.' };
		} finally {
			busy = false;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (qty == null) return (msg = { ok: false, text: tracked && mode === 'in' ? 'Escribe cuántas unidades llegaron.' : 'Escribe cuántas unidades hay.' });
		run(tracked ? mode : 'count', qty);
	}

	const today = toIsoDate(new Date());
	function when(at: string) {
		const d = toIsoDate(new Date(at));
		return d === today ? clock(at) : `${dayLabel(d)} · ${clock(at)}`;
	}
	const what: Record<StockMove['kind'], string> = {
		sale: 'Vendida',
		void: 'Cuenta anulada',
		in: 'Llegó mercancía',
		count: 'Conteo',
		off: 'Dejó de llevar inventario'
	};
	const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
</script>

<section class="stock" aria-labelledby="stock-title">
	<h2 id="stock-title" class="fig heading">Inventario</h2>

	{#if tracked}
		<p class="left {level}">
			<span class="fig big">{level === 'out' ? stockWords(item.stock!) : item.stock}</span>
			{#if level !== 'out'}<span class="unit">{item.stock === 1 ? 'unidad' : 'unidades'}{level === 'low' ? ' · por acabarse' : ''}</span>{/if}
		</p>
		<p class="hint">Cada venta descuenta sola. Te avisamos cuando queden {item.stockMin ?? 0} o menos.</p>

		<form class="form" onsubmit={submit} novalidate>
			<div class="choice" style="--n:2" role="radiogroup" aria-label="Qué pasó">
				<button type="button" role="radio" aria-checked={mode === 'in'} onclick={() => ((mode = 'in'), (msg = null))}>Llegó mercancía</button>
				<button type="button" role="radio" aria-checked={mode === 'count'} onclick={() => ((mode = 'count'), (msg = null))}>Conté y hay otra cantidad</button>
			</div>
			<div class="row2">
				<label class="field">
					<span class="label">{mode === 'in' ? 'Cuántas llegaron' : 'Cuántas hay'}</span>
					<input class="input qty" value={qtyText} oninput={typed} inputmode="numeric" autocomplete="off" placeholder="0" disabled={busy} />
				</label>
				<label class="field">
					<span class="label">Nota (opcional)</span>
					<input class="input" bind:value={note} maxlength="120" autocomplete="off" placeholder={mode === 'in' ? 'Pedido del jueves' : 'Se rompieron 2'} disabled={busy} />
				</label>
			</div>
			{#if mode === 'count' && qty != null && qty !== item.stock}
				<p class="hint">Quedará en {qty}: {qty > item.stock! ? 'sobran' : 'faltan'} {Math.abs(qty - item.stock!)} frente a lo que dice la app.</p>
			{/if}
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={busy}>
				{busy ? 'Guardando…' : mode === 'in' ? (qty ? `Sumar ${qty}` : 'Sumar') : 'Guardar conteo'}
			</button>
		</form>

		{#if moves && moves.length}
			<h3 class="label sub">Movimientos</h3>
			<ul class="moves">
				{#each moves as m, i (i)}
					<li>
						<span class="what">
							{m.receiptNo ? `${what[m.kind]} · N.º ${String(m.receiptNo).padStart(4, '0')}` : what[m.kind]}
							<small>{[m.by, when(m.at), m.note ? `“${m.note}”` : null].filter(Boolean).join(' · ')}</small>
						</span>
						<span class="delta">
							<b class="fig" class:neg={m.delta < 0}>{m.kind === 'count' ? `= ${m.after}` : m.kind === 'off' ? '—' : signed(m.delta)}</b>
							{#if m.after != null && m.kind !== 'count'}<small>{m.after < 0 ? `${-m.after} de más` : `quedan ${m.after}`}</small>{:else if m.kind === 'count' && m.delta !== 0}<small>{signed(m.delta)}</small>{/if}
						</span>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="offrow">
			{#if confirmOff}
				<p class="hint">¿Dejar de llevar inventario? Se borra la cantidad; el historial se conserva.</p>
				<div class="row2">
					<button type="button" class="btn btn-outline" onclick={() => (confirmOff = false)} disabled={busy}>Cancelar</button>
					<button type="button" class="btn btn-danger" onclick={() => run('off', null)} disabled={busy}>Sí, dejar de llevar</button>
				</div>
			{:else}
				<button type="button" class="btn btn-outline" onclick={() => (confirmOff = true)} disabled={busy}>Dejar de llevar inventario</button>
			{/if}
		</div>
	{:else}
		<p class="hint">Todavía no llevas inventario de este producto. Escribe cuántas hay y cada venta las irá descontando.</p>
		<form class="form start" onsubmit={submit} novalidate>
			<label class="field">
				<span class="label">Cuántas hay ahora</span>
				<input class="input qty" value={qtyText} oninput={typed} inputmode="numeric" autocomplete="off" placeholder="0" disabled={busy} />
			</label>
			<p class="form-msg" class:ok={msg?.ok} class:err={msg && !msg.ok} role="status">{msg?.text ?? ''}</p>
			<button class="btn btn-foam" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Empezar inventario'}</button>
		</form>
	{/if}
</section>

<style>
	.stock {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.heading {
		font-size: 1.25rem;
		margin-bottom: 4px;
	}
	.left {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin: 6px 0 2px;
	}
	.big {
		font-size: var(--fs-fig-xl);
		font-weight: 900;
		line-height: 1;
	}
	.unit {
		font-size: var(--fs-sm);
		font-weight: 700;
		color: var(--foam-dim);
	}
	.left.low .big,
	.left.low .unit {
		color: var(--amber);
	}
	.left.out .big {
		font-size: var(--fs-fig-lg);
		color: var(--danger-text);
	}
	.hint {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
		max-width: 50ch;
	}
	.form {
		margin-top: 14px;
	}
	.qty {
		text-align: right;
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
	}
	.choice button {
		height: auto;
		min-height: var(--tap);
		padding: 6px 8px;
		line-height: 1.2;
	}
	.sub {
		margin: 22px 0 6px;
	}
	.moves {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	.moves li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 0;
		border-bottom: 1px solid var(--line);
	}
	.what {
		display: grid;
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.what small,
	.delta small {
		font-weight: 500;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.delta {
		display: grid;
		justify-items: end;
		flex: none;
	}
	.delta b {
		font-size: var(--fs-fig-sm);
	}
	.delta b.neg {
		color: var(--foam-dim);
	}
	.offrow {
		display: grid;
		gap: 10px;
		margin-top: 18px;
	}
</style>
