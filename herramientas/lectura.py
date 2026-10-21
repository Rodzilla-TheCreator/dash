# -*- coding: utf-8 -*-
"""Regenera LECTURA de index.html: lo que dice el texto escrito a mano en RADAR.

    python herramientas/lectura.py              # la foto de hoy
    python herramientas/lectura.py 2026-09-24   # como estaba ese dia (para comparar)

Solo LEE RADAR, por `jarvis/bin/radar-sql`. Imprime los tres bloques listos para
pegar en LECTURA (perdidas, frenado, demanda) y no toca nada mas.

Existe porque el primero se armo en una carpeta temporal que se borro, y la foto
quedo un mes sin poder regenerarse. Se reconstruyo el 2026-10-21 con las reglas
de septiembre (que quedaron en el historial de la sesion) mas los ajustes del
24-sep que explica el comentario de LECTURA. Las reglas estan aca y alla, y
tienen que decir lo mismo: si se cambia una, se cambia la otra en el mismo commit.

LAS REGLAS
  - Solo la org real de Montasa (hay una org DEMO con oportunidades inventadas).
  - Las perdidas creadas el 2026-04-11 son una MIGRACION (rentas mensuales,
    renovaciones y cobros que entraron marcados como perdidos) y no cuentan.
  - A1 perdidas: el motivo sale del `[MOTIVO: ...]` escrito dentro de `notas`;
    si no hay, de la columna `motivo_perdida`, salvo sus valores por defecto.
    Los dos vocabularios se unifican con MAPA.
  - A2 frenado: las abiertas, clasificadas por PALABRAS CLAVE sobre el ultimo
    seguimiento escrito (`opp_seguimientos`). La primera regla que engancha
    gana. Palabras y no un modelo: alguien va a preguntar por que una
    oportunidad cayo en tal casilla, y con reglas se contesta.
  - A3 demanda: por `linea_negocio` (las ocho del formulario de montasa.com),
    contando perdidas (sin la migracion), USD perdido, ganadas y abiertas.
"""
import json
import os
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict

HOME = os.path.expanduser("~")
RADAR = os.path.join(HOME, "jarvis", "bin", "radar-sql")
ENV = dict(os.environ, PYTHONIOENCODING="utf-8")
ORG = "11111111-1111-4111-8111-111111111111"
MIGRACION = "2026-04-11"
ABIERTAS = "('cotizacion','prospecto','contactado','negociacion','cliente_frio')"
GANADAS = "('cerrado_ganado','facturado','pagado','cerrado')"

corte = sys.argv[1] if len(sys.argv) > 1 else None
if corte and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", corte):
    sys.exit("La fecha va como AAAA-MM-DD.")
HASTA = ("and o.created_at < date '%s' + 1" % corte) if corte else ""


def radar(sql):
    out = subprocess.run([sys.executable, RADAR, sql], capture_output=True, text=True,
                         encoding="utf-8", env=ENV).stdout
    m = re.search(r"\[.*\]", out, re.S)
    if not m:
        sys.exit("RADAR no contesto como se esperaba:\n" + out[:600])
    return json.loads(m.group(0))


def plano(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    return " ".join("".join(c for c in s if unicodedata.category(c) != "Mn").split())


# ── A1 · por que se pierden ────────────────────────────────────────────
# Lo que la columna trae por defecto no es un motivo: es que nadie la cambio.
NO_ES_MOTIVO = ("Oportunidad Abierta", "No Aplica (Oportunidad Ganada)")
MAPA = {
    "Disponibilidad de equipo": "Falta de inventario / disponibilidad",
    "Equipo En mal estado": "Falta de inventario / disponibilidad",
    "Ganado por la competencia": "Se fue con la competencia",
    "Precio": "Precio muy alto",
    "Equipo no reunia las especificaciones del cliente": "Necesidades no alineadas",
    "Cliente resuelve con sus mismos recursos.": "Necesidades no alineadas",
    "Unicamente para presupuesto del cliente": "Solo pedia precio de referencia",
    "Disponibilidad de personal": "Otro",
    "No de acuerdo con protocolo de  venta": "Otro",
}

filas = radar(f"""
  select trim(substring(o.notas from '\\[MOTIVO:([^\\]]*)\\]')) tag,
         trim(o.motivo_perdida) col, coalesce(o.valor,0) valor,
         (o.created_at::date = date '{MIGRACION}') mig
  from oportunidades o
  where o.org_id = '{ORG}' and o.etapa = 'cerrado_perdido' {HASTA}""")
migracion = sum(1 for r in filas if r["mig"])
reales = [r for r in filas if not r["mig"]]
agg = defaultdict(lambda: [0, 0.0])
sin = 0
for r in reales:
    m = (r["tag"] or "").strip()
    if not m:
        c = (r["col"] or "").strip()
        m = c if c and c not in NO_ES_MOTIVO else ""
    if not m:
        sin += 1
        continue
    m = MAPA.get(m, m)
    agg[m][0] += 1
    agg[m][1] += float(r["valor"] or 0)
motivos = sorted(agg.items(), key=lambda x: (-x[1][0], -x[1][1]))

# ── A2 · que frena lo abierto ──────────────────────────────────────────
FRENADO = [
    ("Sin canal para contactarlo", ["whatsapp desconectado", "sin whatsapp", "desconectado"]),
    ("El cliente no responde", ["sin respuesta", "no contesta", "no me contesta", "no responde",
                                "no hubo respuesta", "espera de respuesta", "esperando respuesta"]),
    ("Esperando decisión del cliente", ["aprobacion", "aprobado", "pendiente de confirmacion",
                                        "pendiente confirmacion", "espera de confirmacion",
                                        "esperando confirmacion", "pendiente oc", "espera de deposito",
                                        "analisis", "gerencia", "presupuesto"]),
    ("Postergado a una fecha", ["retomar", "proxima semana", "mes de", "llamar en", "postergo",
                                "postergado", "vacaciones", "de viaje", "mas adelante", "agendada"]),
    ("Nos toca mover a nosotros", ["se envio", "envie", "enviada", "cliente contactado", "contactado",
                                   "se le marco", "se le hizo llamada", "se llamo", "propuesta",
                                   "ficha tecnica", "cotizacion", "seguimiento"]),
    ("Dice «pendiente» y nada más", ["pendiente"]),
]
SIN_NOTA, ILEGIBLE = "Sin una sola nota escrita", "No se entiende qué dice"


def causa(txt):
    t = plano(txt)
    if not t:
        return SIN_NOTA
    for etiqueta, claves in FRENADO:
        if any(k in t for k in claves):
            return etiqueta
    return ILEGIBLE


ref = f"date '{corte}'" if corte else "current_date"
ab = radar(f"""
  select coalesce(o.valor,0) valor,
         coalesce((select s.nota from opp_seguimientos s where s.opp_id = o.id
                   {"and s.created_at < date '%s' + 1" % corte if corte else ""}
                   order by s.created_at desc limit 1), '') ultima,
         ({ref} - coalesce(o.ultimo_seguimiento, o.created_at::date))::int dias
  from oportunidades o
  where o.org_id = '{ORG}' and o.etapa in {ABIERTAS} {HASTA}""")
fr = defaultdict(lambda: [0, 0.0])
for r in ab:
    c = causa(r["ultima"])
    fr[c][0] += 1
    fr[c][1] += float(r["valor"] or 0)
causas = sorted(fr.items(), key=lambda x: (-x[1][0], -x[1][1]))
q30 = sum(1 for r in ab if (r["dias"] or 0) > 30)
q90 = [r for r in ab if (r["dias"] or 0) > 90]

# ── A3 · que pedian, por linea de negocio ──────────────────────────────
CATALOGO = ["Renta y Leasing Operativo", "Repuestos y Suministros", "Venta de Equipo",
            "Renta por Hora", "Certificación de Operador", "Mano de Obra", "Revisiones IHTT",
            "Fletes"]
lin = radar(f"""
  select nullif(trim(o.linea_negocio),'') linea,
         count(*) filter (where o.etapa = 'cerrado_perdido')::int perd,
         round(coalesce(sum(o.valor) filter (where o.etapa = 'cerrado_perdido'),0))::bigint usd,
         count(*) filter (where o.etapa in {GANADAS})::int gan,
         count(*) filter (where o.etapa in {ABIERTAS})::int ab
  from oportunidades o
  where o.org_id = '{ORG}' and o.created_at::date <> date '{MIGRACION}' {HASTA}
  group by 1""")
por = {r["linea"]: r for r in lin}
sin_linea = (por.get(None) or {}).get("perd", 0)
fuera = [r for r in lin if r["linea"] and r["linea"] not in CATALOGO]

# ── salida ─────────────────────────────────────────────────────────────
F = lambda v: int(round(float(v or 0)))
print("LECTURA.fecha: \"%s\"" % (corte or __import__("datetime").date.today().isoformat()))
print()
print("  perdidas: {")
print("    total: %d, conMotivo: %d, sinMotivo: %d, migracion: %d,"
      % (len(reales), len(reales) - sin, sin, migracion))
print("    migracionUsd: %d, todasUsd: %d,"
      % (F(sum(float(r["valor"] or 0) for r in filas if r["mig"])),
         F(sum(float(r["valor"] or 0) for r in filas))))
print('    residuo: ["Otro"],')
print("    motivos: [")
print(",\n".join('      [%-40s %5d, %8d]' % (json.dumps(m, ensure_ascii=False) + ",", n, F(v))
                 for m, (n, v) in motivos))
print("    ]\n  },")
print()
print("  frenado: {")
print("    total: %d, valor: %d, quietas30: %d, quietas90: %d, valor90: %d,"
      % (len(ab), F(sum(float(r["valor"] or 0) for r in ab)), q30, len(q90),
         F(sum(float(r["valor"] or 0) for r in q90))))
print('    residuo: ["%s", "%s"],' % (SIN_NOTA, ILEGIBLE))
print("    causas: [")
print(",\n".join('      [%-34s %5d, %8d]' % (json.dumps(c, ensure_ascii=False) + ",", n, F(v))
                 for c, (n, v) in causas))
print("    ]\n  },")
print()
print("  demanda: {")
print("    perdidasSinLinea: %d, fueraDelCatalogo: %d, fueraUsd: %d,"
      % (sin_linea, sum(r["perd"] for r in fuera), sum(F(r["usd"]) for r in fuera)))
print("    lineas: [")
filas3 = [por.get(l) or {"linea": l, "perd": 0, "usd": 0, "gan": 0, "ab": 0} for l in CATALOGO]
filas3.sort(key=lambda r: -r["perd"])
print(",\n".join('      [%-28s %4d, %8d, %4d, %4d]'
                 % (json.dumps(r["linea"], ensure_ascii=False) + ",", r["perd"], F(r["usd"]),
                    r["gan"], r["ab"]) for r in filas3))
print("    ]\n  }")
if fuera:
    print("\n  fuera del catalogo:", ", ".join("%s (%d)" % (r["linea"], r["perd"]) for r in fuera))
