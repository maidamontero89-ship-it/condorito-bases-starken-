"""Sube las filas limpias de Book1.xlsx a la tabla temporal public._carga_pedidos
usando la API REST de Supabase y la clave publicable (sin contraseña de la base).

Luego se ejecuta scripts/transformar_staging.sql para poblar el modelo.

Uso:
    python scripts/cargar_via_api.py [ruta_excel]
"""

from __future__ import annotations

import json
import sys
import urllib.request

import cargar_excel as c

LOTE = 500


def filas_limpias(datos):
    for r in datos:
        ruta = c.texto(r["Ruta / Conductor"])
        ruta_cod, cond_cod = (p.strip() for p in ruta.split("/", 1)) if ruta else (None, None)
        f = lambda v: v.isoformat() if v else None  # noqa: E731
        d = lambda v: str(v) if v is not None else None  # noqa: E731
        yield {
            "id_pedido": c.texto(r["ID Pedido"]),
            "codigo_seguimiento": c.texto(r["Código Seguimiento"]),
            "fecha_emision": f(c.fecha(r["Fecha Emisión"])),
            "hora_emision": c.hora(r["Hora Emisión"]).strftime("%H:%M"),
            "canal_venta": c.texto(r["Canal de Venta"]),
            "tipo_cliente": c.texto(r["Tipo Cliente"]),
            "remitente_rut": c.texto(r["RUT Remitente"]),
            "remitente_nombre": c.texto(r["Nombre Remitente"]),
            "remitente_telefono": c.texto(r["Teléfono Remitente"]),
            "region_origen": c.texto(r["Región Origen"]),
            "comuna_origen": c.texto(r["Comuna Origen"]),
            "sucursal_origen": c.texto(r["Sucursal Origen"]),
            "destinatario_rut": c.texto(r["RUT Destinatario"]),
            "destinatario_nombre": c.texto(r["Nombre Destinatario"]),
            "destinatario_telefono": c.texto(r["Teléfono Destinatario"]),
            "destinatario_email": c.texto(r["Email Destinatario"]),
            "direccion_destino": c.texto(r["Dirección Destino"]),
            "comuna_destino": c.texto(r["Comuna Destino"]),
            "region_destino": c.texto(r["Región Destino"]),
            "zona_destino": c.texto(r["Zona Destino"]),
            "tipo_entrega": c.texto(r["Tipo Entrega"]),
            "sucursal_destino": c.texto(r["Sucursal Destino"]),
            "tipo_servicio": c.texto(r["Tipo Servicio"]),
            "tipo_bulto": c.texto(r["Tipo Bulto"]),
            "contenido_declarado": c.texto(r["Contenido Declarado"]),
            "n_bultos": c.entero(r["N° Bultos"]),
            "peso_real_kg": d(c.decimal2(r["Peso Real (kg)"])),
            "largo_cm": c.entero(r["Largo (cm)"]),
            "ancho_cm": c.entero(r["Ancho (cm)"]),
            "alto_cm": c.entero(r["Alto (cm)"]),
            "peso_volumetrico_kg": d(c.decimal2(r["Peso Volumétrico (kg)"])),
            "peso_facturable_kg": d(c.decimal2(r["Peso Facturable (kg)"])),
            "valor_declarado_clp": c.entero(r["Valor Declarado (CLP)"]),
            "seguro_contratado": c.si_no(r["Seguro Contratado"]),
            "condicion_pago": c.texto(r["Condición de Pago"]),
            "medio_pago": c.texto(r["Medio de Pago"]),
            "flete_neto_clp": c.entero(r["Flete Neto (CLP)"]),
            "costo_seguro_clp": c.entero(r["Costo Seguro (CLP)"]) or 0,
            "total_neto_clp": c.entero(r["Total Neto (CLP)"]),
            "iva_clp": c.entero(r["IVA (CLP)"]),
            "total_con_iva_clp": c.entero(r["Total con IVA (CLP)"]),
            "fecha_comprometida": f(c.fecha(r["Fecha Comprometida"])),
            "fecha_entrega_real": f(c.fecha(r["Fecha Entrega Real"])),
            "estado": c.texto(r["Estado"]),
            "intentos_entrega": c.entero(r["Intentos de Entrega"]) or 0,
            "motivo_incidencia": c.texto(r["Motivo Incidencia"]),
            "recibido_por": c.texto(r["Recibido Por"]),
            "ruta_codigo": ruta_cod,
            "conductor_codigo": cond_cod,
            "dias_transito_habiles": c.entero(r["Días Tránsito (hábiles)"]),
            "cumple_sla": c.si_no(r["Cumple SLA"]),
            "calificacion_cliente": c.entero(r["Calificación Cliente (1-5)"]),
        }


def main():
    env = c.leer_env()
    url, clave = env["SUPABASE_URL"], env["SUPABASE_PUBLISHABLE_KEY"]
    datos = c.leer_excel()
    c.construir_catalogos(datos)  # valida consistencia antes de subir
    filas = [{"fila": x} for x in filas_limpias(datos)]
    total = sum(x["fila"]["total_con_iva_clp"] for x in filas)
    print(f"  total con IVA Excel: {total:,}")

    for i in range(0, len(filas), LOTE):
        cuerpo = json.dumps(filas[i:i + LOTE], ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/rest/v1/_carga_pedidos",
            data=cuerpo,
            method="POST",
            headers={
                "apikey": clave,
                "Authorization": f"Bearer {clave}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status not in (200, 201, 204):
                raise SystemExit(f"Error HTTP {resp.status} en lote {i}")
        print(f"  subidas {min(i + LOTE, len(filas))}/{len(filas)}")
    print("Subida a tabla temporal completada.")


if __name__ == "__main__":
    main()
