const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** 438000 → "$ 438.000" */
export const money = (n: number) => `$ ${pesos.format(n)}`;

/** Like money, but the sign never wraps away from the figure inside running text. */
export const moneyNb = (n: number) => `$ ${pesos.format(n)}`;

/** 438000 → "438.000" (for columns already labelled in pesos) */
export const amount = (n: number) => pesos.format(n);

const dayFmt = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });

/** → "Mar 10 nov" */
export function shortDate(d = new Date()) {
	const s = dayFmt
		.formatToParts(d)
		.filter((p) => p.type !== 'literal')
		.map((p) => p.value.replace('.', ''))
		.join(' ');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export const roleLabel = { admin: 'Administración', cashier: 'Caja', barber: 'Barbero' } as const;

const timeFmt = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });

/** ISO → "6:42 p. m." */
export const clock = (iso: string) => timeFmt.format(new Date(iso));

export const methodLabel = { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta' } as const;

/** "2026-11-10" (a business date, no time zone) → Date at local noon, safe from day shifts. */
export const fromIsoDate = (d: string) => new Date(d.slice(0, 10) + 'T12:00:00');

export const toIsoDate = (d: Date) =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "2026-11-10", -1 → "2026-11-09" */
export function addDays(d: string, n: number) {
	const x = fromIsoDate(d);
	x.setDate(x.getDate() + n);
	return toIsoDate(x);
}

export type PeriodKind = 'day' | 'week' | 'month';

/** A day, a Monday-to-Sunday week or a calendar month, `offset` periods away from the one with `today`. */
export function periodRange(today: string, kind: PeriodKind, offset = 0): { from: string; to: string } {
	if (kind === 'day') {
		const d = addDays(today, offset);
		return { from: d, to: d };
	}
	if (kind === 'week') {
		const t = fromIsoDate(today);
		const monday = addDays(today, -((t.getDay() + 6) % 7) + 7 * offset);
		return { from: monday, to: addDays(monday, 6) };
	}
	const m = fromIsoDate(today.slice(0, 8) + '01');
	m.setMonth(m.getMonth() + offset);
	const end = new Date(m.getFullYear(), m.getMonth() + 1, 0, 12);
	return { from: toIsoDate(m), to: toIsoDate(end) };
}

/** "Hoy", "Ayer", "Esta semana · 9 nov – 15 nov", "Noviembre 2026"… */
export function periodLabel(kind: PeriodKind, offset: number, r: { from: string; to: string }) {
	if (kind === 'day') return offset === 0 ? `Hoy · ${dayLabel(r.from)}` : offset === -1 ? `Ayer · ${dayLabel(r.from)}` : dayLabel(r.from);
	if (kind === 'week')
		return `${offset === 0 ? 'Esta semana' : offset === -1 ? 'Semana pasada' : 'Semana'} · ${rangeLabel(r.from, r.to)}`;
	return monthLabel(r.from);
}

/** "2026-11-10" → "Mar 10 nov" */
export const dayLabel = (d: string) => shortDate(fromIsoDate(d));

const longFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });
/** "2025-06-02" → "2 de junio de 2025" */
export const longDate = (d: string) => longFmt.format(fromIsoDate(d));

const monthFmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
/** "2026-11-01" → "Noviembre 2026" */
export function monthLabel(d: string) {
	const s = monthFmt.format(fromIsoDate(d)).replace(' de ', ' ');
	return s.charAt(0).toUpperCase() + s.slice(1);
}

const rangeFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
/** "2026-11-09", "2026-11-15" → "9 nov – 15 nov" */
export const rangeLabel = (a: string, b: string) =>
	`${rangeFmt.format(fromIsoDate(a)).replace('.', '')} – ${rangeFmt.format(fromIsoDate(b)).replace('.', '')}`;
