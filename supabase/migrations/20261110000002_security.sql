-- Bar Beer · permissions
-- Reads go through row level security. Money writes go only through the functions in the next
-- migration: the phone says what was sold, the server decides price, commission and receipt number.
--
-- Supabase grants everything on public tables to anon and authenticated by default, so we first
-- take that away and then hand back exactly what each table needs.

revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;

-- Functions are executable by PUBLIC by default; close that and open per function.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.my_staff_id(), public.my_shop_id(), public.my_role(),
  public.business_date_at(uuid, timestamptz) to authenticated;

alter table public.shops                enable row level security;
alter table public.staff                enable row level security;
alter table public.catalog_items        enable row level security;
alter table public.commission_overrides enable row level security;
alter table public.customers            enable row level security;
alter table public.sales                enable row level security;
alter table public.sale_lines           enable row level security;
alter table public.payments             enable row level security;
alter table public.bonus_rules          enable row level security;
alter table public.bonus_awards         enable row level security;
alter table public.cash_closings        enable row level security;
alter table public.payouts              enable row level security;
alter table public.client_errors        enable row level security;

-- ─── shops ──────────────────────────────────────────────────────────────────
create policy shops_read on public.shops for select to authenticated
  using (id = (select public.my_shop_id()));

create policy shops_admin_update on public.shops for update to authenticated
  using (id = (select public.my_shop_id()) and (select public.my_role()) = 'admin')
  with check (id = (select public.my_shop_id()));

-- The receipt counter and identity columns are not editable from the app.
grant update (name, timezone, day_cutoff, daily_cut_goal, receipt_template, modules)
  on public.shops to authenticated;

-- ─── staff ──────────────────────────────────────────────────────────────────
-- Admin and cashier see the whole team (the cashier needs the lineup). A barber sees only himself.
create policy staff_read on public.staff for select to authenticated
  using (
    shop_id = (select public.my_shop_id())
    and ((select public.my_role()) in ('admin', 'cashier') or user_id = auth.uid())
  );

create policy staff_admin_insert on public.staff for insert to authenticated
  with check (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin');

create policy staff_admin_update on public.staff for update to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin')
  with check (shop_id = (select public.my_shop_id()));

-- user_id is set only by the create-staff Edge Function (service role).
grant insert (shop_id, role, display_name, username, cuts, daily_cut_goal, hired_on, sort_order)
  on public.staff to authenticated;
grant update (role, display_name, username, cuts, daily_cut_goal, active, hired_on, sort_order)
  on public.staff to authenticated;

-- ─── catalog ────────────────────────────────────────────────────────────────
create policy catalog_read on public.catalog_items for select to authenticated
  using (shop_id = (select public.my_shop_id()));

create policy catalog_admin_insert on public.catalog_items for insert to authenticated
  with check (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin');

create policy catalog_admin_update on public.catalog_items for update to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin')
  with check (shop_id = (select public.my_shop_id()));

grant insert (shop_id, kind, name, price, commission_pct, counts_as_cut, active, sort_order)
  on public.catalog_items to authenticated;
grant update (kind, name, price, commission_pct, counts_as_cut, active, sort_order)
  on public.catalog_items to authenticated;

create policy overrides_read on public.commission_overrides for select to authenticated
  using (
    shop_id = (select public.my_shop_id())
    and ((select public.my_role()) = 'admin' or staff_id = (select public.my_staff_id()))
  );

create policy overrides_admin_write on public.commission_overrides for all to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin')
  with check (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin');

grant insert, update, delete on public.commission_overrides to authenticated;

-- ─── customers (personal data: never visible to barbers) ────────────────────
create policy customers_read on public.customers for select to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) in ('admin', 'cashier'));

-- ─── sales, lines, payments ─────────────────────────────────────────────────
-- Admin: everything in the shop. Cashier: the current and previous business day.
-- Barber: only his own lines, never whole bills.
create function public.can_see_day(p_shop uuid, p_date date) returns boolean
language sql stable security definer set search_path = public as $$
  select p_shop = public.my_shop_id()
    and (
      public.my_role() = 'admin'
      or (public.my_role() = 'cashier' and p_date >= public.business_date_at(p_shop) - 1)
    )
$$;
grant execute on function public.can_see_day(uuid, date) to authenticated;

create policy sales_read on public.sales for select to authenticated
  using ((select public.can_see_day(shop_id, business_date)));

create policy payments_read on public.payments for select to authenticated
  using ((select public.can_see_day(shop_id, business_date)));

create policy lines_read on public.sale_lines for select to authenticated
  using (
    (select public.can_see_day(shop_id, business_date))
    or (shop_id = (select public.my_shop_id()) and barber_id = (select public.my_staff_id()))
  );

-- ─── bonuses, closings, payouts ─────────────────────────────────────────────
create policy bonus_rules_read on public.bonus_rules for select to authenticated
  using (shop_id = (select public.my_shop_id()));

create policy bonus_rules_admin_write on public.bonus_rules for all to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin')
  with check (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin');

grant insert, update, delete on public.bonus_rules to authenticated;

create policy bonus_awards_read on public.bonus_awards for select to authenticated
  using (
    shop_id = (select public.my_shop_id())
    and ((select public.my_role()) = 'admin' or staff_id = (select public.my_staff_id()))
  );

create policy closings_read on public.cash_closings for select to authenticated
  using ((select public.can_see_day(shop_id, business_date)));

create policy payouts_read on public.payouts for select to authenticated
  using (
    shop_id = (select public.my_shop_id())
    and ((select public.my_role()) = 'admin' or staff_id = (select public.my_staff_id()))
  );

-- ─── client errors: write-only from the app ─────────────────────────────────
create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (user_id = auth.uid());
revoke select on public.client_errors from authenticated;
grant insert (message, context) on public.client_errors to authenticated;
