// Bills waiting to reach the server. A charge is written here first, then sent; if the Wi-Fi
// drops it stays here (and in localStorage) and goes out by itself when the network returns.
// Safe to retry because register_sale is idempotent on the bill id generated on this phone.
import { backend } from './session.svelte.js';
import {
	AppError,
	NetworkError,
	type BillLineInput,
	type ChargeResult,
	type CustomerInput,
	type PaymentInput,
	type SaleRecord
} from './types.js';

export interface Pending {
	id: string;
	lines: BillLineInput[];
	payments: PaymentInput[];
	customer: CustomerInput | null;
	/** What the "Hoy" list and the mugs show until the server confirms. */
	preview: SaleRecord;
	/** Cuts this bill adds per barber, for the optimistic mugs. */
	cuts: Record<string, number>;
	status: 'pending' | 'failed';
	error?: string;
}

const KEY = 'barbeer-outbox';

function load(): Pending[] {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as Pending[]) : [];
	} catch {
		return [];
	}
}

export const outbox = $state({ items: load(), sending: false });

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(outbox.items));
	} catch {
		/* storage blocked: the queue still works for this session */
	}
}

/**
 * Charges a bill. Returns the server result, or null when it was queued for later (offline).
 * Throws AppError when the server refused the bill (nothing is queued then).
 */
export async function charge(p: Omit<Pending, 'status'>): Promise<ChargeResult | null> {
	outbox.items.unshift({ ...p, status: 'pending' });
	save();
	try {
		const r = await backend.registerSale(p.id, p.lines, p.payments, p.customer);
		remove(p.id);
		return r;
	} catch (e) {
		if (e instanceof NetworkError) return null;
		remove(p.id);
		throw e;
	}
}

export function remove(id: string) {
	const i = outbox.items.findIndex((x) => x.id === id);
	if (i >= 0) outbox.items.splice(i, 1);
	save();
}

/** Sends every queued bill. A bill the server refuses is kept as failed for the cashier to see. */
export async function flush(): Promise<void> {
	if (outbox.sending || !outbox.items.some((x) => x.status === 'pending')) return;
	outbox.sending = true;
	try {
		for (const item of [...outbox.items].reverse()) {
			if (item.status !== 'pending') continue;
			try {
				await backend.registerSale(item.id, item.lines, item.payments, item.customer ?? null);
				remove(item.id);
			} catch (e) {
				if (e instanceof NetworkError) break;
				const it = outbox.items.find((x) => x.id === item.id);
				if (it) {
					it.status = 'failed';
					it.error = e instanceof AppError ? e.message : 'El servidor rechazó la cuenta.';
				}
				save();
			}
		}
	} finally {
		outbox.sending = false;
	}
}

let started = false;
/** Retry on reconnect and every 20 s. Call once from the register layout. */
export function startOutbox() {
	if (started) return;
	started = true;
	addEventListener('online', () => flush());
	setInterval(() => flush(), 20000);
	flush();
}
