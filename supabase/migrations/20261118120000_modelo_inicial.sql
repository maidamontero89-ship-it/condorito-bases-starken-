-- Modelo inicial: envíos Starken (dataset sintético Book1.xlsx)
-- Catálogos geográficos + pedido + parámetros de cálculo + vista plana.

-- =========================================================
-- Catálogos geográficos
-- =========================================================
create table public.region (
  id     smallint generated always as identity primary key,
  nombre text not null unique,
  zona   text not null check (zona in ('Norte', 'Centro', 'Sur', 'Austral'))
);
comment on table public.region is 'Regiones de Chile y su zona logística.';

create table public.comuna (
  id        smallint generated always as identity primary key,
  nombre    text not null unique,
  region_id smallint not null references public.region (id)
);
comment on table public.comuna is 'Comunas con cobertura (origen y/o destino).';

create table public.sucursal (
  id        smallint generated always as identity primary key,
  nombre    text not null unique,
  comuna_id smallint not null references public.comuna (id)
);
comment on table public.sucursal is 'Sucursales Starken (una por comuna en el dataset).';

-- =========================================================
-- Parámetros de cálculo (hoja "Supuestos")
-- =========================================================
create table public.parametro (
  clave       text primary key,
  descripcion text not null,
  valor       numeric not null,
  unidad      text
);
comment on table public.parametro is 'Supuestos usados para calcular pesos, seguro e IVA.';

insert into public.parametro (clave, descripcion, valor, unidad) values
  ('iva',                 'IVA',                               0.19, 'proporción'),
  ('factor_peso_vol',     'Factor peso volumétrico',           4000, 'cm3/kg'),
  ('tasa_seguro',         'Tasa seguro sobre valor declarado', 0.01, 'proporción'),
  ('minimo_seguro_clp',   'Cobro mínimo seguro',               1000, 'CLP');

-- =========================================================
-- Pedidos (una fila por envío)
-- =========================================================
create table public.pedido (
  id_pedido             text primary key,                -- PED-2026-000001
  codigo_seguimiento    text not null unique,
  fecha_emision         date not null,
  hora_emision          time not null,
  canal_venta           text not null check (canal_venta in ('Sucursal', 'Web', 'Cuenta Corporativa', 'Integración API', 'App')),
  tipo_cliente          text not null check (tipo_cliente in ('Persona', 'PYME', 'E-commerce', 'Empresa')),

  -- Remitente (datos tal como se registraron en el envío)
  remitente_rut         text not null,
  remitente_nombre      text not null,
  remitente_telefono    text,
  sucursal_origen_id    smallint not null references public.sucursal (id),

  -- Destinatario
  destinatario_rut      text not null,
  destinatario_nombre   text not null,
  destinatario_telefono text,
  destinatario_email    text,
  direccion_destino     text not null,
  comuna_destino_id     smallint not null references public.comuna (id),
  tipo_entrega          text not null check (tipo_entrega in ('Domicilio', 'Retiro en Sucursal')),
  sucursal_destino_id   smallint references public.sucursal (id),

  -- Carga
  tipo_servicio         text not null check (tipo_servicio in ('Normal', 'Express', 'Mismo Día')),
  tipo_bulto            text not null check (tipo_bulto in ('Caja', 'Bolsa', 'Sobre', 'Pallet')),
  contenido_declarado   text not null,
  n_bultos              smallint not null check (n_bultos > 0),
  peso_real_kg          numeric(8,2) not null check (peso_real_kg >= 0),
  largo_cm              smallint not null,
  ancho_cm              smallint not null,
  alto_cm               smallint not null,
  peso_volumetrico_kg   numeric(8,2) not null,
  peso_facturable_kg    numeric(8,2) not null,

  -- Cobro (CLP, enteros)
  valor_declarado_clp   integer,
  seguro_contratado     boolean not null,
  condicion_pago        text not null check (condicion_pago in ('Pagado en Origen', 'Cuenta Corriente', 'Por Pagar')),
  medio_pago            text not null check (medio_pago in ('Facturación mensual', 'Tarjeta Crédito', 'Tarjeta Débito', 'Webpay', 'Efectivo', 'Transferencia')),
  flete_neto_clp        integer not null,
  costo_seguro_clp      integer not null default 0,
  total_neto_clp        integer not null,
  iva_clp               integer not null,
  total_con_iva_clp     integer not null,

  -- Operación y entrega
  fecha_comprometida    date not null,
  fecha_entrega_real    date,
  estado                text not null check (estado in ('Entregado', 'Con Incidencia', 'Devuelto a Origen', 'Siniestrado', 'En Reparto', 'En Tránsito', 'Disponible para Retiro', 'Recibido en Sucursal')),
  intentos_entrega      smallint not null default 0,
  motivo_incidencia     text,
  recibido_por          text,
  ruta_codigo           text,                             -- MET-022
  conductor_codigo      text,                             -- CND-0566
  dias_transito_habiles smallint,                         -- en origen hay 72 valores -1 (mayoría Mismo Día)
  cumple_sla            boolean,                          -- null = Pendiente
  calificacion_cliente  smallint check (calificacion_cliente between 1 and 5),

  constraint pedido_sucursal_destino_chk check (
    (tipo_entrega = 'Retiro en Sucursal') = (sucursal_destino_id is not null)
  ),
  constraint pedido_total_neto_chk check (total_neto_clp = flete_neto_clp + costo_seguro_clp),
  constraint pedido_total_chk      check (total_con_iva_clp = total_neto_clp + iva_clp)
);
comment on table public.pedido is 'Envíos Starken: una fila por pedido (hoja Pedidos de Book1.xlsx).';

create index pedido_fecha_emision_idx    on public.pedido (fecha_emision);
create index pedido_estado_idx           on public.pedido (estado);
create index pedido_sucursal_origen_idx  on public.pedido (sucursal_origen_id);
create index pedido_comuna_destino_idx   on public.pedido (comuna_destino_id);
create index pedido_sucursal_destino_idx on public.pedido (sucursal_destino_id);

-- =========================================================
-- Vista plana (equivalente al Excel) para análisis / BI
-- =========================================================
create view public.v_pedidos
with (security_invoker = true) as
select
  p.id_pedido,
  p.codigo_seguimiento,
  p.fecha_emision,
  p.hora_emision,
  p.canal_venta,
  p.tipo_cliente,
  p.remitente_rut,
  p.remitente_nombre,
  ro.nombre  as region_origen,
  co.nombre  as comuna_origen,
  so.nombre  as sucursal_origen,
  p.destinatario_rut,
  p.destinatario_nombre,
  p.direccion_destino,
  cd.nombre  as comuna_destino,
  rd.nombre  as region_destino,
  rd.zona    as zona_destino,
  p.tipo_entrega,
  sd.nombre  as sucursal_destino,
  p.tipo_servicio,
  p.tipo_bulto,
  p.contenido_declarado,
  p.n_bultos,
  p.peso_real_kg,
  p.peso_volumetrico_kg,
  p.peso_facturable_kg,
  p.valor_declarado_clp,
  p.seguro_contratado,
  p.condicion_pago,
  p.medio_pago,
  p.flete_neto_clp,
  p.costo_seguro_clp,
  p.total_neto_clp,
  p.iva_clp,
  p.total_con_iva_clp,
  p.fecha_comprometida,
  p.fecha_entrega_real,
  p.estado,
  p.intentos_entrega,
  p.motivo_incidencia,
  p.recibido_por,
  p.ruta_codigo,
  p.conductor_codigo,
  p.dias_transito_habiles,
  p.cumple_sla,
  p.calificacion_cliente
from public.pedido p
join public.sucursal so on so.id = p.sucursal_origen_id
join public.comuna   co on co.id = so.comuna_id
join public.region   ro on ro.id = co.region_id
join public.comuna   cd on cd.id = p.comuna_destino_id
join public.region   rd on rd.id = cd.region_id
left join public.sucursal sd on sd.id = p.sucursal_destino_id;

-- =========================================================
-- Seguridad: RLS activo, sin políticas = sin acceso vía API pública
-- =========================================================
alter table public.region    enable row level security;
alter table public.comuna    enable row level security;
alter table public.sucursal  enable row level security;
alter table public.parametro enable row level security;
alter table public.pedido    enable row level security;
