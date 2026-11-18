"""Carga Book1.xlsx (hoja Pedidos) en Supabase.

Uso:
    python scripts/cargar_excel.py [ruta_excel]

Requiere en .env la variable DATABASE_URL (Supabase > Connect > Session pooler).
Recarga completa: vacía region/comuna/sucursal/pedido y los vuelve a poblar
en una sola transacción (si algo falla, no queda nada a medias).
"""

from __future__ import annotations

import datetime as dt
import sys
from decimal import Decimal
from pathlib import Path

import openpyxl
import psycopg

RAIZ = Path(__file__).resolve().parent.parent
EXCEL = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "Book1.xlsx"
HOJA = "Pedidos"

COLUMNAS = [
    "ID Pedido", "Código Seguimiento", "Fecha Emisión", "Hora Emisión", "Canal de Venta",
    "Tipo Cliente", "RUT Remitente", "Nombre Remitente", "Teléfono Remitente", "Región Origen",
    "Comuna Origen", "Sucursal Origen", "RUT Destinatario", "Nombre Destinatario",
    "Teléfono Destinatario", "Email Destinatario", "Dirección Destino", "Comuna Destino",
    "Región Destino", "Zona Destino", "Tipo Entrega", "Sucursal Destino", "Tipo Servicio",
    "Tipo Bulto", "Contenido Declarado", "N° Bultos", "Peso Real (kg)", "Largo (cm)",
    "Ancho (cm)", "Alto (cm)", "Peso Volumétrico (kg)", "Peso Facturable (kg)",
    "Valor Declarado (CLP)", "Seguro Contratado", "Condición de Pago", "Medio de Pago",
    "Flete Neto (CLP)", "Costo Seguro (CLP)", "Total Neto (CLP)", "IVA (CLP)",
    "Total con IVA (CLP)", "Fecha Comprometida", "Fecha Entrega Real", "Estado",
    "Intentos de Entrega", "Motivo Incidencia", "Recibido Por", "Ruta / Conductor",
    "Días Tránsito (hábiles)", "Cumple SLA", "Calificación Cliente (1-5)",
]


# ---------------------------------------------------------------- utilidades
def leer_env() -> dict[str, str]:
    env = {}
    archivo = RAIZ / ".env"
    if archivo.exists():
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                k, v = linea.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def vacio(v) -> bool:
    return v is None or (isinstance(v, str) and v.strip() in ("", "-"))


def texto(v):
    if vacio(v):
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def entero(v):
    if vacio(v):
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = str(v).replace("$", "").replace(".", "").replace(",", ".").strip()
    return int(round(float(s)))


def decimal2(v):
    if vacio(v):
        return None
    if isinstance(v, (int, float)):
        return Decimal(str(round(float(v), 2)))
    s = str(v).replace(".", "").replace(",", ".").strip()
    return Decimal(s).quantize(Decimal("0.01"))


def fecha(v):
    if vacio(v):
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    return dt.datetime.strptime(str(v).strip(), "%d-%m-%Y").date()


def hora(v):
    if isinstance(v, dt.datetime):
        return v.time().replace(second=0, microsecond=0)
    if isinstance(v, dt.time):
        return v
    if isinstance(v, (int, float)):  # fracción de día de Excel
        minutos = round(float(v) * 24 * 60)
        return dt.time(minutos // 60, minutos % 60)
    return dt.datetime.strptime(str(v).strip(), "%H:%M").time()


def si_no(v):
    s = texto(v)
    if s in ("Sí", "Si"):
        return True
    if s == "No":
        return False
    return None  # p.ej. "Pendiente"


# ---------------------------------------------------------------- lectura
def leer_excel():
    print(f"Leyendo {EXCEL.name} / hoja {HOJA} ...")
    wb = openpyxl.load_workbook(EXCEL, read_only=True, data_only=True)
    filas = wb[HOJA].iter_rows(values_only=True)
    encabezado = [texto(c) for c in next(filas)]
    # La 1ª columna se valida por contenido (PED-...), por si el título de A1 fue editado.
    if encabezado[1 : len(COLUMNAS)] != COLUMNAS[1:]:
        faltan = [c for c in COLUMNAS[1:] if c not in encabezado]
        raise SystemExit(f"Encabezados distintos a los esperados. Faltan: {faltan}")
    if encabezado[0] != COLUMNAS[0]:
        print(f"  Aviso: la celda A1 dice '{encabezado[0]}' (se esperaba '{COLUMNAS[0]}')")
    datos = [dict(zip(COLUMNAS, f)) for f in filas if f and f[0] is not None]
    malos = [d["ID Pedido"] for d in datos if not str(d["ID Pedido"]).startswith("PED-")]
    if malos:
        raise SystemExit(f"La primera columna no contiene IDs de pedido válidos: {malos[:5]}")
    wb.close()
    print(f"  {len(datos)} filas leídas")
    return datos


def construir_catalogos(datos):
    regiones: dict[str, str | None] = {}
    comunas: dict[str, str] = {}
    sucursales: dict[str, str] = {}

    def agregar(dic, k, v, que):
        if dic.setdefault(k, v) != v:
            raise SystemExit(f"Inconsistencia: {que} '{k}' asociado a '{dic[k]}' y '{v}'")

    for r in datos:
        ro, rd = texto(r["Región Origen"]), texto(r["Región Destino"])
        regiones.setdefault(ro, None)
        if regiones.get(rd) is None:
            regiones[rd] = texto(r["Zona Destino"])
        elif regiones[rd] != texto(r["Zona Destino"]):
            raise SystemExit(f"Inconsistencia: región {rd} con dos zonas")
        agregar(comunas, texto(r["Comuna Origen"]), ro, "comuna")
        agregar(comunas, texto(r["Comuna Destino"]), rd, "comuna")
        agregar(sucursales, texto(r["Sucursal Origen"]), texto(r["Comuna Origen"]), "sucursal")
        if not vacio(r["Sucursal Destino"]):
            agregar(sucursales, texto(r["Sucursal Destino"]), texto(r["Comuna Destino"]), "sucursal")

    sin_zona = [k for k, v in regiones.items() if v is None]
    if sin_zona:
        raise SystemExit(f"Regiones sin zona conocida: {sin_zona}")
    return regiones, comunas, sucursales


# ---------------------------------------------------------------- carga
def main():
    env = leer_env()
    url = env.get("DATABASE_URL")
    if not url or "[YOUR-PASSWORD]" in url or "TU-CONTRASEÑA" in url:
        raise SystemExit("Falta DATABASE_URL (con la contraseña) en el archivo .env")

    datos = leer_excel()
    regiones, comunas, sucursales = construir_catalogos(datos)
    print(f"  {len(regiones)} regiones, {len(comunas)} comunas, {len(sucursales)} sucursales")

    with psycopg.connect(url) as con, con.cursor() as cur:
        cur.execute("truncate public.pedido, public.sucursal, public.comuna, public.region restart identity")

        id_region = {}
        for nombre, zona in sorted(regiones.items()):
            cur.execute("insert into public.region (nombre, zona) values (%s, %s) returning id", (nombre, zona))
            id_region[nombre] = cur.fetchone()[0]
        id_comuna = {}
        for nombre, region in sorted(comunas.items()):
            cur.execute("insert into public.comuna (nombre, region_id) values (%s, %s) returning id",
                        (nombre, id_region[region]))
            id_comuna[nombre] = cur.fetchone()[0]
        id_sucursal = {}
        for nombre, comuna in sorted(sucursales.items()):
            cur.execute("insert into public.sucursal (nombre, comuna_id) values (%s, %s) returning id",
                        (nombre, id_comuna[comuna]))
            id_sucursal[nombre] = cur.fetchone()[0]

        columnas_db = [
            "id_pedido", "codigo_seguimiento", "fecha_emision", "hora_emision", "canal_venta",
            "tipo_cliente", "remitente_rut", "remitente_nombre", "remitente_telefono",
            "sucursal_origen_id", "destinatario_rut", "destinatario_nombre", "destinatario_telefono",
            "destinatario_email", "direccion_destino", "comuna_destino_id", "tipo_entrega",
            "sucursal_destino_id", "tipo_servicio", "tipo_bulto", "contenido_declarado", "n_bultos",
            "peso_real_kg", "largo_cm", "ancho_cm", "alto_cm", "peso_volumetrico_kg",
            "peso_facturable_kg", "valor_declarado_clp", "seguro_contratado", "condicion_pago",
            "medio_pago", "flete_neto_clp", "costo_seguro_clp", "total_neto_clp", "iva_clp",
            "total_con_iva_clp", "fecha_comprometida", "fecha_entrega_real", "estado",
            "intentos_entrega", "motivo_incidencia", "recibido_por", "ruta_codigo",
            "conductor_codigo", "dias_transito_habiles", "cumple_sla", "calificacion_cliente",
        ]
        total_excel = 0
        with cur.copy(f"copy public.pedido ({', '.join(columnas_db)}) from stdin") as copia:
            for r in datos:
                ruta = texto(r["Ruta / Conductor"])
                ruta_cod, cond_cod = (p.strip() for p in ruta.split("/", 1)) if ruta else (None, None)
                suc_dest = texto(r["Sucursal Destino"])
                total = entero(r["Total con IVA (CLP)"])
                total_excel += total
                copia.write_row((
                    texto(r["ID Pedido"]), texto(r["Código Seguimiento"]), fecha(r["Fecha Emisión"]),
                    hora(r["Hora Emisión"]), texto(r["Canal de Venta"]), texto(r["Tipo Cliente"]),
                    texto(r["RUT Remitente"]), texto(r["Nombre Remitente"]), texto(r["Teléfono Remitente"]),
                    id_sucursal[texto(r["Sucursal Origen"])],
                    texto(r["RUT Destinatario"]), texto(r["Nombre Destinatario"]),
                    texto(r["Teléfono Destinatario"]), texto(r["Email Destinatario"]),
                    texto(r["Dirección Destino"]), id_comuna[texto(r["Comuna Destino"])],
                    texto(r["Tipo Entrega"]), id_sucursal[suc_dest] if suc_dest else None,
                    texto(r["Tipo Servicio"]), texto(r["Tipo Bulto"]), texto(r["Contenido Declarado"]),
                    entero(r["N° Bultos"]), decimal2(r["Peso Real (kg)"]), entero(r["Largo (cm)"]),
                    entero(r["Ancho (cm)"]), entero(r["Alto (cm)"]), decimal2(r["Peso Volumétrico (kg)"]),
                    decimal2(r["Peso Facturable (kg)"]), entero(r["Valor Declarado (CLP)"]),
                    si_no(r["Seguro Contratado"]), texto(r["Condición de Pago"]), texto(r["Medio de Pago"]),
                    entero(r["Flete Neto (CLP)"]), entero(r["Costo Seguro (CLP)"]) or 0,
                    entero(r["Total Neto (CLP)"]), entero(r["IVA (CLP)"]), total,
                    fecha(r["Fecha Comprometida"]), fecha(r["Fecha Entrega Real"]), texto(r["Estado"]),
                    entero(r["Intentos de Entrega"]) or 0, texto(r["Motivo Incidencia"]),
                    texto(r["Recibido Por"]), ruta_cod, cond_cod, entero(r["Días Tránsito (hábiles)"]),
                    si_no(r["Cumple SLA"]), entero(r["Calificación Cliente (1-5)"]),
                ))

        cur.execute("select count(*), sum(total_con_iva_clp) from public.pedido")
        n_db, total_db = cur.fetchone()
        print(f"  pedidos en BD: {n_db}  |  total con IVA BD: {total_db:,}  |  Excel: {total_excel:,}")
        if n_db != len(datos) or total_db != total_excel:
            raise SystemExit("Los totales no cuadran: se deshace la carga.")
    print("Carga completada OK.")


if __name__ == "__main__":
    main()
