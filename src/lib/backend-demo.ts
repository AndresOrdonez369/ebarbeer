// In-memory example data (invented names, prices and phones) so the app can be shown before a
// Supabase project exists. Every figure here is synthetic. The demo's state lives in this tab's
// sessionStorage, so a reload (or opening a receipt link) keeps what was charged.
// Barbers' figures are derived from today's service lines, like the real day_board.
import {
	AppError,
	NetworkError,
	type Award,
	type Backend,
	type BoardRow,
	type BonusRule,
	type CatalogItem,
	type Closing,
	type Customer,
	type DayRow,
	type ItemKind,
	type PayMethod,
	type PayoutMethod,
	type Settlement,
	type Profile,
	type ReportLine,
	type ReportSummary,
	type Role,
	type SaleRecord,
	type StaffMember
} from './types.js';
import { normalizePhone } from './receipt.js';

const SHOP = { id: 'demo-shop', name: 'Bar Beer' };
const seedTeam: StaffMember[] = [
	{ id: 'd-admin', role: 'admin', name: 'Andrés', username: 'admin', hasAccess: true, active: true, cuts: false, dailyCutGoal: null, hiredOn: '2023-08-01' },
	{ id: 'd-luisa', role: 'cashier', name: 'Luisa', username: 'luisa', hasAccess: true, active: true, cuts: false, dailyCutGoal: null, hiredOn: '2024-05-06' },
	{ id: 'd-dago', role: 'barber', name: 'Dago', username: 'dago', hasAccess: true, active: true, cuts: true, dailyCutGoal: null, hiredOn: '2024-02-05' },
	{ id: 'd-kike', role: 'barber', name: 'Kike', username: 'kike', hasAccess: true, active: true, cuts: true, dailyCutGoal: null, hiredOn: '2025-06-02' },
	{ id: 'd-mono', role: 'barber', name: 'Mono', username: 'mono', hasAccess: true, active: true, cuts: true, dailyCutGoal: null, hiredOn: '2025-01-13' },
	{ id: 'd-brayan', role: 'barber', name: 'Brayan', username: 'brayan', hasAccess: false, active: true, cuts: true, dailyCutGoal: null, hiredOn: '2026-03-02' },
	{ id: 'd-jota', role: 'barber', name: 'Jota', username: null, hasAccess: false, active: true, cuts: true, dailyCutGoal: null, hiredOn: '2026-10-19' }
];

const seedItems: CatalogItem[] = [
	['service', 'Corte', 20000, 50, true],
	['service', 'Corte + barba', 30000, 50, true],
	['service', 'Barba', 12000, 50, false],
	['service', 'Cejas', 5000, 50, false],
	['service', 'Diseño', 8000, 50, false],
	['service', 'Corte niño', 15000, 50, true],
	['drink', 'Cerveza', 6000, 0, false],
	['drink', 'Cerveza artesanal', 9000, 0, false],
	['drink', 'Gaseosa', 3500, 0, false],
	['drink', 'Agua', 2500, 0, false],
	['product', 'Cera mate', 25000, 0, false],
	['product', 'Aceite de barba', 30000, 0, false],
	['product', 'Piercing', 35000, 0, false]
].map(([kind, name, price, pct, cut], i) => ({
	id: `d-item-${i}`,
	kind: kind as CatalogItem['kind'],
	name: name as string,
	price: price as number,
	commissionPct: pct as number,
	countsAsCut: cut as boolean,
	active: true,
	sortOrder: i
}));

// The demo's live state (assigned below from sessionStorage or a fresh example day).
let st = undefined as unknown as DemoState;

const barbers = () => st.team.filter((t) => t.cuts && t.active);
const nameOfId = (id: string) => st.team.find((t) => t.id === id)?.name ?? null;
const hiredOnOf = (id: string) => st.team.find((t) => t.id === id)?.hiredOn ?? todayIso();
const goalOf = (id: string) => st.team.find((t) => t.id === id)?.dailyCutGoal ?? st.shop.goal;
const itemById = (id: string) => st.items.find((i) => i.id === id);
const pctFor = (barberId: string, item: CatalogItem) =>
	st.overrides.find((o) => o.staffId === barberId && o.itemId === item.id)?.pct ?? item.commissionPct;

interface DemoLine {
	id: string;
	saleId: string | null;
	barberId: string;
	at: string;
	name: string;
	service: boolean;
	qty: number;
	total: number;
	commission: number;
	cut: boolean;
	status: 'ok' | 'void';
}

interface DemoSettlement {
	id: string;
	staffId: string;
	from: string;
	to: string;
	/** Business date it was paid on. */
	date: string;
	lineIds: string[];
	awards: { key: string; amount: number }[];
	commission: number;
	bonus: number;
	cuts: number;
	method: PayoutMethod;
	at: string;
	by: string | null;
}

interface DemoState {
	version: 6;
	team: StaffMember[];
	items: CatalogItem[];
	overrides: { staffId: string; itemId: string; pct: number }[];
	shop: { name: string; goal: number; cutoff: string };
	lines: DemoLine[];
	sales: SaleRecord[];
	customers: Customer[];
	base: { total: number; cash: number; transfer: number; card: number; bills: number };
	nextReceipt: number;
	template: string | null;
	rules: BonusRule[];
	/** Closings made in this demo; older days get a synthetic one. */
	closings: Closing[];
	/** Payments made at the register in this demo; past days are paid by the synthetic history. */
	settlements: DemoSettlement[];
	voids: Record<string, { at: string; by: string }>;
}

let lineSeq = 0;
function line(barberId: string, itemName: string, at: string, saleId: string | null = null, status: 'ok' | 'void' = 'ok'): DemoLine {
	const list = st ? st.items : seedItems;
	// Fall back to the first service if the admin renamed or removed the example item.
	const it = list.find((i) => i.name === itemName) ?? list.find((i) => i.kind === 'service') ?? seedItems[0];
	return {
		id: `d-l${++lineSeq}`,
		saleId,
		barberId,
		at,
		name: it.name,
		service: it.kind === 'service',
		qty: 1,
		total: it.price,
		commission: Math.round((it.price * it.commissionPct) / 100),
		cut: it.countsAsCut,
		status
	};
}

function fresh(): DemoState {
	const now = Date.now();
	const ago = (m: number) => new Date(now - m * 60000).toISOString();
	const andres = { id: 'd-c1', name: 'Andrés Pérez', phone: '+573005550147', promo: true };

	// Today's services per barber: [cuts, other services], spread over the afternoon.
	const plan: Record<string, [number, number]> = {
		'd-dago': [7, 2],
		'd-kike': [4, 1],
		'd-mono': [4, 1],
		'd-brayan': [3, 0],
		'd-jota': [1, 0]
	};
	const lines: DemoLine[] = [];
	for (const [bid, [cuts, extra]] of Object.entries(plan)) {
		for (let i = 0; i < cuts; i++) lines.push(line(bid, i % 3 === 1 ? 'Corte + barba' : 'Corte', ago(90 + i * 47 + bid.length * 3)));
		for (let i = 0; i < extra; i++) lines.push(line(bid, i % 2 ? 'Cejas' : 'Barba', ago(110 + i * 61)));
	}
	// Lines of the example bills listed in Hoy.
	lines.push(line('d-dago', 'Corte + barba', ago(12), 'd-s3'));
	lines.push(line('d-mono', 'Corte', ago(40), 'd-s2', 'void'));
	lines.push(line('d-kike', 'Corte', ago(65), 'd-s1'));

	const synthTotal = lines.filter((l) => !l.saleId).reduce((s, l) => s + l.total, 0) + sumLines(drinksToday());
	const split = methodsOf(synthTotal);
	return {
		version: 6,
		team: structuredClone(seedTeam),
		items: structuredClone(seedItems),
		overrides: [],
		shop: { name: SHOP.name, goal: 8, cutoff: '04:00' },
		lines,
		customers: [andres, { id: 'd-c2', name: 'Sara Gómez', phone: '+573102223344', promo: false }],
		sales: [
			{
				id: 'd-s3', receiptNo: 23, receiptToken: 'demo0000000000000000000000000023', createdAt: ago(12),
				total: 42000, status: 'ok', customer: andres, receiptSentAt: ago(11),
				lines: [
					{ name: 'Corte + barba', qty: 1, total: 30000, barberId: 'd-dago' },
					{ name: 'Cerveza', qty: 2, total: 12000, barberId: null }
				],
				payments: [{ method: 'cash', amount: 42000, cashReceived: 50000 }]
			},
			{
				id: 'd-s2', receiptNo: 22, receiptToken: 'demo0000000000000000000000000022', createdAt: ago(40),
				total: 20000, status: 'void', voidReason: 'Cobrado dos veces', customer: null,
				lines: [{ name: 'Corte', qty: 1, total: 20000, barberId: 'd-mono' }],
				payments: [{ method: 'transfer', amount: 20000, cashReceived: null }]
			},
			{
				id: 'd-s1', receiptNo: 21, receiptToken: 'demo0000000000000000000000000021', createdAt: ago(65),
				total: 45000, status: 'ok', customer: null,
				lines: [
					{ name: 'Corte', qty: 1, total: 20000, barberId: 'd-kike' },
					{ name: 'Cera mate', qty: 1, total: 25000, barberId: null }
				],
				payments: [
					{ method: 'card', amount: 25000, cashReceived: null },
					{ method: 'cash', amount: 20000, cashReceived: 20000 }
				]
			}
		],
		// The rest of the day that the example bills do not list (synthetic services plus drinks).
		base: { total: synthTotal, cash: split.cash, transfer: split.transfer, card: split.card, bills: 18 },
		nextReceipt: 24,
		template: null,
		rules: [
			{ id: 'd-r0', name: 'Día de 5', period: 'day', metric: 'cuts', threshold: 5, rewardType: 'fixed', rewardValue: 10000, active: true },
			{ id: 'd-r1', name: 'Semana fuerte', period: 'week', metric: 'cuts', threshold: 40, rewardType: 'fixed', rewardValue: 50000, active: true },
			{ id: 'd-r2', name: 'Mes de oro', period: 'month', metric: 'revenue', threshold: 3500000, rewardType: 'pct_extra', rewardValue: 5, active: true }
		],
		closings: [],
		settlements: [],
		voids: { 'd-s2': { at: ago(37), by: 'Luisa' } }
	};
}

const STATE_KEY = 'barbeer-demo-state';
function loadState(): DemoState {
	try {
		const raw = sessionStorage.getItem(STATE_KEY);
		if (raw) {
			const s = JSON.parse(raw) as DemoState;
			if (s.version === 6) return s;
		}
	} catch {
		/* fall through to a fresh demo */
	}
	return fresh();
}
st = loadState();
lineSeq = st.lines.length + 1;
function persist() {
	try {
		sessionStorage.setItem(STATE_KEY, JSON.stringify(st));
	} catch {
		/* private mode: the demo still works until reload */
	}
}

// ─── Synthetic past (deterministic: the same date always gives the same day) ────
function iso(d: Date) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayIso = () => iso(new Date());
function hash(s: string) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	// Final avalanche (murmur3 fmix32) so near-identical dates do not give near-identical values.
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967295;
}
/** One line of a synthetic or real day, enough for reports and the CSV. */
interface FlatLine {
	barberId: string | null;
	name: string;
	kind: ItemKind;
	qty: number;
	total: number;
	commission: number;
	cut: boolean;
	saleId?: string;
}
// Past days keep the example prices they were "charged" at, like frozen sale lines.
// Function declarations: fresh() runs at module load, before later consts exist.
function seedPrice(name: string) {
	return seedItems.find((i) => i.name === name)?.price ?? 0;
}
function seedKind(name: string): ItemKind {
	return seedItems.find((i) => i.name === name)?.kind ?? 'product';
}
const OPENED = '2023-08-01';
const isOpen = (date: string) => date >= OPENED && new Date(date + 'T12:00:00').getDay() !== 1; // closed on Mondays
function sumLines(ls: FlatLine[]) {
	return ls.reduce((s, l) => s + l.total, 0);
}
function flat(barberId: string | null, name: string, qty: number, cut = false, pct = 0): FlatLine {
	const total = qty * seedPrice(name);
	return { barberId, name, kind: seedKind(name), qty, total, commission: Math.round((total * pct) / 100), cut };
}
function pastLines(barberId: string, date: string): FlatLine[] | null {
	if (date < hiredOnOf(barberId) || !isOpen(date)) return null;
	const r = hash(barberId + date);
	if (r < 0.12) return null; // day off
	const dow = new Date(date + 'T12:00:00').getDay();
	const cuts = 2 + Math.floor(r * 8) + (dow === 5 || dow === 6 ? 2 : 0);
	const extras = Math.floor(hash(date + barberId) * 3);
	const withBeard = Math.floor(cuts / 3);
	return [
		flat(barberId, 'Corte', cuts - withBeard, true, 50),
		flat(barberId, 'Corte + barba', withBeard, true, 50),
		flat(barberId, 'Barba', Math.ceil(extras / 2), false, 50),
		flat(barberId, 'Cejas', Math.floor(extras / 2), false, 50)
	].filter((l) => l.qty > 0);
}
// Drinks and products sold at the bar on a past day (nobody's commission).
function pastShopLines(date: string): FlatLine[] {
	if (!isOpen(date)) return [];
	return [
		flat(null, 'Cerveza', 4 + Math.floor(hash('beer' + date) * 10)),
		flat(null, 'Gaseosa', Math.floor(hash('soda' + date) * 5)),
		flat(null, 'Cera mate', hash('wax' + date) < 0.3 ? 1 : 0)
	].filter((l) => l.qty > 0);
}
// Drinks of today that the example bills do not list.
function drinksToday(): FlatLine[] {
	return [flat(null, 'Cerveza', 8), flat(null, 'Gaseosa', 4), flat(null, 'Cerveza artesanal', 1), flat(null, 'Agua', 2)];
}
function methodsOf(total: number): Record<PayMethod, number> {
	const transfer = Math.round((total * 0.22) / 1000) * 1000;
	const card = Math.round((total * 0.08) / 1000) * 1000;
	return { cash: total - transfer - card, transfer, card };
}
function pastDay(barberId: string, date: string): DayRow | null {
	const ls = pastLines(barberId, date);
	if (!ls) return null;
	return {
		date,
		cuts: ls.filter((l) => l.cut).reduce((s, l) => s + l.qty, 0),
		services: ls.reduce((s, l) => s + l.qty, 0),
		revenue: sumLines(ls),
		commission: ls.reduce((s, l) => s + l.commission, 0)
	};
}
function addDays(date: string, n: number) {
	const d = new Date(date + 'T12:00:00');
	d.setDate(d.getDate() + n);
	return iso(d);
}
function datesBetween(from: string, to: string): string[] {
	const out: string[] = [];
	for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
	return out;
}
function todayRow(barberId: string): DayRow {
	const ls = st.lines.filter((l) => l.barberId === barberId && l.status === 'ok');
	return {
		date: todayIso(),
		cuts: ls.filter((l) => l.cut).reduce((s, l) => s + l.qty, 0),
		services: ls.filter((l) => l.service).reduce((s, l) => s + l.qty, 0),
		revenue: ls.reduce((s, l) => s + l.total, 0),
		commission: ls.reduce((s, l) => s + l.commission, 0)
	};
}
function historyBetween(barberId: string, from: string, to: string): DayRow[] {
	const out: DayRow[] = [];
	const today = todayIso();
	const d = new Date(to + 'T12:00:00');
	const stop = new Date(from + 'T12:00:00');
	while (d >= stop) {
		const date = iso(d);
		const row = date === today ? todayRow(barberId) : date < today ? pastDay(barberId, date) : null;
		if (row && (row.services > 0 || date !== today)) out.push(row);
		d.setDate(d.getDate() - 1);
	}
	return out;
}

const ROLE_KEY = 'barbeer-demo-role';
const role = {
	get: () => {
		try {
			return sessionStorage.getItem(ROLE_KEY) as Role | null;
		} catch {
			return null;
		}
	},
	set: (v: Role | null) => {
		try {
			if (v) sessionStorage.setItem(ROLE_KEY, v);
			else sessionStorage.removeItem(ROLE_KEY);
		} catch {
			/* private mode */
		}
	}
};

const profiles: Record<Role, Profile> = {
	admin: { staffId: 'd-admin', shopId: SHOP.id, shopName: SHOP.name, role: 'admin', displayName: 'Andrés', cuts: false },
	cashier: { staffId: 'd-luisa', shopId: SHOP.id, shopName: SHOP.name, role: 'cashier', displayName: 'Luisa', cuts: false },
	barber: { staffId: 'd-kike', shopId: SHOP.id, shopName: SHOP.name, role: 'barber', displayName: 'Kike', cuts: true }
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());
const okSales = () => st.sales.filter((s) => s.status === 'ok');
const paidToday = (m: PayMethod) =>
	okSales().reduce((s, x) => s + x.payments.filter((p) => p.method === m).reduce((a, p) => a + p.amount, 0), 0);
const methodsToday = (): Record<PayMethod, number> => ({
	cash: st.base.cash + paidToday('cash'),
	transfer: st.base.transfer + paidToday('transfer'),
	card: st.base.card + paidToday('card')
});

/** Every line of a business day, real or synthetic, with its bills and payment split. */
function dayData(date: string): { lines: FlatLine[]; bills: number; voided: number; methods: Record<PayMethod, number> } {
	const today = todayIso();
	if (date > today) return { lines: [], bills: 0, voided: 0, methods: { cash: 0, transfer: 0, card: 0 } };
	if (date === today) {
		const kindOf = (name: string) => st.items.find((i) => i.name === name)?.kind ?? seedKind(name);
		const synth = st.lines
			.filter((l) => !l.saleId && l.status === 'ok')
			.map((l): FlatLine => ({ barberId: l.barberId, name: l.name, kind: kindOf(l.name), qty: l.qty, total: l.total, commission: l.commission, cut: l.cut }));
		const billed = okSales().flatMap((s) =>
			s.lines.map((l): FlatLine => {
				const own = st.lines.find((x) => x.saleId === s.id && x.name === l.name && x.barberId === l.barberId);
				return { barberId: l.barberId, name: l.name, kind: kindOf(l.name), qty: l.qty, total: l.total, commission: own?.commission ?? 0, cut: own?.cut ?? false, saleId: s.id };
			})
		);
		return {
			lines: [...synth, ...drinksToday(), ...billed],
			bills: st.base.bills + okSales().length,
			voided: st.sales.filter((s) => s.status === 'void').length,
			methods: methodsToday()
		};
	}
	const lines = [...st.team.filter((t) => t.cuts).flatMap((t) => pastLines(t.id, date) ?? []), ...pastShopLines(date)];
	const cuts = lines.filter((l) => l.cut).reduce((s, l) => s + l.qty, 0);
	return { lines, bills: cuts || (lines.length ? 1 : 0), voided: 0, methods: methodsOf(sumLines(lines)) };
}

// ─── Paying barbers ("liquidar") ──────────────────────────────────────────────
// The synthetic past was paid at the register every night (cash, by Luisa), day bonuses included.
// Week and month bonuses of the last week are still owed, so the week view has something to pay.
const awardKey = (a: { ruleName: string; periodStart: string }) => `${a.ruleName}|${a.periodStart}`;
function dayAwardsOf(barberId: string, row: DayRow): (Award & { payable: boolean })[] {
	return st.rules
		.filter((x) => x.active && x.period === 'day' && (x.metric === 'cuts' ? row.cuts : row.revenue) >= x.threshold)
		.map((x) => ({
			ruleName: x.name,
			period: 'day' as const,
			periodStart: row.date,
			amount: x.rewardType === 'fixed' ? x.rewardValue : Math.round((row.commission * x.rewardValue) / 100),
			// Same rule as the server: a percentage day bonus is settled at night, not at the register.
			payable: x.rewardType === 'fixed'
		}));
}
function periodEndOf(a: Award) {
	if (a.period === 'day') return a.periodStart;
	if (a.period === 'week') return addDays(a.periodStart, 6);
	const d = new Date(a.periodStart + 'T12:00:00');
	return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}
const settledBy = (staffId: string) => st.settlements.filter((x) => x.staffId === staffId);
function pastPayout(barberId: string, date: string) {
	const row = pastDay(barberId, date);
	if (!row) return null;
	return { total: row.commission + dayAwardsOf(barberId, row).reduce((s, a) => s + a.amount, 0), cuts: row.cuts };
}
function settleOf(barberId: string, from: string, to: string): Settlement {
	const today = todayIso();
	const yesterday = addDays(today, -1);
	const end = to < today ? to : today;
	const withToday = from <= today && today <= to;
	const own = settledBy(barberId);
	const paidLines = new Set(own.flatMap((x) => x.lineIds));
	const paidAwards = new Map(own.flatMap((x) => x.awards).map((a) => [a.key, a.amount]));
	const rows = from <= end ? historyBetween(barberId, from, end) : [];
	const todayLines = st.lines.filter((l) => l.barberId === barberId && l.status === 'ok');

	let commissionPaid = 0;
	for (const r of rows) if (r.date < today) commissionPaid += r.commission;
	if (withToday) commissionPaid += todayLines.filter((l) => paidLines.has(l.id)).reduce((s, l) => s + l.commission, 0);

	const items = new Map<string, { name: string; qty: number; revenue: number; commission: number }>();
	const addItem = (name: string, qty: number, revenue: number, commission: number) => {
		const it = items.get(name) ?? { name, qty: 0, revenue: 0, commission: 0 };
		it.qty += qty;
		it.revenue += revenue;
		it.commission += commission;
		items.set(name, it);
	};
	if (from <= yesterday)
		for (const d of datesBetween(from, to < yesterday ? to : yesterday))
			for (const l of pastLines(barberId, d) ?? []) addItem(l.name, l.qty, l.total, l.commission);
	if (withToday) for (const l of todayLines) addItem(l.name, l.qty, l.total, l.commission);

	const recent = addDays(today, -7);
	const closed = awardsFor(barberId, addDays(from, -31))
		.filter((a) => a.periodStart >= from && a.periodStart <= to)
		.map((a) => ({ ...a, paid: a.period === 'day' || periodEndOf(a) < recent || paidAwards.has(awardKey(a)), today: false, payable: true }));
	const todays = withToday
		? dayAwardsOf(barberId, todayRow(barberId)).map((a) => ({ ...a, paid: paidAwards.has(awardKey(a)), today: !paidAwards.has(awardKey(a)) }))
		: [];
	const all = [...closed, ...todays];
	const counted = all.filter((a) => a.payable);

	const payouts: Settlement['payouts'] = [];
	if (from <= yesterday)
		for (const d of datesBetween(from, to < yesterday ? to : yesterday)) {
			const p = pastPayout(barberId, d);
			if (p) payouts.push({ id: `d-pay-${barberId}-${d}`, paidAt: new Date(d + 'T22:40:00').toISOString(), total: p.total, method: 'cash', paidBy: 'Luisa', from: d, to: d });
		}
	for (const x of own)
		if (x.date >= from && x.date <= to)
			payouts.push({ id: x.id, paidAt: x.at, total: x.commission + x.bonus, method: x.method, paidBy: x.by, from: x.from, to: x.to });
	payouts.sort((a, b) => b.paidAt.localeCompare(a.paidAt));

	// Owed from before the range: only the recent week and month bonuses can be (the past was paid nightly).
	const before = awardsFor(barberId, addDays(from, -45)).filter(
		(a) => a.periodStart < from && a.period !== 'day' && periodEndOf(a) >= recent && !paidAwards.has(awardKey(a))
	);
	const owedBefore = before.reduce((s, a) => s + a.amount, 0);
	const unpaidNow = [...before, ...all.filter((a) => a.payable && !a.paid)].map((a) => a.periodStart);
	if (withToday && todayLines.some((l) => !paidLines.has(l.id) && l.commission > 0)) unpaidNow.push(today);

	return {
		name: nameOfId(barberId) ?? 'Barbero',
		cuts: rows.reduce((s, r) => s + r.cuts, 0),
		services: rows.reduce((s, r) => s + r.services, 0),
		revenue: rows.reduce((s, r) => s + r.revenue, 0),
		commission: rows.reduce((s, r) => s + r.commission, 0),
		commissionPaid,
		bonus: counted.reduce((s, a) => s + a.amount, 0),
		bonusPaid: counted.filter((a) => a.paid).reduce((s, a) => s + a.amount, 0),
		bonusToday: todays.filter((a) => !a.paid && a.payable).reduce((s, a) => s + a.amount, 0),
		days: rows.filter((r) => r.services > 0).length,
		items: [...items.values()].sort((a, b) => b.commission - a.commission),
		bonuses: all.map((a) => ({ name: a.ruleName, periodStart: a.periodStart, amount: a.amount, paid: a.paid, today: a.today, payable: a.payable })),
		payouts,
		owedBefore,
		owedFrom: unpaidNow.length ? unpaidNow.sort()[0] : null
	};
}
/** Cash charged on a day, cash paid out to barbers, and what the drawer should hold. */
function cashOf(date: string) {
	const today = todayIso();
	if (date > today) return { cashIn: 0, paidOut: 0, expected: 0 };
	if (date === today) {
		const cashIn = methodsToday().cash;
		const paidOut = st.settlements.filter((x) => x.date === today && x.method === 'cash').reduce((s, x) => s + x.commission + x.bonus, 0);
		return { cashIn, paidOut, expected: cashIn - paidOut };
	}
	const cashIn = dayData(date).methods.cash;
	const paidOut = st.team.filter((t) => t.cuts).reduce((s, t) => s + (pastPayout(t.id, date)?.total ?? 0), 0);
	return { cashIn, paidOut, expected: cashIn - paidOut };
}

function closingOf(date: string): Closing | null {
	const own = st.closings.find((c) => c.date === date);
	if (own) return { ...own };
	const today = todayIso();
	if (date >= today || date < addDays(today, -90) || !isOpen(date)) return null;
	const expected = cashOf(date).expected;
	const r = hash('close' + date);
	const difference = r < 0.72 ? 0 : r < 0.86 ? -2000 : r < 0.95 ? 1000 : -5000;
	return {
		date,
		closedAt: new Date(addDays(date, 1) + 'T01:40:00').toISOString(),
		closedBy: 'Luisa',
		expectedCash: expected,
		countedCash: expected + difference,
		difference,
		notes: difference === -5000 ? 'Se pagó un domicilio de la caja' : null
	};
}

/** Bonuses a barber earned in closed periods since a date, from the same generated past and rules. */
function awardsFor(barberId: string, since: string): Award[] {
	const today = todayIso();
	const rows = historyBetween(barberId, since < hiredOnOf(barberId) ? hiredOnOf(barberId) : since, addDays(today, -1));
	const out: Award[] = [];
	for (const rule of st.rules.filter((r) => r.active)) {
		const groups = new Map<string, { cuts: number; revenue: number; commission: number }>();
		for (const r of rows) {
			const d = new Date(r.date + 'T12:00:00');
			let key = r.date;
			if (rule.period === 'week') {
				d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
				key = iso(d);
			} else if (rule.period === 'month') key = r.date.slice(0, 8) + '01';
			const g = groups.get(key) ?? { cuts: 0, revenue: 0, commission: 0 };
			g.cuts += r.cuts;
			g.revenue += r.revenue;
			g.commission += r.commission;
			groups.set(key, g);
		}
		for (const [key, g] of groups) {
			// Only closed periods: today, this week and this month are still running.
			const end = new Date(key + 'T12:00:00');
			if (rule.period === 'week') end.setDate(end.getDate() + 6);
			else if (rule.period === 'month') end.setMonth(end.getMonth() + 1, 0);
			if (iso(end) >= today) continue;
			const value = rule.metric === 'cuts' ? g.cuts : g.revenue;
			if (value < rule.threshold) continue;
			const amount = rule.rewardType === 'fixed' ? rule.rewardValue : Math.round((g.commission * rule.rewardValue) / 100);
			out.push({ ruleName: rule.name, period: rule.period, periodStart: key, amount });
		}
	}
	return out.sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

function boardRows(): BoardRow[] {
	return barbers().map((b) => {
		const r = todayRow(b.id);
		return { staffId: b.id, name: b.name, cuts: r.cuts, services: r.services, revenue: r.revenue, commission: r.commission, goal: goalOf(b.id) };
	});
}

function upsertCustomer(phone: string, name?: string | null, promo?: boolean | null): Customer {
	const d = normalizePhone(phone);
	if (!d) throw new AppError('Número de WhatsApp no válido');
	const e164 = '+' + d;
	let c = st.customers.find((x) => x.phone === e164);
	if (!c) {
		c = { id: `d-c${st.customers.length + 1}`, name: name?.trim() || null, phone: e164, promo: promo ?? false };
		st.customers.unshift(c);
	} else {
		if (name?.trim()) c.name = name.trim();
		// Same rule as the database: only an explicit answer changes recorded consent.
		if (promo != null) c.promo = promo;
	}
	return { ...c };
}

const token = () => crypto.randomUUID().replace(/-/g, '');

export function createDemoBackend(): Backend {
	let current: Profile | null = null;
	let ambient: ReturnType<typeof setInterval> | null = null;

	// Outside the register, a cut is poured into a random mug now and then, so live views move.
	function ambientPour() {
		const bs = barbers();
		if (!bs.length) return;
		const b = bs[Math.floor(Math.random() * bs.length)];
		const l = line(b.id, 'Corte', new Date().toISOString());
		st.lines.push(l);
		st.base.total += l.total;
		st.base.cash += l.total;
		st.base.bills += 1;
		persist();
		notify();
	}

	return {
		mode: 'demo',

		async restore() {
			const r = role.get();
			current = r ? profiles[r] : null;
			return current;
		},

		async signIn(user) {
			await wait(250);
			const r = user.replace('demo:', '') as Role;
			if (!profiles[r]) throw new AppError('En la demostración usa uno de los tres botones.');
			role.set(r);
			current = profiles[r];
			return current;
		},

		async signOut() {
			role.set(null);
			current = null;
		},

		async dayBoard() {
			await wait(120);
			const rows = boardRows();
			return current?.role === 'barber' ? rows.filter((r) => r.staffId === current!.staffId) : rows;
		},

		async dayTotals() {
			await wait(120);
			const m = methodsToday();
			return {
				date: todayIso(),
				bills: st.base.bills + okSales().length,
				total: st.base.total + okSales().reduce((s, x) => s + x.total, 0),
				cuts: boardRows().reduce((s, r) => s + r.cuts, 0),
				cash: m.cash,
				transfer: m.transfer,
				card: m.card,
				voided: st.sales.filter((s) => s.status === 'void').length
			};
		},

		async catalog() {
			await wait(80);
			return st.items
				.filter((i) => i.active)
				.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
				.map((i) => ({ ...i }));
		},

		async staff() {
			await wait(80);
			return st.team.map((x) => ({ ...x }));
		},

		async registerSale(id, lines, payments, customer) {
			await wait(350);
			if (!navigator.onLine) throw new NetworkError('Sin conexión.');
			const existing = st.sales.find((s) => s.id === id);
			if (existing) {
				return {
					id,
					receiptNo: existing.receiptNo!,
					receiptToken: existing.receiptToken!,
					total: existing.total,
					customerId: existing.customer?.id ?? null,
					duplicate: true
				};
			}
			if (!lines.length) throw new AppError('La cuenta está vacía');
			const recLines = lines.map((l) => {
				const it = itemById(l.itemId);
				if (it && !it.active) throw new AppError('Producto o servicio no disponible');
				if (!it) throw new AppError('Producto o servicio no disponible');
				if (it.kind === 'service' && !l.barberId) throw new AppError(`Falta el barbero de ${it.name}`);
				return { it, qty: l.qty, barberId: l.barberId };
			});
			const total = recLines.reduce((s, l) => s + l.it.price * l.qty, 0);
			const paid = payments.reduce((s, p) => s + p.amount, 0);
			if (paid !== total) throw new AppError(`Los pagos (${paid}) no suman el total (${total})`);
			const cust = customer?.phone ? upsertCustomer(customer.phone, customer.name, customer.promo) : null;

			const at = new Date().toISOString();
			for (const l of recLines) {
				if (!l.barberId) continue;
				const amount = l.it.price * l.qty;
				st.lines.push({
					id: `d-l${++lineSeq}`,
					saleId: id,
					barberId: l.barberId,
					at,
					name: l.it.name,
					service: l.it.kind === 'service',
					qty: l.qty,
					total: amount,
					commission: Math.round((amount * pctFor(l.barberId, l.it)) / 100),
					cut: l.it.countsAsCut,
					status: 'ok'
				});
			}
			const receiptNo = st.nextReceipt++;
			const receiptToken = token();
			st.sales.unshift({
				id,
				receiptNo,
				receiptToken,
				receiptSentAt: null,
				createdAt: at,
				total,
				status: 'ok',
				customer: cust,
				lines: recLines.map((l) => ({ name: l.it.name, qty: l.qty, total: l.it.price * l.qty, barberId: l.barberId })),
				payments: payments.map((p) => ({
					method: p.method,
					amount: p.amount,
					cashReceived: p.method === 'cash' ? (p.cashReceived ?? null) : null
				}))
			});
			persist();
			setTimeout(notify, 0);
			return { id, receiptNo, receiptToken, total, customerId: cust?.id ?? null, duplicate: false };
		},

		async voidSale(id, reason) {
			await wait(250);
			if (reason.trim().length < 3) throw new AppError('Escribe el motivo de la anulación');
			const s = st.sales.find((x) => x.id === id);
			if (!s) throw new AppError('Cuenta no encontrada');
			if (s.status === 'void') return;
			const paid = new Set(st.settlements.flatMap((x) => x.lineIds));
			const paidLine = st.lines.find((l) => l.saleId === id && paid.has(l.id));
			if (paidLine) throw new AppError(`A ${nameOfId(paidLine.barberId) ?? 'el barbero'} ya se le pagó la comisión de esta cuenta; no se puede anular`);
			s.status = 'void';
			s.voidReason = reason.trim();
			st.voids[id] = { at: new Date().toISOString(), by: current?.displayName ?? 'Caja' };
			for (const l of st.lines) if (l.saleId === id) l.status = 'void';
			persist();
			notify();
		},

		async todaySales() {
			await wait(120);
			return st.sales.map((s) => structuredClone(s));
		},

		async searchCustomers(digits) {
			await wait(120);
			const d = digits.replace(/[^0-9]/g, '');
			if (d.length < 4) return [];
			return st.customers.filter((c) => c.phone.includes(d)).slice(0, 5).map((c) => ({ ...c }));
		},

		async setSaleCustomer(id, customer) {
			await wait(200);
			const s = st.sales.find((x) => x.id === id);
			if (!s) throw new AppError('Cuenta no encontrada');
			const c = upsertCustomer(customer.phone, customer.name, customer.promo);
			s.customer = c;
			persist();
			return c;
		},

		async markReceiptSent(id) {
			const s = st.sales.find((x) => x.id === id);
			if (s) s.receiptSentAt = new Date().toISOString();
			persist();
		},

		async receiptSettings() {
			await wait(80);
			return { shopName: st.shop.name, template: st.template };
		},

		async saveReceiptTemplate(template) {
			await wait(200);
			st.template = template?.trim() ? template : null;
			persist();
		},

		async myDayLines() {
			await wait(120);
			const me = current?.staffId ?? '';
			return st.lines
				.filter((l) => l.barberId === me)
				.sort((a, b) => b.at.localeCompare(a.at))
				.map((l) => ({ at: l.at, name: l.name, qty: l.qty, total: l.total, commission: l.commission, cut: l.cut, status: l.status }));
		},

		async myHistory(from, to) {
			await wait(150);
			return historyBetween(current?.staffId ?? '', from, to);
		},

		async myTotals() {
			await wait(150);
			const me = current?.staffId ?? '';
			const rows = historyBetween(me, hiredOnOf(me), todayIso());
			return {
				hiredOn: hiredOnOf(me),
				firstDay: rows.length ? rows[rows.length - 1].date : null,
				days: rows.length,
				cuts: rows.reduce((s, r) => s + r.cuts, 0),
				commission: rows.reduce((s, r) => s + r.commission, 0)
			};
		},

		async myGoals() {
			await wait(150);
			const me = current?.staffId ?? '';
			const today = new Date(todayIso() + 'T12:00:00');
			return st.rules.filter((r) => r.active).map(({ active: _, ...r }) => {
				const start = new Date(today);
				const end = new Date(today);
				if (r.period === 'week') {
					start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
					end.setTime(start.getTime());
					end.setDate(start.getDate() + 6);
				} else if (r.period === 'month') {
					start.setDate(1);
					end.setMonth(today.getMonth() + 1, 0);
				}
				const rows = historyBetween(me, iso(start), todayIso());
				const progress = rows.reduce((s, x) => s + (r.metric === 'cuts' ? x.cuts : x.revenue), 0);
				return { ...r, periodStart: iso(start), periodEnd: iso(end), progress };
			});
		},

		// Awards come from the same generated past and the same rules, so they always add up.
		// Daily awards would flood this list (the panel shows today); they still count in payouts.
		async myAwards(): Promise<Award[]> {
			await wait(120);
			const me = current?.staffId ?? '';
			return awardsFor(me, hiredOnOf(me))
				.filter((a) => a.period !== 'day')
				.slice(0, 24);
		},

		async businessDate() {
			return todayIso();
		},

		async saveStaff(input) {
			await wait(250);
			const name = input.name.trim();
			if (!name) throw new AppError('Escribe el nombre.');
			const cuts = input.role === 'barber' ? true : input.cuts;
			if (input.id) {
				const m = st.team.find((x) => x.id === input.id);
				if (!m) throw new AppError('Persona no encontrada.');
				const lastAdmin = m.role === 'admin' && st.team.filter((x) => x.role === 'admin' && x.active).length === 1;
				if (lastAdmin && (input.role !== 'admin' || !input.active))
					throw new AppError('El local debe conservar al menos un administrador activo');
				Object.assign(m, { role: input.role, name, cuts, dailyCutGoal: input.dailyCutGoal, hiredOn: input.hiredOn, active: input.active });
				persist();
				notify();
				return { ...m };
			}
			const m: StaffMember = {
				id: `d-st${Date.now().toString(36)}`,
				role: input.role,
				name,
				username: null,
				hasAccess: false,
				active: input.active,
				cuts,
				dailyCutGoal: input.dailyCutGoal,
				hiredOn: input.hiredOn
			};
			st.team.push(m);
			persist();
			notify();
			return { ...m };
		},

		async staffAccess(staffId, action, username, password) {
			await wait(300);
			const m = st.team.find((x) => x.id === staffId);
			if (!m) throw new AppError('Persona no encontrada en este local');
			if (action === 'grant') {
				const u = (username ?? '').trim().toLowerCase();
				if (!/^[a-z0-9._-]{2,30}$/.test(u)) throw new AppError('Usuario: 2 a 30 letras minúsculas, números, punto o guion');
				if ((password ?? '').length < 6) throw new AppError('El PIN o la contraseña debe tener al menos 6 caracteres');
				if (st.team.some((x) => x.id !== staffId && x.username === u)) throw new AppError('Ese usuario ya existe en el local.');
				m.username = u;
				m.hasAccess = true;
			} else if (action === 'password') {
				if (!m.hasAccess) throw new AppError('Esta persona no tiene acceso');
				if ((password ?? '').length < 6) throw new AppError('El PIN o la contraseña debe tener al menos 6 caracteres');
			} else {
				if (m.id === current?.staffId) throw new AppError('No puedes quitarte tu propio acceso.');
				if (m.role === 'admin' && st.team.filter((x) => x.role === 'admin' && x.hasAccess).length === 1)
					throw new AppError('El local debe conservar al menos un administrador activo');
				m.hasAccess = false;
			}
			persist();
		},

		async overrides(staffId) {
			await wait(100);
			return st.overrides.filter((o) => o.staffId === staffId).map((o) => ({ itemId: o.itemId, pct: o.pct }));
		},

		async saveOverride(staffId, itemId, pct) {
			await wait(150);
			st.overrides = st.overrides.filter((o) => !(o.staffId === staffId && o.itemId === itemId));
			if (pct != null) {
				if (pct < 0 || pct > 100) throw new AppError('El porcentaje va de 0 a 100.');
				st.overrides.push({ staffId, itemId, pct });
			}
			persist();
		},

		async catalogAll() {
			await wait(100);
			return [...st.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((i) => ({ ...i }));
		},

		async saveItem(input) {
			await wait(200);
			const name = input.name.trim();
			if (!name) throw new AppError('Escribe el nombre.');
			if (st.items.some((i) => i.id !== input.id && i.kind === input.kind && i.name.toLowerCase() === name.toLowerCase()))
				throw new AppError('Ya existe un ítem con ese nombre en esa pestaña.');
			const fields = {
				kind: input.kind,
				name,
				price: input.price,
				commissionPct: input.commissionPct,
				countsAsCut: input.kind === 'service' ? input.countsAsCut : false,
				active: input.active,
				sortOrder: input.sortOrder
			};
			let it = input.id ? st.items.find((i) => i.id === input.id) : undefined;
			if (it) Object.assign(it, fields);
			else {
				it = { id: `d-item-${Date.now().toString(36)}`, ...fields };
				st.items.push(it);
			}
			persist();
			return { ...it };
		},

		async customers(query) {
			await wait(120);
			const q = query.trim().toLowerCase();
			const digits = q.replace(/[^0-9]/g, '');
			return st.customers
				.filter((c) => !q || (c.name ?? '').toLowerCase().includes(q) || (digits && c.phone.includes(digits)))
				.map((c) => {
					const own = st.sales.filter((x) => x.customer?.phone === c.phone && x.status === 'ok');
					return {
						id: c.id,
						name: c.name,
						phone: c.phone,
						promo: !!c.promo,
						visits: own.length,
						lastVisit: own.length ? own.map((x) => x.createdAt).sort().at(-1)! : null,
						spent: own.reduce((sum, x) => sum + x.total, 0)
					};
				})
				.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''));
		},

		async shopSettings() {
			await wait(80);
			return { name: st.shop.name, dailyCutGoal: st.shop.goal, dayCutoff: st.shop.cutoff };
		},

		async saveShopSettings(settings) {
			await wait(200);
			if (!settings.name.trim()) throw new AppError('Escribe el nombre del local.');
			if (settings.dailyCutGoal < 1 || settings.dailyCutGoal > 200) throw new AppError('La meta diaria va de 1 a 200 cortes.');
			st.shop = { name: settings.name.trim(), goal: settings.dailyCutGoal, cutoff: settings.dayCutoff };
			persist();
			notify();
		},

		async cashDay(date) {
			await wait(120);
			const c = cashOf(date);
			return { date, expectedCash: c.expected, cashIn: c.cashIn, paidOut: c.paidOut, closing: closingOf(date) };
		},

		async closeRegister(date, counted, notes) {
			await wait(300);
			if (!Number.isInteger(counted) || counted < 0) throw new AppError('Escribe el efectivo contado');
			if (current?.role === 'cashier' && date < addDays(todayIso(), -1))
				throw new AppError('Solo el administrador puede cerrar días anteriores');
			if (closingOf(date)) throw new AppError('Ese día ya tiene cierre');
			const expected = cashOf(date).expected;
			const c: Closing = {
				date,
				closedAt: new Date().toISOString(),
				closedBy: current?.displayName ?? null,
				expectedCash: expected,
				countedCash: counted,
				difference: counted - expected,
				notes: notes?.trim() || null
			};
			st.closings.push(c);
			persist();
			return { ...c };
		},

		async closings(from, to) {
			await wait(150);
			return datesBetween(from, to)
				.reverse()
				.map(closingOf)
				.filter((c): c is Closing => !!c);
		},

		async bonusRules() {
			await wait(100);
			return [...st.rules].sort((a, b) => Number(b.active) - Number(a.active)).map((r) => ({ ...r }));
		},

		async saveBonusRule(input) {
			await wait(200);
			const name = input.name.trim();
			if (!name) throw new AppError('Escribe el nombre del bono.');
			if (!(input.threshold > 0)) throw new AppError('La meta debe ser mayor que cero.');
			if (!(input.rewardValue > 0)) throw new AppError('El premio debe ser mayor que cero.');
			if (input.rewardType === 'pct_extra' && input.rewardValue > 100) throw new AppError('El porcentaje va de 1 a 100.');
			const { id: _, ...fields } = { ...input, name };
			let r = input.id ? st.rules.find((x) => x.id === input.id) : undefined;
			if (r) Object.assign(r, fields);
			else {
				r = { ...fields, id: `d-r${Date.now().toString(36)}` };
				st.rules.push(r);
			}
			persist();
			return { ...r };
		},

		async awardBonuses() {
			await wait(400);
			// The demo's awards are derived from the generated past, so nothing is ever pending.
			return 0;
		},

		async payoutSummary(from, to) {
			await wait(180);
			return st.team
				.filter((t) => t.cuts)
				.map((t) => {
					const x = settleOf(t.id, from, to);
					return {
						staffId: t.id,
						name: t.name,
						active: t.active,
						cuts: x.cuts,
						commission: x.commission,
						bonus: x.bonus,
						paid: x.commissionPaid + x.bonusPaid,
						owed: x.commission - x.commissionPaid + x.bonus - x.bonusPaid,
						owedBefore: x.owedBefore,
						lastPaidAt: x.payouts[0]?.paidAt ?? null
					};
				})
				.filter((r) => r.active || r.commission > 0)
				.map(({ active: _, ...r }) => r);
		},

		async settleSummary(staffId, from, to) {
			await wait(160);
			if (!st.team.some((t) => t.id === staffId)) throw new AppError('Persona no encontrada');
			if (current?.role === 'barber' && current.staffId !== staffId) throw new AppError('No tienes permiso para esta acción');
			return settleOf(staffId, from, to);
		},

		async payBarber(staffId, from, to, method, expected) {
			await wait(300);
			const today = todayIso();
			if (to < from || to > today) throw new AppError('El periodo no es válido');
			if (method === 'cash' && closingOf(today)) throw new AppError('La caja de hoy ya está cerrada: págale por transferencia');
			if (current?.role === 'barber') throw new AppError('No tienes permiso para esta acción');
			const name = nameOfId(staffId);
			if (!name) throw new AppError('Persona no encontrada');
			const own = settledBy(staffId);
			const paidLines = new Set(own.flatMap((x) => x.lineIds));
			const lines = from <= today && today <= to
				? st.lines.filter((l) => l.barberId === staffId && l.status === 'ok' && !paidLines.has(l.id))
				: [];
			const owedNow = settleOf(staffId, from, to);
			const awards = owedNow.bonuses.filter((b) => !b.paid && b.payable).map((b) => ({ key: `${b.name}|${b.periodStart}`, amount: b.amount }));
			// Past days in range that are still owed (recent week and month bonuses before today).
			const commission = lines.reduce((s, l) => s + l.commission, 0);
			const bonus = awards.reduce((s, a) => s + a.amount, 0);
			if (commission + bonus <= 0) throw new AppError(`No hay nada pendiente por pagarle a ${name}`);
			if (commission + bonus !== expected)
				throw new AppError(`El monto cambió: ahora le toca $ ${(commission + bonus).toLocaleString('es-CO')}. Revísalo y vuelve a confirmar.`);
			const x: DemoSettlement = {
				id: `d-pay-${Date.now().toString(36)}`,
				staffId,
				from,
				to,
				date: today,
				lineIds: lines.map((l) => l.id),
				awards,
				commission,
				bonus,
				cuts: lines.filter((l) => l.cut).reduce((s, l) => s + l.qty, 0),
				method,
				at: new Date().toISOString(),
				by: current?.displayName ?? null
			};
			st.settlements.push(x);
			persist();
			return { id: x.id, paidAt: x.at, commission, bonus, total: commission + bonus, cuts: x.cuts, method, paidBy: x.by };
		},

		async reportSummary(from, to): Promise<ReportSummary> {
			await wait(200);
			const out: ReportSummary = {
				total: 0, bills: 0, voided: 0, cuts: 0, commission: 0,
				methods: { cash: 0, transfer: 0, card: 0 },
				byBarber: [], byItem: [], byDay: []
			};
			const barberMap = new Map<string, ReportSummary['byBarber'][number]>();
			const itemMap = new Map<string, ReportSummary['byItem'][number]>();
			for (const date of datesBetween(from, to)) {
				const d = dayData(date);
				if (!d.lines.length && !d.voided) continue;
				const total = sumLines(d.lines);
				out.total += total;
				out.bills += d.bills;
				out.voided += d.voided;
				for (const m of ['cash', 'transfer', 'card'] as const) out.methods[m] += d.methods[m];
				if (d.lines.length) out.byDay.push({ date, total, bills: d.bills });
				for (const l of d.lines) {
					if (l.cut) out.cuts += l.qty;
					out.commission += l.commission;
					if (l.barberId) {
						const name = nameOfId(l.barberId) ?? 'Barbero';
						const b = barberMap.get(name) ?? { name, cuts: 0, revenue: 0, commission: 0 };
						if (l.cut) b.cuts += l.qty;
						b.revenue += l.total;
						b.commission += l.commission;
						barberMap.set(name, b);
					}
					const k = l.kind + '|' + l.name;
					const it = itemMap.get(k) ?? { name: l.name, kind: l.kind, qty: 0, revenue: 0 };
					it.qty += l.qty;
					it.revenue += l.total;
					itemMap.set(k, it);
				}
			}
			out.byBarber = [...barberMap.values()].sort((a, b) => b.revenue - a.revenue);
			out.byItem = [...itemMap.values()].sort((a, b) => b.revenue - a.revenue);
			return out;
		},

		async reportLines(from, to) {
			await wait(250);
			const today = todayIso();
			const rows: ReportLine[] = [];
			const fromFlat = (date: string, l: FlatLine): ReportLine => ({
				date, receiptNo: null, createdAt: new Date(date + 'T15:00:00').toISOString(), item: l.name, kind: l.kind,
				qty: l.qty, total: l.total, barber: l.barberId ? nameOfId(l.barberId) : null, commission: l.commission,
				status: 'ok', payment: null, customer: null
			});
			for (const date of datesBetween(from, to)) {
				if (date > today) break;
				const d = dayData(date);
				rows.push(...d.lines.filter((l) => !l.saleId).map((l) => fromFlat(date, l)));
				if (date !== today) continue;
				for (const s of [...st.sales].reverse()) {
					const payment = s.payments.map((p) => `${p.method} ${p.amount}`).join(' + ');
					for (const l of s.lines) {
						const own = st.lines.find((x) => x.saleId === s.id && x.name === l.name && x.barberId === l.barberId);
						rows.push({
							date, receiptNo: s.receiptNo, createdAt: s.createdAt, item: l.name,
							kind: st.items.find((i) => i.name === l.name)?.kind ?? seedKind(l.name), qty: l.qty, total: l.total,
							barber: l.barberId ? nameOfId(l.barberId) : null, commission: own?.commission ?? 0,
							status: s.status === 'void' ? 'void' : 'ok', payment, customer: s.customer?.name ?? null
						});
					}
				}
			}
			return rows;
		},

		async voidedSales(from, to) {
			await wait(150);
			const today = todayIso();
			if (today < from || today > to) return [];
			return st.sales
				.filter((s) => s.status === 'void')
				.map((s) => ({
					id: s.id,
					receiptNo: s.receiptNo,
					date: today,
					createdAt: s.createdAt,
					total: s.total,
					voidedAt: st.voids[s.id]?.at ?? s.createdAt,
					reason: s.voidReason ?? null,
					voidedBy: st.voids[s.id]?.by ?? null,
					cashier: 'Luisa'
				}))
				.sort((a, b) => (b.voidedAt ?? '').localeCompare(a.voidedAt ?? ''));
		},

		async publicReceipt(t) {
			await wait(150);
			const s = st.sales.find((x) => x.receiptToken === t);
			if (!s) return null;
			return {
				shop: st.shop.name,
				receiptNo: s.receiptNo!,
				createdAt: s.createdAt,
				status: s.status === 'void' ? 'void' : 'ok',
				total: s.total,
				customer: (s.customer?.name ?? '').split(' ')[0],
				lines: s.lines.map((l) => ({
					name: l.name,
					qty: l.qty,
					total: l.total,
					barber: l.barberId ? nameOfId(l.barberId) : null
				})),
				payments: s.payments.map((p) => ({ method: p.method, amount: p.amount }))
			};
		},

		onAuthLost() {
			return () => {};
		},

		onSalesChange(cb) {
			listeners.add(cb);
			if (!ambient && current?.role !== 'cashier') ambient = setInterval(ambientPour, 14000);
			return () => {
				listeners.delete(cb);
				if (!listeners.size && ambient) {
					clearInterval(ambient);
					ambient = null;
				}
			};
		},

		reportError(message) {
			console.warn('[demo] error:', message);
		}
	};
}
