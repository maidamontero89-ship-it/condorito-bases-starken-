# condorito-bases-starken

Proyecto de bases de datos Starken, conectado a Supabase.

## Supabase

- Proyecto: `condorito-bases-starken-` (ref `kkvumowpftyckriszlya`, región `sa-east-1`)
- Cambios de esquema: archivos SQL en `supabase/migrations/`, con nombre `AAAAMMDDHHMMSS_descripcion.sql`.
  Cada cambio a la base queda versionado aquí junto con el código.

## Modelo de datos

| Tabla | Contenido |
|---|---|
| `region` | 16 regiones con su zona (Norte/Centro/Sur/Austral) |
| `comuna` | 43 comunas → región |
| `sucursal` | 43 sucursales → comuna |
| `pedido` | 10.000 envíos (hoja Pedidos de Book1.xlsx) |
| `parametro` | IVA, factor peso volumétrico, tasa y mínimo de seguro |
| `v_pedidos` (vista) | Pedidos en formato plano, como el Excel |

## Recargar datos desde el Excel

1. Ejecutar `scripts/staging_crear.sql` en Supabase (crea tabla temporal).
2. `.venv\Scripts\python.exe scripts\cargar_via_api.py Book1.xlsx`
3. Ejecutar `scripts/transformar_staging.sql` (puebla el modelo; recarga completa).
4. Ejecutar `scripts/staging_borrar.sql`.

Alternativa con conexión directa (requiere `DATABASE_URL` en `.env`):
`.venv\Scripts\python.exe scripts\cargar_excel.py Book1.xlsx`

## Configuración

Las credenciales van en un archivo `.env` local (no se sube a GitHub).
Copia `.env.example` como `.env` y completa con los valores de
Supabase > Project Settings > API Keys. Usa solo la clave publicable;
nunca la `service_role` / secret key en el repositorio.
