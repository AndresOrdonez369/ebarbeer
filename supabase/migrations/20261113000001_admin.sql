-- Bar Beer · phase 5: administration.
-- Staff, catalog, overrides and shop settings are edited straight through their tables: the
-- permissions migration already limits those writes to the admin of the shop, column by column.
-- Customers need a summary the table alone does not give.

-- Customers of the shop with their visits, last visit and money spent. Admin only.
create function public.customer_stats(p_q text default null)
returns table (
  id uuid, name text, phone text, promo_opt_in boolean,
  visits int, last_visit timestamptz, spent int
)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.phone, c.promo_opt_in,
    count(s.id) filter (where s.status = 'ok')::int,
    max(s.created_at) filter (where s.status = 'ok'),
    coalesce(sum(s.total) filter (where s.status = 'ok'), 0)::int
  from public.customers c
  left join public.sales s on s.customer_id = c.id
  where public.my_role() = 'admin'
    and c.shop_id = public.my_shop_id()
    and (
      p_q is null or trim(p_q) = ''
      or c.name ilike '%' || trim(p_q) || '%'
      or (regexp_replace(p_q, '[^0-9]', '', 'g') <> ''
          and c.phone like '%' || regexp_replace(p_q, '[^0-9]', '', 'g') || '%')
    )
  group by c.id
  order by max(s.created_at) desc nulls last, c.created_at desc
  limit 200
$$;

grant execute on function public.customer_stats(text) to authenticated;
