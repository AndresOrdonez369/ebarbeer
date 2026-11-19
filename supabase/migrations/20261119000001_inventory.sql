-- Inventory for drinks and products: how many are left of each one.
-- Every bill charged takes its units out, every void puts them back, and the admin records what
-- arrives and what a count found. Each change is a row in stock_moves, so the count can be explained.

alter table public.catalog_items
  -- null: this item has no inventory (services never do).
  add column stock int,
  -- The register and the admin are warned when stock falls to this or below.
  add column stock_min int not null default 0 check (stock_min between 0 and 100000);
grant insert (stock_min) on public.catalog_items to authenticated;
grant update (stock_min) on public.catalog_items to authenticated;

create table public.stock_moves (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  item_id      uuid not null references public.catalog_items (id) on delete cascade,
  -- sale: a bill took units · void: a voided bill put them back · in: stock arrived
  -- count: a physical count replaced the figure · off: the item stopped keeping inventory
  kind         text not null check (kind in ('sale', 'void', 'in', 'count', 'off')),
  delta        int  not null,
  stock_after  int,
  sale_id      uuid references public.sales (id) on delete set null,
  staff_id     uuid references public.staff (id),
  note         text check (length(note) <= 120),
  created_at   timestamptz not null default now()
);
create index stock_moves_item on public.stock_moves (item_id, created_at desc);
create index stock_moves_sale on public.stock_moves (sale_id) where sale_id is not null;
alter table public.stock_moves enable row level security;
create policy stock_moves_admin_read on public.stock_moves for select to authenticated
  using (shop_id = (select public.my_shop_id()) and (select public.my_role()) = 'admin');
revoke all on public.stock_moves from anon, authenticated;
grant select on public.stock_moves to authenticated;

-- ─── Sales and voids move the stock ─────────────────────────────────────────
-- A trigger, so the charging and voiding functions stay as they are. Stock may go below zero:
-- the register never refuses a sale over the count; the admin sees the negative and recounts.
create function public._stock_on_line() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_after int;
  v_staff uuid;
begin
  if new.item_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'ok' then
      return null;
    end if;
    update public.catalog_items set stock = stock - new.qty
      where id = new.item_id and stock is not null
      returning stock into v_after;
    if found then
      select cashier_id into v_staff from public.sales where id = new.sale_id;
      insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, sale_id, staff_id)
      values (new.shop_id, new.item_id, 'sale', -new.qty, v_after, new.sale_id, v_staff);
    end if;

  elsif old.status = 'ok' and new.status = 'void' then
    -- Only what this bill actually took out, and only once.
    if exists (select 1 from public.stock_moves where sale_id = new.sale_id and item_id = new.item_id and kind = 'sale')
       and not exists (select 1 from public.stock_moves where sale_id = new.sale_id and item_id = new.item_id and kind = 'void') then
      update public.catalog_items set stock = stock + new.qty
        where id = new.item_id and stock is not null
        returning stock into v_after;
      if found then
        select voided_by into v_staff from public.sales where id = new.sale_id;
        insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, sale_id, staff_id)
        values (new.shop_id, new.item_id, 'void', new.qty, v_after, new.sale_id, v_staff);
      end if;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public._stock_on_line() from public, anon, authenticated;

create trigger sale_lines_stock
  after insert or update of status on public.sale_lines
  for each row execute function public._stock_on_line();

-- ─── An item moved to Servicios stops keeping inventory ─────────────────────
-- Services never keep stock, and adjust_stock refuses them, so the figure would be stuck otherwise.
create function public._stock_kind() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, staff_id, note)
  values (new.shop_id, new.id, 'off', 0, null, public.my_staff_id(), 'Pasó a servicios');
  new.stock := null;
  return new;
end $$;
revoke execute on function public._stock_kind() from public, anon, authenticated;

create trigger catalog_items_stock_kind
  before update of kind on public.catalog_items
  for each row when (new.kind = 'service' and old.stock is not null)
  execute function public._stock_kind();

-- ─── The admin moves the stock by hand ──────────────────────────────────────
--   in:    p_qty units arrived (starts the inventory at 0 if it had none)
--   count: a count found p_qty units; the figure becomes that
--   off:   stop keeping inventory of this item
create function public.adjust_stock(p_item uuid, p_kind text, p_qty int default null, p_note text default null)
returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  it public.catalog_items;
  v_after int;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 120), '');
begin
  select * into me from public._require_role('admin');
  select * into it from public.catalog_items where id = p_item and shop_id = me.shop_id for update;
  if not found then
    raise exception 'Producto no encontrado' using errcode = '22023';
  end if;
  if it.kind = 'service' then
    raise exception 'Los servicios no llevan inventario' using errcode = '22023';
  end if;

  if p_kind = 'in' then
    if p_qty is null or p_qty < 1 or p_qty > 100000 then
      raise exception 'Escribe cuántas unidades llegaron' using errcode = '22023';
    end if;
    v_after := coalesce(it.stock, 0) + p_qty;
    insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, staff_id, note)
    values (me.shop_id, p_item, 'in', p_qty, v_after, me.staff_id, v_note);
  elsif p_kind = 'count' then
    if p_qty is null or p_qty < 0 or p_qty > 1000000 then
      raise exception 'Escribe cuántas unidades hay' using errcode = '22023';
    end if;
    v_after := p_qty;
    insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, staff_id, note)
    values (me.shop_id, p_item, 'count', p_qty - coalesce(it.stock, 0), v_after, me.staff_id, v_note);
  elsif p_kind = 'off' then
    if it.stock is null then
      return null;
    end if;
    v_after := null;
    insert into public.stock_moves (shop_id, item_id, kind, delta, stock_after, staff_id, note)
    values (me.shop_id, p_item, 'off', 0, null, me.staff_id, v_note);
  else
    raise exception 'Movimiento de inventario no válido' using errcode = '22023';
  end if;

  update public.catalog_items set stock = v_after where id = p_item;
  return v_after;
end $$;

revoke execute on function public.adjust_stock(uuid, text, int, text) from public, anon;
grant execute on function public.adjust_stock(uuid, text, int, text) to authenticated;
