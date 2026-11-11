-- Bar Beer · paying barbers at the register ("liquidar").
-- At the end of the shift the barber comes to the register; the cashier sees his cuts, what he sold,
-- his commission and bonuses, what was already paid, and pays what is left with one tap.
-- Every paid commission and bonus points at its payout, so nothing is paid twice and any range
-- (day, week, month) can say what was earned, what was paid and what is still owed.

alter table public.sale_lines add column payout_id uuid references public.payouts (id);
alter table public.bonus_awards add column payout_id uuid references public.payouts (id);
create index on public.sale_lines (barber_id, business_date) where payout_id is null;

-- A barber can be paid more than once for overlapping ranges (today, then the rest of the week).
alter table public.payouts drop constraint if exists payouts_staff_id_period_start_period_end_key;
alter table public.payouts
  add column method text not null default 'cash' check (method in ('cash', 'transfer')),
  add column business_date date,
  add column cuts int not null default 0;
update public.payouts set business_date = public.business_date_at(shop_id, paid_at) where business_date is null;
alter table public.payouts alter column business_date set not null;
create index on public.payouts (shop_id, business_date);

-- Payouts recorded before this migration were bookkeeping marks for a range: link what they
-- covered so it is not paid again, and keep them out of the drawer (they were not register cash).
update public.payouts set method = 'transfer';
update public.sale_lines l set payout_id = p.id
  from public.payouts p
  where l.barber_id = p.staff_id and l.status = 'ok' and l.payout_id is null
    and l.business_date between p.period_start and p.period_end;
update public.bonus_awards a set payout_id = p.id
  from public.payouts p
  where a.staff_id = p.staff_id and a.payout_id is null and a.period_start between p.period_start and p.period_end;

-- ─── Day bonuses met today ──────────────────────────────────────────────────
-- Day rules met today and not awarded yet. A fixed day bonus can be paid the same night (cuts only
-- go up, so once met it stays met). A percentage one depends on the whole day's commission, so it
-- waits for the nightly calculation; it is shown, not paid.
create function public._day_bonuses_pending(p_shop uuid, p_staff uuid)
returns table (rule_id uuid, name text, amount int, payable boolean)
language sql stable security definer set search_path = public as $$
  with d as (
    select
      coalesce(sum(case when counts_as_cut then qty else 0 end), 0)::int as cuts,
      coalesce(sum(line_total), 0)::int as revenue,
      coalesce(sum(commission_amount), 0)::int as commission
    from public.sale_lines
    where barber_id = p_staff and status = 'ok' and business_date = public.business_date_at(p_shop)
  )
  select b.id, b.name,
    case when b.reward_type = 'fixed' then round(b.reward_value)::int
         else round(d.commission * b.reward_value / 100)::int end,
    b.reward_type = 'fixed'
  from public.bonus_rules b, d
  where b.shop_id = p_shop and b.active and b.period = 'day'
    and (case when b.metric = 'cuts' then d.cuts else d.revenue end) >= b.threshold
    and not exists (
      select 1 from public.bonus_awards a
      where a.rule_id = b.id and a.staff_id = p_staff and a.period_start = public.business_date_at(p_shop))
$$;

-- Earliest business date with something unpaid (a line or a bonus), or null when he is up to date.
create function public._owed_from(p_staff uuid) returns date
language sql stable security definer set search_path = public as $$
  select least(
    (select min(business_date) from public.sale_lines
      where barber_id = p_staff and status = 'ok' and payout_id is null and commission_amount > 0),
    (select min(period_start) from public.bonus_awards where staff_id = p_staff and payout_id is null))
$$;

-- ─── What one barber earned, was paid and is owed in a range ────────────────
create function public.settle_summary(p_staff uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  st public.staff;
  v_today date;
  v_with_today boolean;
begin
  select * into me from public._require_role('admin', 'cashier', 'barber');
  select * into st from public.staff where id = p_staff and shop_id = me.shop_id;
  if not found then
    raise exception 'Persona no encontrada' using errcode = '22023';
  end if;
  if me.role = 'barber' and me.staff_id <> p_staff then
    raise exception 'No tienes permiso para esta acción' using errcode = '42501';
  end if;
  v_today := public.business_date_at(me.shop_id);
  v_with_today := v_today between p_from and p_to;

  return (
    with l as (
      select * from public.sale_lines
      where barber_id = p_staff and status = 'ok' and business_date between p_from and p_to
    ),
    a as (
      select a.*, b.name as rule_name from public.bonus_awards a join public.bonus_rules b on b.id = a.rule_id
      where a.staff_id = p_staff and a.period_start between p_from and p_to
    ),
    t as (
      select * from public._day_bonuses_pending(me.shop_id, p_staff) where v_with_today
    )
    select jsonb_build_object(
      'name', st.display_name,
      'cuts', (select coalesce(sum(qty), 0) from l where counts_as_cut),
      'services', (select coalesce(sum(qty), 0) from l where item_kind = 'service'),
      'revenue', (select coalesce(sum(line_total), 0) from l),
      'commission', (select coalesce(sum(commission_amount), 0) from l),
      'commission_paid', (select coalesce(sum(commission_amount), 0) from l where payout_id is not null),
      'bonus', (select coalesce(sum(amount), 0) from a) + (select coalesce(sum(amount), 0) from t where payable),
      'bonus_paid', (select coalesce(sum(amount), 0) from a where payout_id is not null),
      'bonus_today', (select coalesce(sum(amount), 0) from t where payable),
      'days', (select count(distinct business_date) from l),
      'items', (select coalesce(jsonb_agg(x order by x.commission desc), '[]'::jsonb) from (
          select item_name as name, sum(qty) as qty, sum(line_total) as revenue, sum(commission_amount) as commission
          from l group by item_name) x),
      'bonuses', (select coalesce(jsonb_agg(x order by x.period_start), '[]'::jsonb) from (
          select rule_name as name, period_start, amount, payout_id is not null as paid, false as today, true as payable from a
          union all
          select name, v_today, amount, false, true, payable from t) x),
      'payouts', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'paid_at', p.paid_at,
          'total', p.commission_total + p.bonus_total, 'method', p.method, 'paid_by', pb.display_name,
          'from', p.period_start, 'to', p.period_end) order by p.paid_at desc), '[]'::jsonb)
        from public.payouts p left join public.staff pb on pb.id = p.paid_by
        where p.staff_id = p_staff and p.business_date between p_from and p_to),
      -- Owed from before the range, and since when, so nothing older is left behind.
      'owed_before', (select coalesce(sum(commission_amount), 0) from public.sale_lines
          where barber_id = p_staff and status = 'ok' and payout_id is null and business_date < p_from)
        + (select coalesce(sum(amount), 0) from public.bonus_awards
          where staff_id = p_staff and payout_id is null and period_start < p_from),
      'owed_from', public._owed_from(p_staff)
    )
  );
end $$;

-- ─── Pay what is owed in a range ────────────────────────────────────────────
-- Amounts come from the frozen lines, never from the phone. The phone sends the amount the cashier
-- confirmed; if anything changed in between (a new sale, another phone paid), nothing is recorded
-- and the cashier is asked again. Lines are claimed by the same statement that sums them, so a sale
-- or a void arriving at the same moment is either fully in this payout or fully out of it.
create function public.pay_barber(p_staff uuid, p_from date, p_to date, p_method text default 'cash',
  p_expected int default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me record;
  st public.staff;
  v_today date;
  v_comm int;
  v_cuts int;
  v_bonus int;
  r public.payouts;
begin
  select * into me from public._require_role('admin', 'cashier');
  -- One payment per barber at a time.
  select * into st from public.staff where id = p_staff and shop_id = me.shop_id for update;
  if not found then
    raise exception 'Persona no encontrada' using errcode = '22023';
  end if;
  if p_method not in ('cash', 'transfer') then
    raise exception 'Forma de pago no válida' using errcode = '22023';
  end if;
  v_today := public.business_date_at(me.shop_id);
  if p_to < p_from or p_to > v_today then
    raise exception 'El periodo no es válido' using errcode = '22023';
  end if;
  if p_method = 'cash' and exists (
    select 1 from public.cash_closings where shop_id = me.shop_id and business_date = v_today) then
    raise exception 'La caja de hoy ya está cerrada: págale por transferencia' using errcode = '22023';
  end if;
  if v_today between p_from and p_to then
    insert into public.bonus_awards (rule_id, shop_id, staff_id, period_start, amount)
      select rule_id, me.shop_id, p_staff, v_today, amount
      from public._day_bonuses_pending(me.shop_id, p_staff) where payable
      on conflict (rule_id, staff_id, period_start) do nothing;
  end if;

  insert into public.payouts (shop_id, staff_id, period_start, period_end, commission_total, bonus_total,
    paid_by, method, business_date, cuts)
  values (me.shop_id, p_staff, p_from, p_to, 0, 0, me.staff_id, p_method, v_today, 0)
  returning * into r;

  with u as (
    update public.sale_lines set payout_id = r.id
    where barber_id = p_staff and status = 'ok' and payout_id is null and business_date between p_from and p_to
    returning commission_amount, qty, counts_as_cut
  )
  select coalesce(sum(commission_amount), 0)::int, coalesce(sum(case when counts_as_cut then qty else 0 end), 0)::int
    into v_comm, v_cuts from u;
  with u as (
    update public.bonus_awards set payout_id = r.id
    where staff_id = p_staff and payout_id is null and period_start between p_from and p_to
    returning amount
  )
  select coalesce(sum(amount), 0)::int into v_bonus from u;

  if v_comm + v_bonus <= 0 then
    raise exception 'No hay nada pendiente por pagarle a %', st.display_name using errcode = '22023';
  end if;
  if p_expected is not null and v_comm + v_bonus <> p_expected then
    raise exception 'El monto cambió: ahora le toca $ %. Revísalo y vuelve a confirmar.',
      replace(to_char(v_comm + v_bonus, 'FM999,999,999'), ',', '.') using errcode = '22023';
  end if;

  update public.payouts set commission_total = v_comm, bonus_total = v_bonus, cuts = v_cuts
    where id = r.id;

  return jsonb_build_object('id', r.id, 'paid_at', r.paid_at, 'commission', v_comm, 'bonus', v_bonus,
    'total', v_comm + v_bonus, 'cuts', v_cuts, 'method', r.method,
    'paid_by', (select display_name from public.staff where id = me.staff_id));
end $$;

-- ─── Everyone at once, for the register's Barberos tab and the admin's Pagos ─
-- Runs as the definer: a cashier must see every barber's bonuses and payouts, which row level
-- security hides from her elsewhere.
drop function public.payout_summary(date, date);
drop function public.mark_payout_paid(uuid, date, date);

create function public.payout_summary(p_from date, p_to date)
returns table (
  staff_id uuid, display_name text, cuts int, commission int, bonus int, paid int, owed int,
  owed_before int, last_paid_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  v_today date;
begin
  select * into me from public._require_role('admin', 'cashier');
  v_today := public.business_date_at(me.shop_id);
  return query
  with s as (
    select st.id, st.display_name as dn, st.sort_order,
      (select coalesce(sum(case when l.counts_as_cut then l.qty else 0 end), 0) from public.sale_lines l
        where l.barber_id = st.id and l.status = 'ok' and l.business_date between p_from and p_to)::int as c_cuts,
      (select coalesce(sum(l.commission_amount), 0) from public.sale_lines l
        where l.barber_id = st.id and l.status = 'ok' and l.business_date between p_from and p_to)::int as c_comm,
      (select coalesce(sum(l.commission_amount), 0) from public.sale_lines l
        where l.barber_id = st.id and l.status = 'ok' and l.payout_id is not null and l.business_date between p_from and p_to)::int as c_comm_paid,
      ((select coalesce(sum(a.amount), 0) from public.bonus_awards a
        where a.staff_id = st.id and a.period_start between p_from and p_to)
       + case when v_today between p_from and p_to then
           (select coalesce(sum(t.amount), 0) from public._day_bonuses_pending(me.shop_id, st.id) t where t.payable)
         else 0 end)::int as c_bonus,
      (select coalesce(sum(a.amount), 0) from public.bonus_awards a
        where a.staff_id = st.id and a.payout_id is not null and a.period_start between p_from and p_to)::int as c_bonus_paid,
      ((select coalesce(sum(l.commission_amount), 0) from public.sale_lines l
        where l.barber_id = st.id and l.status = 'ok' and l.payout_id is null and l.business_date < p_from)
       + (select coalesce(sum(a.amount), 0) from public.bonus_awards a
        where a.staff_id = st.id and a.payout_id is null and a.period_start < p_from))::int as c_before,
      (select max(p.paid_at) from public.payouts p where p.staff_id = st.id and p.business_date between p_from and p_to) as c_last
    from public.staff st
    where st.shop_id = me.shop_id and st.cuts
      and (st.active or exists (
        select 1 from public.sale_lines l where l.barber_id = st.id and l.business_date between p_from and p_to))
  )
  select s.id, s.dn, s.c_cuts, s.c_comm, s.c_bonus, s.c_comm_paid + s.c_bonus_paid,
    (s.c_comm - s.c_comm_paid) + (s.c_bonus - s.c_bonus_paid), s.c_before, s.c_last
  from s order by s.sort_order, s.dn;
end $$;

-- ─── The drawer: cash paid to barbers leaves it ─────────────────────────────
create or replace function public.expected_cash(p_shop uuid, p_date date) returns int
language sql stable security definer set search_path = public as $$
  select (
    select coalesce(sum(p.amount), 0)
    from public.payments p join public.sales s on s.id = p.sale_id
    where p.shop_id = p_shop and p.business_date = p_date and p.method = 'cash' and s.status = 'ok'
  )::int - (
    select coalesce(sum(o.commission_total + o.bonus_total), 0)
    from public.payouts o
    where o.shop_id = p_shop and o.business_date = p_date and o.method = 'cash'
  )::int
$$;

-- Cash in and cash out of a day, for the closing screen.
create function public.cash_breakdown(p_date date default null)
returns table (cash_in int, paid_out int, expected int)
language plpgsql stable security definer set search_path = public as $$
declare me record; d date;
begin
  select * into me from public._require_role('admin', 'cashier');
  d := coalesce(p_date, public.business_date_at(me.shop_id));
  return query select
    (select coalesce(sum(p.amount), 0) from public.payments p join public.sales s on s.id = p.sale_id
      where p.shop_id = me.shop_id and p.business_date = d and p.method = 'cash' and s.status = 'ok')::int,
    (select coalesce(sum(o.commission_total + o.bonus_total), 0) from public.payouts o
      where o.shop_id = me.shop_id and o.business_date = d and o.method = 'cash')::int,
    public.expected_cash(me.shop_id, d);
end $$;

-- ─── A paid service cannot be voided ────────────────────────────────────────
create or replace function public.void_sale(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me record;
  s  public.sales;
  v_paid text;
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
  -- Lock the lines so a payment cannot claim them while this void decides.
  perform 1 from public.sale_lines where sale_id = p_id for update;
  select st.display_name into v_paid
    from public.sale_lines l join public.staff st on st.id = l.barber_id
    where l.sale_id = p_id and l.payout_id is not null limit 1;
  if v_paid is not null then
    raise exception 'A % ya se le pagó la comisión de esta cuenta; no se puede anular', v_paid using errcode = '22023';
  end if;

  update public.sales
    set status = 'void', voided_by = me.staff_id, voided_at = now(), void_reason = trim(p_reason)
    where id = p_id;
  update public.sale_lines set status = 'void' where sale_id = p_id;
end $$;

revoke execute on function public._day_bonuses_pending(uuid, uuid), public._owed_from(uuid) from public, anon, authenticated;
revoke execute on function public.settle_summary(uuid, date, date), public.pay_barber(uuid, date, date, text, int),
  public.payout_summary(date, date), public.cash_breakdown(date), public.void_sale(uuid, text) from public, anon;
grant execute on function public.settle_summary(uuid, date, date), public.pay_barber(uuid, date, date, text, int),
  public.payout_summary(date, date), public.cash_breakdown(date), public.void_sale(uuid, text) to authenticated;
