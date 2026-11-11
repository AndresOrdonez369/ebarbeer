-- Bar Beer · phase 3: customers at the register and receipts by WhatsApp.
--
-- The customer travels inside the bill (p_customer: phone, name, promo opt-in) so a bill charged
-- offline keeps its customer when the queue drains, in the same transaction, idempotently.
-- A customer can also be attached after charging, when the cashier forgot to ask.

drop function if exists public.register_sale(uuid, jsonb, jsonb, uuid);

-- Finds or creates the customer of a shop from what the cashier typed. Internal.
create function public._customer_from(p_shop uuid, p_customer jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_phone text;
  v_name text;
  v_promo boolean;
begin
  if p_customer is null or coalesce(p_customer->>'phone', '') = '' then
    return null;
  end if;
  v_phone := public.normalize_phone(p_customer->>'phone');
  v_name := nullif(trim(coalesce(p_customer->>'name', '')), '');
  v_promo := (p_customer->>'promo')::boolean;

  insert into public.customers (shop_id, phone, name, promo_opt_in)
  values (p_shop, v_phone, v_name, coalesce(v_promo, false))
  on conflict (shop_id, phone) do update
    set name = coalesce(excluded.name, public.customers.name),
        promo_opt_in = coalesce(v_promo, public.customers.promo_opt_in)
  returning id into v_id;
  return v_id;
end $$;

-- p_lines:    [{ "item_id": uuid, "qty": int, "barber_id": uuid | null }]
-- p_payments: [{ "method": "cash"|"transfer"|"card", "amount": int, "cash_received": int | null }]
-- p_customer: { "phone": text, "name": text | null, "promo": bool | null } | null
-- Idempotent on p_id: calling twice with the same id returns the first result.
create function public.register_sale(
  p_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_customer jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me        record;
  v_date    date;
  v_no      int;
  v_total   int := 0;
  v_paid    int := 0;
  v_sale    public.sales;
  v_cust    uuid;
  l         jsonb;
  v_n       int;
  p         jsonb;
  it        public.catalog_items;
  v_qty     int;
  v_barber  uuid;
  v_pct     numeric(5,2);
  v_line    int;
begin
  select * into me from public._require_role('admin', 'cashier');

  select * into v_sale from public.sales where id = p_id;
  if found then
    if v_sale.shop_id <> me.shop_id then
      raise exception 'Identificador de cuenta en uso' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_sale.id, 'receipt_no', v_sale.receipt_no,
      'receipt_token', v_sale.receipt_token, 'total', v_sale.total,
      'business_date', v_sale.business_date, 'customer_id', v_sale.customer_id, 'duplicate', true);
  end if;

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'La cuenta está vacía' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lines) > 50 then
    raise exception 'Demasiados ítems en una cuenta' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Falta el método de pago' using errcode = '22023';
  end if;

  v_cust := public._customer_from(me.shop_id, p_customer);
  v_date := public.business_date_at(me.shop_id, now());

  update public.shops set next_receipt_no = next_receipt_no + 1
  where id = me.shop_id returning next_receipt_no - 1 into v_no;

  insert into public.sales (id, shop_id, receipt_no, business_date, cashier_id, customer_id, subtotal, total)
  values (p_id, me.shop_id, v_no, v_date, me.staff_id, v_cust, 0, 0)
  returning * into v_sale;

  for l, v_n in select e, n from jsonb_array_elements(p_lines) with ordinality as t(e, n) loop
    select * into it from public.catalog_items
    where id = (l->>'item_id')::uuid and shop_id = me.shop_id and active;
    if not found then
      raise exception 'Producto o servicio no disponible' using errcode = '22023';
    end if;

    v_qty := coalesce((l->>'qty')::int, 1);
    if v_qty not between 1 and 99 then
      raise exception 'Cantidad no válida' using errcode = '22023';
    end if;

    v_barber := nullif(l->>'barber_id', '')::uuid;
    if v_barber is not null and not exists (
      select 1 from public.staff where id = v_barber and shop_id = me.shop_id and active and cuts
    ) then
      raise exception 'Barbero no disponible' using errcode = '22023';
    end if;
    if it.kind = 'service' and v_barber is null then
      raise exception 'Falta el barbero de %', it.name using errcode = '22023';
    end if;

    v_line := it.price * v_qty;
    v_pct := 0;
    if v_barber is not null then
      select coalesce(
        (select o.commission_pct from public.commission_overrides o
          where o.staff_id = v_barber and o.item_id = it.id and o.shop_id = me.shop_id),
        it.commission_pct)
      into v_pct;
    end if;

    insert into public.sale_lines (sale_id, line_no, shop_id, business_date, item_id, barber_id, qty,
      item_name, item_kind, unit_price, line_total, commission_pct, commission_amount, counts_as_cut)
    values (p_id, v_n, me.shop_id, v_date, it.id, v_barber, v_qty,
      it.name, it.kind, it.price, v_line, v_pct, round(v_line * v_pct / 100)::int,
      it.counts_as_cut and v_barber is not null);

    v_total := v_total + v_line;
  end loop;

  for p in select * from jsonb_array_elements(p_payments) loop
    if (p->>'method') not in ('cash', 'transfer', 'card') then
      raise exception 'Método de pago no válido' using errcode = '22023';
    end if;
    if coalesce((p->>'amount')::int, 0) <= 0 then
      raise exception 'Monto de pago no válido' using errcode = '22023';
    end if;
    insert into public.payments (sale_id, shop_id, business_date, method, amount, cash_received)
    values (p_id, me.shop_id, v_date, (p->>'method')::public.pay_method, (p->>'amount')::int,
      case when p->>'method' = 'cash' then nullif(p->>'cash_received', '')::int end);
    v_paid := v_paid + (p->>'amount')::int;
  end loop;

  if v_paid <> v_total then
    raise exception 'Los pagos (%) no suman el total (%)', v_paid, v_total using errcode = '22023';
  end if;

  update public.sales set subtotal = v_total, total = v_total where id = p_id
  returning * into v_sale;

  return jsonb_build_object('id', v_sale.id, 'receipt_no', v_sale.receipt_no,
    'receipt_token', v_sale.receipt_token, 'total', v_sale.total,
    'business_date', v_sale.business_date, 'customer_id', v_sale.customer_id, 'duplicate', false);
end $$;

-- Attach (or replace) the customer of a bill already charged, so its receipt can be sent.
create function public.set_sale_customer(p_id uuid, p_customer jsonb) returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  me record;
  s  public.sales;
  v_cust uuid;
  r  public.customers;
begin
  select * into me from public._require_role('admin', 'cashier');
  select * into s from public.sales where id = p_id and shop_id = me.shop_id;
  if not found then
    raise exception 'Cuenta no encontrada' using errcode = '22023';
  end if;
  if me.role = 'cashier' and s.business_date < public.business_date_at(me.shop_id) - 1 then
    raise exception 'Solo el administrador puede cambiar cuentas de días anteriores' using errcode = '42501';
  end if;
  v_cust := public._customer_from(me.shop_id, p_customer);
  if v_cust is null then
    raise exception 'Escribe el WhatsApp del cliente' using errcode = '22023';
  end if;
  update public.sales set customer_id = v_cust where id = p_id;
  select * into r from public.customers where id = v_cust;
  return r;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.my_staff_id(), public.my_shop_id(), public.my_role(),
  public.business_date_at(uuid, timestamptz), public.can_see_day(uuid, date),
  public.upsert_customer(text, text, boolean),
  public.register_sale(uuid, jsonb, jsonb, jsonb),
  public.set_sale_customer(uuid, jsonb),
  public.void_sale(uuid, text),
  public.mark_receipt_sent(uuid),
  public.close_register(date, int, text),
  public.day_board(date),
  public.day_totals(date),
  public.normalize_phone(text)
to authenticated;

grant execute on function public.get_receipt(text) to anon, authenticated;
