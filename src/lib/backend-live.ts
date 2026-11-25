import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, loginEmail } from './config.js';
import {
	AppError,
	NetworkError,
	RepeatError,
	type Backend,
	type BoardRow,
	type BonusRule,
	type CashOut,
	type CatalogItem,
	type ClientVisit,
	type Customer,
	type PhotoAngle,
	type DayTotals,
	type PayMethod,
	type Profile,
	type SaleRecord,
	type StaffMember
} from './types.js';

/** Our own database errors carry a Spanish message meant for the cashier; anything else is transport. */
function toError(error: { message?: string; code?: string } | null, fallback: string): AppError {
	const msg = error?.message ?? '';
	if (typeof navigator !== 'undefined' && !navigator.onLine) return new NetworkError('Sin conexión.');
	if (!error?.code && /fetch|network|timeout|load failed/i.test(msg)) return new NetworkError('Sin conexión.');
	// An expired or revoked login is not the bill's fault: keep it queued until the user enters again.
	if (error?.code === 'PGRST301' || error?.code === 'PGRST303' || /JWT/i.test(msg)) return new NetworkError('Tu sesión venció.');
	// Postgres' own permission errors are in English and mean a bug or a revoked role, never the user's typing.
	if (error?.code === '42501' && /^permission denied|row-level security/i.test(msg)) return new AppError('No tienes permiso para hacer esto. Si debería funcionar, avísale al administrador.');
	if (error?.code === '23505' && /username/.test(msg)) return new AppError('Ese usuario ya existe en el local.');
	if (error?.code && ['22023', '42501', '23505', 'P0001'].includes(error.code) && msg) return new AppError(msg);
	return new AppError(fallback);
}

const CASH_OUT =
	'id, business_date, amount, reason, taken_at, voided_at, void_reason, taker:staff!cash_outs_taken_by_fkey(display_name), voider:staff!cash_outs_voided_by_fkey(display_name)';

function cashOutFrom(r: Record<string, unknown>): CashOut {
	const name = (x: unknown) => (x as { display_name: string | null } | null)?.display_name ?? null;
	return {
		id: r.id as string,
		date: r.business_date as string,
		amount: r.amount as number,
		reason: r.reason as string,
		takenAt: r.taken_at as string,
		takenBy: name(r.taker),
		voidedAt: (r.voided_at as string | null) ?? null,
		voidedBy: name(r.voider),
		voidReason: (r.void_reason as string | null) ?? null
	};
}

const PHOTOS = 'client-photos';
/** Signed links last 6 hours; this phone reuses them for 5, so a thumbnail seen twice downloads once. */
const SIGN_FOR = 6 * 3600;
const REUSE_FOR = 5 * 3600 * 1000;
const LINKS = 'barbeer-photo-links';

/** Storage errors: offline is a connection problem; a refused upload means the visit no longer takes photos. */
function storageError(e: { message?: string; statusCode?: string | number } | null, fallback: string): AppError {
	const msg = e?.message ?? '';
	const code = String(e?.statusCode ?? '');
	if (typeof navigator !== 'undefined' && !navigator.onLine) return new NetworkError('Sin conexión.');
	if (/fetch|network|timeout|load failed/i.test(msg) && !code) return new NetworkError('Sin conexión.');
	if (code === '413' || /too large|maximum allowed size/i.test(msg)) return new AppError('Una foto pesa demasiado. Tómala de nuevo.');
	if (code === '403' || /row-level security|unauthorized/i.test(msg))
		return new AppError('La visita ya no acepta fotos (pasaron más de 3 días o el cliente retiró su autorización).');
	return new AppError(fallback);
}

function ruleFrom(r: Record<string, unknown>): BonusRule {
	return {
		id: r.id as string,
		name: r.name as string,
		period: r.period as BonusRule['period'],
		metric: r.metric as BonusRule['metric'],
		threshold: r.threshold as number,
		rewardType: r.reward_type as BonusRule['rewardType'],
		rewardValue: Number(r.reward_value),
		active: r.active as boolean
	};
}

export function createLiveBackend(): Backend {
	const sb: SupabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
		auth: { persistSession: true, autoRefreshToken: true }
	});

	let shopId = '';

	// The last good profile and catalog, so the register opens and charges into the queue offline.
	const PROFILE = 'barbeer-profile';
	const profileName = () => recall<Profile>(PROFILE)?.displayName ?? null;
	const CATALOG = 'barbeer-catalog';
	const remember = (key: string, value: unknown) => {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			/* storage blocked */
		}
	};
	const recall = <T>(key: string): T | null => {
		try {
			const raw = localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : null;
		} catch {
			return null;
		}
	};
	const offline = () => typeof navigator !== 'undefined' && !navigator.onLine;
	/** The user id in the saved login, read without the network (getSession may refuse an expired token offline). */
	function storedUserId(): string | null {
		try {
			const key = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
			return key ? (JSON.parse(localStorage.getItem(key) ?? 'null')?.user?.id ?? null) : null;
		} catch {
			return null;
		}
	}

	// ─── Photos ─────────────────────────────────────────────────────────────
	/** Signed links for private photos, reusing the ones this phone already has. */
	async function signed(paths: string[]): Promise<Record<string, string>> {
		const now = Date.now();
		const cache = recall<Record<string, { url: string; until: number }>>(LINKS) ?? {};
		for (const k of Object.keys(cache)) if (cache[k].until < now) delete cache[k];
		const out: Record<string, string> = {};
		const missing: string[] = [];
		for (const p of new Set(paths)) {
			if (cache[p]) out[p] = cache[p].url;
			else missing.push(p);
		}
		if (missing.length) {
			const { data, error } = await sb.storage.from(PHOTOS).createSignedUrls(missing, SIGN_FOR);
			if (error) throw storageError(error, 'No se pudieron cargar las fotos.');
			for (const x of data ?? []) {
				if (!x.signedUrl || !x.path) continue;
				out[x.path] = x.signedUrl;
				cache[x.path] = { url: x.signedUrl, until: now + REUSE_FOR };
			}
			// Keep the newest 400 links at most.
			const keys = Object.keys(cache).sort((a, b) => cache[b].until - cache[a].until);
			for (const k of keys.slice(400)) delete cache[k];
			remember(LINKS, cache);
		}
		return out;
	}

	/** Removes the files waiting in the trash (older visits beyond the last 3). Best effort: the next upload tries again. */
	async function empty(trash: string[] | null) {
		if (!trash?.length) return;
		try {
			const { error } = await sb.storage.from(PHOTOS).remove(trash);
			if (!error) await sb.rpc('photo_trash_done');
		} catch {
			/* next time */
		}
	}

	async function loadProfile(userId: string): Promise<Profile | null> {
		const { data, error } = await sb
			.from('staff')
			.select('id, shop_id, role, display_name, cuts, shops(name)')
			.eq('user_id', userId)
			.eq('active', true)
			.maybeSingle();
		if (error) {
			const cached = recall<Profile & { userId: string }>(PROFILE);
			if (cached && cached.userId === userId && (offline() || toError(error, '') instanceof NetworkError)) {
				shopId = cached.shopId;
				return cached;
			}
			throw new AppError('No se pudo cargar tu perfil. Revisa la conexión.');
		}
		if (!data) {
			await sb.auth.signOut();
			throw new AppError('Tu usuario no está activo en ningún local. Habla con el administrador.');
		}
		shopId = data.shop_id;
		const profile: Profile = {
			staffId: data.id,
			shopId: data.shop_id,
			shopName: (data.shops as unknown as { name: string } | null)?.name ?? '',
			role: data.role,
			displayName: data.display_name,
			cuts: data.cuts
		};
		remember(PROFILE, { ...profile, userId });
		return profile;
	}

	async function salesOn(date: string): Promise<SaleRecord[]> {
		const { data, error } = await sb
			.from('sales')
			.select(
				'id, receipt_no, receipt_token, receipt_sent_at, created_at, total, status, void_reason, customers(id, name, phone), sale_lines(line_no, item_name, qty, line_total, barber_id), payments(method, amount, cash_received)'
			)
			.eq('business_date', date)
			.order('created_at', { ascending: false });
		if (error) throw toError(error, 'No se pudieron cargar las cuentas.');
		return (data ?? []).map(
			(r): SaleRecord => ({
				id: r.id,
				receiptNo: r.receipt_no,
				createdAt: r.created_at,
				total: r.total,
				status: r.status,
				voidReason: r.void_reason,
				receiptToken: r.receipt_token,
				receiptSentAt: r.receipt_sent_at,
				customer: (r.customers as unknown as Customer | null) ?? null,
				lines: [...(r.sale_lines ?? [])]
					.sort((a, b) => a.line_no - b.line_no)
					.map((l) => ({ name: l.item_name, qty: l.qty, total: l.line_total, barberId: l.barber_id })),
				payments: (r.payments ?? []).map((p) => ({
					method: p.method as PayMethod,
					amount: p.amount,
					cashReceived: p.cash_received
				}))
			})
		);
	}

	return {
		mode: 'live',

		async restore() {
			const { data } = await sb.auth.getSession();
			const userId = data.session?.user.id ?? (offline() ? storedUserId() : null);
			return userId ? loadProfile(userId) : null;
		},

		async signIn(user, secret) {
			const { data: auth, error } = await sb.auth.signInWithPassword({ email: loginEmail(user), password: secret });
			if (error || !auth.user) {
				if (error?.status === 400) throw new AppError('Usuario o PIN incorrecto.');
				throw new AppError('No se pudo entrar. Revisa la conexión e intenta de nuevo.');
			}
			const profile = await loadProfile(auth.user.id);
			if (!profile) throw new AppError('No se pudo entrar.');
			return profile;
		},

		async signOut() {
			// Offline the global sign-out fails and would leave the login saved on a shared phone.
			const { error } = await sb.auth.signOut();
			if (error) await sb.auth.signOut({ scope: 'local' });
			try {
				localStorage.removeItem(PROFILE);
			} catch {
				/* storage blocked */
			}
		},

		async dayBoard() {
			const { data, error } = await sb.rpc('day_board');
			if (error) throw new AppError('No se pudo cargar el día.');
			return (data ?? []).map(
				(r: Record<string, number | string>): BoardRow => ({
					staffId: r.staff_id as string,
					name: r.display_name as string,
					cuts: r.cuts as number,
					services: r.services as number,
					revenue: r.revenue as number,
					commission: r.commission as number,
					goal: r.goal as number
				})
			);
		},

		async dayTotals() {
			const { data, error } = await sb.rpc('day_totals');
			if (error || !data?.[0]) throw new AppError('No se pudieron cargar los totales.');
			const r = data[0];
			return {
				date: r.business_date,
				bills: r.bills,
				total: r.total,
				cuts: r.cuts,
				cash: r.cash,
				transfer: r.transfer,
				card: r.card,
				voided: r.voided
			} satisfies DayTotals;
		},

		async catalog() {
			const { data, error } = await sb
				.from('catalog_items')
				.select('id, kind, name, price, commission_pct, counts_as_cut, stock, stock_min')
				.eq('active', true)
				.order('sort_order')
				.order('name');
			if (error) {
				const cached = recall<CatalogItem[]>(CATALOG);
				if (cached && (offline() || toError(error, '') instanceof NetworkError)) return cached;
				throw new AppError('No se pudo cargar el catálogo.');
			}
			const items = (data ?? []).map(
				(r): CatalogItem => ({
					id: r.id,
					kind: r.kind,
					name: r.name,
					price: r.price,
					commissionPct: Number(r.commission_pct),
					countsAsCut: r.counts_as_cut,
					stock: r.stock,
					stockMin: r.stock_min
				})
			);
			remember(CATALOG, items);
			return items;
		},

		async staff() {
			const { data, error } = await sb
				.from('staff')
				.select('id, role, display_name, username, user_id, active, cuts, daily_cut_goal, hired_on')
				.order('active', { ascending: false })
				.order('sort_order')
				.order('display_name');
			if (error) throw new AppError('No se pudo cargar el equipo.');
			return (data ?? []).map(
				(r): StaffMember => ({
					id: r.id,
					role: r.role,
					name: r.display_name,
					username: r.username,
					hasAccess: !!r.user_id,
					active: r.active,
					cuts: r.cuts,
					dailyCutGoal: r.daily_cut_goal,
					hiredOn: r.hired_on
				})
			);
		},

		async registerSale(id, lines, payments, customer, repeat = false) {
			if (!navigator.onLine) throw new NetworkError('Sin conexión.');
			const { data, error } = await sb.rpc('register_sale', {
				p_repeat: repeat,
				p_customer: customer?.phone
					? { phone: customer.phone, name: customer.name ?? null, promo: customer.promo ?? null }
					: null,
				p_id: id,
				p_lines: lines.map((l) => ({ item_id: l.itemId, qty: l.qty, barber_id: l.barberId })),
				p_payments: payments.map((p) => ({
					method: p.method,
					amount: p.amount,
					cash_received: p.method === 'cash' ? (p.cashReceived ?? null) : null
				}))
			});
			if (error?.code === 'BBR01') {
				let d: { receipt_no?: number; created_at?: string; total?: number; methods?: PayMethod[]; cashier?: string } = {};
				try {
					d = JSON.parse(error.details ?? '{}');
				} catch {
					/* the warning still stands without its details */
				}
				throw new RepeatError({
					receiptNo: d.receipt_no ?? null,
					createdAt: d.created_at ?? new Date().toISOString(),
					total: d.total ?? 0,
					methods: d.methods ?? [],
					cashier: d.cashier ?? null
				});
			}
			if (error) throw toError(error, 'No se pudo cobrar. Intenta de nuevo.');
			return {
				id: data.id,
				receiptNo: data.receipt_no,
				receiptToken: data.receipt_token,
				total: data.total,
				customerId: data.customer_id ?? null,
				duplicate: data.duplicate
			};
		},

		async voidSale(id, reason) {
			const { error } = await sb.rpc('void_sale', { p_id: id, p_reason: reason });
			if (error) throw toError(error, 'No se pudo anular.');
		},

		async todaySales() {
			const { data: totals, error: e1 } = await sb.rpc('day_totals');
			if (e1 || !totals?.[0]) throw toError(e1, 'No se pudieron cargar las cuentas de hoy.');
			return salesOn(totals[0].business_date);
		},

		daySales: (date) => salesOn(date),

		async searchCustomers(digits) {
			const d = digits.replace(/[^0-9]/g, '');
			if (d.length < 4) return [];
			const { data, error } = await sb
				.from('customers')
				.select('id, name, phone, promo_opt_in')
				.like('phone', `%${d}%`)
				.order('created_at', { ascending: false })
				.limit(5);
			if (error) throw toError(error, 'No se pudo buscar el cliente.');
			return (data ?? []).map((c) => ({ id: c.id, name: c.name, phone: c.phone, promo: c.promo_opt_in }));
		},

		async setSaleCustomer(id, customer) {
			const { data, error } = await sb.rpc('set_sale_customer', {
				p_id: id,
				p_customer: { phone: customer.phone, name: customer.name ?? null, promo: customer.promo ?? null }
			});
			if (error) throw toError(error, 'No se pudo guardar el cliente.');
			return { id: data.id, name: data.name, phone: data.phone };
		},

		async markReceiptSent(id) {
			await sb.rpc('mark_receipt_sent', { p_id: id });
		},

		async receiptSettings() {
			const { data, error } = await sb.from('shops').select('name, receipt_template').maybeSingle();
			if (error || !data) throw toError(error, 'No se pudo cargar la plantilla.');
			return { shopName: data.name, template: data.receipt_template };
		},

		async saveReceiptTemplate(template) {
			const { error } = await sb.from('shops').update({ receipt_template: template }).eq('id', shopId);
			if (error) throw toError(error, 'No se pudo guardar la plantilla.');
		},

		async myDayLines() {
			const { data, error } = await sb.rpc('my_day_lines');
			if (error) throw toError(error, 'No se pudieron cargar tus servicios.');
			return (data ?? []).map((r: Record<string, never>) => ({
				at: r.created_at,
				name: r.item_name,
				qty: r.qty,
				total: r.line_total,
				commission: r.commission,
				cut: r.counts_as_cut,
				status: r.status
			}));
		},

		async myHistory(from, to) {
			const { data, error } = await sb.rpc('my_history', { p_from: from, p_to: to });
			if (error) throw toError(error, 'No se pudo cargar tu historial.');
			return (data ?? []).map((r: Record<string, never>) => ({
				date: r.business_date,
				cuts: r.cuts,
				services: r.services,
				revenue: r.revenue,
				commission: r.commission
			}));
		},

		async myTotals() {
			const { data, error } = await sb.rpc('my_totals');
			if (error || !data?.[0]) throw toError(error, 'No se pudieron cargar tus totales.');
			const r = data[0];
			return { hiredOn: r.hired_on, firstDay: r.first_day, days: r.days, cuts: r.cuts, commission: r.commission };
		},

		async myGoals() {
			const { data, error } = await sb.rpc('my_goals');
			if (error) throw toError(error, 'No se pudieron cargar tus metas.');
			return (data ?? []).map((r: Record<string, never>) => ({
				id: r.rule_id,
				name: r.name,
				period: r.period,
				metric: r.metric,
				threshold: r.threshold,
				rewardType: r.reward_type,
				rewardValue: Number(r.reward_value),
				periodStart: r.period_start,
				periodEnd: r.period_end,
				progress: r.progress
			}));
		},

		async myAwards() {
			const { data, error } = await sb
				.from('bonus_awards')
				.select('period_start, amount, bonus_rules(name, period)')
				.order('period_start', { ascending: false })
				.limit(24);
			if (error) throw toError(error, 'No se pudieron cargar tus bonos.');
			return (data ?? []).map((r) => {
				const rule = r.bonus_rules as unknown as { name: string; period: 'day' | 'week' | 'month' } | null;
				return { ruleName: rule?.name ?? 'Bono', period: rule?.period ?? 'month', periodStart: r.period_start, amount: r.amount };
			});
		},

		async businessDate() {
			const { data, error } = await sb.rpc('business_date_at', { p_shop: shopId });
			if (error || !data) throw toError(error, 'No se pudo leer la fecha del local.');
			return data as string;
		},

		async saveStaff(input) {
			const row = {
				role: input.role,
				display_name: input.name.trim(),
				cuts: input.role === 'barber' ? true : input.cuts,
				daily_cut_goal: input.dailyCutGoal,
				hired_on: input.hiredOn,
				active: input.active
			};
			const q = input.id
				? sb.from('staff').update(row).eq('id', input.id)
				: sb.from('staff').insert({ ...row, shop_id: shopId });
			const { data, error } = await q
				.select('id, role, display_name, username, user_id, active, cuts, daily_cut_goal, hired_on')
				.single();
			if (error) throw toError(error, 'No se pudo guardar la persona.');
			return {
				id: data.id,
				role: data.role,
				name: data.display_name,
				username: data.username,
				hasAccess: !!data.user_id,
				active: data.active,
				cuts: data.cuts,
				dailyCutGoal: data.daily_cut_goal,
				hiredOn: data.hired_on
			};
		},

		async staffAccess(staffId, action, username, password) {
			const { data, error } = await sb.functions.invoke('create-staff', {
				body: { action, staff_id: staffId, username, password }
			});
			if (error) {
				let msg = 'No se pudo cambiar el acceso.';
				try {
					const body = await (error as { context?: Response }).context?.json();
					if (body?.error) msg = body.error;
				} catch {
					/* keep the generic message */
				}
				throw new AppError(msg);
			}
			if (data?.error) throw new AppError(data.error);
		},

		async overrides(staffId) {
			const { data, error } = await sb.from('commission_overrides').select('item_id, commission_pct').eq('staff_id', staffId);
			if (error) throw toError(error, 'No se pudieron cargar los porcentajes.');
			return (data ?? []).map((r) => ({ itemId: r.item_id, pct: Number(r.commission_pct) }));
		},

		async saveOverride(staffId, itemId, pct) {
			const { error } =
				pct == null
					? await sb.from('commission_overrides').delete().eq('staff_id', staffId).eq('item_id', itemId)
					: await sb
							.from('commission_overrides')
							.upsert(
								{ shop_id: shopId, staff_id: staffId, item_id: itemId, commission_pct: pct },
								{ onConflict: 'staff_id,item_id' }
							);
			if (error) throw toError(error, 'No se pudo guardar el porcentaje.');
		},

		async catalogAll() {
			const { data, error } = await sb
				.from('catalog_items')
				.select('id, kind, name, price, commission_pct, counts_as_cut, active, sort_order, stock, stock_min')
				.order('sort_order')
				.order('name');
			if (error) throw toError(error, 'No se pudo cargar el catálogo.');
			return (data ?? []).map((r) => ({
				id: r.id,
				kind: r.kind,
				name: r.name,
				price: r.price,
				commissionPct: Number(r.commission_pct),
				countsAsCut: r.counts_as_cut,
				active: r.active,
				sortOrder: r.sort_order,
				stock: r.stock,
				stockMin: r.stock_min
			}));
		},

		async saveItem(input) {
			const row = {
				kind: input.kind,
				name: input.name.trim(),
				price: input.price,
				commission_pct: input.commissionPct,
				counts_as_cut: input.kind === 'service' ? input.countsAsCut : false,
				active: input.active,
				sort_order: input.sortOrder,
				stock_min: input.kind === 'service' ? 0 : Math.max(0, Math.round(input.stockMin ?? 0))
			};
			const q = input.id
				? sb.from('catalog_items').update(row).eq('id', input.id)
				: sb.from('catalog_items').insert({ ...row, shop_id: shopId });
			const { data, error } = await q
				.select('id, kind, name, price, commission_pct, counts_as_cut, active, sort_order, stock, stock_min')
				.single();
			if (error) {
				if (error.code === '23505') throw new AppError('Ya existe un ítem con ese nombre en esa pestaña.');
				throw toError(error, 'No se pudo guardar.');
			}
			// A new drink or product can start its inventory right away.
			let stock: number | null = data.stock;
			if (!input.id && input.kind !== 'service' && input.stock != null) {
				const r = await sb.rpc('adjust_stock', { p_item: data.id, p_kind: 'count', p_qty: input.stock, p_note: null });
				if (r.error) throw toError(r.error, 'Se agregó, pero no se pudo guardar la cantidad. Escríbela en Inventario.');
				stock = r.data as number;
			}
			return {
				id: data.id,
				kind: data.kind,
				name: data.name,
				price: data.price,
				commissionPct: Number(data.commission_pct),
				countsAsCut: data.counts_as_cut,
				active: data.active,
				sortOrder: data.sort_order,
				stock,
				stockMin: data.stock_min
			};
		},

		async adjustStock(itemId, kind, qty = null, note = null) {
			const { data, error } = await sb.rpc('adjust_stock', { p_item: itemId, p_kind: kind, p_qty: qty, p_note: note });
			if (error) throw toError(error, 'No se pudo cambiar el inventario.');
			return data as number | null;
		},

		async stockMoves(itemId) {
			const { data, error } = await sb
				.from('stock_moves')
				.select('created_at, kind, delta, stock_after, note, sales(receipt_no), staff(display_name)')
				.eq('item_id', itemId)
				.order('created_at', { ascending: false })
				.limit(30);
			if (error) throw toError(error, 'No se pudo cargar el inventario.');
			return (data ?? []).map((r) => ({
				at: r.created_at,
				kind: r.kind,
				delta: r.delta,
				after: r.stock_after,
				receiptNo: (r.sales as unknown as { receipt_no: number } | null)?.receipt_no ?? null,
				by: (r.staff as unknown as { display_name: string } | null)?.display_name ?? null,
				note: r.note
			}));
		},

		async customers(query) {
			const { data, error } = await sb.rpc('customer_stats', { p_q: query || null });
			if (error) throw toError(error, 'No se pudieron cargar los clientes.');
			return (data ?? []).map((r: Record<string, never>) => ({
				id: r.id,
				name: r.name,
				phone: r.phone,
				promo: r.promo_opt_in,
				visits: r.visits,
				lastVisit: r.last_visit,
				spent: r.spent
			}));
		},

		async shopSettings() {
			const { data, error } = await sb.from('shops').select('name, daily_cut_goal, day_cutoff').maybeSingle();
			if (error || !data) throw toError(error, 'No se pudieron cargar los datos del local.');
			return { name: data.name, dailyCutGoal: data.daily_cut_goal, dayCutoff: String(data.day_cutoff).slice(0, 5) };
		},

		async saveShopSettings(settings) {
			const { error } = await sb
				.from('shops')
				.update({ name: settings.name.trim(), daily_cut_goal: settings.dailyCutGoal, day_cutoff: settings.dayCutoff })
				.eq('id', shopId);
			if (error) throw toError(error, 'No se pudieron guardar los datos del local.');
		},

		async cashDay(date) {
			const name = (x: unknown) => (x as { display_name: string } | null)?.display_name ?? null;
			const [{ data: cash, error: e1 }, { data: k, error: e2 }, { data: o, error: e3 }, { data: last, error: e4 }, { data: outs, error: e5 }] = await Promise.all([
				sb.rpc('cash_breakdown', { p_date: date }),
				sb
					.from('cash_closings')
					.select('business_date, closed_at, expected_cash, counted_cash, difference, notes, opening_cash, cash_out, staff(display_name)')
					.eq('business_date', date)
					.maybeSingle(),
				sb
					.from('cash_openings')
					.select(
						'business_date, amount, opened_at, changed_at, opener:staff!cash_openings_opened_by_fkey(display_name), changer:staff!cash_openings_changed_by_fkey(display_name)'
					)
					.eq('business_date', date)
					.maybeSingle(),
				sb.from('cash_openings').select('amount').lt('business_date', date).order('business_date', { ascending: false }).limit(1).maybeSingle(),
				sb.from('cash_outs').select(CASH_OUT).eq('business_date', date).order('taken_at', { ascending: false })
			]);
			if (e1 || e2 || e3 || e4 || e5) throw toError(e1 ?? e2 ?? e3 ?? e4 ?? e5, 'No se pudo cargar la caja.');
			const c = (cash as { opening: number; cash_in: number; paid_out: number; taken_out: number; expected: number }[] | null)?.[0];
			return {
				date,
				expectedCash: c?.expected ?? 0,
				openingCash: c?.opening ?? 0,
				cashIn: c?.cash_in ?? 0,
				paidOut: c?.paid_out ?? 0,
				takenOut: c?.taken_out ?? 0,
				outs: (outs ?? []).map(cashOutFrom),
				opening: o
					? {
							date: o.business_date,
							amount: o.amount,
							openedAt: o.opened_at,
							openedBy: name(o.opener),
							changedAt: o.changed_at,
							changedBy: name(o.changer)
						}
					: null,
				lastBase: last?.amount ?? null,
				closing: k
					? {
							date: k.business_date,
							closedAt: k.closed_at,
							closedBy: name(k.staff),
							openingCash: k.opening_cash,
							cashOut: k.cash_out ?? 0,
							expectedCash: k.expected_cash,
							countedCash: k.counted_cash,
							difference: k.difference,
							notes: k.notes
						}
					: null
			};
		},

		async openRegister(amount, date) {
			const { data, error } = await sb.rpc('open_register', { p_amount: amount, p_date: date ?? null });
			if (error) throw toError(error, 'No se pudo abrir la caja.');
			return {
				date: data.business_date,
				amount: data.amount,
				openedAt: data.opened_at,
				openedBy: null,
				changedAt: data.changed_at,
				changedBy: null
			};
		},

		async closeRegister(date, counted, notes) {
			const { data, error } = await sb.rpc('close_register', { p_date: date, p_counted: counted, p_notes: notes });
			if (error) throw toError(error, 'No se pudo cerrar la caja.');
			return {
				date: data.business_date,
				closedAt: data.closed_at,
				closedBy: null,
				openingCash: data.opening_cash,
				cashOut: data.cash_out ?? 0,
				expectedCash: data.expected_cash,
				countedCash: data.counted_cash,
				difference: data.difference,
				notes: data.notes
			};
		},

		async takeCash(amount, reason, date) {
			const { data, error } = await sb.rpc('take_cash', { p_amount: amount, p_reason: reason, p_date: date ?? null });
			if (error) throw toError(error, 'No se pudo registrar la salida.');
			return cashOutFrom({ ...data, taker: { display_name: profileName() } });
		},

		async voidCashOut(id, reason) {
			const { data, error } = await sb.rpc('void_cash_out', { p_id: id, p_reason: reason });
			if (error) throw toError(error, 'No se pudo anular la salida.');
			return cashOutFrom({ ...data, voider: { display_name: profileName() } });
		},

		async cashOuts(from, to) {
			const { data, error } = await sb
				.from('cash_outs')
				.select(CASH_OUT)
				.gte('business_date', from)
				.lte('business_date', to)
				.order('taken_at', { ascending: false });
			if (error) throw toError(error, 'No se pudieron cargar las salidas.');
			return (data ?? []).map(cashOutFrom);
		},

		async closings(from, to) {
			const { data, error } = await sb.rpc('closing_history', { p_from: from, p_to: to });
			if (error) throw toError(error, 'No se pudieron cargar los cierres.');
			return (data ?? []).map((r: Record<string, never>) => ({
				date: r.business_date,
				closedAt: r.closed_at,
				closedBy: r.closed_by,
				openingCash: r.opening_cash ?? 0,
				cashOut: r.cash_out ?? 0,
				expectedCash: r.expected_cash,
				countedCash: r.counted_cash,
				difference: r.difference,
				notes: r.notes
			}));
		},

		async bonusRules() {
			const { data, error } = await sb
				.from('bonus_rules')
				.select('id, name, period, metric, threshold, reward_type, reward_value, active')
				.order('active', { ascending: false })
				.order('created_at');
			if (error) throw toError(error, 'No se pudieron cargar los bonos.');
			return (data ?? []).map(ruleFrom);
		},

		async saveBonusRule(input) {
			const row = {
				name: input.name.trim(),
				period: input.period,
				metric: input.metric,
				threshold: input.threshold,
				reward_type: input.rewardType,
				reward_value: input.rewardValue,
				active: input.active
			};
			const q = input.id
				? sb.from('bonus_rules').update(row).eq('id', input.id)
				: sb.from('bonus_rules').insert({ ...row, shop_id: shopId });
			const { data, error } = await q
				.select('id, name, period, metric, threshold, reward_type, reward_value, active')
				.single();
			if (error) throw toError(error, 'No se pudo guardar el bono.');
			return ruleFrom(data);
		},

		async awardBonuses() {
			const { data, error } = await sb.rpc('award_bonuses');
			if (error) throw toError(error, 'No se pudieron calcular los bonos.');
			return data as number;
		},

		async payoutSummary(from, to) {
			const { data, error } = await sb.rpc('payout_summary', { p_from: from, p_to: to });
			if (error) throw toError(error, 'No se pudieron cargar los pagos.');
			return (data ?? []).map((r: Record<string, never>) => ({
				staffId: r.staff_id,
				name: r.display_name,
				cuts: r.cuts,
				commission: r.commission,
				bonus: r.bonus,
				paid: r.paid,
				owed: r.owed,
				owedBefore: r.owed_before,
				lastPaidAt: r.last_paid_at
			}));
		},

		async settleSummary(staffId, from, to) {
			const { data: j, error } = await sb.rpc('settle_summary', { p_staff: staffId, p_from: from, p_to: to });
			if (error || !j) throw toError(error, 'No se pudo cargar la liquidación.');
			return {
				name: j.name,
				cuts: j.cuts,
				services: j.services,
				revenue: j.revenue,
				commission: j.commission,
				commissionPaid: j.commission_paid,
				bonus: j.bonus,
				bonusPaid: j.bonus_paid,
				bonusToday: j.bonus_today,
				days: j.days,
				items: j.items,
				bonuses: (j.bonuses as Record<string, never>[]).map((b) => ({
					name: b.name,
					periodStart: b.period_start,
					amount: b.amount,
					paid: b.paid,
					today: b.today,
					payable: b.payable
				})),
				payouts: (j.payouts as Record<string, never>[]).map((p) => ({
					id: p.id,
					paidAt: p.paid_at,
					total: p.total,
					method: p.method,
					paidBy: p.paid_by,
					from: p.from,
					to: p.to
				})),
				owedBefore: j.owed_before,
				owedFrom: j.owed_from
			};
		},

		async payBarber(staffId, from, to, method, expected) {
			const { data: r, error } = await sb.rpc('pay_barber', {
				p_staff: staffId,
				p_from: from,
				p_to: to,
				p_method: method,
				p_expected: expected
			});
			if (error || !r) throw toError(error, 'No se pudo registrar el pago.');
			return {
				id: r.id,
				paidAt: r.paid_at,
				commission: r.commission,
				bonus: r.bonus,
				total: r.total,
				cuts: r.cuts,
				method: r.method,
				paidBy: r.paid_by
			};
		},

		async reportSummary(from, to) {
			const { data, error } = await sb.rpc('report_summary', { p_from: from, p_to: to });
			if (error || !data) throw toError(error, 'No se pudo cargar el reporte.');
			return {
				total: data.total,
				bills: data.bills,
				voided: data.voided,
				cuts: data.cuts,
				commission: data.commission,
				methods: { cash: 0, transfer: 0, card: 0, ...data.methods },
				byBarber: data.by_barber,
				byItem: data.by_item,
				byDay: (data.by_day as { day: string; total: number; bills: number }[]).map((d) => ({
					date: d.day,
					total: d.total,
					bills: d.bills
				}))
			};
		},

		async reportLines(from, to) {
			const { data, error } = await sb.rpc('report_lines', { p_from: from, p_to: to });
			if (error) throw toError(error, 'No se pudo preparar el CSV.');
			return (data ?? []).map((r: Record<string, never>) => ({
				date: r.business_date,
				receiptNo: r.receipt_no,
				createdAt: r.created_at,
				item: r.item_name,
				kind: r.item_kind,
				qty: r.qty,
				total: r.line_total,
				barber: r.barber,
				commission: r.commission,
				status: r.status,
				payment: r.payment,
				customer: r.customer
			}));
		},

		async voidedSales(from, to) {
			const { data, error } = await sb.rpc('voided_sales', { p_from: from, p_to: to });
			if (error) throw toError(error, 'No se pudieron cargar las anulaciones.');
			return (data ?? []).map((r: Record<string, never>) => ({
				id: r.id,
				receiptNo: r.receipt_no,
				date: r.business_date,
				createdAt: r.created_at,
				total: r.total,
				voidedAt: r.voided_at,
				reason: r.void_reason,
				voidedBy: r.voided_by,
				cashier: r.cashier
			}));
		},

		async findClients(query) {
			const { data, error } = await sb.rpc('find_clients', { p_q: query.trim() || null });
			if (error) throw toError(error, 'No se pudo buscar el cliente.');
			return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
				id: r.id as string,
				name: (r.name as string | null) ?? null,
				phone: r.phone as string,
				visits: r.visits as number,
				lastVisit: (r.last_visit as string | null) ?? null,
				consent: r.consent as boolean
			}));
		},

		async clientFile(customerId) {
			const { data, error } = await sb.rpc('client_file', { p_customer: customerId });
			if (error) throw toError(error, 'No se pudo abrir el cliente.');
			if (!data) return null;
			const raw = data as {
				id: string; name: string | null; phone: string; consent_at: string | null; minor: boolean;
				visits: { id: string; at: string; barber: string | null; mine: boolean; note: string | null; photos_gone: boolean;
					photos: { angle: PhotoAngle; path: string; thumb: string }[] }[];
			};
			const links = await signed(raw.visits.flatMap((v) => v.photos.flatMap((p) => [p.thumb, p.path])));
			const visits: ClientVisit[] = raw.visits.map((v) => ({
				id: v.id,
				at: v.at,
				barber: v.barber,
				mine: v.mine,
				note: v.note,
				photosGone: v.photos_gone,
				photos: v.photos
					.filter((p) => links[p.thumb] && links[p.path])
					.map((p) => ({ angle: p.angle, thumb: links[p.thumb], full: links[p.path] }))
			}));
			return { id: raw.id, name: raw.name, phone: raw.phone, consentAt: raw.consent_at, minor: raw.minor, visits };
		},

		async saveVisit(d) {
			const { data: r, error } = await sb.rpc('start_visit', {
				p_id: d.id,
				p_customer: d.customer,
				p_note: d.note,
				p_consent: d.consent,
				p_minor: d.minor,
				p_photos: d.photos.length,
				p_at: d.at
			});
			if (error) throw toError(error, 'No se pudo guardar la visita.');
			const v = r as { visit_id: string; customer_id: string; shop_id: string };
			const base = `${v.shop_id}/${v.customer_id}/${v.visit_id}`;
			const bucket = sb.storage.from(PHOTOS);
			// A file already there is a retry after a cut connection: it counts as uploaded.
			const put = async (name: string, blob: Blob, ext: string) => {
				const { error: e } = await bucket.upload(`${base}/${name}`, blob, {
					contentType: ext === 'jpg' ? 'image/jpeg' : 'image/webp',
					cacheControl: '31536000',
					upsert: false
				});
				const status = String((e as { statusCode?: string | number } | null)?.statusCode ?? '');
				if (e && !(status === '409' || /already exists|duplicate/i.test(e.message))) throw storageError(e, 'No se pudo subir una foto.');
			};
			await Promise.all(
				d.photos.flatMap((p) => [put(`${p.angle}.${p.ext}`, p.full, p.ext), put(`${p.angle}-t.${p.ext}`, p.thumb, p.ext)])
			);
			const { data: trash, error: e2 } = await sb.rpc('finish_visit', {
				p_id: d.id,
				p_photos: d.photos.map((p) => ({ angle: p.angle, ext: p.ext }))
			});
			if (e2) throw toError(e2, 'No se pudo guardar la visita.');
			await empty(trash as string[] | null);
			return v.customer_id;
		},

		async forgetClientPhotos(customerId) {
			const { data, error } = await sb.rpc('forget_client_photos', { p_customer: customerId });
			if (error) throw toError(error, 'No se pudieron borrar las fotos.');
			await empty(data as string[] | null);
		},

		async photoUsage() {
			const { data, error } = await sb.rpc('photo_usage');
			if (error) throw toError(error, 'No se pudo leer el espacio de las fotos.');
			const u = data as { bytes: number; photos: number; visits: number; clients: number };
			return { bytes: Number(u.bytes), photos: Number(u.photos), visits: Number(u.visits), clients: Number(u.clients) };
		},

		async publicReceipt(token) {
			const { data, error } = await sb.rpc('get_receipt', { p_token: token });
			if (error) throw toError(error, 'No se pudo cargar la boleta.');
			if (!data) return null;
			return {
				shop: data.shop,
				receiptNo: data.receipt_no,
				createdAt: data.created_at,
				status: data.status,
				total: data.total,
				customer: data.customer,
				lines: data.lines,
				payments: data.payments
			};
		},

		onAuthLost(cb) {
			const { data } = sb.auth.onAuthStateChange((event) => {
				if (event === 'SIGNED_OUT') cb();
			});
			return () => data.subscription.unsubscribe();
		},

		onSalesChange(cb) {
			const channel = sb
				.channel('sales-live')
				.on('postgres_changes', { event: '*', schema: 'public', table: 'sale_lines' }, () => cb())
				.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sales' }, () => cb())
				.subscribe();
			return () => {
				sb.removeChannel(channel);
			};
		},

		reportError(message, context) {
			sb.from('client_errors')
				.insert({ message: message.slice(0, 2000), context: context ?? null })
				.then(() => {});
		}
	};
}
