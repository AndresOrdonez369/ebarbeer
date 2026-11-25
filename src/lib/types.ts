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
	/** Units left; null when the item keeps no inventory. Can go below zero. */
	stock?: number | null;
	/** Warn when stock falls to this or below. */
	stockMin?: number;
}

export type StockMoveKind = 'sale' | 'void' | 'in' | 'count' | 'off';

/** One change to an item's stock, newest first. */
export interface StockMove {
	at: string;
	kind: StockMoveKind;
	delta: number;
	after: number | null;
	receiptNo: number | null;
	by: string | null;
	note: string | null;
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
	stockMin?: number;
	/** Only when creating: the units there are now, to start its inventory. */
	stock?: number | null;
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

/** The four photos of a visit, in the order the barber takes them. */
export type PhotoAngle = 'front' | 'left' | 'right' | 'back';

export interface ClientMatch {
	id: string;
	name: string | null;
	/** Full for the admin and the register; "···0147" for the barbers. */
	phone: string;
	visits: number;
	lastVisit: string | null;
	/** Authorised keeping photos. */
	consent: boolean;
}

export interface VisitPhoto {
	angle: PhotoAngle;
	/** Signed URLs, valid for a few hours. */
	thumb: string;
	full: string;
}

export interface ClientVisit {
	id: string;
	at: string;
	barber: string | null;
	/** Registered by whoever is looking. */
	mine: boolean;
	note: string | null;
	photos: VisitPhoto[];
	/** The photos were removed (to save space, or on request). */
	photosGone: boolean;
}

export interface ClientFile {
	id: string;
	name: string | null;
	phone: string;
	consentAt: string | null;
	minor: boolean;
	visits: ClientVisit[];
}

/** A shrunk photo ready to upload. */
export interface ShotFile {
	angle: PhotoAngle;
	full: Blob;
	thumb: Blob;
	/** 'webp', or 'jpg' where the phone cannot encode WebP. */
	ext: 'webp' | 'jpg';
}

/** A visit saved on the phone, waiting to reach the server. */
export interface VisitDraft {
	id: string;
	/** An existing customer by id, or a new one by WhatsApp. */
	customer: { id?: string; phone?: string; name?: string | null };
	note: string | null;
	/** The customer authorises keeping their photos (asked once). */
	consent: boolean;
	minor: boolean;
	photos: ShotFile[];
	/** When it was saved on the phone (ISO). */
	at: string;
}

export interface PhotoUsage {
	bytes: number;
	photos: number;
	visits: number;
	clients: number;
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
	/** The base the drawer opened with that day. */
	openingCash: number;
	/** Cash taken out of the drawer that day (not voided) when it was counted. */
	cashOut: number;
	expectedCash: number;
	countedCash: number;
	difference: number;
	notes: string | null;
}

/** Cash taken out of the drawer ("sacar efectivo"): for what, by whom, and whether it was voided. */
export interface CashOut {
	id: string;
	date: string;
	amount: number;
	reason: string;
	takenAt: string;
	takenBy: string | null;
	voidedAt: string | null;
	voidedBy: string | null;
	voidReason: string | null;
}

/** The cash the drawer started a business day with ("abrir caja"). */
export interface Opening {
	date: string;
	amount: number;
	openedAt: string;
	openedBy: string | null;
	/** Set when the base was corrected after the first opening. */
	changedAt: string | null;
	changedBy: string | null;
}

/** The register's cash for one business day, its opening and its closing. */
export interface CashDay {
	date: string;
	/** Base + cash charged that day − cash paid to barbers − cash taken out. */
	expectedCash: number;
	openingCash: number;
	cashIn: number;
	paidOut: number;
	/** Cash taken out of the drawer (not voided). */
	takenOut: number;
	/** Every salida of the day, voided ones included, newest first. */
	outs: CashOut[];
	opening: Opening | null;
	/** The base of the last day opened before this one, to suggest it. */
	lastBase: number | null;
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
	/**
	 * Charges a bill. Idempotent on id: retrying the same id never charges twice.
	 * Throws RepeatError when the same bill was charged minutes ago, unless `repeat` says it is
	 * another customer.
	 */
	registerSale(
		id: string,
		lines: BillLineInput[],
		payments: PaymentInput[],
		customer?: CustomerInput | null,
		repeat?: boolean
	): Promise<ChargeResult>;
	voidSale(id: string, reason: string): Promise<void>;
	/** Bills of the current business day, newest first. */
	todaySales(): Promise<SaleRecord[]>;
	/** Bills of one business day, newest first (admin: any day; cashier: today and yesterday). */
	daySales(date: string): Promise<SaleRecord[]>;
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
	/** Admin: units that arrived (in), a count that replaces the figure (count), or stop keeping inventory (off). Returns the new stock. */
	adjustStock(itemId: string, kind: 'in' | 'count' | 'off', qty?: number | null, note?: string | null): Promise<number | null>;
	/** Admin: the latest changes to an item's stock, newest first. */
	stockMoves(itemId: string): Promise<StockMove[]>;
	customers(query: string): Promise<CustomerStat[]>;
	shopSettings(): Promise<ShopSettings>;
	saveShopSettings(settings: ShopSettings): Promise<void>;
	/** Register and admin: the cash of a business day and its closing. */
	cashDay(date: string): Promise<CashDay>;
	/** Opens the register with this base, or corrects it while the day is open. Today unless a date is given (admin). */
	openRegister(amount: number, date?: string): Promise<Opening>;
	closeRegister(date: string, counted: number, notes: string | null): Promise<Closing>;
	/** Takes cash out of the drawer (today, or an earlier open day for the admin). */
	takeCash(amount: number, reason: string, date?: string): Promise<CashOut>;
	/** Voids a salida registered by mistake, while its day is open. */
	voidCashOut(id: string, reason: string): Promise<CashOut>;
	/** Admin: closings between two business dates, newest first. */
	closings(from: string, to: string): Promise<Closing[]>;
	/** Admin: salidas between two business dates, voided ones included, newest first. */
	cashOuts(from: string, to: string): Promise<CashOut[]>;
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
	/** Staff: customers by WhatsApp digits (4+) or name; empty: the latest visited. */
	findClients(query: string): Promise<ClientMatch[]>;
	/** Staff: a customer with their visits and photos. Null when not in this shop. */
	clientFile(customerId: string): Promise<ClientFile | null>;
	/**
	 * Uploads a visit and its photos. Idempotent on draft.id: retrying finishes what is missing.
	 * Returns the customer id. Keeps only the customer's last 3 visits with photos.
	 */
	saveVisit(draft: VisitDraft): Promise<string>;
	/**
	 * Admin: removes every photo of a customer (visits and notes stay) and withdraws consent.
	 * False when the files could not be deleted yet (they go on the next try).
	 */
	forgetClientPhotos(customerId: string): Promise<boolean>;
	/** Admin: space the photos use. Also deletes files left waiting in the trash. */
	photoUsage(): Promise<PhotoUsage>;
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

/** The bill the cashier is about to charge again. receiptNo is null while it waits to be sent. */
export interface TwinSale {
	receiptNo: number | null;
	createdAt: string;
	total: number;
	methods: PayMethod[];
	cashier: string | null;
}
/** The same bill was charged minutes ago: ask before charging it again. */
export class RepeatError extends AppError {
	constructor(readonly twin: TwinSale) {
		super('Ya se cobró una cuenta igual hace un momento');
	}
}
