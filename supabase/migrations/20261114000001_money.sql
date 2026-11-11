-- Bar Beer · phase 6: money. Bonuses awarded, barbers paid, reports, voids.
-- Writes (awards, payouts) are server-side functions; every amount is computed from the frozen
-- sale lines, never sent by the phone.

-- ─── Bonuses ────────────────────────────────────────────────────────────────
-- Awards every closed period (day, week or month) of every active rule in which a barber met the
-- threshold, if not awarded yet. Looks back 120 days. Returns how many awards it created.
create function public._award_bonuses(p_shop uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.business_date_at(p_shop);
  v_count int := 0;
  r record;
  p record;
begin
  for r in select * from public.bonus_rules where shop_id = p_shop and active loop
    for p in
      with periods as (
        select distinct public.period_start(r.period, d::date) as s
        from generate_series(v_today - 120, v_today - 1, interval '1 day') d
      ),
      closed as (
        select s, public.period_end(r.period, s) as e from periods
        where public.period_end(r.period, s) < v_today
      )
      select c.s, c.e, l.barber_id,
        sum(case when l.counts_as_cut then l.qty else 0 end)::int as cuts,
        sum(l.line_total)::int as revenue,
        sum(l.commission_amount)::int as commission
      from closed c
      join public.sale_lines l
        on l.shop_id = p_shop and l.status = 'ok' and l.barber_id is not null
       and l.business_date between c.s and c.e
      group by c.s, c.e, l.barber_id
    loop
      if (case when r.metric = 'cuts' then p.cuts else p.revenue end) >= r.threshold
         and not exists (
           select 1 from public.bonus_awards a
           where a.rule_id = r.id and a.staff_id = p.barber_id and a.period_start = p.s
         ) then
        insert into public.bonus_awards (rule_id, shop_id, staff_id, period_start, amount)
        values (r.id, p_shop, p.barber_id, p.s,
          case when r.reward_type = 'fixed' then round(r.reward_value)::int
               else round(p.commission * r.reward_value / 100)::int end);
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end $$;

-- Admin button: "calcular bonos pendientes".
create function public.award_bonuses() returns int
language plpgsql security definer set search_path = public as $$
declare me record;
begin
  select * into me from public._require_role('admin');
  return public._award_bonuses(me.shop_id);
end $$;

-- Nightly, for every shop (scheduled below when pg_cron is enabled).
create function public.award_bonuses_all() returns int
language plpgsql security definer set search_path = public as $$
declare v int := 0; s record;
begin
  for s in select id from public.shops loop
    v := v + public._award_bonuses(s.id);
  end loop;
  return v;
end $$;

-- Supabase ships pg_cron; turn it on here so nobody has to click it in the dashboard first.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and not exists (select 1 from pg_extension where extname = 'pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('barbeer-award-bonuses', '30 10 * * *', 'select public.award_bonuses_all()');
  end if;
end $$;

-- ─── Paying barbers ─────────────────────────────────────────────────────────
-- What each person who takes clients is owed between two business dates: commission of their
-- own lines plus bonuses awarded for periods that start in the range, and whether it was paid.
create function public.payout_summary(p_from date, p_to date)
returns table (
  staff_id uuid, display_name text, cuts int, commission int, bonus int,
  paid_at timestamptz, paid_total int
)
language sql stable security invoker set search_path = public as $$
  select st.id, st.display_name,
    coalesce((select sum(case when l.counts_as_cut then l.qty else 0 end) from public.sale_lines l
      where l.barber_id = st.id and l.status = 'ok' and l.business_date between p_from and p_to), 0)::int,
    coalesce((select sum(l.commission_amount) from public.sale_lines l
      where l.barber_id = st.id and l.status = 'ok' and l.business_date between p_from and p_to), 0)::int,
    coalesce((select sum(a.amount) from public.bonus_awards a
      where a.staff_id = st.id and a.period_start between p_from and p_to), 0)::int,
    po.paid_at,
    (po.commission_total + po.bonus_total)
  from public.staff st
  left join public.payouts po on po.staff_id = st.id and po.period_start = p_from and po.period_end = p_to
  where public.my_role() = 'admin' and st.shop_id = public.my_shop_id() and st.cuts
    and (st.active or exists (
      select 1 from public.sale_lines l where l.barber_id = st.id and l.business_date between p_from and p_to))
  order by st.sort_order, st.display_name
$$;

-- Records a payment. Amounts are recomputed here, not taken from the phone.
create function public.mark_payout_paid(p_staff uuid, p_from date, p_to date) returns public.payouts
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_comm int;
  v_bonus int;
  r public.payouts;
begin
  select * into me from public._require_role('admin');
  if p_to < p_from then
    raise exception 'El periodo no es válido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.staff where id = p_staff and shop_id = me.shop_id) then
    raise exception 'Persona no encontrada' using errcode = '22023';
  end if;
  if exists (select 1 from public.payouts where staff_id = p_staff and period_start = p_from and period_end = p_to) then
    raise exception 'Ese periodo ya está marcado como pagado' using errcode = '23505';
  end if;
  select coalesce(sum(commission_amount), 0)::int into v_comm from public.sale_lines
    where barber_id = p_staff and status = 'ok' and business_date between p_from and p_to;
  select coalesce(sum(amount), 0)::int into v_bonus from public.bonus_awards
    where staff_id = p_staff and period_start between p_from and p_to;
  insert into public.payouts (shop_id, staff_id, period_start, period_end, commission_total, bonus_total, paid_by)
  values (me.shop_id, p_staff, p_from, p_to, v_comm, v_bonus, me.staff_id)
  returning * into r;
  return r;
end $$;

-- ─── Reports ────────────────────────────────────────────────────────────────
create function public.report_summary(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = public as $$
  select case when public.my_role() <> 'admin' then null else jsonb_build_object(
    'total', (select coalesce(sum(total), 0) from public.sales where status = 'ok' and business_date between p_from and p_to),
    'bills', (select count(*) from public.sales where status = 'ok' and business_date between p_from and p_to),
    'voided', (select count(*) from public.sales where status = 'void' and business_date between p_from and p_to),
    'cuts', (select coalesce(sum(qty), 0) from public.sale_lines where status = 'ok' and counts_as_cut and business_date between p_from and p_to),
    'commission', (select coalesce(sum(commission_amount), 0) from public.sale_lines where status = 'ok' and business_date between p_from and p_to),
    'methods', (select coalesce(jsonb_object_agg(method, amount), '{}'::jsonb) from (
        select p.method, sum(p.amount) as amount from public.payments p join public.sales s on s.id = p.sale_id
        where s.status = 'ok' and p.business_date between p_from and p_to group by p.method) m),
    'by_barber', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb) from (
        select st.display_name as name,
          sum(case when l.counts_as_cut then l.qty else 0 end) as cuts,
          sum(l.line_total) as revenue, sum(l.commission_amount) as commission
        from public.sale_lines l join public.staff st on st.id = l.barber_id
        where l.status = 'ok' and l.business_date between p_from and p_to
        group by st.display_name) x),
    'by_item', (select coalesce(jsonb_agg(x order by x.revenue desc), '[]'::jsonb) from (
        select l.item_name as name, l.item_kind as kind, sum(l.qty) as qty, sum(l.line_total) as revenue
        from public.sale_lines l
        where l.status = 'ok' and l.business_date between p_from and p_to
        group by l.item_name, l.item_kind) x),
    'by_day', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
        select s.business_date as day, sum(s.total) as total, count(*) as bills
        from public.sales s
        where s.status = 'ok' and s.business_date between p_from and p_to
        group by s.business_date) x)
  ) end
$$;

-- One row per sale line, for the CSV export.
create function public.report_lines(p_from date, p_to date)
returns table (
  business_date date, receipt_no int, created_at timestamptz, item_name text, item_kind text,
  qty int, line_total int, barber text, commission int, status text, payment text, customer text
)
language sql stable security invoker set search_path = public as $$
  select l.business_date, s.receipt_no, s.created_at, l.item_name, l.item_kind::text, l.qty, l.line_total,
    b.display_name, l.commission_amount, l.status::text,
    (select string_agg(p.method::text || ' ' || p.amount, ' + ' order by p.amount desc)
       from public.payments p where p.sale_id = s.id),
    c.name
  from public.sale_lines l
  join public.sales s on s.id = l.sale_id
  left join public.staff b on b.id = l.barber_id
  left join public.customers c on c.id = s.customer_id
  where public.my_role() = 'admin' and l.business_date between p_from and p_to
  order by s.created_at, l.line_no
$$;

-- Voided bills with who voided them and why.
create function public.voided_sales(p_from date, p_to date)
returns table (
  id uuid, receipt_no int, business_date date, created_at timestamptz, total int,
  voided_at timestamptz, void_reason text, voided_by text, cashier text
)
language sql stable security invoker set search_path = public as $$
  select s.id, s.receipt_no, s.business_date, s.created_at, s.total, s.voided_at, s.void_reason,
    v.display_name, c.display_name
  from public.sales s
  left join public.staff v on v.id = s.voided_by
  left join public.staff c on c.id = s.cashier_id
  where public.my_role() = 'admin' and s.status = 'void' and s.business_date between p_from and p_to
  order by s.voided_at desc
$$;

-- Closings with who closed.
create function public.closing_history(p_from date, p_to date)
returns table (
  business_date date, closed_at timestamptz, closed_by text,
  expected_cash int, counted_cash int, difference int, notes text
)
language sql stable security invoker set search_path = public as $$
  select k.business_date, k.closed_at, st.display_name, k.expected_cash, k.counted_cash, k.difference, k.notes
  from public.cash_closings k left join public.staff st on st.id = k.closed_by
  where k.business_date between p_from and p_to
  order by k.business_date desc
$$;

-- Cash the drawer should hold for a business day of the caller's own shop.
create function public.my_expected_cash(p_date date default null) returns int
language plpgsql stable security definer set search_path = public as $$
declare me record;
begin
  select * into me from public._require_role('admin', 'cashier');
  return public.expected_cash(me.shop_id, coalesce(p_date, public.business_date_at(me.shop_id)));
end $$;

revoke execute on function public._award_bonuses(uuid), public.award_bonuses_all() from public, anon, authenticated;
grant execute on function
  public.award_bonuses(), public.payout_summary(date, date), public.mark_payout_paid(uuid, date, date),
  public.report_summary(date, date), public.report_lines(date, date), public.voided_sales(date, date),
  public.closing_history(date, date), public.my_expected_cash(date)
to authenticated;
