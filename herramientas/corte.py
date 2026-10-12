# -*- coding: utf-8 -*-
"""Regenera la foto del tablero de flota (CORTE y CRUCE_TALLER de index.html).

    python herramientas/corte.py

Solo LEE: RADAR por `jarvis/bin/radar-sql` y la base del taller por
`jarvis/bin/firebase-lectura`. Imprime los dos bloques listos para pegar en
index.html, y no toca nada mas.

Existe porque la primera foto se armo a mano en la consola y el guion se
perdio con una carpeta temporal. Para la segunda hubo que reconstruirlo leyendo
el comentario de index.html. Las reglas estan aca y alla, y tienen que decir
lo mismo: si se cambia una, se cambia la otra en el mismo commit.

LAS REGLAS (las mismas que explica el comentario de CORTE en index.html)
  - Solo la org real de Montasa: hay una org de prueba con 24 montacargas
    inventados en `honduras` que inflaban MT Rental.
  - MT Rental = empresa_id `mtrental` + `honduras` (en la flota, `honduras` es
    MT Rental a medio migrar, NO Monhaco). Monhaco = `monhaco`.
  - Los vendidos no cuentan.
  - La PLATA solo cuenta lo rentable: fuera los vehiculos (MTV-, CM-, C-, GR-),
    fuera lo que no tiene codigo de flota (letras-guion-numero: equipos de
    cliente y los marcadores TALLER-SPS / TALLER-CHOLOMA), y fuera ST-15 y TH-02
    porque Fabrizio lo dijo el 2026-09-24. BC- SI cuenta.
  - usd = suma de precio_renta_mes.
"""
import datetime
import json
import os
import re
import subprocess
import sys

HOME = os.path.expanduser("~")
RADAR = os.path.join(HOME, "jarvis", "bin", "radar-sql")
FB = os.path.join(HOME, "jarvis", "bin", "firebase-lectura")
ENV = dict(os.environ, PYTHONIOENCODING="utf-8")
ORG = "11111111-1111-4111-8111-111111111111"


def radar(sql):
    out = subprocess.run([sys.executable, RADAR, sql], capture_output=True, text=True,
                         encoding="utf-8", env=ENV).stdout
    m = re.search(r"\[.*\]", out, re.S)
    if not m:
        sys.exit("RADAR no contesto como se esperaba:\n" + out[:600])
    return json.loads(m.group(0))


def fb(ruta, campos):
    out = subprocess.run([sys.executable, FB, ruta, "--limite", "999", "--campos", campos],
                         capture_output=True, text=True, encoding="utf-8", env=ENV).stdout
    m = re.search(r"\{.*\}", out, re.S)
    if not m:
        return []
    d = json.loads(m.group(0))
    return [r for r in (d.values() if isinstance(d, dict) else d) if isinstance(r, dict)]


EMPRESA = ("CASE WHEN empresa_id IN ('mtrental','honduras') THEN 'MT Rental' "
           "WHEN empresa_id = 'monhaco' THEN 'Monhaco' END")
RENTABLE = (r"codigo !~ '^(MTV|CM|C|GR)-' AND codigo ~ '^[A-Za-z]+-[0-9]' "
            r"AND codigo NOT IN ('ST-15','TH-02')")

# ── el reparto por empresa: toda la flota menos lo vendido ─────────────
filas = radar(f"""
  select {EMPRESA} empresa, estado, count(*)::int n
  from equipos
  where org_id = '{ORG}' and estado <> 'vendido'
    and empresa_id in ('mtrental','honduras','monhaco')
  group by 1, 2""")
emp = {}
for r in filas:
    e = emp.setdefault(r["empresa"], {"renta": 0, "disp": 0, "rep": 0, "mant": 0, "otro": 0})
    k = {"en_renta": "renta", "disponible": "disp", "reparacion": "rep",
         "mantenimiento": "mant"}.get(r["estado"], "otro")
    e[k] += r["n"]
for e in emp.values():
    e["total"] = e["renta"] + e["disp"] + e["rep"] + e["mant"] + e["otro"]

# ── la plata: solo lo rentable ─────────────────────────────────────────
plata = {r["estado"]: r for r in radar(f"""
  select estado, round(coalesce(sum(precio_renta_mes),0))::int usd, count(*)::int n
  from equipos
  where org_id = '{ORG}' and estado <> 'vendido'
    and empresa_id in ('mtrental','honduras','monhaco') and {RENTABLE}
  group by 1""")}

sin_precio = {r["empresa"]: r["n"] for r in radar(f"""
  select {EMPRESA} empresa, count(*)::int n
  from equipos
  where org_id = '{ORG}' and estado in ('disponible','reparacion','mantenimiento')
    and empresa_id in ('mtrental','honduras','monhaco') and {RENTABLE}
    and coalesce(precio_renta_mes,0) = 0
  group by 1""")}

# ── el cruce con el taller: parados en RADAR con orden abierta en Nexo ─
def cerrada(o):
    est = str(o.get("estado") or "").strip().lower()
    return (o.get("completado") is True or est.startswith("completad")
            or bool(str(o.get("fechaCierre") or "").strip())
            or bool(str(o.get("fechaCompletado") or "").strip()))

abiertas = set()
for raiz in ("montasa", "monhaco"):
    cod = {e.get("id"): str(e.get("codigo") or "").strip().upper()
           for e in fb(raiz + "/equipos", "id,codigo")}
    for nodo in ("preventivos", "correctivos"):
        for o in fb(raiz + "/" + nodo, "equipoId,estado,completado,fechaCierre,fechaCompletado"):
            if not cerrada(o) and cod.get(o.get("equipoId")):
                abiertas.add(cod[o.get("equipoId")])
parados = [str(r["codigo"]).strip().upper() for r in radar(f"""
  select codigo from equipos
  where org_id = '{ORG}' and estado in ('reparacion','mantenimiento')
    and empresa_id in ('mtrental','honduras','monhaco')""")]
con_orden = sum(1 for c in parados if c in abiertas)

hoy = datetime.date.today().isoformat()
mt, mh = emp.get("MT Rental", {}), emp.get("Monhaco", {})
otros = mt.get("otro", 0) + mh.get("otro", 0)


def p(k):
    return plata.get(k, {}).get("usd", 0)


print("const CRUCE_TALLER = { fecha:\"%s\", parados:%d, conOrden:%d, sinOrden:%d };"
      % (hoy, len(parados), con_orden, len(parados) - con_orden))
print()
print("CORTE.fecha:", hoy)
for nom, e in (("MT Rental", mt), ("Monhaco", mh)):
    print('    { nombre:"%s", ... renta:%d, disp:%d, rep:%d, mant:%d, total:%d }'
          % (nom, e.get("renta", 0), e.get("disp", 0), e.get("rep", 0), e.get("mant", 0),
             e.get("total", 0)))
print("  plata: en_renta %d · disponible %d · reparacion %d · mantenimiento %d"
      % (p("en_renta"), p("disponible"), p("reparacion"), p("mantenimiento")))
print("  potencial parado: %d" % (p("disponible") + p("reparacion") + p("mantenimiento")))
print("  paradosSinPrecio:", {"MT Rental": sin_precio.get("MT Rental", 0),
                              "Monhaco": sin_precio.get("Monhaco", 0)})
if otros:
    print("  OJO: %d equipos en un estado que la tabla no muestra (ni renta, disp, rep ni mant):"
          " el total los incluye y las columnas no." % otros)
