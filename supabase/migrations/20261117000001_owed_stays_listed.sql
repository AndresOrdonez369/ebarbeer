-- Bar Beer · QA before publishing: a barber deactivated (or no longer taking clients) while still
-- owed money must stay in the payout list until he is paid.
create or replace function public.payout_summary(p_from date, p_to date)
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
    -- Everyone who takes clients today, plus anyone with work in the range or money still owed,
    -- even if deactivated since: nobody leaves the list while the shop owes him.
    where st.shop_id = me.shop_id
      and ((st.cuts and st.active)
        or exists (select 1 from public.sale_lines l where l.barber_id = st.id and l.business_date between p_from and p_to)
        or public._owed_from(st.id) is not null)
  )
  select s.id, s.dn, s.c_cuts, s.c_comm, s.c_bonus, s.c_comm_paid + s.c_bonus_paid,
    (s.c_comm - s.c_comm_paid) + (s.c_bonus - s.c_bonus_paid), s.c_before, s.c_last
  from s order by s.sort_order, s.dn;
end $$;
