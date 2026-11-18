-- Tabla temporal para carga vía API REST con la clave publicable.
-- Solo permite INSERT a anon (no lectura). Borrar al terminar con staging_borrar.sql.
create table public._carga_pedidos (
  id   bigint generated always as identity primary key,
  fila jsonb not null
);
alter table public._carga_pedidos enable row level security;
revoke all on public._carga_pedidos from anon, authenticated;
grant insert on public._carga_pedidos to anon;
create policy carga_temporal_insert on public._carga_pedidos for insert to anon with check (true);
