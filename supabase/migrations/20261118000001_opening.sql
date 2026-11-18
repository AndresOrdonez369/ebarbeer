-- Opening the register ("abrir caja"): every morning the cashier writes the cash the drawer starts
-- with, and the day's expected cash is counted from there:
--   base + cash charged − cash paid to barbers.

create table public.cash_openings (
  shop_id        uuid not null references public.shops (id) on delete cascade,
  business_date  date not null,
  amount         int  not null check (amount >= 0),
  opened_by      uuid not null references public.staff (id),
  opened_at      timestamptz not null default now(),
  -- Set when the base is corrected after the first opening (before the day is closed).
  changed_by     uuid references public.staff (id),
  changed_at     timestamptz,
  primary key (shop_id, business_date)
);
alter table public.cash_openings enable row level security;
create policy openings_read on public.cash_openings for select to authenticated
  using ((select public.can_see_day(shop_id, business_date)));
revoke all on public.cash_openings from anon, authenticated;
grant select on public.cash_openings to authenticated;

-- The closing keeps the base it was counted against.
alter table public.cash_closings add column opening_cash int not null default 0;

-- ─── The drawer ─────────────────────────────────────────────────────────────
create or replace function public.opening_cash(p_shop uuid, p_date date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select amount from public.cash_openings where shop_id = p_shop and business_date = p_date), 0)
$$;
revoke execute on function public.opening_cash(uuid, date) from public, anon, authenticated;

create or replace function public.expected_cash(p_shop uuid, p_date date) returns int
language sql stable security definer set search_path = public as $$
  select public.opening_cash(p_shop, p_date) + (
    select coalesce(sum(p.amount), 0)
    from public.payments p join public.sales s on s.id = p.sale_id
    where p.shop_id = p_shop and p.business_date = p_date and p.method = 'cash' and s.status = 'ok'
  )::int - (
    select coalesce(sum(o.commission_total + o.bonus_total), 0)
    from public.payouts o
    where o.shop_id = p_shop and o.business_date = p_date and o.method = 'cash'
  )::int
$$;

-- Opens today's register, or corrects its base while the day is still open.
-- A cashier opens only today; the admin can also set the base of an earlier day not yet closed.
create function public.open_register(p_amount int, p_date date default null)
returns public.cash_openings
language plpgsql security definer set search_path = public as $$
declare
  me record;
  d date;
  r public.cash_openings;
begin
  select * into me from public._require_role('admin', 'cashier');
  d := coalesce(p_date, public.business_date_at(me.shop_id));
  if p_amount is null or p_amount < 0 or p_amount > 100000000 then
    raise exception 'Escribe el efectivo con que abre la caja' using errcode = '22023';
  end if;
  if d > public.business_date_at(me.shop_id) then
    raise exception 'No se puede abrir la caja de un día que no ha llegado' using errcode = '22023';
  end if;
  if me.role = 'cashier' and d <> public.business_date_at(me.shop_id) then
    raise exception 'Solo el administrador puede cambiar la base de días anteriores' using errcode = '42501';
  end if;
  -- One opening or closing of a day at a time.
  perform pg_advisory_xact_lock(hashtextextended('register:' || me.shop_id || ':' || d, 0));
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = d) then
    raise exception 'La caja de ese día ya está cerrada' using errcode = '22023';
  end if;

  insert into public.cash_openings (shop_id, business_date, amount, opened_by)
  values (me.shop_id, d, p_amount, me.staff_id)
  on conflict (shop_id, business_date) do update
    set amount = excluded.amount, changed_by = me.staff_id, changed_at = now()
    where public.cash_openings.amount is distinct from excluded.amount
  returning * into r;
  if not found then
    select * into r from public.cash_openings where shop_id = me.shop_id and business_date = d;
  end if;
  return r;
end $$;

-- Closing: same rules as before, now recording the base too.
create or replace function public.close_register(p_date date, p_counted int, p_notes text default null)
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
  -- One opening or closing of a day at a time.
  perform pg_advisory_xact_lock(hashtextextended('register:' || me.shop_id || ':' || p_date, 0));
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = p_date) then
    raise exception 'Ese día ya tiene cierre' using errcode = '23505';
  end if;

  v_expected := public.expected_cash(me.shop_id, p_date);
  insert into public.cash_closings (shop_id, business_date, closed_by, expected_cash, counted_cash, difference, notes, opening_cash)
  values (me.shop_id, p_date, me.staff_id, v_expected, p_counted, p_counted - v_expected, nullif(trim(p_notes), ''),
    public.opening_cash(me.shop_id, p_date))
  returning * into r;
  return r;
end $$;

-- Base, cash in and cash out of a day, for the closing screen.
drop function public.cash_breakdown(date);
create function public.cash_breakdown(p_date date default null)
returns table (opening int, cash_in int, paid_out int, expected int)
language plpgsql stable security definer set search_path = public as $$
declare me record; d date;
begin
  select * into me from public._require_role('admin', 'cashier');
  d := coalesce(p_date, public.business_date_at(me.shop_id));
  return query select
    public.opening_cash(me.shop_id, d),
    (select coalesce(sum(p.amount), 0) from public.payments p join public.sales s on s.id = p.sale_id
      where p.shop_id = me.shop_id and p.business_date = d and p.method = 'cash' and s.status = 'ok')::int,
    (select coalesce(sum(o.commission_total + o.bonus_total), 0) from public.payouts o
      where o.shop_id = me.shop_id and o.business_date = d and o.method = 'cash')::int,
    public.expected_cash(me.shop_id, d);
end $$;

-- Closings with who closed and the base they started from.
drop function public.closing_history(date, date);
create function public.closing_history(p_from date, p_to date)
returns table (
  business_date date, closed_at timestamptz, closed_by text,
  expected_cash int, counted_cash int, difference int, notes text, opening_cash int
)
language sql stable security invoker set search_path = public as $$
  select k.business_date, k.closed_at, st.display_name, k.expected_cash, k.counted_cash, k.difference, k.notes, k.opening_cash
  from public.cash_closings k left join public.staff st on st.id = k.closed_by
  where k.business_date between p_from and p_to
  order by k.business_date desc
$$;

revoke execute on function public.open_register(int, date), public.cash_breakdown(date), public.closing_history(date, date)
  from public, anon;
grant execute on function public.open_register(int, date), public.cash_breakdown(date), public.closing_history(date, date)
  to authenticated;
