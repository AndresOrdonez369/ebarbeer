-- Live updates: the admin and the barber see the counter rise the moment the cashier charges.
-- Realtime respects row level security, so a barber only receives his own lines.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sale_lines, public.sales;
  end if;
end $$;
