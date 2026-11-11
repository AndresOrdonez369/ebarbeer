-- Bar Beer · after the first run on a real project, what Supabase's database advisor asked for.

-- Supabase grants EXECUTE on every new function to anon by default. The functions of later
-- migrations already refuse anon inside (they check the role), but nothing outside the public
-- receipt should even be callable without a login.
revoke execute on all functions in schema public from anon, public;
grant execute on function public.get_receipt(text) to anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- Pin search_path on the helpers that lacked it.
alter function public.staff_immutable_shop() set search_path = public;
alter function public.normalize_phone(text) set search_path = public;
alter function public.period_start(text, date) set search_path = public;
alter function public.period_end(text, date) set search_path = public;

-- Evaluate auth.uid() once per query, not once per row.
alter policy staff_read on public.staff
  using (
    shop_id = (select public.my_shop_id())
    and ((select public.my_role()) in ('admin', 'cashier') or user_id = (select auth.uid()))
  );
alter policy client_errors_insert on public.client_errors
  with check (user_id = (select auth.uid()));
