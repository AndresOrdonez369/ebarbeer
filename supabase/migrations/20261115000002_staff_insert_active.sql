-- The admin's "Crear persona" sends active with the new row; the column grant left it out.
grant insert (active) on public.staff to authenticated;
