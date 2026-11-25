-- Photos of the customer after the cut: up to four (front, left, right, back) per visit, with a
-- note, so the next barber sees what was done. Optional, and only with the customer's consent.
--
-- The photos live in a private Storage bucket, shrunk on the phone (~100 kB each plus a small
-- thumbnail). To stay inside the free plan, a customer keeps the photos of their last 3 visits;
-- older ones go to a trash list that the next upload clears through the Storage API (Supabase
-- does not let SQL delete files). The visit and its note stay.
--
-- Paths: <shop>/<customer>/<visit>/<angle>.webp and <angle>-t.webp (the thumbnail); .jpg where
-- the phone cannot encode WebP.

-- ─── Consent ────────────────────────────────────────────────────────────────
alter table public.customers
  add column photo_consent_at    timestamptz,
  add column photo_consent_by    uuid references public.staff (id),
  -- A minor's guardian authorised it.
  add column photo_consent_minor boolean not null default false;

-- ─── Visits and photos ──────────────────────────────────────────────────────
create table public.client_visits (
  -- Generated on the phone, so a retried upload never duplicates the visit.
  id             uuid primary key,
  shop_id        uuid not null references public.shops (id) on delete cascade,
  customer_id    uuid not null references public.customers (id) on delete cascade,
  barber_id      uuid not null references public.staff (id),
  business_date  date not null,
  created_at     timestamptz not null default now(),
  -- When the barber saved it on the phone (it may reach the server later, without signal).
  taken_at       timestamptz not null default now(),
  note           text check (note is null or length(note) <= 280),
  -- The photos were removed (to save space, or because the customer asked).
  photos_gone_at timestamptz
);
create index client_visits_customer on public.client_visits (customer_id, taken_at desc);
create index client_visits_shop on public.client_visits (shop_id, taken_at desc);

create type public.photo_angle as enum ('front', 'left', 'right', 'back');

create table public.visit_photos (
  visit_id    uuid not null references public.client_visits (id) on delete cascade,
  angle       public.photo_angle not null,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  path        text not null,
  thumb_path  text not null,
  -- Photo plus thumbnail, as stored.
  bytes       int not null check (bytes > 0),
  created_at  timestamptz not null default now(),
  primary key (visit_id, angle)
);

-- Files to remove from Storage. Whoever uploads next removes them.
create table public.photo_trash (
  path      text primary key,
  shop_id   uuid not null references public.shops (id) on delete cascade,
  queued_at timestamptz not null default now()
);

alter table public.client_visits enable row level security;
alter table public.visit_photos enable row level security;
alter table public.photo_trash enable row level security;
-- Staff of the shop read visits and photos; everything is written through the functions below.
create policy client_visits_read on public.client_visits for select to authenticated
  using (shop_id = (select public.my_shop_id()));
create policy visit_photos_read on public.visit_photos for select to authenticated
  using (shop_id = (select public.my_shop_id()));
create policy photo_trash_read on public.photo_trash for select to authenticated
  using (shop_id = (select public.my_shop_id()));
revoke all on public.client_visits, public.visit_photos, public.photo_trash from anon, authenticated;
grant select on public.client_visits, public.visit_photos, public.photo_trash to authenticated;

-- ─── Storage ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 409600, array['image/webp', 'image/jpeg'])
on conflict (id) do nothing;

-- A file may go up only into a visit of the caller's shop, registered by them (or the admin) in
-- the last 3 days, of a customer who authorised photos, under one of the four expected names.
create function public.can_upload_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}/(front|left|right|back)(-t)?\.(webp|jpg)$'
    and exists (
      select 1
      from public.client_visits v
      join public.customers c on c.id = v.customer_id
      join public.staff s on s.user_id = auth.uid() and s.active and s.shop_id = v.shop_id
      where v.id::text = split_part(p_name, '/', 3)
        and v.shop_id::text = split_part(p_name, '/', 1)
        and v.customer_id::text = split_part(p_name, '/', 2)
        and (v.barber_id = s.id or s.role = 'admin')
        and v.created_at > now() - interval '3 days'
        and v.photos_gone_at is null
        and c.photo_consent_at is not null
    )
$$;

-- A file may be removed only once it is in the shop's trash list.
create function public.can_remove_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.photo_trash t where t.path = p_name and t.shop_id = public.my_shop_id())
$$;

create policy client_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'client-photos' and split_part(name, '/', 1) = (select public.my_shop_id())::text);
create policy client_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'client-photos' and public.can_upload_photo(name));
create policy client_photos_remove on storage.objects for delete to authenticated
  using (bucket_id = 'client-photos' and public.can_remove_photo(name));

-- ─── Functions ──────────────────────────────────────────────────────────────
-- "···0147" for the barbers: they find the customer by the number they type, but never collect it.
create function public._client_phone(p_phone text, p_role public.staff_role) returns text
language sql immutable set search_path = public as $$
  select case when p_role in ('admin', 'cashier') then p_phone else '···' || right(p_phone, 4) end
$$;

-- Starts (or finds again) a visit: the customer by id or by WhatsApp, the note, and the consent
-- when the customer gives it now. p_photos says how many photos will follow; photos need consent.
-- p_at: when it was saved on the phone (kept if within the last 3 days). A barber never renames
-- a customer: the name typed only fills one that was missing.
create function public.start_visit(
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

-- Records the photos already uploaded for a visit and keeps only the customer's last 3 visits
-- with photos. p_photos: [{ "angle": "front", "ext": "webp" }]. Idempotent.
-- Returns the files waiting in the shop's trash, for the phone to remove.
create function public.finish_visit(p_id uuid, p_photos jsonb) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v public.client_visits;
  p jsonb;
  v_angle public.photo_angle;
  v_ext text;
  v_base text;
  v_full bigint;
  v_thumb bigint;
  v_trash text[];
begin
  select * into me from public._require_role('admin', 'barber', 'cashier');
  select * into v from public.client_visits where id = p_id and shop_id = me.shop_id;
  if not found or (v.barber_id <> me.staff_id and me.role <> 'admin') then
    raise exception 'Visita no encontrada' using errcode = '22023';
  end if;
  -- One customer at a time, so two phones saving at once keep the 3-visit rule.
  perform pg_advisory_xact_lock(hashtextextended('photos:' || v.customer_id, 0));

  for p in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    begin
      v_angle := (p->>'angle')::public.photo_angle;
    exception when others then
      raise exception 'Ángulo de foto no válido' using errcode = '22023';
    end;
    v_ext := case when p->>'ext' = 'jpg' then 'jpg' else 'webp' end;
    v_base := v.shop_id || '/' || v.customer_id || '/' || v.id || '/' || v_angle;
    select (metadata->>'size')::bigint into v_full from storage.objects
      where bucket_id = 'client-photos' and name = v_base || '.' || v_ext;
    select (metadata->>'size')::bigint into v_thumb from storage.objects
      where bucket_id = 'client-photos' and name = v_base || '-t.' || v_ext;
    if v_full is null or v_thumb is null then
      raise exception 'Falta subir una foto de la visita' using errcode = '22023';
    end if;
    insert into public.visit_photos (visit_id, angle, shop_id, path, thumb_path, bytes)
    values (v.id, v_angle, v.shop_id, v_base || '.' || v_ext, v_base || '-t.' || v_ext, greatest(v_full + v_thumb, 1))
    on conflict (visit_id, angle) do update
      set path = excluded.path, thumb_path = excluded.thumb_path, bytes = excluded.bytes;
  end loop;

  -- Keep the photos of the last 3 visits that have them.
  with old as (
    select x.id from (
      select cv.id, row_number() over (order by cv.taken_at desc, cv.id desc) as n
      from public.client_visits cv
      where cv.customer_id = v.customer_id
        and exists (select 1 from public.visit_photos vp where vp.visit_id = cv.id)
    ) x where x.n > 3
  ), gone as (
    delete from public.visit_photos vp using old where vp.visit_id = old.id
    returning vp.path, vp.thumb_path, vp.shop_id, vp.visit_id
  ), queued as (
    insert into public.photo_trash (path, shop_id)
    select f, g.shop_id from gone g cross join lateral unnest(array[g.path, g.thumb_path]) f
    on conflict do nothing
    returning 1
  )
  update public.client_visits set photos_gone_at = now()
    where id in (select visit_id from gone);

  select coalesce(array_agg(path order by queued_at), '{}') into v_trash
    from (select path, queued_at from public.photo_trash where shop_id = me.shop_id order by queued_at limit 100) t;
  return v_trash;
end $$;

-- After the phone removed files: forget the trash entries whose file is gone.
create function public.photo_trash_done() returns int
language plpgsql security definer set search_path = public as $$
declare
  me record;
  n int;
begin
  select * into me from public._require_role('admin', 'barber', 'cashier');
  delete from public.photo_trash t
    where t.shop_id = me.shop_id
      and not exists (select 1 from storage.objects o where o.bucket_id = 'client-photos' and o.name = t.path);
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin: the customer asked to remove their photos. The visits and notes stay; consent is withdrawn.
create function public.forget_client_photos(p_customer uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_trash text[];
begin
  select * into me from public._require_role('admin');
  if not exists (select 1 from public.customers where id = p_customer and shop_id = me.shop_id) then
    raise exception 'Cliente no encontrado' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('photos:' || p_customer, 0));
  with gone as (
    delete from public.visit_photos vp using public.client_visits cv
    where vp.visit_id = cv.id and cv.customer_id = p_customer
    returning vp.path, vp.thumb_path, vp.shop_id, vp.visit_id
  ), queued as (
    insert into public.photo_trash (path, shop_id)
    select f, g.shop_id from gone g cross join lateral unnest(array[g.path, g.thumb_path]) f
    on conflict do nothing
    returning 1
  )
  update public.client_visits set photos_gone_at = now() where id in (select visit_id from gone);
  update public.customers
    set photo_consent_at = null, photo_consent_by = null, photo_consent_minor = false
    where id = p_customer;
  select coalesce(array_agg(path order by queued_at), '{}') into v_trash
    from (select path, queued_at from public.photo_trash where shop_id = me.shop_id order by queued_at limit 100) t;
  return v_trash;
end $$;

-- Customers by WhatsApp digits (4 or more) or by name; empty: the latest visited. Any staff.
create function public.find_clients(p_q text default null)
returns table (
  id uuid, name text, phone text, visits int, last_visit timestamptz, consent boolean, minor boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  q text := trim(coalesce(p_q, ''));
  d text := regexp_replace(coalesce(p_q, ''), '[^0-9]', '', 'g');
begin
  select * into me from public._require_role('admin', 'barber', 'cashier');
  if q <> '' and length(d) < 4 and length(q) < 2 then
    return;
  end if;
  return query
    select c.id, c.name, public._client_phone(c.phone, me.role),
      (select count(*) from public.client_visits v where v.customer_id = c.id)::int,
      (select max(v.taken_at) from public.client_visits v where v.customer_id = c.id),
      c.photo_consent_at is not null, c.photo_consent_minor
    from public.customers c
    where c.shop_id = me.shop_id
      and (
        (q = '' and exists (select 1 from public.client_visits v where v.customer_id = c.id))
        or (length(d) >= 4 and c.phone like '%' || d || '%')
        or (length(d) < 4 and length(q) >= 2 and c.name ilike '%' || q || '%')
      )
    order by 5 desc nulls last, c.created_at desc
    limit 12;
end $$;

-- A customer's file: who they are, consent, and their visits (newest first, 40 at most) with
-- the paths of their photos. Any staff of the shop.
create function public.client_file(p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
  c public.customers;
begin
  select * into me from public._require_role('admin', 'barber', 'cashier');
  select * into c from public.customers where id = p_customer and shop_id = me.shop_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'phone', public._client_phone(c.phone, me.role),
    'consent_at', c.photo_consent_at,
    'minor', c.photo_consent_minor,
    'visits', coalesce((
      select jsonb_agg(x.j order by x.at desc)
      from (
        select v.taken_at as at, jsonb_build_object(
          'id', v.id,
          'at', v.taken_at,
          'barber', st.display_name,
          'mine', v.barber_id = me.staff_id,
          'note', v.note,
          'photos_gone', v.photos_gone_at is not null,
          'photos', coalesce((
            select jsonb_agg(jsonb_build_object('angle', p.angle, 'path', p.path, 'thumb', p.thumb_path)
              order by p.angle)
            from public.visit_photos p where p.visit_id = v.id
          ), '[]'::jsonb)
        ) as j
        from public.client_visits v
        left join public.staff st on st.id = v.barber_id
        where v.customer_id = c.id
        order by v.taken_at desc
        limit 40
      ) x
    ), '[]'::jsonb)
  );
end $$;

-- Admin: how much of the free plan's 1 GB the photos use.
create function public.photo_usage() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me record;
begin
  select * into me from public._require_role('admin');
  return jsonb_build_object(
    'bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
              where o.bucket_id = 'client-photos' and split_part(o.name, '/', 1) = me.shop_id::text),
    'photos', (select count(*) from public.visit_photos where shop_id = me.shop_id),
    'visits', (select count(*) from public.client_visits where shop_id = me.shop_id),
    'clients', (select count(distinct customer_id) from public.client_visits where shop_id = me.shop_id)
  );
end $$;

revoke execute on function public.can_upload_photo(text), public.can_remove_photo(text),
  public._client_phone(text, public.staff_role),
  public.start_visit(uuid, jsonb, text, boolean, boolean, int, timestamptz), public.finish_visit(uuid, jsonb),
  public.photo_trash_done(), public.forget_client_photos(uuid), public.find_clients(text),
  public.client_file(uuid), public.photo_usage()
  from public, anon;
revoke execute on function public._client_phone(text, public.staff_role) from authenticated;
-- The Storage policies call these two as the logged-in user.
grant execute on function public.can_upload_photo(text), public.can_remove_photo(text),
  public.start_visit(uuid, jsonb, text, boolean, boolean, int, timestamptz), public.finish_visit(uuid, jsonb),
  public.photo_trash_done(), public.forget_client_photos(uuid), public.find_clients(text),
  public.client_file(uuid), public.photo_usage()
  to authenticated;
