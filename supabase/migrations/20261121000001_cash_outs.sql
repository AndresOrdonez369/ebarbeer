-- Cash taken out of the drawer ("sacar efectivo"): cigarettes, shop supplies, the owner taking some.
-- Each one is recorded with its amount, what it was for, who took it and when, and the day's
-- expected cash becomes:  base + cash charged − cash paid to barbers − cash taken out.
-- A mistake is voided (with a reason), never deleted, while the day is still open.

create table public.cash_outs (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  business_date  date not null,
  amount         int  not null check (amount > 0 and amount <= 100000000),
  reason         text not null check (length(trim(reason)) between 3 and 120),
  taken_by       uuid not null references public.staff (id),
  taken_at       timestamptz not null default now(),
  voided_by      uuid references public.staff (id),
  voided_at      timestamptz,
  void_reason    text check (void_reason is null or length(void_reason) <= 120)
);
create index cash_outs_day on public.cash_outs (shop_id, business_date);
alter table public.cash_outs enable row level security;
create policy cash_outs_read on public.cash_outs for select to authenticated
  using ((select public.can_see_day(shop_id, business_date)));
revoke all on public.cash_outs from anon, authenticated;
grant select on public.cash_outs to authenticated;

-- The closing keeps what had been taken out when it was counted.
alter table public.cash_closings add column cash_out int not null default 0;

-- ─── The drawer ─────────────────────────────────────────────────────────────
create function public.cash_out_total(p_shop uuid, p_date date) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0)::int from public.cash_outs
  where shop_id = p_shop and business_date = p_date and voided_at is null
$$;
revoke execute on function public.cash_out_total(uuid, date) from public, anon, authenticated;

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
  )::int - public.cash_out_total(p_shop, p_date)
$$;

-- "$ 80.000", for messages.
create function public._pesos(p int) returns text
language sql immutable set search_path = public as $$
  select '$ ' || replace(to_char(p, 'FM999,999,999,990'), ',', '.')
$$;
revoke execute on function public._pesos(int) from public, anon, authenticated;

-- Takes cash out of the drawer. A cashier takes from today only; the admin also from an earlier
-- day not yet closed. Never more than the drawer should hold, never from a closed day.
create function public.take_cash(p_amount int, p_reason text, p_date date default null)
returns public.cash_outs
language plpgsql security definer set search_path = public as $$
declare
  me record;
  d date;
  v_reason text := trim(coalesce(p_reason, ''));
  v_left int;
  r public.cash_outs;
begin
  select * into me from public._require_role('admin', 'cashier');
  d := coalesce(p_date, public.business_date_at(me.shop_id));
  if p_amount is null or p_amount < 1 or p_amount > 100000000 then
    raise exception 'Escribe cuánto efectivo sacas' using errcode = '22023';
  end if;
  if length(v_reason) < 3 then
    raise exception 'Escribe para qué se saca el efectivo' using errcode = '22023';
  end if;
  if length(v_reason) > 120 then
    v_reason := left(v_reason, 120);
  end if;
  if d > public.business_date_at(me.shop_id) then
    raise exception 'No se puede sacar efectivo de un día que no ha llegado' using errcode = '22023';
  end if;
  if me.role = 'cashier' and d <> public.business_date_at(me.shop_id) then
    raise exception 'Solo el administrador puede registrar salidas de días anteriores' using errcode = '42501';
  end if;
  -- Same lock as opening and closing: a salida never slips in while the day is being closed.
  perform pg_advisory_xact_lock(hashtextextended('register:' || me.shop_id || ':' || d, 0));
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = d) then
    raise exception 'La caja de ese día ya está cerrada' using errcode = '22023';
  end if;
  v_left := public.expected_cash(me.shop_id, d);
  if p_amount > v_left then
    raise exception 'En la caja debería haber % y no se puede sacar más. Si hay más efectivo, revisa la base o las cuentas.', public._pesos(greatest(v_left, 0))
      using errcode = '22023';
  end if;

  insert into public.cash_outs (shop_id, business_date, amount, reason, taken_by)
  values (me.shop_id, d, p_amount, v_reason, me.staff_id)
  returning * into r;
  return r;
end $$;

-- Voids a salida registered by mistake, while its day is still open. Voiding twice does nothing.
create function public.void_cash_out(p_id uuid, p_reason text)
returns public.cash_outs
language plpgsql security definer set search_path = public as $$
declare
  me record;
  r public.cash_outs;
begin
  select * into me from public._require_role('admin', 'cashier');
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Escribe por qué se anula la salida' using errcode = '22023';
  end if;
  select * into r from public.cash_outs where id = p_id and shop_id = me.shop_id;
  if not found then
    raise exception 'Salida no encontrada' using errcode = '22023';
  end if;
  if me.role = 'cashier' and r.business_date <> public.business_date_at(me.shop_id) then
    raise exception 'Solo el administrador puede anular salidas de días anteriores' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('register:' || me.shop_id || ':' || r.business_date, 0));
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = r.business_date) then
    raise exception 'La caja de ese día ya está cerrada' using errcode = '22023';
  end if;
  select * into r from public.cash_outs where id = p_id for update;
  if r.voided_at is not null then
    return r;
  end if;
  update public.cash_outs
    set voided_by = me.staff_id, voided_at = now(), void_reason = left(trim(p_reason), 120)
    where id = p_id
    returning * into r;
  return r;
end $$;

-- Closing: same rules, now recording what had been taken out.
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
  perform pg_advisory_xact_lock(hashtextextended('register:' || me.shop_id || ':' || p_date, 0));
  if exists (select 1 from public.cash_closings where shop_id = me.shop_id and business_date = p_date) then
    raise exception 'Ese día ya tiene cierre' using errcode = '23505';
  end if;

  v_expected := public.expected_cash(me.shop_id, p_date);
  insert into public.cash_closings (shop_id, business_date, closed_by, expected_cash, counted_cash, difference, notes,
    opening_cash, cash_out)
  values (me.shop_id, p_date, me.staff_id, v_expected, p_counted, p_counted - v_expected, nullif(trim(p_notes), ''),
    public.opening_cash(me.shop_id, p_date), public.cash_out_total(me.shop_id, p_date))
  returning * into r;
  return r;
end $$;

-- Base, cash in, cash paid to barbers and cash taken out of a day, for the closing screen.
drop function public.cash_breakdown(date);
create function public.cash_breakdown(p_date date default null)
returns table (opening int, cash_in int, paid_out int, taken_out int, expected int)
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
    public.cash_out_total(me.shop_id, d),
    public.expected_cash(me.shop_id, d);
end $$;

-- Closings with who closed, the base and what was taken out.
drop function public.closing_history(date, date);
create function public.closing_history(p_from date, p_to date)
returns table (
  business_date date, closed_at timestamptz, closed_by text,
  expected_cash int, counted_cash int, difference int, notes text, opening_cash int, cash_out int
)
language sql stable security invoker set search_path = public as $$
  select k.business_date, k.closed_at, st.display_name, k.expected_cash, k.counted_cash, k.difference, k.notes,
    k.opening_cash, k.cash_out
  from public.cash_closings k left join public.staff st on st.id = k.closed_by
  where k.business_date between p_from and p_to
  order by k.business_date desc
$$;

revoke execute on function public.take_cash(int, text, date), public.void_cash_out(uuid, text),
  public.cash_breakdown(date), public.closing_history(date, date) from public, anon;
grant execute on function public.take_cash(int, text, date), public.void_cash_out(uuid, text),
  public.cash_breakdown(date), public.closing_history(date, date) to authenticated;
