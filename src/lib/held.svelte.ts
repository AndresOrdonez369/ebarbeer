// Bills put on hold at the register ("en espera"): the cashier is interrupted, parks the
// customer's bill, serves someone else, and picks it up again. Kept on this phone only.
import type { CatalogItem } from './types.js';

export type Line = { key: string; item: CatalogItem; barberId: string | null; barber: string | null; qty: number };
export interface HeldBill {
	id: string;
	at: string;
	lines: Line[];
}

const KEY = 'barbeer-held';

function load(): HeldBill[] {
	try {
		const raw = localStorage.getItem(KEY);
		return raw ? (JSON.parse(raw) as HeldBill[]) : [];
	} catch {
		return [];
	}
}

export const held = $state({ bills: load() });

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(held.bills));
	} catch {
		/* storage blocked: holding still works until reload */
	}
}

export function hold(lines: Line[]) {
	if (!lines.length) return;
	held.bills.push({ id: crypto.randomUUID(), at: new Date().toISOString(), lines: structuredClone($state.snapshot(lines)) as Line[] });
	save();
}

/** Takes a held bill out, refreshing item prices from the current catalog. */
export function take(id: string, catalog: CatalogItem[]): Line[] {
	const i = held.bills.findIndex((b) => b.id === id);
	// Without a catalog every line would drop: leave the bill parked.
	if (i < 0 || !catalog.length) return [];
	const [bill] = held.bills.splice(i, 1);
	save();
	const byId = new Map(catalog.map((c) => [c.id, c]));
	return bill.lines.filter((l) => byId.has(l.item.id)).map((l) => ({ ...l, item: byId.get(l.item.id)! }));
}

export const heldTotal = (b: HeldBill) => b.lines.reduce((s, l) => s + l.item.price * l.qty, 0);

// The bill being built right now, so a reload, a crash or an expired login does not lose it.
const DRAFT = 'barbeer-draft';

export function saveDraft(lines: Line[]) {
	try {
		if (lines.length) localStorage.setItem(DRAFT, JSON.stringify(lines));
		else localStorage.removeItem(DRAFT);
	} catch {
		/* storage blocked */
	}
}

/** The saved bill, with prices from the current catalog; items no longer sold are dropped. */
export function loadDraft(catalog: CatalogItem[]): Line[] {
	try {
		const raw = localStorage.getItem(DRAFT);
		if (!raw) return [];
		const byId = new Map(catalog.map((c) => [c.id, c]));
		return (JSON.parse(raw) as Line[]).filter((l) => byId.has(l.item.id)).map((l) => ({ ...l, item: byId.get(l.item.id)! }));
	} catch {
		return [];
	}
}
