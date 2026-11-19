-- Charging the same bill twice by mistake.
-- A bill identical to one charged minutes ago (same items, same barbers, same quantities) is held
-- back until the cashier says it is another customer. The bill id generated on the phone still
-- makes a retried request return the first result, so the queue and slow networks are unaffected.

-- The newest bill of the shop that matches these lines, charged recently enough to be a mistake:
-- 15 minutes when a barber served it (nobody does the same cut twice that fast), 2 minutes for
-- drinks and products alone (two customers often order the same beer).
create function public._twin_sale(p_shop uuid, p_lines jsonb) returns public.sales
language sql stable security definer set search_path = public as $$
  with want as (
    select (e->>'item_id')::uuid as item_id,
           nullif(e->>'barber_id', '')::uuid as barber_id,
           sum(coalesce((e->>'qty')::int, 1)) as qty
    from jsonb_array_elements(p_lines) e
    group by 1, 2
  ), k as (
    select string_agg(item_id::text || ':' || coalesce(barber_id::text, '') || ':' || qty, ','
                      order by item_id, barber_id) as key,
           bool_or(barber_id is not null) as served
    from want
  )
  select s.*
  from public.sales s, k
  where s.shop_id = p_shop
    and s.status = 'ok'
    and s.created_at > now() - case when k.served then interval '15 minutes' else interval '2 minutes' end
    and (select string_agg(x.item_id::text || ':' || coalesce(x.barber_id::text, '') || ':' || x.qty, ','
                           order by x.item_id, x.barber_id)
         from (select item_id, barber_id, sum(qty) as qty
               from public.sale_lines where sale_id = s.id group by 1, 2) x) = k.key
  order by s.created_at desc
  limit 1
$$;
revoke execute on function public._twin_sale(uuid, jsonb) from public, anon, authenticated;

-- register_sale with the repeat check. p_repeat = true charges it anyway ("es otro cliente").
-- The 4-argument version stays for phones still running the previous app.
create function public.register_sale(p_id uuid, p_lines jsonb, p_payments jsonb, p_customer jsonb, p_repeat boolean)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me record;
  t  public.sales;
begin
  select * into me from public._require_role('admin', 'cashier');

  if not p_repeat
     and jsonb_typeof(p_lines) = 'array'
     and not exists (select 1 from public.sales where id = p_id) then
    -- Two phones charging the same bill at the same moment: the second one waits and sees the first.
    perform pg_advisory_xact_lock(hashtextextended('charge:' || me.shop_id, 0));
    t := public._twin_sale(me.shop_id, p_lines);
    if t.id is not null then
      raise exception 'Ya se cobró una cuenta igual hace un momento' using
        errcode = 'BBR01',
        detail = json_build_object(
          'receipt_no', t.receipt_no,
          'created_at', t.created_at,
          'total', t.total,
          'methods', (select json_agg(distinct p.method) from public.payments p where p.sale_id = t.id),
          'cashier', (select display_name from public.staff where id = t.cashier_id)
        )::text;
    end if;
  end if;

  return public.register_sale(p_id, p_lines, p_payments, p_customer);
end $$;

revoke execute on function public.register_sale(uuid, jsonb, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.register_sale(uuid, jsonb, jsonb, jsonb, boolean) to authenticated;
