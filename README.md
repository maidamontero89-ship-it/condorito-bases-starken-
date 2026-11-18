# condorito-bases-starken

Proyecto de bases de datos Starken, conectado a Supabase.

## Supabase

- Proyecto: `condorito-bases-starken-` (ref `kkvumowpftyckriszlya`, región `sa-east-1`)
- Cambios de esquema: archivos SQL en `supabase/migrations/`, con nombre `AAAAMMDDHHMMSS_descripcion.sql`.
  Cada cambio a la base queda versionado aquí junto con el código.

## Configuración

Las credenciales van en un archivo `.env` local (no se sube a GitHub).
Copia `.env.example` como `.env` y completa con los valores de
Supabase > Project Settings > API Keys. Usa solo la clave publicable;
nunca la `service_role` / secret key en el repositorio.
