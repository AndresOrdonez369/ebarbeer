-- Bar Beer · phase 4: what a barber sees about himself.
-- All read models here filter on the caller's own staff id, and run with the caller's permissions,
-- so row level security still applies underneath.

-- Today's (or a given day's) services of the calling barber, newest first.
create function public.my_day_lines(p_date date default null)
returns table (
  created_at timestamptz, item_name text, qty int, line_total int,
  commission int, counts_as_cut boolean, status public.sale_status
)
language sql stable security invoker set search_path = public as $$
  select l.created_at, l.item_name, l.qty, l.line_total, l.commission_amount, l.counts_as_cut, l.status
  from public.sale_lines l
  where l.barber_id = public.my_staff_id()
    and l.business_date = coalesce(p_date, public.business_date_at(public.my_shop_id()))
  order by l.created_at desc, l.line_no desc
$$;

-- One row per business day the calling barber worked, between two dates (inclusive).
create function public.my_history(p_from date, p_to date)
returns table (business_date date, cuts int, services int, revenue int, commission int)
language sql stable security invoker set search_path = public as $$
  select l.business_date,
    coalesce(sum(case when l.counts_as_cut then l.qty end), 0)::int,
    coalesce(sum(case when l.item_kind = 'service' then l.qty end), 0)::int,
    coalesce(sum(l.line_total), 0)::int,
    coalesce(sum(l.commission_amount), 0)::int
  from public.sale_lines l
  where l.barber_id = public.my_staff_id()
    and l.status = 'ok'
    and l.business_date between p_from and p_to
  group by l.business_date
  order by l.business_date desc
$$;

-- Everything since the barber started.
create function public.my_totals()
returns table (hired_on date, first_day date, days int, cuts int, commission int)
language sql stable security invoker set search_path = public as $$
  select st.hired_on,
    min(l.business_date),
    count(distinct l.business_date)::int,
    coalesce(sum(case when l.counts_as_cut then l.qty end), 0)::int,
    coalesce(sum(l.commission_amount), 0)::int
  from public.staff st
  left join public.sale_lines l on l.barber_id = st.id and l.status = 'ok'
  where st.id = public.my_staff_id()
  group by st.hired_on
$$;

-- Start of the period a bonus rule measures, for a business day. Weeks start on Monday.
create function public.period_start(p_period text, p_day date) returns date
language sql immutable as $$
  select case p_period
    when 'day' then p_day
    when 'week' then date_trunc('week', p_day)::date
    else date_trunc('month', p_day)::date
  end
$$;

create function public.period_end(p_period text, p_day date) returns date
language sql immutable as $$
  select case p_period
    when 'day' then p_day
    when 'week' then (date_trunc('week', p_day) + interval '6 days')::date
    else (date_trunc('month', p_day) + interval '1 month' - interval '1 day')::date
  end
$$;

-- Progress of the calling barber toward every active bonus rule, in the current period.
create function public.my_goals()
returns table (
  rule_id uuid, name text, period text, metric text, threshold int,
  reward_type text, reward_value numeric, period_start date, period_end date, progress int
)
language sql stable security invoker set search_path = public as $$
  with d as (select public.business_date_at(public.my_shop_id()) as today)
  select r.id, r.name, r.period, r.metric, r.threshold, r.reward_type, r.reward_value,
    public.period_start(r.period, d.today), public.period_end(r.period, d.today),
    coalesce((
      select case when r.metric = 'cuts'
        then sum(case when l.counts_as_cut then l.qty else 0 end)
        else sum(l.line_total) end
      from public.sale_lines l
      where l.barber_id = public.my_staff_id() and l.status = 'ok'
        and l.business_date between public.period_start(r.period, d.today) and d.today
    ), 0)::int
  from public.bonus_rules r cross join d
  where r.active and r.shop_id = public.my_shop_id()
  order by case r.period when 'day' then 1 when 'week' then 2 else 3 end, r.threshold
$$;

grant execute on function
  public.my_day_lines(date), public.my_history(date, date), public.my_totals(), public.my_goals(),
  public.period_start(text, date), public.period_end(text, date)
to authenticated;
