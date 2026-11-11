-- Bar Beer · business functions
-- All money writes happen here. Each function checks who is calling and works only inside
-- that person's shop.

-- ─── Internal guard ─────────────────────────────────────────────────────────
create function public._require_role(variadic p_roles public.staff_role[])
returns table (staff_id uuid, shop_id uuid, role public.staff_role)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
    select s.id, s.shop_id, s.role from public.staff s
    where s.user_id = auth.uid() and s.active and s.role = any (p_roles);
  if not found then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
end $$;

-- Overrides must point at staff and items of their own shop.
create function public.check_override_shop() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.staff where id = new.staff_id and shop_id = new.shop_id)
     or not exists (select 1 from public.catalog_items where id = new.item_id and shop_id = new.shop_id) then
    raise exception 'El barbero y el servicio deben ser del mismo local';
  end if;
  return new;
end $$;

create trigger commission_overrides_shop before insert or update on public.commission_overrides
  for each row execute function public.check_override_shop();

-- ─── Phone normalisation ────────────────────────────────────────────────────
-- Accepts what a cashier types ("300 555 0147", "+57 300...", "57300...") and returns E.164.
-- A bare 10-digit number starting with 3 is taken as a Colombian mobile.
create function public.normalize_phone(p_raw text) returns text
language plpgsql immutable as $$
declare
  d text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  if length(d) = 10 and left(d, 1) = '3' then
    d := '57' || d;
  end if;
  if d !~ '^[1-9][0-9]{7,14}$' then
    raise exception 'Número de WhatsApp no válido' using errcode = '22023';
  end if;
  return '+' || d;
end $$;

-- ─── Customers ──────────────────────────────────────────────────────────────
create function public.upsert_customer(p_phone text, p_name text default null, p_promo boolean default null)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_phone text := public.normalize_phone(p_phone);
  v_name text := nullif(trim(p_name), '');
  r public.customers;
begin
  select * into me from public._require_role('admin', 'cashier');

  insert into public.customers (shop_id, phone, name, promo_opt_in)
  values (me.shop_id, v_phone, v_name, coalesce(p_promo, false))
  on conflict (shop_id, phone) do update
    set name = coalesce(excluded.name, public.customers.name),
        promo_opt_in = coalesce(p_promo, public.customers.promo_opt_in)
  returning * into r;
  return r;
end $$;

-- ─── Register a bill ────────────────────────────────────────────────────────
-- p_lines:    [{ "item_id": uuid, "qty": int, "barber_id": uuid | null }]
-- p_payments: [{ "method": "cash"|"transfer"|"card", "amount": int, "cash_received": int | null }]
-- Idempotent on p_id: calling twice with the same id returns the first result.
create function public.register_sale(
  p_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_customer_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me        record;
  v_date    date;
  v_no      int;
  v_total   int := 0;
  v_paid    int := 0;
  v_sale    public.sales;
  l         jsonb;
  v_n       int;
  p         jsonb;
  it        public.catalog_items;
  v_qty     int;
  v_barber  uuid;
  v_pct     numeric(5,2);
  v_line    int;
begin
  select * into me from public._require_role('admin', 'cashier');

  -- Already registered? Return it (retry after a dropped connection).
  select * into v_sale from public.sales where id = p_id;
  if found then
    if v_sale.shop_id <> me.shop_id then
      raise exception 'Identificador de cuenta en uso' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_sale.id, 'receipt_no', v_sale.receipt_no,
      'receipt_token', v_sale.receipt_token, 'total', v_sale.total,
      'business_date', v_sale.business_date, 'duplicate', true);
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La cuenta está vacía' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 50 then
    raise exception 'Demasiados ítems en una cuenta' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Falta el método de pago' using errcode = '22023';
  end if;
  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and shop_id = me.shop_id
  ) then
    raise exception 'Cliente no encontrado' using errcode = '22023';
  end if;

  v_date := public.business_date_at(me.shop_id, now());

  -- Locks the shop row: receipt numbers are consecutive and never repeat.
  update public.shops set next_receipt_no = next_receipt_no + 1
  where id = me.shop_id returning next_receipt_no - 1 into v_no;

  insert into public.sales (id, shop_id, receipt_no, business_date, cashier_id, customer_id, subtotal, total)
  values (p_id, me.shop_id, v_no, v_date, me.staff_id, p_customer_id, 0, 0)
  returning * into v_sale;

  for l, v_n in select e, n from jsonb_array_elements(p_lines) with ordinality as t(e, n) loop
    select * into it from public.catalog_items
    where id = (l->>'item_id')::uuid and shop_id = me.shop_id and active;
    if not found then
      raise exception 'Producto o servicio no disponible' using errcode = '22023';
    end if;

    v_qty := coalesce((l->>'qty')::int, 1);
    if v_qty not between 1 and 99 then
      raise exception 'Cantidad no válida' using errcode = '22023';
    end if;

    v_barber := nullif(l->>'barber_id', '')::uuid;
    if v_barber is not null and not exists (
      select 1 from public.staff where id = v_barber and shop_id = me.shop_id and active and cuts
    ) then
      raise exception 'Barbero no disponible' using errcode = '22023';
    end if;
    if it.kind = 'service' and v_barber is null then
      raise exception 'Falta el barbero de %', it.name using errcode = '22023';
    end if;

    v_line := it.price * v_qty;
    v_pct := 0;
    if v_barber is not null then
      select coalesce(
        (select o.commission_pct from public.commission_overrides o
          where o.staff_id = v_barber and o.item_id = it.id and o.shop_id = me.shop_id),
        it.commission_pct)
      into v_pct;
    end if;

    insert into public.sale_lines (sale_id, line_no, shop_id, business_date, item_id, barber_id, qty,
      item_name, item_kind, unit_price, line_total, commission_pct, commission_amount, counts_as_cut)
    values (p_id, v_n, me.shop_id, v_date, it.id, v_barber, v_qty,
      it.name, it.kind, it.price, v_line, v_pct, round(v_line * v_pct / 100)::int,
      it.counts_as_cut and v_barber is not null);

    v_total := v_total + v_line;
  end loop;

  for p in select * from jsonb_array_elements(p_payments) loop
    if (p->>'method') not in ('cash', 'transfer', 'card') then
      raise exception 'Método de pago no válido' using errcode = '22023';
    end if;
    if coalesce((p->>'amount')::int, 0) <= 0 then
      raise exception 'Monto de pago no válido' using errcode = '22023';
    end if;
    insert into public.payments (sale_id, shop_id, business_date, method, amount, cash_received)
    values (p_id, me.shop_id, v_date, (p->>'method')::public.pay_method, (p->>'amount')::int,
      case when p->>'method' = 'cash' then nullif(p->>'cash_received', '')::int end);
    v_paid := v_paid + (p->>'amount')::int;
  end loop;

  if v_paid <> v_total then
    raise exception 'Los pagos (%) no suman el total (%)', v_paid, v_total using errcode = '22023';
  end if;

  update public.sales set subtotal = v_total, total = v_total where id = p_id
  returning * into v_sale;

  return jsonb_build_object('id', v_sale.id, 'receipt_no', v_sale.receipt_no,
    'receipt_token', v_sale.receipt_token, 'total', v_sale.total,
    'business_date', v_sale.business_date, 'duplicate', false);
end $$;

-- ─── Void a bill ────────────────────────────────────────────────────────────
-- Nothing is deleted: the bill stays, struck through, with who, when and why.
create function public.void_sale(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me record;
  s  public.sales;
begin
  select * into me from public._require_role('admin', 'cashier');

  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribe el motivo de la anulación' using errcode = '22023';
  end if;

  select * into s from public.sales where id = p_id and shop_id = me.shop_id for update;
  if not found then
    raise exception 'Cuenta no encontrada' using errcode = '22023';
  end if;
  if s.status = 'void' then
    return;
  end if;
  if me.role = 'cashier' and s.business_date < public.business_date_at(me.shop_id) then
    raise exception 'Solo el administrador puede anular cuentas de días anteriores' using errcode = '42501';
  end if;

  update public.sales
    set status = 'void', voided_by = me.staff_id, voided_at = now(), void_reason = trim(p_reason)
    where id = p_id;
  update public.sale_lines set status = 'void' where sale_id = p_id;
end $$;

create function public.mark_receipt_sent(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from public._require_role('admin', 'cashier');
  update public.sales set receipt_sent_at = now() where id = p_id and shop_id = me.shop_id;
end $$;

-- ─── Cash closing ───────────────────────────────────────────────────────────
-- Expected cash is what the system says came in cash on that business day.
create function public.expected_cash(p_shop uuid, p_date date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(p.amount), 0)::int
  from public.payments p join public.sales s on s.id = p.sale_id
  where p.shop_id = p_shop and p.business_date = p_date and p.method = 'cash' and s.status = 'ok'
$$;

create function public.close_register(p_date date, p_counted int, p_notes text default null)
returns public.cash_closings
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_expected int;
  r public.cash_closings;
begin
  select * into me from public._require_role('admin', 'cashier');
  if p_counted is null or p_counted < 0 then
    raise exception 'Escribe el efectivo contado' using errcode = '22023';
  end if;
  if me.role = 'cashier' and p_date < public.business_date_at(me.shop_id) - 1 then
    raise exception 'Solo el administrador puede cerrar días anteriores' using errcode = '42501';
  end if;
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = p_date) then
    raise exception 'Ese día ya tiene cierre' using errcode = '23505';
  end if;

  v_expected := public.expected_cash(me.shop_id, p_date);
  insert into public.cash_closings (shop_id, business_date, closed_by, expected_cash, counted_cash, difference, notes)
  values (me.shop_id, p_date, me.staff_id, v_expected, p_counted, p_counted - v_expected, nullif(trim(p_notes), ''))
  returning * into r;
  return r;
end $$;

-- ─── Read models ────────────────────────────────────────────────────────────
-- These run with the caller's own permissions, so row level security decides what each role sees:
-- a cashier gets every barber of the day, a barber gets only his own row.

-- One row per person who takes clients: cuts, revenue and commission on a business day.
create function public.day_board(p_date date default null)
returns table (
  staff_id uuid, display_name text, sort_order int,
  cuts int, services int, revenue int, commission int, goal int
)
language sql stable security invoker set search_path = public as $$
  with d as (
    select coalesce(p_date, public.business_date_at(public.my_shop_id())) as day
  )
  select
    st.id, st.display_name, st.sort_order,
    coalesce(sum(case when l.counts_as_cut then l.qty end), 0)::int,
    coalesce(sum(case when l.item_kind = 'service' then l.qty end), 0)::int,
    coalesce(sum(l.line_total), 0)::int,
    coalesce(sum(l.commission_amount), 0)::int,
    coalesce(st.daily_cut_goal, sh.daily_cut_goal)
  from public.staff st
  join public.shops sh on sh.id = st.shop_id
  cross join d
  left join public.sale_lines l
    on l.barber_id = st.id and l.business_date = d.day and l.status = 'ok'
  where st.active and st.cuts and st.shop_id = public.my_shop_id()
  group by st.id, st.display_name, st.sort_order, st.daily_cut_goal, sh.daily_cut_goal
  order by st.sort_order, st.display_name
$$;

-- Whole-shop figures for a business day (admin and cashier only, through row level security).
create function public.day_totals(p_date date default null)
returns table (
  business_date date, bills int, total int, cuts int, cash int, transfer int, card int, voided int
)
language sql stable security invoker set search_path = public as $$
  with d as (
    select coalesce(p_date, public.business_date_at(public.my_shop_id())) as day
  )
  select
    d.day,
    (select count(*) from public.sales s where s.business_date = d.day and s.status = 'ok')::int,
    (select coalesce(sum(s.total), 0) from public.sales s where s.business_date = d.day and s.status = 'ok')::int,
    (select coalesce(sum(l.qty), 0) from public.sale_lines l
       where l.business_date = d.day and l.status = 'ok' and l.counts_as_cut)::int,
    (select coalesce(sum(p.amount), 0) from public.payments p join public.sales s on s.id = p.sale_id
       where p.business_date = d.day and s.status = 'ok' and p.method = 'cash')::int,
    (select coalesce(sum(p.amount), 0) from public.payments p join public.sales s on s.id = p.sale_id
       where p.business_date = d.day and s.status = 'ok' and p.method = 'transfer')::int,
    (select coalesce(sum(p.amount), 0) from public.payments p join public.sales s on s.id = p.sale_id
       where p.business_date = d.day and s.status = 'ok' and p.method = 'card')::int,
    (select count(*) from public.sales s where s.business_date = d.day and s.status = 'void')::int
  from d
$$;

-- ─── Public receipt ─────────────────────────────────────────────────────────
-- What the customer sees from the link in their WhatsApp message. The token is 128 random bits;
-- only the customer's first name is exposed, never the phone.
create function public.get_receipt(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'shop', sh.name,
    'receipt_no', s.receipt_no,
    'created_at', s.created_at,
    'timezone', sh.timezone,
    'status', s.status,
    'total', s.total,
    'customer', split_part(coalesce(c.name, ''), ' ', 1),
    'lines', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', l.item_name, 'qty', l.qty, 'total', l.line_total, 'barber', b.display_name
      ) order by l.line_no), '[]'::jsonb)
      from public.sale_lines l left join public.staff b on b.id = l.barber_id
      where l.sale_id = s.id
    ),
    'payments', (
      select coalesce(jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount)), '[]'::jsonb)
      from public.payments p where p.sale_id = s.id
    )
  )
  from public.sales s
  join public.shops sh on sh.id = s.shop_id
  left join public.customers c on c.id = s.customer_id
  where p_token ~ '^[0-9a-f]{32}$' and s.receipt_token = p_token
$$;

-- ─── First shop and admin (run once from the SQL editor) ────────────────────
-- 1. Create the admin user in Supabase → Authentication → Users → Add user (email + password).
-- 2. select public.bootstrap_shop('bar-beer', 'Bar Beer', 'admin@correo.com', 'Nombre');
create function public.bootstrap_shop(p_slug text, p_name text, p_admin_email text, p_admin_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_shop uuid;
begin
  select id into v_user from auth.users where lower(email) = lower(p_admin_email);
  if v_user is null then
    raise exception 'Primero crea el usuario % en Authentication', p_admin_email;
  end if;
  insert into public.shops (slug, name) values (p_slug, p_name) returning id into v_shop;
  insert into public.staff (shop_id, user_id, role, display_name, username)
  values (v_shop, v_user, 'admin', p_admin_name, 'admin');
  return v_shop;
end $$;

-- ─── Execute grants ─────────────────────────────────────────────────────────
-- Supabase's default privileges grant EXECUTE straight to anon and authenticated (not only to
-- PUBLIC), so all three are revoked before opening functions one by one.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.my_staff_id(), public.my_shop_id(), public.my_role(),
  public.business_date_at(uuid, timestamptz), public.can_see_day(uuid, date),
  public.upsert_customer(text, text, boolean),
  public.register_sale(uuid, jsonb, jsonb, uuid),
  public.void_sale(uuid, text),
  public.mark_receipt_sent(uuid),
  public.close_register(date, int, text),
  public.day_board(date),
  public.day_totals(date),
  public.normalize_phone(text)
to authenticated;

grant execute on function public.get_receipt(text) to anon, authenticated;
-- bootstrap_shop, expected_cash and _require_role stay private (service role / internal only).
