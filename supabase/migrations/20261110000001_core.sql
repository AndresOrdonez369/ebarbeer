-- Bar Beer · core schema
-- Every row hangs from a shop, so a second barbershop is one more row, not another database.
-- Money is stored as whole pesos (integer). Prices and commission are copied onto each sale
-- line at charge time, so catalog changes never move what was already charged.

-- ─── Types ──────────────────────────────────────────────────────────────────
create type public.staff_role  as enum ('admin', 'cashier', 'barber');
create type public.item_kind   as enum ('service', 'drink', 'product');
create type public.pay_method  as enum ('cash', 'transfer', 'card');
create type public.sale_status as enum ('ok', 'void');

-- ─── Tables ─────────────────────────────────────────────────────────────────
create table public.shops (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name              text not null check (length(trim(name)) between 1 and 60),
  timezone          text not null default 'America/Bogota',
  currency          text not null default 'COP',
  -- Sales before this hour belong to the previous business day (it is a bar).
  day_cutoff        time not null default '04:00',
  -- How many cuts fill a barber's mug in a day, unless the barber has their own goal.
  daily_cut_goal    int  not null default 8 check (daily_cut_goal between 1 and 200),
  receipt_template  text,
  modules           jsonb not null default '{}'::jsonb,
  next_receipt_no   int  not null default 1,
  created_at        timestamptz not null default now()
);

create table public.staff (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  -- Null until the admin gives this person an access. A barber can be charged cuts from minute one.
  user_id         uuid unique references auth.users (id) on delete set null,
  role            public.staff_role not null,
  display_name    text not null check (length(trim(display_name)) between 1 and 40),
  username        text check (username ~ '^[a-z0-9._-]{2,30}$'),
  -- True for anyone who takes clients: every barber, and an admin who also cuts.
  cuts            boolean not null default false,
  daily_cut_goal  int check (daily_cut_goal between 1 and 200),
  active          boolean not null default true,
  hired_on        date not null default current_date,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (shop_id, username),
  check (role <> 'barber' or cuts)
);

create table public.catalog_items (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  kind            public.item_kind not null,
  name            text not null check (length(trim(name)) between 1 and 40),
  price           int  not null check (price >= 0),
  commission_pct  numeric(5,2) not null default 0 check (commission_pct between 0 and 100),
  -- Whether this service adds to the barber's cut counter and to cut-based bonuses.
  counts_as_cut   boolean not null default false,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  unique (shop_id, kind, name)
);

create table public.commission_overrides (
  shop_id         uuid not null references public.shops (id) on delete cascade,
  staff_id        uuid not null references public.staff (id) on delete cascade,
  item_id         uuid not null references public.catalog_items (id) on delete cascade,
  commission_pct  numeric(5,2) not null check (commission_pct between 0 and 100),
  primary key (staff_id, item_id)
);

create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text check (length(trim(name)) between 1 and 60),
  phone         text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  promo_opt_in  boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (shop_id, phone)
);

create table public.sales (
  -- Generated on the phone, so a retried request on a bad network never duplicates a bill.
  id               uuid primary key,
  shop_id          uuid not null references public.shops (id) on delete cascade,
  receipt_no       int  not null,
  receipt_token    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  business_date    date not null,
  created_at       timestamptz not null default now(),
  cashier_id       uuid not null references public.staff (id),
  customer_id      uuid references public.customers (id) on delete set null,
  subtotal         int  not null check (subtotal >= 0),
  discount_total   int  not null default 0 check (discount_total >= 0),
  total            int  not null check (total >= 0),
  status           public.sale_status not null default 'ok',
  voided_by        uuid references public.staff (id),
  voided_at        timestamptz,
  void_reason      text,
  receipt_sent_at  timestamptz,
  unique (shop_id, receipt_no)
);

create table public.sale_lines (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references public.sales (id) on delete cascade,
  line_no            smallint not null,
  shop_id            uuid not null references public.shops (id) on delete cascade,
  business_date      date not null,
  created_at         timestamptz not null default now(),
  status             public.sale_status not null default 'ok',
  item_id            uuid references public.catalog_items (id) on delete set null,
  barber_id          uuid references public.staff (id),
  qty                int  not null check (qty between 1 and 99),
  -- Frozen copy at charge time.
  item_name          text not null,
  item_kind          public.item_kind not null,
  unit_price         int  not null check (unit_price >= 0),
  discount           int  not null default 0 check (discount >= 0),
  line_total         int  not null check (line_total >= 0),
  commission_pct     numeric(5,2) not null default 0,
  commission_amount  int  not null default 0,
  counts_as_cut      boolean not null default false
);

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales (id) on delete cascade,
  shop_id        uuid not null references public.shops (id) on delete cascade,
  business_date  date not null,
  method         public.pay_method not null,
  amount         int not null check (amount > 0),
  cash_received  int check (cash_received is null or cash_received >= amount)
);

create table public.bonus_rules (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  name          text not null,
  period        text not null check (period in ('day', 'week', 'month')),
  metric        text not null check (metric in ('cuts', 'revenue')),
  threshold     int  not null check (threshold > 0),
  reward_type   text not null check (reward_type in ('fixed', 'pct_extra')),
  reward_value  numeric(12,2) not null check (reward_value > 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.bonus_awards (
  rule_id       uuid not null references public.bonus_rules (id) on delete cascade,
  shop_id       uuid not null references public.shops (id) on delete cascade,
  staff_id      uuid not null references public.staff (id) on delete cascade,
  period_start  date not null,
  amount        int  not null check (amount >= 0),
  awarded_at    timestamptz not null default now(),
  primary key (rule_id, staff_id, period_start)
);

create table public.cash_closings (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  business_date  date not null,
  closed_by      uuid not null references public.staff (id),
  closed_at      timestamptz not null default now(),
  expected_cash  int not null,
  counted_cash   int not null check (counted_cash >= 0),
  difference     int not null,
  notes          text,
  unique (shop_id, business_date)
);

create table public.payouts (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  staff_id          uuid not null references public.staff (id),
  period_start      date not null,
  period_end        date not null check (period_end >= period_start),
  commission_total  int not null,
  bonus_total       int not null default 0,
  paid_at           timestamptz not null default now(),
  paid_by           uuid not null references public.staff (id),
  unique (staff_id, period_start, period_end)
);

create table public.client_errors (
  id          bigint generated always as identity primary key,
  user_id     uuid default auth.uid(),
  message     text not null check (length(message) <= 2000),
  context     jsonb,
  created_at  timestamptz not null default now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────
create index on public.staff (shop_id) where active;
create index on public.catalog_items (shop_id, kind, sort_order) where active;
create index on public.sales (shop_id, business_date);
create index on public.sale_lines (shop_id, business_date);
create index on public.sale_lines (barber_id, business_date);
create index on public.sale_lines (sale_id);
create index on public.payments (shop_id, business_date);
create index on public.payments (sale_id);
create index on public.customers (shop_id, created_at);

-- ─── Identity helpers (who is calling) ──────────────────────────────────────
create function public.my_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff where user_id = auth.uid() and active
$$;

create function public.my_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from public.staff where user_id = auth.uid() and active
$$;

create function public.my_role() returns public.staff_role
language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid() and active
$$;

-- The business day a moment belongs to, in the shop's own time zone and cutoff.
create function public.business_date_at(p_shop uuid, p_at timestamptz default now()) returns date
language sql stable security definer set search_path = public as $$
  select ((p_at at time zone s.timezone) - s.day_cutoff)::date
  from public.shops s where s.id = p_shop
$$;

-- ─── Guards ─────────────────────────────────────────────────────────────────
-- A shop must always keep at least one active admin with an access.
create function public.keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := coalesce(old.shop_id, new.shop_id);
begin
  -- Deleting the whole shop cascades through staff; nothing to protect then.
  if not exists (select 1 from public.shops where id = v_shop) then
    return null;
  end if;
  if not exists (
    select 1 from public.staff
    where shop_id = v_shop and role = 'admin' and active and user_id is not null
  ) then
    raise exception 'El local debe conservar al menos un administrador activo'
      using errcode = 'P0001';
  end if;
  return null;
end $$;

create constraint trigger staff_keep_one_admin
  after update or delete on public.staff
  deferrable initially immediate
  for each row
  when (old.role = 'admin')
  execute function public.keep_one_admin();

-- A person stays in the shop they were created in.
create function public.staff_immutable_shop() returns trigger
language plpgsql as $$
begin
  if new.shop_id <> old.shop_id then
    raise exception 'No se puede mover a una persona de local';
  end if;
  return new;
end $$;

create trigger staff_immutable_shop before update on public.staff
  for each row execute function public.staff_immutable_shop();
