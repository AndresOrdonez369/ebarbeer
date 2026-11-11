-- EXAMPLE DATA ONLY. Names, prices and percentages are invented to try the app.
-- Replace with the shop's real catalog before going live.
-- Runs after bootstrap_shop('bar-beer', ...) has created the shop.

do $$
declare
  v_shop uuid := (select id from public.shops where slug = 'bar-beer');
begin
  if v_shop is null then
    raise notice 'No shop "bar-beer" yet: run bootstrap_shop first. Seed skipped.';
    return;
  end if;

  insert into public.catalog_items (shop_id, kind, name, price, commission_pct, counts_as_cut, sort_order) values
    (v_shop, 'service', 'Corte',          20000, 50, true,  1),
    (v_shop, 'service', 'Corte + barba',  30000, 50, true,  2),
    (v_shop, 'service', 'Barba',          12000, 50, false, 3),
    (v_shop, 'service', 'Cejas',           5000, 50, false, 4),
    (v_shop, 'service', 'Diseño',          8000, 50, false, 5),
    (v_shop, 'service', 'Corte niño',     15000, 50, true,  6),
    (v_shop, 'drink',   'Cerveza',         6000,  0, false, 1),
    (v_shop, 'drink',   'Cerveza artesanal', 9000, 0, false, 2),
    (v_shop, 'drink',   'Gaseosa',         3500,  0, false, 3),
    (v_shop, 'drink',   'Agua',            2500,  0, false, 4),
    (v_shop, 'product', 'Cera mate',      25000,  0, false, 1),
    (v_shop, 'product', 'Aceite de barba', 30000, 0, false, 2),
    (v_shop, 'product', 'Piercing',       35000,  0, false, 3)
  on conflict (shop_id, kind, name) do nothing;

  insert into public.staff (shop_id, role, display_name, username, cuts, sort_order) values
    (v_shop, 'barber',  'Dago',   'dago',   true, 1),
    (v_shop, 'barber',  'Kike',   'kike',   true, 2),
    (v_shop, 'barber',  'Mono',   'mono',   true, 3),
    (v_shop, 'barber',  'Brayan', 'brayan', true, 4),
    (v_shop, 'barber',  'Jota',   'jota',   true, 5),
    (v_shop, 'cashier', 'Luisa',  'luisa',  false, 0)
  on conflict (shop_id, username) do nothing;
end $$;
