// Pure money logic for the register. No framework, no I/O: tested with `npm run test:unit`.

export type Method = 'cash' | 'transfer' | 'card';

export interface Split {
	method: Method;
	amount: number;
	cashReceived?: number | null;
}

/** "50.000" or "$ 50 000" → 50000. Anything without digits → 0. */
export function parsePesos(input: string): number {
	const d = input.replace(/[^0-9]/g, '');
	return d ? Math.min(Number(d), 99_999_999) : 0;
}

/** Change to hand back in cash. Never negative. */
export function changeDue(cashAmount: number, received: number): number {
	return Math.max(received - cashAmount, 0);
}

/** One-tap cash amounts a customer usually hands over, above the amount due. */
export function quickCash(due: number): number[] {
	if (due <= 0) return [];
	const out = new Set<number>([due]);
	for (const step of [10000, 20000, 50000, 100000]) {
		const up = Math.ceil(due / step) * step;
		if (up > due) out.add(up);
	}
	return [...out].sort((a, b) => a - b).slice(0, 4);
}

/**
 * Checks a payment plan against the bill total. Returns the problem in the cashier's words,
 * or null when it can be charged.
 */
export function paymentProblem(total: number, splits: Split[]): string | null {
	const used = splits.filter((s) => s.amount > 0);
	if (!used.length) return 'Escribe cuánto se paga.';
	const paid = used.reduce((s, x) => s + x.amount, 0);
	if (paid < total) return `Faltan $ ${fmt(total - paid)}.`;
	if (paid > total) return `Sobran $ ${fmt(paid - total)}. El pago debe sumar exacto el total.`;
	const cash = used.find((s) => s.method === 'cash');
	if (cash && cash.cashReceived != null && cash.cashReceived > 0 && cash.cashReceived < cash.amount)
		return `El efectivo recibido no alcanza: faltan $ ${fmt(cash.amount - cash.cashReceived)}.`;
	return null;
}

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
function fmt(n: number) {
	return nf.format(n);
}
