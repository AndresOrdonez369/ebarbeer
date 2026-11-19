<!-- The bills of a day: tap one to see it, send its receipt, or void it when it was charged by mistake.
     Marks a bill that looks like a repeat of the one just before it. -->
<script lang="ts">
	import { amount, clock, methodLabel, money } from '../format.js';
	import { remove } from '../outbox.svelte.js';
	import { findTwin, type TwinLine } from '../repeat.js';
	import { backend } from '../session.svelte.js';
	import { AppError, type SaleRecord } from '../types.js';
	import SendReceipt from './SendReceipt.svelte';

	let {
		list,
		names,
		onvoided,
		receipts = true
	}: { list: SaleRecord[]; names: Map<string, string>; onvoided: () => void; receipts?: boolean } = $props();

	let open = $state<string | null>(null);
	let reason = $state('');
	let voiding = $state(false);
	let voidError = $state('');

	function toggle(id: string) {
		open = open === id ? null : id;
		reason = '';
		voidError = '';
	}

	async function doVoid(id: string) {
		if (reason.trim().length < 3) {
			voidError = 'Escribe el motivo (mínimo 3 letras).';
			return;
		}
		voiding = true;
		voidError = '';
		try {
			await backend.voidSale(id, reason);
			open = null;
			onvoided();
		} catch (e) {
			voidError = e instanceof AppError ? e.message : 'No se pudo anular.';
		} finally {
			voiding = false;
		}
	}

	const no = (n: number | null) => (n ? `N.º ${String(n).padStart(4, '0')}` : 'Sin número');
	const summary = (s: SaleRecord) =>
		s.lines.map((l) => `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''}${l.barberId && names.get(l.barberId) ? ` (${names.get(l.barberId)})` : ''}`).join(', ');
	const methods = (s: SaleRecord) => [...new Set(s.payments.map((p) => methodLabel[p.method]))].join(' + ');

	// A bill that repeats an earlier one minutes before it: probably charged twice.
	const asTwin = (s: SaleRecord): TwinLine[] => s.lines.map((l) => ({ key: l.name, barberId: l.barberId, qty: l.qty }));
	const repeats = $derived.by(() => {
		const live = list.filter((s) => s.status === 'ok' || s.status === 'pending');
		const out = new Map<string, SaleRecord>();
		for (const s of live) {
			const earlier = live.filter((e) => e.id !== s.id && e.createdAt < s.createdAt).map((e) => ({ at: e.createdAt, lines: asTwin(e), e }));
			const t = findTwin({ at: s.createdAt, lines: asTwin(s) }, earlier);
			if (t) out.set(s.id, t.e);
		}
		return out;
	});
	const reasons = ['Se cobró dos veces', 'Error al cobrar'];
</script>

<ul class="sales">
	{#each list as s (s.id)}
		{@const twin = repeats.get(s.id)}
		<li class={s.status}>
			<button type="button" class="row" aria-expanded={open === s.id} onclick={() => toggle(s.id)}>
				<span class="no">{no(s.receiptNo)} · {clock(s.createdAt)}</span>
				<span class="fig tot">{amount(s.total)}</span>
				<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
				<span class="what">{summary(s)}</span>
				<span class="how">
					{#if s.status === 'void'}Anulada{:else if s.status === 'pending'}Por enviar{:else if s.status === 'failed'}Rechazada{:else}{methods(s)}{/if}
				</span>
				{#if twin}<span class="twin">¿Repetida? Igual a la {no(twin.receiptNo)} de las {clock(twin.createdAt)}</span>{/if}
			</button>

			{#if open === s.id}
				<div class="detail">
					{#if s.status === 'void'}
						<p>Motivo: {s.voidReason}</p>
					{:else if s.status === 'failed'}
						<p class="bad">{s.error}</p>
						<p>El servidor no aceptó esta cuenta. Vuelve a cobrarla desde Caja y descarta esta.</p>
						<button type="button" class="ghost" onclick={() => remove(s.id)}>Descartar</button>
					{:else if s.status === 'pending'}
						<p>Guardada en este celular. Se envía sola cuando vuelva la conexión. No la cobres de nuevo.</p>
					{:else}
						<ul class="lines">
							{#each s.lines as l, i (i)}
								<li>
									<span>{l.name}{l.qty > 1 ? ` × ${l.qty}` : ''}{#if l.barberId}<em>{names.get(l.barberId) ?? ''}</em>{/if}</span>
									<span class="fig">{amount(l.total)}</span>
								</li>
							{/each}
						</ul>
						<p class="pays">
							{#each s.payments as p, i (i)}
								<span>{methodLabel[p.method]} {money(p.amount)}{p.cashReceived && p.cashReceived > p.amount ? ` (recibido ${money(p.cashReceived)})` : ''}</span>
							{/each}
						</p>
						{#if receipts && s.receiptToken && s.receiptNo}
							<div class="receipt">
								<SendReceipt
									compact
									sale={{
										id: s.id,
										receiptNo: s.receiptNo,
										receiptToken: s.receiptToken,
										createdAt: s.createdAt,
										total: s.total,
										lines: s.lines.map((l) => ({ ...l, barber: l.barberId ? (names.get(l.barberId) ?? null) : null })),
										payments: s.payments,
										customer: s.customer ?? null,
										receiptSentAt: s.receiptSentAt
									}}
								/>
							</div>
						{/if}
						<p class="voidnote">¿Se cobró por error o dos veces? Anúlala: sale de las cuentas, de la caja y de la comisión del barbero. Queda en Anulaciones con el motivo.</p>
						<div class="chips">
							{#each reasons as r (r)}
								<button type="button" class="chip" aria-pressed={reason === r} onclick={() => ((reason = r), (voidError = ''))} disabled={voiding}>{r}</button>
							{/each}
						</div>
						<label class="reason">
							<span class="label">Motivo para anular</span>
							<input bind:value={reason} placeholder="Ej.: cobrado dos veces" maxlength="120" disabled={voiding} />
						</label>
						<p class="bad" role="alert">{voidError}</p>
						<button type="button" class="voidbtn" onclick={() => doVoid(s.id)} disabled={voiding}>
							{voiding ? 'Anulando…' : 'Anular cuenta'}
						</button>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.sales,
	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.sales > li {
		border-bottom: 1px solid var(--line);
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto 20px;
		gap: 2px 10px;
		width: 100%;
		padding: 12px 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.row:hover .no {
		color: var(--foam);
	}
	.no {
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--foam-dim);
		transition: color var(--t-fast);
	}
	.chev {
		grid-row: span 2;
		align-self: center;
		width: 20px;
		height: 20px;
		fill: none;
		stroke: var(--foam-dim);
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		transition: transform var(--t-fast);
	}
	.row[aria-expanded='true'] .chev {
		transform: rotate(90deg);
	}
	.tot {
		grid-row: span 2;
		align-self: center;
		font-size: var(--fs-fig-md);
	}
	.what {
		font-size: var(--fs-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.how {
		grid-column: 1 / -1;
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.twin {
		grid-column: 1 / -1;
		justify-self: start;
		margin-top: 4px;
		padding: 2px 8px;
		border: 1px solid var(--amber-deep);
		border-radius: var(--r);
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--amber);
	}
	/* State is carried by form, not only colour. */
	.void .tot,
	.void .what {
		text-decoration: line-through;
		color: var(--foam-dim);
	}
	.void .how,
	.failed .how {
		color: var(--danger-text);
	}
	.pending {
		border: 1px dashed var(--amber-deep) !important;
		border-radius: var(--r);
		padding: 0 10px;
		margin: 6px 0;
	}
	.pending .how {
		color: var(--amber);
	}
	.detail {
		padding: 0 0 14px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		display: grid;
		gap: 8px;
	}
	.lines li {
		display: flex;
		justify-content: space-between;
		min-height: 32px;
		align-items: center;
		color: var(--foam);
		border-bottom: 1px dashed var(--line);
	}
	.lines em {
		font-style: normal;
		color: var(--foam-dim);
		font-size: var(--fs-xs);
		margin-left: 6px;
	}
	.pays {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.receipt {
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.voidnote {
		margin-top: 6px;
		font-size: var(--fs-xs);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		min-height: 40px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-weight: 700;
		font-size: var(--fs-xs);
	}
	.chip[aria-pressed='true'] {
		border-color: var(--amber);
		color: var(--amber);
	}
	.reason {
		display: grid;
		gap: 6px;
		margin-top: 4px;
	}
	.reason input {
		height: 48px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam);
		transition: border-color var(--t-fast);
	}
	.reason input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.bad {
		color: var(--danger-text);
		min-height: 0;
	}
	.voidbtn,
	.ghost {
		height: 48px;
		border-radius: var(--r);
		font-weight: 700;
		font-size: var(--fs-sm);
		background: none;
		transition:
			background-color var(--t-fast),
			color var(--t-fast);
	}
	.voidbtn {
		border: 1px solid var(--red);
		color: var(--danger-text);
	}
	.voidbtn:hover:not(:disabled) {
		background: var(--red);
		color: #fff;
	}
	.ghost {
		border: 1px solid var(--line-strong);
		color: var(--foam);
	}
</style>
