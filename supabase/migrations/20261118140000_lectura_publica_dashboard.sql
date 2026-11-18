-- Lectura pública (solo SELECT) para el dashboard web.
-- Los datos son sintéticos y están anonimizados. Escritura sigue bloqueada para anon/authenticated.

revoke insert, update, delete, truncate, references, trigger
  on public.region, public.comuna, public.sucursal, public.parametro, public.pedido
  from anon, authenticated;

grant select on public.region, public.comuna, public.sucursal, public.parametro, public.pedido, public.v_pedidos
  to anon, authenticated;

create policy lectura_publica on public.region    for select to anon, authenticated using (true);
create policy lectura_publica on public.comuna    for select to anon, authenticated using (true);
create policy lectura_publica on public.sucursal  for select to anon, authenticated using (true);
create policy lectura_publica on public.parametro for select to anon, authenticated using (true);
create policy lectura_publica on public.pedido    for select to anon, authenticated using (true);
