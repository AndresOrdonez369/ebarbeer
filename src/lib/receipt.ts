// Receipt text and the WhatsApp link. Pure functions: tested with `npm run test:unit`.

/** Placeholders the admin can use in the receipt template, with what each one becomes. */
export const PLACEHOLDERS = [
	{ key: 'local', hint: 'Nombre del local' },
	{ key: 'numero', hint: 'Número de boleta' },
	{ key: 'fecha', hint: 'Fecha y hora' },
	{ key: 'lineas', hint: 'Lo que consumió, una línea por ítem' },
	{ key: 'total', hint: 'Total pagado' },
	{ key: 'pago', hint: 'Cómo pagó' },
	{ key: 'saludo', hint: '"Gracias, Andrés." o "¡Gracias!"' },
	{ key: 'barbero', hint: 'Quién lo atendió' },
	{ key: 'enlace', hint: 'Enlace a la boleta' }
] as const;

export const DEFAULT_TEMPLATE = `*{local}* · Boleta N.º {numero}
{fecha}

{lineas}

*Total: {total}* · {pago}

{saludo} Te atendió {barbero}.
Tu boleta: {enlace}`;

export interface ReceiptData {
	shop: string;
	receiptNo: number;
	createdAt: string;
	lines: { name: string; qty: number; total: number; barber: string | null }[];
	total: number;
	payments: { method: 'cash' | 'transfer' | 'card'; amount: number }[];
	customerName: string | null;
	link: string;
}

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const money = (n: number) => `$${pesos.format(n)}`;
const methodName = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' } as const;
const dateFmt = new Intl.DateTimeFormat('es-CO', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: 'numeric',
	minute: '2-digit'
});

export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';

/** Fills the template. Unknown placeholders are left as typed so the admin sees the mistake. */
export function buildReceiptMessage(template: string | null | undefined, d: ReceiptData): string {
	const barbers = [...new Set(d.lines.map((l) => l.barber).filter(Boolean))] as string[];
	const name = firstName(d.customerName);
	const values: Record<string, string> = {
		local: d.shop,
		numero: String(d.receiptNo).padStart(4, '0'),
		fecha: dateFmt.format(new Date(d.createdAt)),
		lineas: d.lines
			.map((l) => `${l.name}${l.qty > 1 ? ` × ${l.qty}` : ''}${l.barber ? ` (${l.barber})` : ''} — ${money(l.total)}`)
			.join('\n'),
		total: money(d.total),
		pago: [...new Set(d.payments.map((p) => methodName[p.method]))].join(' + '),
		saludo: name ? `Gracias, ${name}.` : '¡Gracias!',
		barbero: barbers.length ? barbers.join(' y ') : 'el equipo de ' + d.shop,
		enlace: d.link
	};
	const text = (template?.trim() ? template : DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (m, k: string) =>
		k in values ? values[k] : m
	);
	return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Same rules as the database's normalize_phone: what a cashier types becomes digits with the
 * country code. A bare 10-digit number starting with 3 is a Colombian mobile. Returns null if invalid.
 */
export function normalizePhone(raw: string): string | null {
	let d = raw.replace(/[^0-9]/g, '');
	if (d.length === 10 && d.startsWith('3')) d = '57' + d;
	return /^[1-9][0-9]{7,14}$/.test(d) ? d : null;
}

/** "573005550147" → "300 555 0147" for Colombian mobiles, "+<digits>" otherwise. */
export function prettyPhone(phone: string): string {
	const d = phone.replace(/[^0-9]/g, '');
	if (d.length === 12 && d.startsWith('573')) return `${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
	return '+' + d;
}

/** Link that opens WhatsApp with the chat and the message ready; the cashier only taps Send. */
export function whatsappLink(phone: string, message: string): string {
	const d = phone.replace(/[^0-9]/g, '');
	return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}
