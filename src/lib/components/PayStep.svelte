<!-- Second step at the register: how the customer pays. One method, or split across several. -->
<script lang="ts">
	import { changeDue, parsePesos, paymentProblem, quickCash, type Method, type Split } from '../bill.js';
	import { amount, methodLabel, money } from '../format.js';
	import { normalizePhone, prettyPhone } from '../receipt.js';
	import { backend } from '../session.svelte.js';
	import type { Customer, CustomerInput, PaymentInput } from '../types.js';

	let {
		total,
		count,
		busy,
		error,
		oncancel,
		onconfirm
	}: {
		total: number;
		count: number;
		busy: boolean;
		error: string;
		oncancel: () => void;
		onconfirm: (payments: PaymentInput[], change: number, customer: CustomerInput | null) => void;
	} = $props();

	type Mode = Method | 'mixed';
	const modes: { id: Mode; label: string }[] = [
		{ id: 'cash', label: 'Efectivo' },
		{ id: 'transfer', label: 'Transferencia' },
		{ id: 'card', label: 'Tarjeta' },
		{ id: 'mixed', label: 'Mixto' }
	];
	const methods: Method[] = ['cash', 'transfer', 'card'];

	let mode = $state<Mode>('cash');
	let receivedText = $state('');
	let split = $state<Record<Method, string>>({ cash: '', transfer: '', card: '' });

	const received = $derived(parsePesos(receivedText));
	const splits = $derived<Split[]>(
		mode === 'mixed'
			? methods.map((m) => ({
					method: m,
					amount: parsePesos(split[m]),
					cashReceived: m === 'cash' && received ? received : null
				}))
			: [{ method: mode, amount: total, cashReceived: mode === 'cash' && received ? received : null }]
	);
	const cashPart = $derived(splits.find((s) => s.method === 'cash')?.amount ?? 0);
	const problem = $derived(paymentProblem(total, splits));
	const change = $derived(cashPart && received ? changeDue(cashPart, received) : 0);
	const remaining = $derived(total - splits.reduce((s, x) => s + x.amount, 0));
	const quick = $derived(quickCash(cashPart || total));
	const showCash = $derived(mode === 'cash' || (mode === 'mixed' && cashPart > 0));

	// Customer for the WhatsApp receipt. Optional: a bill can be charged without one.
	let phone = $state('');
	let name = $state('');
	let promo = $state(false);
	// Consent is only sent when the cashier actually answered; otherwise the stored answer stands.
	let promoTouched = $state(false);
	let matches = $state<Customer[]>([]);
	let picked = $state<Customer | null>(null);

	const phoneDigits = $derived(phone.replace(/[^0-9]/g, ''));
	const phoneOk = $derived(!phoneDigits || !!normalizePhone(phone));
	const phoneProblem = $derived(
		phoneDigits.length >= 10 && !phoneOk ? 'El WhatsApp no parece válido. Corrígelo o bórralo para cobrar sin boleta.' : null
	);
	const phoneIncomplete = $derived(phoneDigits.length > 0 && phoneDigits.length < 10);

	$effect(() => {
		const d = phoneDigits;
		if (picked || d.length < 4) {
			matches = [];
			return;
		}
		const t = setTimeout(() => {
			backend
				.searchCustomers(d)
				.then((r) => (matches = r))
				.catch(() => (matches = []));
		}, 250);
		return () => clearTimeout(t);
	});

	function pickCustomer(c: Customer) {
		picked = c;
		phone = prettyPhone(c.phone);
		name = c.name ?? '';
		promo = !!c.promo;
		promoTouched = false;
		matches = [];
	}

	function editPhone(e: Event) {
		phone = (e.currentTarget as HTMLInputElement).value;
		if (picked) {
			picked = null;
			promo = false;
			promoTouched = false;
		}
	}

	function rest(m: Method) {
		const others = methods.filter((x) => x !== m).reduce((s, x) => s + parsePesos(split[x]), 0);
		split[m] = amount(Math.max(total - others, 0));
	}

	function typed(e: Event, set: (v: string) => void) {
		const n = parsePesos((e.currentTarget as HTMLInputElement).value);
		set(n ? amount(n) : '');
	}

	const blocker = $derived(
		problem ?? phoneProblem ?? (phoneIncomplete ? 'Completa el WhatsApp (10 dígitos) o bórralo para cobrar sin boleta.' : null)
	);

	function confirm() {
		if (blocker || busy) return;
		onconfirm(
			splits
				.filter((s) => s.amount > 0)
				.map((s) => ({ method: s.method, amount: s.amount, cashReceived: s.cashReceived ?? null })),
			change,
			phoneDigits ? { phone, name: name.trim() || null, promo: promoTouched ? promo : null } : null
		);
	}
</script>

<section class="pay" aria-labelledby="pay-title">
	<div class="top">
		<button type="button" class="back" onclick={oncancel} disabled={busy}>
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
			Volver a la cuenta
		</button>
		<span class="meta">{count} {count === 1 ? 'ítem' : 'ítems'}</span>
	</div>

	<h1 id="pay-title" class="fig">Cobro</h1>
	<p class="due"><span class="label">Total a pagar</span><span class="fig amount">{money(total)}</span></p>

	<div class="modes" role="radiogroup" aria-label="Método de pago">
		{#each modes as m (m.id)}
			<button type="button" role="radio" aria-checked={mode === m.id} onclick={() => (mode = m.id)} disabled={busy}>
				{m.label}
			</button>
		{/each}
	</div>

	{#if mode === 'mixed'}
		<div class="split">
			{#each methods as m (m)}
				<label class="row">
					<span class="name">{methodLabel[m]}</span>
					<input
						inputmode="numeric"
						autocomplete="off"
						placeholder="0"
						value={split[m]}
						oninput={(e) => typed(e, (v) => (split[m] = v))}
						disabled={busy}
					/>
					<button type="button" class="restbtn" onclick={() => rest(m)} disabled={busy}>Resto</button>
				</label>
			{/each}
			<p class="left" class:ok={remaining === 0}>
				{#if remaining > 0}Faltan {money(remaining)}{:else if remaining < 0}Sobran {money(-remaining)}{:else}Suma exacta{/if}
			</p>
		</div>
	{/if}

	{#if showCash}
		<div class="cash">
			<label class="recv">
				<span class="label">Efectivo recibido</span>
				<input
					inputmode="numeric"
					autocomplete="off"
					placeholder={amount(cashPart || total)}
					value={receivedText}
					oninput={(e) => typed(e, (v) => (receivedText = v))}
					disabled={busy}
				/>
			</label>
			<div class="quick" aria-label="Montos rápidos" style:--n={quick.length}>
				{#each quick as q (q)}
					<button type="button" onclick={() => (receivedText = amount(q))} disabled={busy}>
						{q === (cashPart || total) ? 'Exacto' : amount(q)}
					</button>
				{/each}
			</div>
			<p class="change" aria-live="polite">
				<span class="label">Vueltas</span>
				<span class="fig">{received ? money(change) : '—'}</span>
			</p>
		</div>
	{/if}

	<section class="cust" aria-labelledby="cust-title">
		<h2 id="cust-title" class="fig heading">Boleta por WhatsApp</h2>
		<label class="field">
			<span class="label">WhatsApp del cliente (opcional)</span>
			<input
				type="tel"
				inputmode="tel"
				autocomplete="off"
				placeholder="300 555 0147"
				value={phone}
				oninput={editPhone}
				disabled={busy}
			/>
		</label>
		{#if matches.length}
			<ul class="matches" aria-label="Clientes que coinciden">
				{#each matches as c (c.id)}
					<li>
						<button type="button" onclick={() => pickCustomer(c)}>
							<b>{c.name ?? 'Sin nombre'}</b><span>{prettyPhone(c.phone)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if phoneDigits.length >= 4}
			<label class="field">
				<span class="label">Nombre</span>
				<input bind:value={name} autocomplete="off" autocapitalize="words" placeholder="Andrés" disabled={busy} />
			</label>
			<label class="check">
				<input type="checkbox" bind:checked={promo} onchange={() => (promoTouched = true)} disabled={busy} />
				<span>
					Acepta recibir promociones por WhatsApp
					{#if picked && !promoTouched}<small>{picked.promo ? 'Ya lo había aceptado' : 'No lo ha aceptado'}</small>{/if}
				</span>
			</label>
		{:else}
			<p class="hint">Sin número, se cobra igual y no se envía boleta.</p>
		{/if}
	</section>

	<p class="problem" role="alert">
		{error || (mode === 'mixed' || received || phoneDigits.length >= 10 ? (blocker ?? '') : '')}
	</p>

	<div class="charge">
		<button type="button" class="go" onclick={confirm} disabled={!!blocker || busy}>
			<span class="fig">{busy ? 'Cobrando…' : `Cobrar ${money(total)}`}</span>
			<small>{change > 0 ? `Vueltas ${money(change)}` : mode === 'mixed' ? 'Pago mixto' : methodLabel[mode]}</small>
		</button>
	</div>
</section>

<style>
	.pay {
		padding: 4px var(--gutter) 0;
		animation: step-in var(--t-fast) var(--ease-out);
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 40px;
		margin-left: -8px;
		padding: 0 8px;
		border: 0;
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	.back:hover:not(:disabled) {
		color: var(--foam);
		background: var(--wood);
	}
	.back svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.meta {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	h1 {
		margin-top: 8px;
		font-size: var(--fs-fig-lg);
	}
	.due {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin: 12px 0 16px;
		padding: 12px 0;
		border-top: 1px solid var(--line);
		border-bottom: 1px solid var(--line);
	}
	.amount {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
	}
	.modes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}
	.modes button {
		min-height: var(--tap);
		padding: 0 4px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			background-color var(--t-fast),
			color var(--t-fast),
			border-color var(--t-fast);
	}
	.modes button:hover:not(:disabled) {
		color: var(--foam);
		border-color: var(--line-strong);
	}
	.modes button[aria-checked='true'] {
		background: var(--blue);
		border-color: var(--blue);
		color: #fff;
	}
	.split {
		margin-top: 14px;
		display: grid;
		gap: 8px;
	}
	.row {
		display: grid;
		grid-template-columns: 7.5rem 1fr auto;
		align-items: center;
		gap: 8px;
	}
	.name {
		font-weight: 700;
		font-size: var(--fs-sm);
	}
	input {
		width: 100%;
		height: 52px;
		padding: 0 14px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		font: 800 var(--fs-fig-sm) / 1 var(--font-display);
		text-align: right;
		transition: border-color var(--t-fast);
	}
	input::placeholder {
		color: var(--foam-faint);
	}
	input:hover:not(:disabled) {
		border-color: var(--foam-faint);
	}
	input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.restbtn,
	.quick button {
		height: 40px;
		padding: 0 12px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			color var(--t-fast),
			border-color var(--t-fast),
			background-color var(--t-fast);
	}
	.restbtn:hover:not(:disabled),
	.quick button:hover:not(:disabled) {
		color: var(--foam);
		border-color: var(--foam-faint);
		background: var(--wood);
	}
	.left {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		text-align: right;
	}
	.left.ok {
		color: var(--foam);
	}
	.cash {
		margin-top: 16px;
	}
	.recv {
		display: grid;
		gap: 6px;
	}
	.quick {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: 6px;
		margin-top: 8px;
	}
	.quick button {
		height: var(--tap);
		padding: 0 4px;
	}
	.change {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-top: 14px;
	}
	.change .fig {
		font-size: var(--fs-fig-lg);
		font-weight: 900;
		color: var(--amber);
	}
	.cust {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--line);
		display: grid;
		gap: 10px;
	}
	.heading {
		font-size: 1.25rem;
	}
	.field {
		display: grid;
		gap: 6px;
	}
	.field input {
		font: 500 1.125rem / 1 var(--font-ui);
		text-align: left;
	}
	.matches {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
	}
	.matches button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		min-height: var(--tap);
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: var(--r);
		background: var(--wood);
		text-align: left;
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	.matches button:hover {
		background: var(--wood-raised);
		border-color: var(--line-strong);
	}
	.matches span {
		color: var(--foam-dim);
		font-size: var(--fs-sm);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--tap);
		font-size: var(--fs-sm);
	}
	.check span {
		display: grid;
		gap: 2px;
	}
	.check small {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	.check input {
		appearance: none;
		flex: none;
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		margin: 0;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	.check input::after {
		content: '';
		width: 12px;
		height: 7px;
		border-left: 2.5px solid var(--amber-ink);
		border-bottom: 2.5px solid var(--amber-ink);
		transform: translateY(-2px) rotate(-45deg) scale(0);
		transition: transform var(--t-fast) var(--ease-out);
	}
	.check input:checked {
		background: var(--amber);
		border-color: var(--amber);
	}
	.check input:checked::after {
		transform: translateY(-2px) rotate(-45deg) scale(1);
	}
	.check input:hover:not(:disabled) {
		border-color: var(--foam-faint);
	}
	.hint {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.problem {
		min-height: 1.4em;
		margin: 10px 0 6px;
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.charge {
		position: sticky;
		z-index: 5;
		bottom: var(--tabbar-h);
		margin: 0 calc(var(--gutter) * -1);
		padding: 14px var(--gutter) 10px;
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
	.go .fig {
		font-size: var(--fs-fig-md);
		font-weight: 900;
	}
	.go small {
		font-size: var(--fs-xs);
		font-weight: 700;
	}
	.go:hover:not(:disabled) {
		background: var(--red-hover);
	}
	.go:active:not(:disabled) {
		transform: translateY(3px);
		box-shadow: 0 0 0 var(--red-lip);
	}
	.go:disabled {
		background: var(--red-lip);
		color: var(--foam-dim);
		box-shadow: 0 3px 0 var(--red-lip-deep);
	}
	@keyframes step-in {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
	}
</style>
