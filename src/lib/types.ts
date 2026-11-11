export type Role = 'admin' | 'cashier' | 'barber';
export type ItemKind = 'service' | 'drink' | 'product';

export interface Profile {
	staffId: string;
	shopId: string;
	shopName: string;
	role: Role;
	displayName: string;
	cuts: boolean;
}

/** One person who takes clients, on one business day. */
export interface BoardRow {
	staffId: string;
	name: string;
	cuts: number;
	services: number;
	revenue: number;
	commission: number;
	goal: number;
}

export interface DayTotals {
	date: string;
	bills: number;
	total: number;
	cuts: number;
	cash: number;
	transfer: number;
	card: number;
	voided: number;
}

export interface CatalogItem {
	id: string;
	kind: ItemKind;
	name: string;
	price: number;
	commissionPct: number;
	countsAsCut: boolean;
	active?: boolean;
	sortOrder?: number;
}

export interface ItemInput {
	id?: string;
	kind: ItemKind;
	name: string;
	price: number;
	commissionPct: number;
	countsAsCut: boolean;
	active: boolean;
	sortOrder: number;
}

export interface StaffMember {
	id: string;
	role: Role;
	name: string;
	username: string | null;
	hasAccess: boolean;
	active: boolean;
	cuts: boolean;
	/** Personal daily goal; null means the shop's goal. */
	dailyCutGoal: number | null;
	hiredOn: string;
}

export interface StaffInput {
	id?: string;
	role: Role;
	name: string;
	cuts: boolean;
	dailyCutGoal: number | null;
	hiredOn: string;
	active: boolean;
}

export interface CustomerStat {
	id: string;
	name: string | null;
	phone: string;
	promo: boolean;
	visits: number;
	lastVisit: string | null;
	spent: number;
}

export interface ShopSettings {
	name: string;
	dailyCutGoal: number;
	/** "04:00": sales before this hour belong to the previous business day. */
	dayCutoff: string;
}

export type PayMethod = 'cash' | 'transfer' | 'card';

export interface BillLineInput {
	itemId: string;
	qty: number;
	barberId: string | null;
}

export interface PaymentInput {
	method: PayMethod;
	amount: number;
	cashReceived?: number | null;
}

export interface ChargeResult {
	id: string;
	receiptNo: number;
	receiptToken: string;
	total: number;
	customerId: string | null;
	duplicate: boolean;
}

/** What the cashier types about the customer. Phone is the identity. */
export interface CustomerInput {
	phone: string;
	name?: string | null;
	promo?: boolean | null;
}

export interface Customer {
	id: string;
	name: string | null;
	/** E.164, e.g. +573005550147 */
	phone: string;
	/** Recorded consent to receive promotions by WhatsApp. */
	promo?: boolean;
}

export interface ReceiptSettings {
	shopName: string;
	template: string | null;
}

/** The receipt as the customer sees it from the link: no phone, first name only. */
export interface PublicReceipt {
	shop: string;
	receiptNo: number;
	createdAt: string;
	status: 'ok' | 'void';
	total: number;
	customer: string;
	lines: { name: string; qty: number; total: number; barber: string | null }[];
	payments: { method: PayMethod; amount: number }[];
}

export type SaleStatus = 'ok' | 'void' | 'pending' | 'failed';

export interface SaleRecord {
	id: string;
	receiptNo: number | null;
	createdAt: string;
	total: number;
	status: SaleStatus;
	voidReason?: string | null;
	error?: string;
	receiptToken?: string | null;
	receiptSentAt?: string | null;
	customer?: Customer | null;
	lines: { name: string; qty: number; total: number; barberId: string | null }[];
	payments: { method: PayMethod; amount: number; cashReceived: number | null }[];
}

/** One of the calling barber's services on a day. */
export interface MyLine {
	at: string;
	name: string;
	qty: number;
	total: number;
	commission: number;
	cut: boolean;
	status: 'ok' | 'void';
}

export interface DayRow {
	date: string;
	cuts: number;
	services: number;
	revenue: number;
	commission: number;
}

export interface MyTotals {
	hiredOn: string;
	firstDay: string | null;
	days: number;
	cuts: number;
	commission: number;
}

export interface Goal {
	id: string;
	name: string;
	period: 'day' | 'week' | 'month';
	metric: 'cuts' | 'revenue';
	threshold: number;
	rewardType: 'fixed' | 'pct_extra';
	rewardValue: number;
	periodStart: string;
	periodEnd: string;
	progress: number;
}

export interface Award {
	ruleName: string;
	period: 'day' | 'week' | 'month';
	periodStart: string;
	amount: number;
}

export type Period = 'day' | 'week' | 'month';

export interface BonusRule {
	id: string;
	name: string;
	period: Period;
	metric: 'cuts' | 'revenue';
	threshold: number;
	rewardType: 'fixed' | 'pct_extra';
	rewardValue: number;
	active: boolean;
}

export type BonusRuleInput = Omit<BonusRule, 'id'> & { id?: string };

export interface Closing {
	date: string;
	closedAt: string;
	closedBy: string | null;
	expectedCash: number;
	countedCash: number;
	difference: number;
	notes: string | null;
}

/** The register's cash for one business day, and its closing if it was closed. */
export interface CashDay {
	date: string;
	/** Cash charged that day, minus cash paid to barbers from the drawer. */
	expectedCash: number;
	cashIn: number;
	paidOut: number;
	closing: Closing | null;
}

export type PayoutMethod = 'cash' | 'transfer';

/** One person who takes clients, over a range: earned, already paid and still owed. */
export interface PayoutRow {
	staffId: string;
	name: string;
	cuts: number;
	commission: number;
	bonus: number;
	paid: number;
	owed: number;
	/** Still owed from before the range. */
	owedBefore: number;
	lastPaidAt: string | null;
}

/** Everything the register needs to pay one barber for a range ("liquidar"). */
export interface Settlement {
	name: string;
	cuts: number;
	services: number;
	revenue: number;
	commission: number;
	commissionPaid: number;
	/** Bonuses earned in the range, including day bonuses met today and not paid yet. */
	bonus: number;
	bonusPaid: number;
	bonusToday: number;
	days: number;
	items: { name: string; qty: number; revenue: number; commission: number }[];
	/** today: met today, not awarded yet. payable false: a percentage day bonus, settled at night. */
	bonuses: { name: string; periodStart: string; amount: number; paid: boolean; today: boolean; payable: boolean }[];
	payouts: { id: string; paidAt: string; total: number; method: PayoutMethod; paidBy: string | null; from: string; to: string }[];
	/** Still owed from days before the range. */
	owedBefore: number;
	/** Earliest business date with anything unpaid, or null when he is up to date. */
	owedFrom: string | null;
}

export interface PayResult {
	id: string;
	paidAt: string;
	commission: number;
	bonus: number;
	total: number;
	cuts: number;
	method: PayoutMethod;
	paidBy: string | null;
}

export interface ReportSummary {
	total: number;
	bills: number;
	voided: number;
	cuts: number;
	commission: number;
	methods: Record<PayMethod, number>;
	byBarber: { name: string; cuts: number; revenue: number; commission: number }[];
	byItem: { name: string; kind: ItemKind; qty: number; revenue: number }[];
	byDay: { date: string; total: number; bills: number }[];
}

/** One sale line, as exported to CSV. */
export interface ReportLine {
	date: string;
	receiptNo: number | null;
	createdAt: string;
	item: string;
	kind: ItemKind;
	qty: number;
	total: number;
	barber: string | null;
	commission: number;
	status: 'ok' | 'void';
	payment: string | null;
	customer: string | null;
}

export interface VoidedSale {
	id: string;
	receiptNo: number | null;
	date: string;
	createdAt: string;
	total: number;
	voidedAt: string | null;
	reason: string | null;
	voidedBy: string | null;
	cashier: string | null;
}

export interface Backend {
	readonly mode: 'live' | 'demo';
	restore(): Promise<Profile | null>;
	signIn(user: string, secret: string): Promise<Profile>;
	signOut(): Promise<void>;
	dayBoard(): Promise<BoardRow[]>;
	dayTotals(): Promise<DayTotals>;
	catalog(): Promise<CatalogItem[]>;
	staff(): Promise<StaffMember[]>;
	/** Charges a bill. Idempotent on id: retrying the same id never charges twice. */
	registerSale(
		id: string,
		lines: BillLineInput[],
		payments: PaymentInput[],
		customer?: CustomerInput | null
	): Promise<ChargeResult>;
	voidSale(id: string, reason: string): Promise<void>;
	/** Bills of the current business day, newest first. */
	todaySales(): Promise<SaleRecord[]>;
	/** Customers whose phone contains these digits (4 or more), newest first. */
	searchCustomers(digits: string): Promise<Customer[]>;
	/** Attaches a customer to a bill already charged. */
	setSaleCustomer(id: string, customer: CustomerInput): Promise<Customer>;
	markReceiptSent(id: string): Promise<void>;
	receiptSettings(): Promise<ReceiptSettings>;
	saveReceiptTemplate(template: string | null): Promise<void>;
	/** The calling barber's services today, newest first. */
	myDayLines(): Promise<MyLine[]>;
	/** The calling barber's worked days between two ISO dates (inclusive), newest first. */
	myHistory(from: string, to: string): Promise<DayRow[]>;
	myTotals(): Promise<MyTotals>;
	myGoals(): Promise<Goal[]>;
	myAwards(): Promise<Award[]>;
	/** Today's business date (ISO) in the shop's time zone and cutoff. */
	businessDate(): Promise<string>;
	/** Admin. */
	saveStaff(input: StaffInput): Promise<StaffMember>;
	staffAccess(staffId: string, action: 'grant' | 'password' | 'revoke', username?: string, password?: string): Promise<void>;
	overrides(staffId: string): Promise<{ itemId: string; pct: number }[]>;
	saveOverride(staffId: string, itemId: string, pct: number | null): Promise<void>;
	/** Admin: every item, inactive included, in register order. */
	catalogAll(): Promise<CatalogItem[]>;
	saveItem(input: ItemInput): Promise<CatalogItem>;
	customers(query: string): Promise<CustomerStat[]>;
	shopSettings(): Promise<ShopSettings>;
	saveShopSettings(settings: ShopSettings): Promise<void>;
	/** Register and admin: the cash of a business day and its closing. */
	cashDay(date: string): Promise<CashDay>;
	closeRegister(date: string, counted: number, notes: string | null): Promise<Closing>;
	/** Admin: closings between two business dates, newest first. */
	closings(from: string, to: string): Promise<Closing[]>;
	bonusRules(): Promise<BonusRule[]>;
	saveBonusRule(input: BonusRuleInput): Promise<BonusRule>;
	/** Awards every closed period that met a rule and was not awarded yet. Returns how many. */
	awardBonuses(): Promise<number>;
	/** Admin and register: every barber's earned, paid and owed for a range. */
	payoutSummary(from: string, to: string): Promise<PayoutRow[]>;
	/** Admin, register, or the barber himself. */
	settleSummary(staffId: string, from: string, to: string): Promise<Settlement>;
	/** Pays everything owed in the range. Amounts are computed by the server. */
	payBarber(staffId: string, from: string, to: string, method: PayoutMethod, expected: number): Promise<PayResult>;
	reportSummary(from: string, to: string): Promise<ReportSummary>;
	reportLines(from: string, to: string): Promise<ReportLine[]>;
	voidedSales(from: string, to: string): Promise<VoidedSale[]>;
	/** Public: works without a session. Null when the token matches nothing. */
	publicReceipt(token: string): Promise<PublicReceipt | null>;
	/** Calls back when the login is lost without the user leaving (expired, revoked). Returns an unsubscribe. */
	onAuthLost(cb: () => void): () => void;
	/** Calls back whenever a sale is charged or voided in this shop. Returns an unsubscribe. */
	onSalesChange(cb: () => void): () => void;
	reportError(message: string, context?: Record<string, unknown>): void;
}

export class AppError extends Error {}
/** The request never reached the server (offline, timeout). Safe to retry. */
export class NetworkError extends AppError {}
