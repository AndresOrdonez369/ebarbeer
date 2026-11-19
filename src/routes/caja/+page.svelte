<script lang="ts">
	import DoneStep from '#lib/components/DoneStep.svelte';
	import Lineup from '#lib/components/Lineup.svelte';
	import OpenRegister from '#lib/components/OpenRegister.svelte';
	import PayStep from '#lib/components/PayStep.svelte';
	import { amount, clock, methodLabel, money } from '#lib/format.js';
	import { held, heldTotal, hold, loadDraft, saveDraft, take, type Line } from '#lib/held.svelte.js';
	import { live, once } from '#lib/live.svelte.js';
	import { charge, outbox } from '#lib/outbox.svelte.js';
	import { backend } from '#lib/session.svelte.js';
	import { normalizePhone } from '#lib/receipt.js';
	import { findTwin, type TwinLine } from '#lib/repeat.js';
	import { stockState, stockWords } from '#lib/stock.js';
	import {
		AppError,
		RepeatError,
		type BillLineInput,
		type CatalogItem,
		type CustomerInput,
		type ItemKind,
		type PaymentInput,
		type PayMethod,
		type TwinSale
	} from '#lib/types.js';

	const board = live(() => backend.dayBoard());
	const totals = live(() => backend.dayTotals());
	// Live, so what is left of each drink or product follows every sale.
	const catalog = live(() => backend.catalog());
	// Today's drawer: asks for the base until it is opened, and warns once it was already counted.
	const cash = once(async () => backend.cashDay(await backend.businessDate()));
	let openedNow = $state(false);
	const closing = $derived(cash.data?.closing ?? null);
	const mustOpen = $derived(!!cash.data && !cash.data.opening && !cash.data.closing && !openedNow);

	const tabs: { kind: ItemKind; label: string }[] = [
		{ kind: 'service', label: 'Servicios' },
		{ kind: 'drink', label: 'Bebidas' },
		{ kind: 'product', label: 'Productos' }
	];

	type Served = { id: string; name: string; before: number; after: number; goal: number };

	let step = $state<'cuenta' | 'pago' | 'listo'>('cuenta');
	let selected = $state<string | null>(null);
	let tab = $state<ItemKind>('service');
	let lines = $state<Line[]>([]);
	let hint = $state('');
	let busy = $state(false);
	let payError = $state('');
	type ReceiptSale = {
		id: string;
		receiptNo: number;
		receiptToken: string;
		createdAt: string;
		total: number;
		lines: { name: string; qty: number; total: number; barber: string | null }[];
		payments: { method: PayMethod; amount: number }[];
		customer: { id: string; name: string | null; phone: string } | null;
	};
	let done = $state<{
		receiptNo: number | null;
		queued: boolean;
		total: number;
		change: number;
		served: Served[];
		sale: ReceiptSale | null;
	} | null>(null);

	// Bills still on their way to the server count on the mugs and totals right away.
	const pending = $derived(outbox.items.filter((p) => p.status === 'pending'));
	const pendingCuts = $derived(
		pending.reduce<Record<string, number>>((acc, p) => {
			for (const [id, n] of Object.entries(p.cuts)) acc[id] = (acc[id] ?? 0) + n;
			return acc;
		}, {})
	);
	const rows = $derived((board.data ?? []).map((r) => ({ ...r, cuts: r.cuts + (pendingCuts[r.staffId] ?? 0) })));
	const dayTotal = $derived(totals.data ? totals.data.total + pending.reduce((s, p) => s + p.preview.total, 0) : null);
	const dayCuts = $derived(
		totals.data ? totals.data.cuts + Object.values(pendingCuts).reduce((a, b) => a + b, 0) : null
	);

	const items = $derived((catalog.data ?? []).filter((i) => i.kind === tab));

	let restored = false;
	$effect(() => {
		if (restored || !catalog.data) return;
		restored = true;
		const draft = loadDraft(catalog.data);
		if (draft.length && !lines.length) lines = draft;
	});
	$effect(() => {
		const snap = $state.snapshot(lines) as Line[];
		if (restored) saveDraft(snap);
	});
	const total = $derived(lines.reduce((s, l) => s + l.item.price * l.qty, 0));
	const count = $derived(lines.reduce((s, l) => s + l.qty, 0));

	function pick(id: string) {
		selected = selected === id ? null : id;
		hint = '';
	}

	function add(item: CatalogItem) {
		if (item.kind === 'service' && !selected) {
			hint = 'Primero toca quién hizo el servicio.';
			return;
		}
		hint = '';
		const barberId = item.kind === 'service' ? selected : null;
		const barber = barberId ? (rows.find((r) => r.staffId === barberId)?.name ?? null) : null;
		const key = `${item.id}:${barberId ?? ''}`;
		const existing = lines.find((l) => l.key === key);
		if (existing) existing.qty += 1;
		else lines.push({ key, item, barberId, barber, qty: 1 });
	}

	function remove(key: string) {
		const i = lines.findIndex((l) => l.key === key);
		if (i < 0) return;
		if (lines[i].qty > 1) lines[i].qty -= 1;
		else lines.splice(i, 1);
	}

	function park() {
		hold(lines);
		lines = [];
		selected = null;
	}

	function resume(id: string) {
		if (!catalog.data) return;
		if (lines.length) hold(lines);
		lines = take(id, catalog.data ?? []);
	}

	function toPay() {
		payError = '';
		step = 'pago';
		scrollTo({ top: 0 });
	}

	// The same bill charged minutes ago: ask before charging it again.
	let twin = $state<TwinSale | null>(null);
	let twinArgs: [PaymentInput[], number, CustomerInput | null] | null = null;
	let twinFirst = $state<HTMLButtonElement | null>(null);
	$effect(() => twinFirst?.focus());
	const asTwin = (ls: BillLineInput[]): TwinLine[] => ls.map((l) => ({ key: l.itemId, barberId: l.barberId, qty: l.qty }));
	function since(at: string) {
		const min = Math.floor((Date.now() - Date.parse(at)) / 60000);
		return min < 1 ? 'menos de un minuto' : min === 1 ? '1 minuto' : `${min} minutos`;
	}

	function keepFirst() {
		twin = null;
		twinArgs = null;
		lines = [];
		selected = null;
		saveDraft([]);
		step = 'cuenta';
		hint = 'No se cobró otra vez. La cuenta quedó vacía.';
		scrollTo({ top: 0 });
	}

	function chargeAnyway() {
		const args = twinArgs;
		twin = null;
		twinArgs = null;
		if (args) confirm(...args, true);
	}

	async function confirm(payments: PaymentInput[], change: number, customer: CustomerInput | null, repeat = false) {
		if (busy) return;
		const billLines: BillLineInput[] = lines.map((l) => ({ itemId: l.item.id, qty: l.qty, barberId: l.barberId }));
		// Offline, the server cannot see bills still waiting on this phone: check them here.
		if (!repeat) {
			const queued = findTwin(
				{ at: new Date().toISOString(), lines: asTwin(billLines) },
				outbox.items.filter((p) => p.status === 'pending').map((p) => ({ at: p.preview.createdAt, lines: asTwin(p.lines), p }))
			);
			if (queued) {
				twinArgs = [payments, change, customer];
				twin = {
					receiptNo: null,
					createdAt: queued.p.preview.createdAt,
					total: queued.p.preview.total,
					methods: [...new Set(queued.p.payments.map((x) => x.method))],
					cashier: null
				};
				return;
			}
		}
		busy = true;
		payError = '';
		const id = crypto.randomUUID();
		const cuts: Record<string, number> = {};
		for (const l of lines) if (l.barberId && l.item.countsAsCut) cuts[l.barberId] = (cuts[l.barberId] ?? 0) + l.qty;
		const served: Served[] = Object.entries(cuts).map(([sid, n]) => {
			const r = rows.find((x) => x.staffId === sid)!;
			return { id: sid, name: r.name, before: r.cuts, after: r.cuts + n, goal: r.goal };
		});
		const billTotal = total;
		const createdAt = new Date().toISOString();
		const receiptLines = lines.map((l) => ({ name: l.item.name, qty: l.qty, total: l.item.price * l.qty, barber: l.barber }));
		// From here the bill lives in the outbox: a reload mid-charge must not bring it back as open.
		const draft = $state.snapshot(lines) as Line[];
		saveDraft([]);
		try {
			const result = await charge({
				id,
				lines: billLines,
				payments,
				customer,
				cuts,
				preview: {
					id,
					receiptNo: null,
					createdAt,
					total: billTotal,
					status: 'pending',
					lines: lines.map((l) => ({ name: l.item.name, qty: l.qty, total: l.item.price * l.qty, barberId: l.barberId })),
					payments: payments.map((p) => ({ method: p.method, amount: p.amount, cashReceived: p.cashReceived ?? null }))
				}
			}, repeat);
			const phone = customer ? normalizePhone(customer.phone) : null;
			done = {
				receiptNo: result?.receiptNo ?? null,
				queued: !result,
				total: billTotal,
				change,
				served,
				sale: result
					? {
							id,
							receiptNo: result.receiptNo,
							receiptToken: result.receiptToken,
							createdAt,
							total: billTotal,
							lines: receiptLines,
							payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
							customer:
								result.customerId && phone
									? { id: result.customerId, name: customer?.name ?? null, phone: '+' + phone }
									: null
						}
					: null
			};
			lines = [];
			selected = null;
			step = 'listo';
			scrollTo({ top: 0 });
			if (result) {
				board.refresh();
				totals.refresh();
			}
		} catch (e) {
			saveDraft(draft);
			if (e instanceof RepeatError) {
				twinArgs = [payments, change, customer];
				twin = e.twin;
			} else payError = e instanceof AppError ? e.message : 'No se pudo cobrar. Intenta de nuevo.';
		} finally {
			busy = false;
		}
	}

	function newBill() {
		done = null;
		step = 'cuenta';
		tab = 'service';
	}
</script>

<svelte:head><title>Caja · Bar Beer</title></svelte:head>

{#if step === 'pago'}
	<PayStep {total} {count} {busy} error={payError} oncancel={() => (step = 'cuenta')} onconfirm={(p, c, cu) => confirm(p, c, cu)} />
	{#if twin}
		<div class="twin-back"></div>
		<div class="twin" role="alertdialog" aria-modal="true" aria-labelledby="twin-title" aria-describedby="twin-what">
			<h2 id="twin-title" class="fig">¿Cobrar otra vez?</h2>
			<p id="twin-what">
				Hace {since(twin.createdAt)} se cobró una cuenta igual:
				<b>
					{twin.receiptNo ? `N.º ${String(twin.receiptNo).padStart(4, '0')}` : 'todavía por enviar'} · {money(twin.total)}{twin.methods.length
						? ` · ${twin.methods.map((m) => methodLabel[m]).join(' + ')}`
						: ''}{twin.cashier ? ` · ${twin.cashier}` : ''}
				</b>
			</p>
			<p class="dim">Si es el mismo cliente, no la cobres de nuevo: quedaría repetida en las cuentas y en la comisión.</p>
			<button type="button" class="btn btn-foam" bind:this={twinFirst} onclick={keepFirst}>No cobrar, ya estaba cobrada</button>
			<button type="button" class="btn btn-outline" onclick={chargeAnyway}>Sí, es otro cliente: cobrar</button>
		</div>
	{/if}
{:else if step === 'listo' && done}
	<DoneStep {...done} onnew={newBill} />
{:else}
	<section class="today" aria-label="Hoy en el local">
		<div>
			<span class="label">Hoy en el local</span>
			<span class="fig total">{dayTotal != null ? money(dayTotal) : '—'}</span>
		</div>
		<span class="fig cuts">{dayCuts != null ? `${dayCuts} cortes` : ''}</span>
	</section>
	{#if closing}
		<p class="closed-note">Caja de hoy cerrada a las {clock(closing.closedAt)} · el efectivo que cobres ahora queda fuera de ese cierre</p>
	{:else if mustOpen}
		<div class="opening">
			<OpenRegister lastBase={cash.data?.lastBase ?? null} onopened={() => (openedNow = true)} />
		</div>
	{/if}

	<section class="block">
		<h2 class="fig heading">Quién atendió</h2>
		{#if board.data && board.data.length}
			<Lineup {rows} {selected} onselect={pick} />
		{:else if board.data}
			<p class="note">Todavía no hay barberos. El administrador los crea en Equipo.</p>
		{:else if board.error}
			<p class="note err">{board.error}</p>
		{:else}
			<div class="skeleton lineup-sk"></div>
		{/if}
	</section>

	<section class="block">
		<div class="tabs" role="tablist" aria-label="Catálogo">
			{#each tabs as t (t.kind)}
				<button type="button" role="tab" aria-selected={tab === t.kind} onclick={() => (tab = t.kind)}>{t.label}</button>
			{/each}
		</div>
		<p class="hint" role="status">{hint}</p>
		{#if catalog.data}
			{#if items.length}
				<div class="grid" role="tabpanel">
					{#each items as item (item.id)}
						{@const left = stockState(item)}
						<button type="button" class="item" onclick={() => add(item)}>
							<span class="name">
								{item.name}
								{#if left === 'low' || left === 'out'}<small class="left" class:out={left === 'out'}>{stockWords(item.stock!)}</small>{/if}
							</span>
							<span class="fig price">{amount(item.price)}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="note">No hay nada en esta pestaña. El administrador lo agrega en Catálogo.</p>
			{/if}
		{:else if catalog.error}
			<p class="note err">{catalog.error}</p>
		{:else}
			<div class="skeleton grid-sk"></div>
		{/if}
	</section>

	{#if held.bills.length}
		<section class="held" aria-label="Cuentas en espera">
			<h2 class="fig heading">En espera</h2>
			<div class="chips">
				{#each held.bills as b (b.id)}
					{@const who = [...new Set(b.lines.map((l) => l.barber).filter(Boolean))].join(', ')}
					<button type="button" onclick={() => resume(b.id)} disabled={!catalog.data} aria-label="Retomar cuenta de {clock(b.at)}">
						<span class="who">{who || b.lines[0]?.item.name}</span>
						<span class="sub">{who ? b.lines[0]?.item.name : ''}{b.lines.length > 1 ? ` +${b.lines.length - 1}` : ''} · {clock(b.at)}</span>
						<b class="fig">{amount(heldTotal(b))}</b>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	<section class="bill" aria-label="Cuenta del cliente">
		<h2>
			<span>Cuenta</span>
			<span class="meta">{count ? `${count} ${count === 1 ? 'ítem' : 'ítems'}` : ''}</span>
		</h2>
		{#if lines.length}
			<ul>
				{#each lines as l (l.key)}
					<li>
						<button type="button" class="minus" onclick={() => remove(l.key)} aria-label="Quitar uno de {l.item.name}">
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
						</button>
						<span class="what">
							{l.item.name}{l.qty > 1 ? ` × ${l.qty}` : ''}
							{#if l.barber}<em>{l.barber}</em>{/if}
						</span>
						<span class="fig">{amount(l.item.price * l.qty)}</span>
					</li>
				{/each}
			</ul>
			<div class="billactions">
				<button type="button" onclick={park}>Poner en espera</button>
				<button type="button" onclick={() => (lines = [])}>Vaciar</button>
			</div>
		{:else}
			<p class="note">Elige el barbero y toca lo que el cliente consumió: servicios, cervezas, productos.</p>
		{/if}
	</section>

	<div class="charge" class:pinned={lines.length > 0}>
		<button type="button" class="go" disabled={!lines.length} onclick={toPay}>
			<span class="fig">Cobrar {money(total)}</span>
			<small>{lines.length ? 'Elegir pago' : 'Cuenta vacía'}</small>
		</button>
	</div>
{/if}

<style>
	.twin-back {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgb(0 0 0 / 0.6);
	}
	.twin {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 41;
		display: grid;
		gap: 10px;
		max-width: 560px;
		margin: 0 auto;
		padding: 20px var(--gutter) calc(20px + env(safe-area-inset-bottom));
		border-top: 3px solid var(--amber);
		border-radius: var(--r) var(--r) 0 0;
		background: var(--wood);
	}
	.twin h2 {
		font-size: var(--fs-fig-md);
		color: var(--amber);
	}
	.twin p {
		margin: 0;
		font-size: var(--fs-sm);
	}
	.twin b {
		display: block;
		margin-top: 4px;
		font-size: var(--fs-md);
	}
	.twin .dim {
		color: var(--foam-dim);
		font-size: var(--fs-xs);
	}
	.opening {
		padding: 0 var(--gutter) 14px;
	}
	.today {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
		padding: 2px var(--gutter) 12px;
		border-bottom: 1px solid var(--line);
	}
	.today > div {
		display: grid;
		gap: 4px;
	}
	.total {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
	}
	.cuts {
		font-size: var(--fs-fig-md);
		color: var(--amber);
	}
	.block {
		padding: 14px 12px 0;
	}
	.closed-note {
		padding: 10px var(--gutter);
		border-bottom: 1px solid var(--line);
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.block > h2 {
		padding: 0 4px 8px;
	}
	.heading {
		font-size: 1.25rem;
	}
	.note {
		padding: 4px;
		color: var(--foam-dim);
		font-size: var(--fs-sm);
	}
	.err {
		color: var(--danger-text);
	}
	.tabs {
		display: flex;
		gap: 6px;
		padding: 0 4px;
	}
	.tabs button {
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			background-color var(--t-fast),
			color var(--t-fast);
	}
	.tabs button:hover {
		color: var(--foam);
		border-color: var(--line-strong);
	}
	.tabs button[aria-selected='true'] {
		background: var(--foam);
		border-color: var(--foam);
		color: var(--bg);
	}
	.hint {
		min-height: 1.6em;
		padding: 4px 4px 2px;
		font-size: var(--fs-sm);
		color: var(--amber);
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding: 0 4px;
	}
	.item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 8px;
		min-height: var(--tap);
		padding: 8px 12px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
		text-align: left;
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast),
			transform var(--t-fast);
	}
	.item:hover {
		background: var(--wood-raised);
		border-color: var(--line-strong);
	}
	.item:active {
		transform: scale(0.97);
		background: var(--blue);
		border-color: var(--blue);
	}
	.item .name {
		font-weight: 700;
		font-size: var(--fs-sm);
		line-height: 1.2;
	}
	.item .left {
		display: block;
		margin-top: 2px;
		font-size: var(--fs-xs);
		font-weight: 700;
		color: var(--amber);
	}
	.item .left.out {
		color: var(--danger-text);
	}
	.price {
		font-size: var(--fs-fig-sm);
		color: var(--foam-dim);
	}
	.held {
		padding: 16px var(--gutter) 0;
	}
	.chips {
		display: flex;
		gap: 6px;
		margin-top: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.chips button {
		display: grid;
		gap: 2px;
		flex: none;
		min-height: var(--tap);
		padding: 6px 12px;
		border: 1px dashed var(--line-strong);
		border-radius: var(--r);
		background: none;
		text-align: left;
		transition:
			border-color var(--t-fast),
			background-color var(--t-fast);
	}
	.chips button:hover {
		border-color: var(--foam-faint);
		background: var(--wood);
	}
	.chips .who {
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.chips .sub {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.chips b {
		font-size: var(--fs-fig-sm);
	}
	.bill {
		margin: 16px 12px 0;
		padding: 10px 12px 12px;
		background: var(--wood);
		border: 1px solid var(--line);
		border-top: 3px solid var(--amber);
		border-radius: 0;
	}
	.bill h2 {
		display: flex;
		justify-content: space-between;
		font-weight: 700;
		font-size: var(--fs-sm);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-bottom: 6px;
	}
	.bill .meta {
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
		color: var(--foam-dim);
	}
	.bill ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.bill li {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		border-bottom: 1px dashed var(--line);
		animation: line-in var(--t-fast) var(--ease-out);
	}
	.bill li:last-child {
		border-bottom: 0;
	}
	.what {
		flex: 1;
		font-size: var(--fs-sm);
	}
	.what em {
		font-style: normal;
		color: var(--foam-dim);
		font-size: var(--fs-xs);
		margin-left: 6px;
	}
	.bill li .fig {
		font-size: var(--fs-fig-sm);
	}
	.minus {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
	}
	.minus:hover {
		color: var(--foam);
		border-color: var(--foam-faint);
	}
	.minus svg {
		width: 16px;
		height: 16px;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
	}
	.billactions {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--line);
	}
	.billactions button {
		height: 40px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
		transition: color var(--t-fast);
	}
	.billactions button:hover {
		color: var(--foam);
	}
	.charge {
		padding: 12px 12px 10px;
	}
	/* With something to charge, Cobrar rides on top of the tab bar so the total stays in sight.
	   An empty bill keeps it in the flow, so it never covers the bill panel. */
	.charge.pinned {
		position: sticky;
		z-index: 5;
		bottom: var(--tabbar-h);
		padding-top: 16px;
		background: linear-gradient(transparent, var(--bg) 14px);
	}
	.go {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		min-height: 64px;
		padding: 0 16px;
		border: 0;
		border-radius: var(--r);
		background: var(--red);
		color: #fff;
		box-shadow: 0 3px 0 var(--red-lip);
		transition:
			background-color var(--t-fast),
			transform var(--t-fast),
			box-shadow var(--t-fast);
	}
	.go:hover:not(:disabled) {
		background: var(--red-hover);
	}
	.go:active:not(:disabled) {
		transform: translateY(3px);
		box-shadow: 0 0 0 var(--red-lip);
	}
	.go .fig {
		font-size: var(--fs-fig-md);
		font-weight: 900;
	}
	.go small {
		font-size: var(--fs-xs);
		font-weight: 700;
		text-align: right;
	}
	.go:disabled {
		background: var(--red-lip);
		color: var(--foam-dim);
		box-shadow: 0 3px 0 var(--red-lip-deep);
	}
	.skeleton {
		margin: 0 4px;
		border-radius: var(--r);
		background: linear-gradient(90deg, var(--wood) 30%, var(--wood-raised) 50%, var(--wood) 70%) 0 0 / 300% 100%;
		animation: shimmer 1.4s linear infinite;
	}
	.lineup-sk {
		height: 112px;
	}
	.grid-sk {
		height: 160px;
	}
	@keyframes shimmer {
		to {
			background-position: -300% 0;
		}
	}
	@keyframes line-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
</style>
