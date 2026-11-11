// Database tests: run every migration in an in-memory Postgres (PGlite) that imitates
// Supabase's auth schema and default grants, then check money logic and permissions.
//   npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const db = new PGlite();

let passed = 0;
const failures = [];
async function test(name, fn) {
	try {
		await fn();
		passed++;
		console.log(`  ok   ${name}`);
	} catch (e) {
		failures.push(name);
		console.log(`  FAIL ${name}\n       ${e.message}`);
	} finally {
		await db.exec('reset role');
	}
}
function eq(actual, expected, label = '') {
	const a = JSON.stringify(actual);
	const b = JSON.stringify(expected);
	if (a !== b) throw new Error(`${label} expected ${b}, got ${a}`);
}
async function rejects(promise, fragment) {
	try {
		await promise;
	} catch (e) {
		if (fragment && !String(e.message).includes(fragment))
			throw new Error(`error "${e.message}" does not mention "${fragment}"`);
		return;
	}
	throw new Error(`expected an error${fragment ? ` mentioning "${fragment}"` : ''}`);
}
async function as(userId, sql, params = []) {
	await db.exec('reset role');
	if (userId === 'anon') {
		await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon;`);
	} else {
		await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
		await db.exec('set role authenticated');
	}
	const r = await db.query(sql, params);
	await db.exec('reset role');
	return r.rows;
}
const one = async (...a) => (await as(...a))[0];

// ─── Supabase imitation ─────────────────────────────────────────────────────
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase's defaults: everything in public is granted to the API roles.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

const migrations = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const f of migrations) {
	try {
		await db.exec(readFileSync(join(root, 'migrations', f), 'utf8'));
	} catch (e) {
		console.error(`Migration ${f} failed: ${e.message}`);
		process.exit(1);
	}
}
console.log(`Applied ${migrations.length} migrations.`);

// ─── Fixtures ───────────────────────────────────────────────────────────────
const U = {
	admin: '00000000-0000-0000-0000-00000000000a',
	cashier: '00000000-0000-0000-0000-00000000000c',
	kike: '00000000-0000-0000-0000-0000000000b1',
	dago: '00000000-0000-0000-0000-0000000000b2',
	otherAdmin: '00000000-0000-0000-0000-0000000000f1'
};
await db.exec(`
  insert into auth.users values
    ('${U.admin}', 'admin@barbeer.test'), ('${U.cashier}', 'luisa@staff.test'),
    ('${U.kike}', 'kike@staff.test'), ('${U.dago}', 'dago@staff.test'),
    ('${U.otherAdmin}', 'otro@otro.test');
  select public.bootstrap_shop('bar-beer', 'Bar Beer', 'admin@barbeer.test', 'Admin');
  select public.bootstrap_shop('otro', 'Otra Barbería', 'otro@otro.test', 'Otro');
`);
await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'));
await db.exec(`
  update public.staff set user_id = '${U.cashier}' where username = 'luisa';
  update public.staff set user_id = '${U.kike}' where username = 'kike';
  update public.staff set user_id = '${U.dago}' where username = 'dago';
  insert into public.commission_overrides (shop_id, staff_id, item_id, commission_pct)
  select s.shop_id, s.id, i.id, 60 from public.staff s join public.catalog_items i on i.shop_id = s.shop_id
  where s.username = 'kike' and i.name = 'Corte + barba';
`);
const ids = {};
for (const r of (await db.query(`select username as k, id from public.staff where shop_id = (select id from shops where slug='bar-beer')
                                 union all select name, id from public.catalog_items`)).rows)
	ids[r.k] = r.id;

const sale1 = '11111111-1111-1111-1111-111111111111';
const lines1 = JSON.stringify([
	{ item_id: ids['Corte + barba'], qty: 1, barber_id: ids.kike },
	{ item_id: ids['Cerveza'], qty: 2 },
	{ item_id: ids['Corte'], qty: 1, barber_id: ids.dago }
]);
const pay1 = JSON.stringify([
	{ method: 'cash', amount: 40000, cash_received: 50000 },
	{ method: 'transfer', amount: 22000 }
]);

console.log('\nMoney');
await test('cashier registers a multi-item bill with mixed payment', async () => {
	const r = await one(U.cashier, `select public.register_sale($1, $2, $3) as r`, [sale1, lines1, pay1]);
	eq(r.r.receipt_no, 1, 'receipt_no');
	eq(r.r.total, 62000, 'total');
	eq(r.r.duplicate, false, 'duplicate');
});
await test('commission uses the per-barber override, then the item percentage', async () => {
	const rows = (
		await db.query(`select item_name, barber_id is not null as b, commission_pct::float as pct, commission_amount as amt, counts_as_cut as cut
		                from sale_lines where sale_id = $1 order by item_name`, [sale1])
	).rows;
	eq(rows, [
		{ item_name: 'Cerveza', b: false, pct: 0, amt: 0, cut: false },
		{ item_name: 'Corte', b: true, pct: 50, amt: 10000, cut: true },
		{ item_name: 'Corte + barba', b: true, pct: 60, amt: 18000, cut: true }
	]);
});
await test('retrying the same bill id does not duplicate it', async () => {
	const r = await one(U.cashier, `select public.register_sale($1, $2, $3) as r`, [sale1, lines1, pay1]);
	eq([r.r.receipt_no, r.r.duplicate], [1, true]);
	eq((await db.query(`select count(*)::int as n from sales`)).rows[0].n, 1, 'sales count');
});
await test('next bill gets the next receipt number', async () => {
	const r = await one(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2) as r`, [
		JSON.stringify([{ item_id: ids['Cera mate'], qty: 1 }]),
		JSON.stringify([{ method: 'card', amount: 25000 }])
	]);
	eq(r.r.receipt_no, 2);
});
await test('payments that do not add up to the total are refused', () =>
	rejects(
		as(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2)`, [
			JSON.stringify([{ item_id: ids['Corte'], qty: 1, barber_id: ids.kike }]),
			JSON.stringify([{ method: 'cash', amount: 1000 }])
		]),
		'no suman'
	));
await test('a service without a barber is refused', () =>
	rejects(
		as(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2)`, [
			JSON.stringify([{ item_id: ids['Corte'], qty: 1 }]),
			JSON.stringify([{ method: 'cash', amount: 20000 }])
		]),
		'Falta el barbero'
	));
await test('an item from another shop is refused', async () => {
	const foreign = (await db.query(`insert into catalog_items (shop_id, kind, name, price) select id, 'drink', 'Ron', 1000 from shops where slug='otro' returning id`)).rows[0].id;
	await rejects(
		as(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2)`, [
			JSON.stringify([{ item_id: foreign, qty: 1 }]),
			JSON.stringify([{ method: 'cash', amount: 1000 }])
		]),
		'no disponible'
	);
});
await test('a barber cannot charge', () =>
	rejects(
		as(U.kike, `select public.register_sale(gen_random_uuid(), $1, $2)`, [
			JSON.stringify([{ item_id: ids['Cerveza'], qty: 1 }]),
			JSON.stringify([{ method: 'cash', amount: 6000 }])
		]),
		'permiso'
	));
await test('a failed bill leaves nothing behind (receipt counter included)', async () => {
	eq((await db.query(`select count(*)::int as n from sales`)).rows[0].n, 2, 'sales');
	eq((await db.query(`select next_receipt_no from shops where slug='bar-beer'`)).rows[0].next_receipt_no, 3, 'counter');
});
await test('changing a price later does not move a charged bill', async () => {
	await as(U.admin, `update catalog_items set price = 99000 where id = $1`, [ids['Corte']]);
	const r = (await db.query(`select unit_price from sale_lines where sale_id = $1 and item_name = 'Corte'`, [sale1])).rows[0];
	eq(r.unit_price, 20000);
	await db.query(`update catalog_items set price = 20000 where id = $1`, [ids['Corte']]);
});

console.log('\nBoards');
await test('cashier sees every barber on the day board', async () => {
	const rows = await as(U.cashier, `select display_name, cuts, revenue, commission, goal from public.day_board()`);
	eq(rows.map((r) => r.display_name), ['Dago', 'Kike', 'Mono', 'Brayan', 'Jota']);
	eq(rows.find((r) => r.display_name === 'Kike'), { display_name: 'Kike', cuts: 1, revenue: 30000, commission: 18000, goal: 8 });
});
await test('barber sees only his own row', async () => {
	const rows = await as(U.kike, `select display_name, cuts, commission from public.day_board()`);
	eq(rows, [{ display_name: 'Kike', cuts: 1, commission: 18000 }]);
});
await test('day totals split by payment method', async () => {
	const t = await one(U.admin, `select bills, total, cuts, cash, transfer, card from public.day_totals()`);
	eq(t, { bills: 2, total: 87000, cuts: 2, cash: 40000, transfer: 22000, card: 25000 });
});

console.log('\nVoids and closing');
await test('void needs a reason', () => rejects(as(U.cashier, `select public.void_sale($1, '')`, [sale1]), 'motivo'));
await test('void keeps the bill, struck, and drops it from the boards', async () => {
	await as(U.cashier, `select public.void_sale($1, 'Cobrado dos veces')`, [sale1]);
	const s = (await db.query(`select status, void_reason from sales where id = $1`, [sale1])).rows[0];
	eq(s, { status: 'void', void_reason: 'Cobrado dos veces' });
	const k = await one(U.cashier, `select cuts from public.day_board() where display_name = 'Kike'`);
	eq(k.cuts, 0);
	const t = await one(U.admin, `select bills, total, voided from public.day_totals()`);
	eq(t, { bills: 1, total: 25000, voided: 1 });
});
await test('cash closing compares counted against expected cash', async () => {
	await db.query(`select 1`);
	const sale3 = '33333333-3333-3333-3333-333333333333';
	await as(U.cashier, `select public.register_sale($1, $2, $3)`, [
		sale3,
		JSON.stringify([{ item_id: ids['Corte'], qty: 1, barber_id: ids.dago }]),
		JSON.stringify([{ method: 'cash', amount: 20000 }])
	]);
	const c = await one(U.cashier, `select * from public.close_register(public.business_date_at(public.my_shop_id()), 18000, 'faltó')`);
	eq([c.expected_cash, c.counted_cash, c.difference], [20000, 18000, -2000]);
});

console.log('\nPermissions');
await test('barber reads only his own sale lines', async () => {
	const rows = await as(U.kike, `select distinct barber_id from sale_lines`);
	eq(rows.map((r) => r.barber_id), [ids.kike]);
});
await test('barber cannot see bills, payments or customers', async () => {
	eq((await as(U.kike, `select count(*)::int as n from sales`))[0].n, 0, 'sales');
	eq((await as(U.kike, `select count(*)::int as n from payments`))[0].n, 0, 'payments');
	await as(U.cashier, `select public.upsert_customer('300 555 0147', 'Andrés Pérez')`);
	eq((await as(U.kike, `select count(*)::int as n from customers`))[0].n, 0, 'customers');
});
await test('barber sees no colleague in the staff table', async () => {
	eq((await as(U.kike, `select display_name from staff`)).map((r) => r.display_name), ['Kike']);
});
await test('cashier cannot change prices', async () => {
	await as(U.cashier, `update catalog_items set price = 1 where id = $1`, [ids['Corte']]);
	eq((await db.query(`select price from catalog_items where id = $1`, [ids['Corte']])).rows[0].price, 20000);
});
await test('nobody can touch the receipt counter from the app', () =>
	rejects(as(U.admin, `update shops set next_receipt_no = 1`), 'permission denied'));
await test('cashier cannot write sales directly', () =>
	rejects(as(U.cashier, `insert into sales (id, shop_id, receipt_no, business_date, cashier_id, subtotal, total) values (gen_random_uuid(), $1, 99, current_date, $2, 0, 0)`, [ids.admin ?? ids.luisa, ids.luisa]), 'permission denied'));
await test('another shop sees none of this shop', async () => {
	eq((await as(U.otherAdmin, `select count(*)::int as n from sales`))[0].n, 0, 'sales');
	eq((await as(U.otherAdmin, `select count(*)::int as n from staff where display_name = 'Kike'`))[0].n, 0, 'staff');
	eq((await as(U.otherAdmin, `select count(*)::int as n from customers`))[0].n, 0, 'customers');
});
await test('admin cannot set a login (user_id) from the app', () =>
	rejects(as(U.admin, `update staff set user_id = $1 where username = 'mono'`, [U.admin]), 'permission denied'));
await test('the last admin cannot be deactivated', () =>
	rejects(as(U.admin, `update staff set active = false where username = 'admin' and shop_id = (select id from shops where slug='bar-beer')`), 'al menos un administrador'));
await test('bootstrap is not callable from the app', () =>
	rejects(as(U.admin, `select public.bootstrap_shop('x', 'X', 'a@b.c', 'X')`), 'permission denied'));

console.log('\nCustomers and receipt');
await test('phone typed loosely is stored as E.164 and reused', async () => {
	const a = await one(U.cashier, `select * from public.upsert_customer('+57 300-555-0147', null)`);
	eq([a.phone, a.name], ['+573005550147', 'Andrés Pérez']);
	eq((await db.query(`select count(*)::int as n from customers`)).rows[0].n, 1);
});
await test('a bad phone is refused', () => rejects(as(U.cashier, `select public.upsert_customer('123')`), 'no válido'));
await test('a bill carries its customer; known phone reuses the record', async () => {
	const r = await one(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2, $3) as r`, [
		JSON.stringify([{ item_id: ids['Cerveza'], qty: 1 }]),
		JSON.stringify([{ method: 'cash', amount: 6000 }]),
		JSON.stringify({ phone: '3005550147', name: null, promo: true })
	]);
	const c = (await db.query(`select name, promo_opt_in from customers where id = $1`, [r.r.customer_id])).rows[0];
	eq([c.name, c.promo_opt_in], ['Andrés Pérez', true]);
	eq((await db.query(`select count(*)::int as n from customers`)).rows[0].n, 1, 'no duplicate customer');
});
await test('a new phone in the bill creates the customer', async () => {
	const r = await one(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2, $3) as r`, [
		JSON.stringify([{ item_id: ids['Agua'], qty: 1 }]),
		JSON.stringify([{ method: 'card', amount: 2500 }]),
		JSON.stringify({ phone: '310 222 3344', name: 'Sara Gómez' })
	]);
	const c = (await db.query(`select phone, name, promo_opt_in from customers where id = $1`, [r.r.customer_id])).rows[0];
	eq(c, { phone: '+573102223344', name: 'Sara Gómez', promo_opt_in: false });
});
await test('a bad phone in the bill refuses the whole bill', async () => {
	const before = (await db.query(`select count(*)::int as n from sales`)).rows[0].n;
	await rejects(
		as(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2, $3)`, [
			JSON.stringify([{ item_id: ids['Agua'], qty: 1 }]),
			JSON.stringify([{ method: 'cash', amount: 2500 }]),
			JSON.stringify({ phone: '12' })
		]),
		'no válido'
	);
	eq((await db.query(`select count(*)::int as n from sales`)).rows[0].n, before);
});
await test('a customer can be attached after charging', async () => {
	const c = await one(U.cashier, `select * from public.set_sale_customer($1, $2)`, [
		sale1,
		JSON.stringify({ phone: '+57 315 000 1111', name: 'Leo' })
	]);
	eq(c.phone, '+573150001111');
	eq((await db.query(`select customer_id from sales where id = $1`, [sale1])).rows[0].customer_id, c.id);
});
await test('a barber cannot attach customers', () =>
	rejects(as(U.kike, `select public.set_sale_customer($1, $2)`, [sale1, JSON.stringify({ phone: '3150001111' })]), 'permiso'));
await test('anonymous visitor gets the receipt by token, first name only', async () => {
	const r = await one(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2, $3) as r`, [
		JSON.stringify([{ item_id: ids['Corte + barba'], qty: 1, barber_id: ids.kike }, { item_id: ids['Cerveza'], qty: 2 }]),
		JSON.stringify([{ method: 'cash', amount: 42000 }]),
		JSON.stringify({ phone: '3005550147' })
	]);
	const rec = (await one('anon', `select public.get_receipt($1) as j`, [r.r.receipt_token])).j;
	eq([rec.shop, rec.total, rec.customer, rec.lines.length, rec.lines[0].barber], ['Bar Beer', 42000, 'Andrés', 2, 'Kike']);
	if (JSON.stringify(rec).includes('5550147')) throw new Error('phone leaked');
});
await test('a wrong token returns nothing', async () => {
	eq((await one('anon', `select public.get_receipt('0123456789abcdef0123456789abcdef') as j`)).j, null);
});
await test('anonymous visitor cannot read tables', async () => {
	await rejects(as('anon', `select * from sales`), 'permission denied');
});

console.log('\nBarber views');
await test('barber lists only his own services of the day, newest first', async () => {
	const rows = await as(U.kike, `select item_name, status from public.my_day_lines()`);
	if (!rows.length) throw new Error('no lines');
	eq(rows.every((r) => ['ok', 'void'].includes(r.status)), true, 'statuses');
	const all = (await db.query(`select count(*)::int as n from sale_lines where barber_id = $1`, [ids.kike])).rows[0].n;
	eq(rows.length, all, 'only and all of his lines');
});
await test('history groups his days and skips voided lines', async () => {
	await db.query(`insert into sale_lines (sale_id, line_no, shop_id, business_date, barber_id, qty, item_name, item_kind, unit_price, line_total, commission_pct, commission_amount, counts_as_cut)
	  select id, 9, shop_id, business_date - 3, $1, 1, 'Corte', 'service', 20000, 20000, 50, 10000, true from sales where id = $2`, [ids.kike, sale1]);
	const rows = await as(U.kike, `select business_date, cuts, commission from public.my_history(current_date - 30, current_date + 1)`);
	eq(rows.length >= 2, true, 'two days at least');
	const old = rows[rows.length - 1];
	eq([old.cuts, old.commission], [1, 10000], 'older day');
});
await test('another barber sees nothing of Kike in history', async () => {
	const rows = await as(U.dago, `select coalesce(sum(commission), 0)::int as c from public.my_history(current_date - 30, current_date + 1)`);
	const own = (await db.query(`select coalesce(sum(commission_amount), 0)::int as c from sale_lines where barber_id = $1 and status = 'ok'`, [ids.dago])).rows[0].c;
	eq(rows[0].c, own);
});
await test('totals since he started', async () => {
	const t = await one(U.kike, `select days, cuts from public.my_totals()`);
	eq(t.days >= 2 && t.cuts >= 1, true);
});
await test('goals show progress in the current period', async () => {
	await db.query(`insert into bonus_rules (shop_id, name, period, metric, threshold, reward_type, reward_value)
	  select id, 'Semana fuerte', 'week', 'cuts', 20, 'fixed', 50000 from shops where slug = 'bar-beer'
	  union all select id, 'Día de oro', 'day', 'revenue', 100000, 'pct_extra', 5 from shops where slug = 'bar-beer'
	  union all select id, 'Inactiva', 'month', 'cuts', 10, 'fixed', 1 from shops where slug = 'bar-beer'`);
	await db.query(`update bonus_rules set active = false where name = 'Inactiva'`);
	const g = await as(U.kike, `select name, period, threshold, progress from public.my_goals()`);
	eq(g.map((x) => x.name), ['Día de oro', 'Semana fuerte'], 'active rules, day first');
	const dayRevenue = (await db.query(`select coalesce(sum(line_total), 0)::int as r from sale_lines where barber_id = $1 and status = 'ok' and business_date = public.business_date_at(shop_id)`, [ids.kike])).rows[0].r;
	eq(g[0].progress, dayRevenue, 'day revenue');
});
await test('week starts on Monday and ends on Sunday', async () => {
	const r = (await db.query(`select public.period_start('week', '2026-11-12') as s, public.period_end('week', '2026-11-12') as e, public.period_end('month', '2026-02-10') as m`)).rows[0];
	eq([r.s.toISOString().slice(0, 10), r.e.toISOString().slice(0, 10), r.m.toISOString().slice(0, 10)], ['2026-11-09', '2026-11-15', '2026-02-28']);
});

console.log('\nAdministration');
await test('admin creates a barber and edits him', async () => {
	const shop = (await db.query(`select id from shops where slug = 'bar-beer'`)).rows[0].id;
	// Exactly the columns the app's saveStaff sends and reads back.
	const s = await one(U.admin, `insert into staff (shop_id, role, display_name, cuts, daily_cut_goal, hired_on, active) values ($1, 'barber', 'Toño', true, null, current_date, true)
	  returning id, role, display_name, username, user_id, active, cuts, daily_cut_goal, hired_on`, [shop]);
	eq(s.active, true);
	await as(U.admin, `update staff set display_name = 'Toño R', daily_cut_goal = 10 where id = $1`, [s.id]);
	const r = (await db.query(`select display_name, daily_cut_goal from staff where id = $1`, [s.id])).rows[0];
	eq(r, { display_name: 'Toño R', daily_cut_goal: 10 });
});
await test('cashier cannot create staff', async () => {
	const shop = (await db.query(`select id from shops where slug = 'bar-beer'`)).rows[0].id;
	await as(U.admin, `insert into catalog_items (shop_id, kind, name, price, commission_pct, counts_as_cut, active, sort_order) values ($1, 'drink', 'Agua con gas', 3000, 0, false, true, 99)
	  returning id, kind, name, price, commission_pct, counts_as_cut, active, sort_order`, [shop]);
	await rejects(as(U.cashier, `insert into staff (shop_id, role, display_name, cuts) values ($1, 'barber', 'X', true)`, [shop]), 'row-level security');
});
await test('admin cannot create staff in another shop', async () => {
	const other = (await db.query(`select id from shops where slug = 'otro'`)).rows[0].id;
	await rejects(as(U.admin, `insert into staff (shop_id, role, display_name, cuts) values ($1, 'barber', 'X', true)`, [other]), 'row-level security');
});
await test('admin adds and deactivates a catalog item', async () => {
	const shop = (await db.query(`select id from shops where slug = 'bar-beer'`)).rows[0].id;
	const i = await one(U.admin, `insert into catalog_items (shop_id, kind, name, price, commission_pct) values ($1, 'product', 'Gorra', 40000, 10) returning id`, [shop]);
	await as(U.admin, `update catalog_items set active = false where id = $1`, [i.id]);
	eq((await db.query(`select active from catalog_items where id = $1`, [i.id])).rows[0].active, false);
});
await test('admin sets and removes a per-barber percentage', async () => {
	const shop = (await db.query(`select id from shops where slug = 'bar-beer'`)).rows[0].id;
	await as(U.admin, `insert into commission_overrides (shop_id, staff_id, item_id, commission_pct) values ($1, $2, $3, 55)`, [shop, ids.mono, ids['Corte']]);
	await as(U.admin, `delete from commission_overrides where staff_id = $1 and item_id = $2`, [ids.mono, ids['Corte']]);
	eq((await db.query(`select count(*)::int as n from commission_overrides where staff_id = $1`, [ids.mono])).rows[0].n, 0);
});
await test('admin edits shop settings but not the receipt counter', async () => {
	await as(U.admin, `update shops set daily_cut_goal = 9, day_cutoff = '05:00' where slug = 'bar-beer'`);
	eq((await db.query(`select daily_cut_goal from shops where slug = 'bar-beer'`)).rows[0].daily_cut_goal, 9);
	await db.query(`update shops set daily_cut_goal = 8, day_cutoff = '04:00' where slug = 'bar-beer'`);
});
await test('admin lists customers with visits and spending', async () => {
	const rows = await as(U.admin, `select name, phone, visits, spent from public.customer_stats(null)`);
	const a = rows.find((r) => r.phone === '+573005550147');
	eq(a.visits >= 2 && a.spent > 0, true, 'Andrés has visits');
	const byDigits = await as(U.admin, `select phone from public.customer_stats('0147')`);
	eq(byDigits.map((r) => r.phone), ['+573005550147'], 'search by digits');
	const byName = await as(U.admin, `select name from public.customer_stats('sara')`);
	eq(byName.map((r) => r.name), ['Sara Gómez'], 'search by name');
});
await test('the last admin cannot change his own role away from admin', () =>
	rejects(as(U.admin, `update staff set role = 'cashier' where username = 'admin' and shop_id = (select id from shops where slug='bar-beer')`), 'al menos un administrador'));
await test('the last admin login cannot be removed (user_id cleared)', () =>
	rejects(db.query(`update staff set user_id = null where username = 'admin' and shop_id = (select id from shops where slug='bar-beer')`), 'al menos un administrador'));
await test('cashier and barber get no customer list', async () => {
	eq((await as(U.cashier, `select count(*)::int as n from public.customer_stats(null)`))[0].n, 0, 'cashier');
	eq((await as(U.kike, `select count(*)::int as n from public.customer_stats(null)`))[0].n, 0, 'barber');
});

console.log('\nMoney: bonuses, payouts, reports');
await test('closed periods that met a rule get their award once', async () => {
	await db.query(`insert into sale_lines (sale_id, line_no, shop_id, business_date, barber_id, qty, item_name, item_kind, unit_price, line_total, commission_pct, commission_amount, counts_as_cut)
	  select id, 20, shop_id, public.business_date_at(shop_id) - 2, $1, 4, 'Corte + barba', 'service', 30000, 120000, 50, 60000, true from sales where id = $2`, [ids.dago, sale1]);
	const n = await one(U.admin, `select public.award_bonuses() as n`);
	eq(n.n >= 1, true, 'created awards');
	const a = (await db.query(`select a.amount from bonus_awards a join bonus_rules r on r.id = a.rule_id where r.name = 'Día de oro' and a.staff_id = $1`, [ids.dago])).rows;
	eq(a.map((x) => x.amount), [3000], '5% of 60.000 commission');
	const again = await one(U.admin, `select public.award_bonuses() as n`);
	eq(again.n, 0, 'idempotent');
});
await test('only an admin awards bonuses', () => rejects(as(U.cashier, `select public.award_bonuses()`), 'permiso'));
await test('nightly award function is not callable from the app', () =>
	rejects(as(U.admin, `select public.award_bonuses_all()`), 'permission denied'));
const TODAY = `public.business_date_at(public.my_shop_id())`;
// The cash-closing test above closed today; paying in cash needs an open drawer.
await db.query(`delete from cash_closings where business_date = public.business_date_at(shop_id)`);
await test('payout summary: earned, paid and owed per barber; the cashier sees what the admin sees', async () => {
	const rows = await as(U.admin, `select display_name, commission, bonus, paid, owed, owed_before from public.payout_summary(${TODAY} - 7, ${TODAY})`);
	const dago = rows.find((r) => r.display_name === 'Dago');
	const own = (await db.query(`select coalesce(sum(commission_amount),0)::int as c from sale_lines where barber_id = $1 and status = 'ok' and business_date >= public.business_date_at(shop_id) - 7`, [ids.dago])).rows[0].c;
	eq([dago.commission, dago.bonus, dago.paid, dago.owed], [own, 3000, 0, own + 3000]);
	const asCashier = await as(U.cashier, `select display_name, commission, bonus, paid, owed from public.payout_summary(${TODAY} - 7, ${TODAY})`);
	eq(asCashier.find((r) => r.display_name === 'Dago'), { display_name: 'Dago', commission: own, bonus: 3000, paid: 0, owed: own + 3000 }, 'same numbers for the cashier');
	const today = await as(U.cashier, `select display_name, owed_before from public.payout_summary(${TODAY}, ${TODAY})`);
	eq(today.find((r) => r.display_name === 'Dago').owed_before, 63000, 'what is owed from before today');
	await rejects(as(U.kike, `select * from public.payout_summary(${TODAY}, ${TODAY})`), 'permiso');
});
await test('settle summary for one barber: lines, items, owed from before and since when', async () => {
	const j = (await one(U.cashier, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.dago])).j;
	const own = (await db.query(`select coalesce(sum(commission_amount),0)::int as c, coalesce(sum(case when counts_as_cut then qty end),0)::int as cuts from sale_lines where barber_id = $1 and status = 'ok' and business_date = public.business_date_at(shop_id)`, [ids.dago])).rows[0];
	eq([j.commission, j.cuts, j.commission_paid], [own.c, own.cuts, 0]);
	eq(Array.isArray(j.items) && j.items.length > 0, true, 'items');
	eq(j.owed_before, 63000, 'two days ago is still owed');
	const from = (await db.query(`select (public.business_date_at(id) - 2)::text as d from shops where slug = 'bar-beer'`)).rows[0].d;
	eq(String(j.owed_from).slice(0, 10), from, 'since when');
	await rejects(as(U.kike, `select public.settle_summary($1, ${TODAY}, ${TODAY})`, [ids.dago]), 'permiso');
	eq((await one(U.kike, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.kike])).j.name, 'Kike', 'a barber reads his own');
});
await test('the cashier pays today: confirmed amount, cash leaves the drawer, nothing paid twice', async () => {
	const before = await one(U.cashier, `select * from public.cash_breakdown()`);
	const owed = (await one(U.cashier, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.dago])).j;
	const amount = owed.commission - owed.commission_paid + owed.bonus - owed.bonus_paid;
	await rejects(as(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'cash', $2)`, [ids.dago, amount + 1000]), 'El monto cambió');
	eq((await db.query(`select count(*)::int as n from payouts`)).rows[0].n, 0, 'a changed amount records nothing');
	const r = (await one(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'cash', $2) as r`, [ids.dago, amount])).r;
	eq(r.total, amount, 'pays what was confirmed');
	const after = await one(U.cashier, `select * from public.cash_breakdown()`);
	eq([after.paid_out - before.paid_out, before.expected - after.expected], [r.total, r.total], 'drawer');
	eq((await one(U.cashier, `select public.my_expected_cash() as c`)).c, after.expected, 'closing uses it');
	await rejects(as(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'cash')`, [ids.dago]), 'nada pendiente');
	const j = (await one(U.cashier, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.dago])).j;
	eq([j.commission_paid, j.payouts.length, j.payouts[0].paid_by], [j.commission, 1, 'Luisa']);
	const p = (await db.query(`select commission_total + bonus_total as t from payouts where id = $1`, [r.id])).rows[0];
	eq(p.t, r.total, 'the stored payout matches');
});
await test('paying the week covers what was left from earlier days, transfers stay out of the drawer', async () => {
	const before = await one(U.admin, `select * from public.cash_breakdown()`);
	const r = (await one(U.admin, `select public.pay_barber($1, ${TODAY} - 6, ${TODAY}, 'transfer') as r`, [ids.dago])).r;
	eq([r.commission, r.bonus], [60000, 3000], 'two days ago plus its day bonus');
	eq((await one(U.admin, `select * from public.cash_breakdown()`)).expected, before.expected, 'transfer');
	eq((await as(U.admin, `select owed from public.payout_summary(${TODAY} - 7, ${TODAY}) where display_name = 'Dago'`))[0].owed, 0);
	eq((await one(U.admin, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.dago])).j.owed_from, null, 'up to date');
});
await test('a fixed day bonus met today is paid with the day; a percentage one waits for the night', async () => {
	await db.query(`insert into bonus_rules (shop_id, name, period, metric, threshold, reward_type, reward_value) select id, 'Día de 1', 'day', 'cuts', 1, 'fixed', 5000 from shops where slug = 'bar-beer'`);
	await db.query(`insert into bonus_rules (shop_id, name, period, metric, threshold, reward_type, reward_value) select id, 'Día del 10%', 'day', 'cuts', 1, 'pct_extra', 10 from shops where slug = 'bar-beer'`);
	const j = (await one(U.cashier, `select public.settle_summary($1, ${TODAY}, ${TODAY}) as j`, [ids.kike])).j;
	eq(j.bonus_today, 5000, 'only the fixed one is payable now');
	eq(j.bonuses.filter((b) => b.today).map((b) => [b.name, b.payable]).sort(), [['Día de 1', true], ['Día del 10%', false]], 'both are listed');
	const r = (await one(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}) as r`, [ids.kike])).r;
	eq(r.bonus, 5000);
	eq((await db.query(`select count(*)::int as n from bonus_awards a join bonus_rules b on b.id = a.rule_id where b.name = 'Día del 10%'`)).rows[0].n, 0, 'the percentage one is not frozen early');
	await db.query(`update bonus_rules set active = false where name in ('Día de 1', 'Día del 10%')`);
});
await test('only the register pays, never a barber, never the future, never cash into a closed drawer', async () => {
	await rejects(as(U.kike, `select public.pay_barber($1, ${TODAY}, ${TODAY})`, [ids.kike]), 'permiso');
	await rejects(as(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY} + 1)`, [ids.dago]), 'no es válido');
	await rejects(as(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'bitcoin')`, [ids.dago]), 'no válida');
	await as(U.cashier, `select public.register_sale(gen_random_uuid(), $1, $2)`, [
		JSON.stringify([{ item_id: ids['Corte'], qty: 1, barber_id: ids.dago }]),
		JSON.stringify([{ method: 'cash', amount: 20000 }])
	]);
	await as(U.cashier, `select public.close_register(${TODAY}, 0, null)`);
	await rejects(as(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'cash')`, [ids.dago]), 'ya está cerrada');
	const r = (await one(U.cashier, `select public.pay_barber($1, ${TODAY}, ${TODAY}, 'transfer') as r`, [ids.dago])).r;
	eq(r.total, 10000, 'by transfer it goes through');
});
await test('a deactivated barber who is still owed stays in the payout list', async () => {
	const mono = (await db.query(`select id from staff where username = 'mono'`)).rows[0].id;
	await db.query(`insert into sale_lines (sale_id, line_no, shop_id, business_date, barber_id, qty, item_name, item_kind, unit_price, line_total, commission_pct, commission_amount, counts_as_cut)
	  select id, 30, shop_id, public.business_date_at(shop_id) - 3, $1, 1, 'Corte', 'service', 20000, 20000, 50, 10000, true from sales where id = $2`, [mono, sale1]);
	await as(U.admin, `update staff set active = false where id = $1`, [mono]);
	const row = (await as(U.cashier, `select display_name, owed_before from public.payout_summary(${TODAY}, ${TODAY})`)).find((r) => r.display_name === 'Mono');
	eq(row?.owed_before, 10000);
	await as(U.admin, `update staff set active = true where id = $1`, [mono]);
});
await test('a bill whose commission was paid cannot be voided', async () => {
	const s = (await db.query(`select l.sale_id from sale_lines l join sales s on s.id = l.sale_id where l.payout_id is not null and s.status = 'ok' limit 1`)).rows[0];
	await rejects(as(U.admin, `select public.void_sale($1, 'error de prueba')`, [s.sale_id]), 'ya se le pagó');
});
await test('report summary matches the day totals', async () => {
	const r = (await one(U.admin, `select public.report_summary(public.business_date_at(public.my_shop_id()), public.business_date_at(public.my_shop_id())) as j`)).j;
	const t = await one(U.admin, `select total, bills, cuts from public.day_totals()`);
	eq([r.total, r.bills], [t.total, t.bills]);
	eq(Array.isArray(r.by_barber) && Array.isArray(r.by_item) && r.by_item.length > 0, true, 'breakdowns');
	eq((await one(U.cashier, `select public.report_summary(current_date, current_date) as j`)).j, null, 'cashier gets nothing');
});
await test('CSV lines cover every line of the range, admin only', async () => {
	const rows = await as(U.admin, `select * from public.report_lines(public.business_date_at(public.my_shop_id()) - 7, public.business_date_at(public.my_shop_id()))`);
	const n = (await db.query(`select count(*)::int as n from sale_lines where business_date >= public.business_date_at(shop_id) - 7 and shop_id = (select id from shops where slug='bar-beer')`)).rows[0].n;
	eq(rows.length, n);
	eq((await as(U.cashier, `select count(*)::int as n from public.report_lines(current_date - 7, current_date)`))[0].n, 0, 'cashier');
});
await test('voided bills list who and why', async () => {
	const rows = await as(U.admin, `select void_reason, voided_by from public.voided_sales(current_date - 7, current_date + 1)`);
	eq(rows.some((r) => r.void_reason === 'Cobrado dos veces' && r.voided_by === 'Luisa'), true);
});
await test('closing history and expected cash for the register', async () => {
	const rows = await as(U.admin, `select closed_by, difference from public.closing_history(current_date - 7, current_date + 1)`);
	// Today's drawer was closed again with 0 counted by the settlement tests.
	const exp = (await one(U.cashier, `select public.my_expected_cash() as c`)).c;
	eq(rows[0], { closed_by: 'Luisa', difference: -exp });
	const e = await one(U.cashier, `select public.my_expected_cash() as c`);
	eq(typeof e.c, 'number');
	await rejects(as(U.kike, `select public.my_expected_cash()`), 'permiso');
});

console.log('\nBusiness day');
await test('1:30 a.m. in Bogotá belongs to the previous day', async () => {
	const r = (await db.query(`select public.business_date_at(id, '2026-11-11 01:30-05') as d from shops where slug='bar-beer'`)).rows[0];
	eq(r.d.toISOString().slice(0, 10), '2026-11-10');
});
await test('4:30 a.m. starts the new day', async () => {
	const r = (await db.query(`select public.business_date_at(id, '2026-11-11 04:30-05') as d from shops where slug='bar-beer'`)).rows[0];
	eq(r.d.toISOString().slice(0, 10), '2026-11-11');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
