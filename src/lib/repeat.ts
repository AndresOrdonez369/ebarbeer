// Telling a bill charged twice by mistake from a second customer.
// Mirrors public._twin_sale: same items, same barbers, same quantities, within 15 minutes when a
// barber served it (nobody does the same cut twice that fast) and 2 minutes for drinks and products
// alone (two customers often order the same beer).

/** One line of a bill: `key` is the item (its id, or its name when only that is known). */
export type TwinLine = { key: string; barberId: string | null; qty: number };
export type TwinBill = { at: string; lines: TwinLine[] };

export const REPEAT_SERVED_MS = 15 * 60_000;
export const REPEAT_ALONE_MS = 2 * 60_000;

/** The same bill gives the same key whatever the order or split of its lines. */
export function billKey(lines: TwinLine[]): string {
	const qty = new Map<string, number>();
	for (const l of lines) {
		const k = `${l.key}|${l.barberId ?? ''}`;
		qty.set(k, (qty.get(k) ?? 0) + l.qty);
	}
	return [...qty]
		.map(([k, q]) => `${k}|${q}`)
		.sort()
		.join(',');
}

export const repeatWindow = (lines: TwinLine[]) => (lines.some((l) => l.barberId) ? REPEAT_SERVED_MS : REPEAT_ALONE_MS);

/** The newest bill in `earlier` that `bill` repeats, if any. */
export function findTwin<T extends TwinBill>(bill: TwinBill, earlier: T[]): T | null {
	const key = billKey(bill.lines);
	const window = repeatWindow(bill.lines);
	const at = Date.parse(bill.at);
	let best: T | null = null;
	for (const e of earlier) {
		const t = Date.parse(e.at);
		if (t > at || at - t > window) continue;
		if (billKey(e.lines) !== key) continue;
		if (!best || t > Date.parse(best.at)) best = e;
	}
	return best;
}
