<!--
  Sends the receipt from the register phone's own WhatsApp: the link opens the chat with the
  message already written; the cashier taps Send there. With no customer yet, asks for the number
  first (saving it is one tap, sending is the next, so the phone never blocks the WhatsApp window).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { clock } from '../format.js';
	import { buildReceiptMessage, normalizePhone, prettyPhone, whatsappLink } from '../receipt.js';
	import { ensureReceiptSettings, receiptSettings } from '../receipt-settings.svelte.js';
	import { backend } from '../session.svelte.js';
	import { AppError, type Customer, type PayMethod } from '../types.js';

	interface SaleForReceipt {
		id: string;
		receiptNo: number;
		receiptToken: string;
		createdAt: string;
		total: number;
		lines: { name: string; qty: number; total: number; barber: string | null }[];
		payments: { method: PayMethod; amount: number }[];
		customer: Customer | null;
		receiptSentAt?: string | null;
	}

	let {
		sale,
		compact = false,
		collapsible = false
	}: { sale: SaleForReceipt; compact?: boolean; collapsible?: boolean } = $props();

	// Seeded once from the bill; afterwards this component owns them (the cashier may change them here).
	let customer = $state<Customer | null>(untrack(() => sale.customer));
	let sentAt = $state<string | null>(untrack(() => sale.receiptSentAt ?? null));
	let editing = $state(false);
	let open = $state(untrack(() => !collapsible));
	let phone = $state('');
	let name = $state('');
	let busy = $state(false);
	let error = $state('');

	onMount(() => {
		ensureReceiptSettings();
	});

	const link = $derived(
		typeof location !== 'undefined' ? `${location.origin}/b/${sale.receiptToken}` : `/b/${sale.receiptToken}`
	);
	const message = $derived(
		buildReceiptMessage(receiptSettings.value?.template, {
			shop: receiptSettings.value?.shopName ?? 'Bar Beer',
			receiptNo: sale.receiptNo,
			createdAt: sale.createdAt,
			lines: sale.lines,
			total: sale.total,
			payments: sale.payments,
			customerName: customer?.name ?? null,
			link
		})
	);
	const href = $derived(customer ? whatsappLink(customer.phone, message) : '');

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!normalizePhone(phone)) {
			error = 'Número de WhatsApp no válido. Ej.: 300 555 0147';
			return;
		}
		busy = true;
		error = '';
		try {
			customer = await backend.setSaleCustomer(sale.id, { phone, name: name || null });
			editing = false;
		} catch (err) {
			error = err instanceof AppError ? err.message : 'No se pudo guardar el número.';
		} finally {
			busy = false;
		}
	}

	function sent() {
		sentAt = new Date().toISOString();
		backend.markReceiptSent(sale.id).catch(() => {});
	}
</script>

<div class="send" class:compact>
	{#if customer && !editing}
		<p class="to">
			<span>Para <b>{customer.name ?? 'cliente'}</b> · {prettyPhone(customer.phone)}</span>
			<button type="button" class="link" onclick={() => ((editing = true), (phone = ''), (name = customer?.name ?? ''))}>
				Cambiar
			</button>
		</p>
		<a class="wa" {href} target="_blank" rel="noopener" onclick={sent}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 20l1.4-4A8 8 0 1 1 8.6 19z" />
				<path d="M9 10h6M9 13.5h4" />
			</svg>
			<span class="fig">{sentAt ? 'Reenviar boleta' : 'Enviar boleta por WhatsApp'}</span>
		</a>
		{#if sentAt}<p class="ok">Abierta en WhatsApp a las {clock(sentAt)} · confirma allá que se envió</p>{/if}
	{:else if !open}
		<button type="button" class="add" onclick={() => (open = true)}>
			<svg viewBox="0 0 24 24" aria-hidden="true">
				<path d="M4 20l1.4-4A8 8 0 1 1 8.6 19z" />
				<path d="M12 9v6M9 12h6" />
			</svg>
			Agregar WhatsApp para enviar la boleta
		</button>
	{:else}
		<form onsubmit={save} novalidate>
			<label>
				<span class="label">WhatsApp del cliente</span>
				<input bind:value={phone} type="tel" inputmode="tel" autocomplete="off" placeholder="300 555 0147" disabled={busy} />
			</label>
			<label>
				<span class="label">Nombre (opcional)</span>
				<input bind:value={name} autocomplete="off" autocapitalize="words" placeholder="Andrés" disabled={busy} />
			</label>
			<p class="err" role="alert">{error}</p>
			<div class="row">
				<button type="submit" class="save" disabled={busy}>{busy ? 'Guardando…' : 'Guardar número'}</button>
				{#if editing}<button type="button" class="link" onclick={() => (editing = false)}>Cancelar</button>
				{:else if collapsible}<button type="button" class="link" onclick={() => (open = false)}>Cancelar</button>{/if}
			</div>
		</form>
	{/if}
	{#if customer || open}
		<a class="view" href={`/b/${sale.receiptToken}`} target="_blank" rel="noopener">Ver la boleta como la ve el cliente</a>
	{/if}
</div>

<style>
	.send {
		display: grid;
		gap: 10px;
	}
	.to {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 8px;
		font-size: var(--fs-sm);
		color: var(--foam-dim);
	}
	.to b {
		color: var(--foam);
	}
	.link {
		height: 40px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--foam-dim);
		font-weight: 700;
		font-size: var(--fs-sm);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.link:hover {
		color: var(--foam);
	}
	.wa {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		min-height: 60px;
		border-radius: var(--r);
		background: var(--foam);
		color: var(--bg);
		text-decoration: none;
		transition:
			background-color var(--t-fast),
			transform var(--t-fast);
	}
	.wa:hover {
		background: #fff;
	}
	.wa:active {
		transform: scale(0.98);
	}
	.wa .fig {
		font-size: var(--fs-fig-sm);
	}
	.compact .wa {
		min-height: 48px;
	}
	.wa svg {
		width: 22px;
		height: 22px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.add {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--tap);
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-weight: 700;
		font-size: var(--fs-sm);
		transition:
			background-color var(--t-fast),
			border-color var(--t-fast);
	}
	.add:hover {
		background: var(--wood);
		border-color: var(--foam-faint);
	}
	.add svg {
		width: 20px;
		height: 20px;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.ok {
		font-size: var(--fs-xs);
		color: var(--foam-dim);
	}
	form {
		display: grid;
		gap: 10px;
	}
	label {
		display: grid;
		gap: 6px;
	}
	input {
		height: 52px;
		padding: 0 14px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r);
		background: var(--wood);
		color: var(--foam);
		font-size: 1.125rem;
		transition: border-color var(--t-fast);
	}
	input::placeholder {
		color: var(--foam-faint);
	}
	input:focus-visible {
		outline: none;
		border-color: var(--amber);
		box-shadow: 0 0 0 1px var(--amber);
	}
	.err {
		min-height: 1.2em;
		font-size: var(--fs-sm);
		color: var(--danger-text);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.save {
		flex: 1;
		height: 52px;
		border: 1px solid var(--foam);
		border-radius: var(--r);
		background: none;
		color: var(--foam);
		font-weight: 700;
		transition: background-color var(--t-fast);
	}
	.save:hover:not(:disabled) {
		background: var(--wood-raised);
	}
	.view {
		font-size: var(--fs-sm);
		color: var(--foam-dim);
		justify-self: start;
	}
	.view:hover {
		color: var(--foam);
	}
</style>
