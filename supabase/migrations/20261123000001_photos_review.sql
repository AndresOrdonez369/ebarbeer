-- Customer photos, after the final review: a malformed customer id reads as "Cliente no
-- encontrado" instead of a raw cast error. Same function otherwise.
create or replace function public.start_visit(
  p_id uuid,
  p_customer jsonb,
  p_note text default null,
  p_consent boolean default false,
  p_minor boolean default false,
  p_photos int default 0,
  p_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v public.client_visits;
  v_cust uuid;
  v_name text := nullif(left(trim(coalesce(p_customer->>'name', '')), 60), '');
  v_at timestamptz := case when p_at between now() - interval '3 days' and now() + interval '5 minutes' then p_at else now() end;
  c public.customers;
begin
  select * into me from public._require_role('admin', 'barber', 'cashier');
  if p_id is null then
    raise exception 'Falta el identificador de la visita' using errcode = '22023';
  end if;

  select * into v from public.client_visits where id = p_id;
  if found then
    if v.shop_id <> me.shop_id or (v.barber_id <> me.staff_id and me.role <> 'admin') then
      raise exception 'Visita no encontrada' using errcode = '22023';
    end if;
    return jsonb_build_object('visit_id', v.id, 'customer_id', v.customer_id, 'shop_id', v.shop_id, 'duplicate', true);
  end if;

  if coalesce(p_customer->>'id', '') <> '' then
    if p_customer->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Cliente no encontrado' using errcode = '22023';
    end if;
    select id into v_cust from public.customers where id = (p_customer->>'id')::uuid and shop_id = me.shop_id;
    if v_cust is null then
      raise exception 'Cliente no encontrado' using errcode = '22023';
    end if;
    if v_name is not null then
      update public.customers set name = v_name where id = v_cust and name is null;
    end if;
  else
    if coalesce(p_customer->>'phone', '') = '' then
      raise exception 'Escribe el WhatsApp del cliente' using errcode = '22023';
    end if;
    insert into public.customers (shop_id, phone, name)
    values (me.shop_id, public.normalize_phone(p_customer->>'phone'), v_name)
    on conflict (shop_id, phone) do update set name = coalesce(public.customers.name, excluded.name)
    returning id into v_cust;
  end if;

  if p_consent then
    update public.customers
      set photo_consent_at = now(), photo_consent_by = me.staff_id, photo_consent_minor = coalesce(p_minor, false)
      where id = v_cust and photo_consent_at is null;
  end if;
  select * into c from public.customers where id = v_cust;
  if coalesce(p_photos, 0) > 0 and c.photo_consent_at is null then
    raise exception 'Falta la autorización del cliente para guardar sus fotos' using errcode = '22023';
  end if;
  if coalesce(p_photos, 0) = 0 and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Toma al menos una foto o escribe una nota' using errcode = '22023';
  end if;

  begin
    insert into public.client_visits (id, shop_id, customer_id, barber_id, business_date, taken_at, note)
    values (p_id, me.shop_id, v_cust, me.staff_id, public.business_date_at(me.shop_id, v_at), v_at,
      nullif(left(trim(coalesce(p_note, '')), 280), ''))
    returning * into v;
  exception when unique_violation then
    -- The same visit sent twice at once from this phone: the other request saved it.
    select * into v from public.client_visits where id = p_id;
    if v.shop_id <> me.shop_id or (v.barber_id <> me.staff_id and me.role <> 'admin') then
      raise exception 'Visita no encontrada' using errcode = '22023';
    end if;
    return jsonb_build_object('visit_id', v.id, 'customer_id', v.customer_id, 'shop_id', v.shop_id, 'duplicate', true);
  end;
  return jsonb_build_object('visit_id', v.id, 'customer_id', v.customer_id, 'shop_id', v.shop_id, 'duplicate', false);
end $$;

revoke execute on function public.start_visit(uuid, jsonb, text, boolean, boolean, int, timestamptz) from public, anon;
grant execute on function public.start_visit(uuid, jsonb, text, boolean, boolean, int, timestamptz) to authenticated;
