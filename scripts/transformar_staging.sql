-- Pobla el modelo desde la tabla temporal public._carga_pedidos (cargada por cargar_via_api.py).
-- Recarga completa: vacía las tablas del modelo antes de insertar.

truncate public.pedido, public.sucursal, public.comuna, public.region restart identity;

insert into public.region (nombre, zona)
select r.nombre, max(r.zona)
from (
  select fila->>'region_destino' as nombre, fila->>'zona_destino' as zona from public._carga_pedidos
  union all
  select fila->>'region_origen', null from public._carga_pedidos
) r
group by r.nombre
order by r.nombre;

insert into public.comuna (nombre, region_id)
select distinct on (x.comuna) x.comuna, rg.id
from (
  select fila->>'comuna_origen' as comuna, fila->>'region_origen' as region from public._carga_pedidos
  union
  select fila->>'comuna_destino', fila->>'region_destino' from public._carga_pedidos
) x
join public.region rg on rg.nombre = x.region
order by x.comuna;

insert into public.sucursal (nombre, comuna_id)
select distinct on (x.sucursal) x.sucursal, co.id
from (
  select fila->>'sucursal_origen' as sucursal, fila->>'comuna_origen' as comuna from public._carga_pedidos
  union
  select fila->>'sucursal_destino', fila->>'comuna_destino' from public._carga_pedidos
  where fila->>'sucursal_destino' is not null
) x
join public.comuna co on co.nombre = x.comuna
order by x.sucursal;

insert into public.pedido (
  id_pedido, codigo_seguimiento, fecha_emision, hora_emision, canal_venta, tipo_cliente,
  remitente_rut, remitente_nombre, remitente_telefono, sucursal_origen_id,
  destinatario_rut, destinatario_nombre, destinatario_telefono, destinatario_email,
  direccion_destino, comuna_destino_id, tipo_entrega, sucursal_destino_id,
  tipo_servicio, tipo_bulto, contenido_declarado, n_bultos, peso_real_kg,
  largo_cm, ancho_cm, alto_cm, peso_volumetrico_kg, peso_facturable_kg,
  valor_declarado_clp, seguro_contratado, condicion_pago, medio_pago,
  flete_neto_clp, costo_seguro_clp, total_neto_clp, iva_clp, total_con_iva_clp,
  fecha_comprometida, fecha_entrega_real, estado, intentos_entrega, motivo_incidencia,
  recibido_por, ruta_codigo, conductor_codigo, dias_transito_habiles, cumple_sla,
  calificacion_cliente
)
select
  f->>'id_pedido', f->>'codigo_seguimiento', (f->>'fecha_emision')::date, (f->>'hora_emision')::time,
  f->>'canal_venta', f->>'tipo_cliente',
  f->>'remitente_rut', f->>'remitente_nombre', f->>'remitente_telefono', so.id,
  f->>'destinatario_rut', f->>'destinatario_nombre', f->>'destinatario_telefono', f->>'destinatario_email',
  f->>'direccion_destino', cd.id, f->>'tipo_entrega', sd.id,
  f->>'tipo_servicio', f->>'tipo_bulto', f->>'contenido_declarado', (f->>'n_bultos')::smallint,
  (f->>'peso_real_kg')::numeric, (f->>'largo_cm')::smallint, (f->>'ancho_cm')::smallint,
  (f->>'alto_cm')::smallint, (f->>'peso_volumetrico_kg')::numeric, (f->>'peso_facturable_kg')::numeric,
  (f->>'valor_declarado_clp')::integer, (f->>'seguro_contratado')::boolean,
  f->>'condicion_pago', f->>'medio_pago',
  (f->>'flete_neto_clp')::integer, (f->>'costo_seguro_clp')::integer, (f->>'total_neto_clp')::integer,
  (f->>'iva_clp')::integer, (f->>'total_con_iva_clp')::integer,
  (f->>'fecha_comprometida')::date, (f->>'fecha_entrega_real')::date, f->>'estado',
  (f->>'intentos_entrega')::smallint, f->>'motivo_incidencia', f->>'recibido_por',
  f->>'ruta_codigo', f->>'conductor_codigo', (f->>'dias_transito_habiles')::smallint,
  (f->>'cumple_sla')::boolean, (f->>'calificacion_cliente')::smallint
from (select fila as f from public._carga_pedidos) s
join public.sucursal so on so.nombre = f->>'sucursal_origen'
join public.comuna   cd on cd.nombre = f->>'comuna_destino'
left join public.sucursal sd on sd.nombre = f->>'sucursal_destino';
