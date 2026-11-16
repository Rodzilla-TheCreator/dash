# -*- coding: utf-8 -*-
"""Pone al día las fotos del tablero (index.html) sin pegar nada a mano.

    python herramientas/actualizar.py            # corre corte.py y lectura.py y parcha index.html
    python herramientas/actualizar.py --probar   # igual, pero no escribe: muestra qué cambiaría

Toca SOLO los bloques de datos que esos dos scripts generan:
  - CRUCE_TALLER (si la base del taller dejó leer; si no, queda el de la fecha anterior)
  - CORTE.fecha, CORTE.empresas (los números), CORTE.plata (los usd), CORTE.paradosSinPrecio
  - LECTURA.fecha y sus bloques perdidas / frenado / demanda
  - ALERTAS_RADAR: cuántas alertas abiertas tiene RADAR por tipo, y cuántas rentas tienen fecha de
    fin (para «Para atender hoy»). Solo cuentas: el repo es público
Los comentarios que explican cada número no se tocan: si una regla cambia, se cambia a mano
en corte.py/lectura.py Y en el comentario.

Es lo que corre la nube de Jarvis para que el Dash no envejezca. No hace commit ni push:
eso lo hace quien lo llama (ver `publicar-dash` en la copia de Railway).
"""
import json
import os
import re
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(AQUI, "..", "index.html")
ENV = dict(os.environ, PYTHONIOENCODING="utf-8")


def correr(script):
    r = subprocess.run([sys.executable, os.path.join(AQUI, script)], capture_output=True,
                       text=True, encoding="utf-8", env=ENV)
    if r.returncode != 0:
        raise SystemExit(f"{script} falló:\n{r.stderr[-1500:]}")
    return r.stdout


TIPOS_ALERTA = ("actividad_vencida", "cotiz_sin_seguimiento", "cron_caido", "cuenta_estancada",
                "forecast_sin_presentar", "lead_sin_asignar", "lead_sin_respuesta")


def radar(sql):
    """Una consulta de solo lectura con el mismo guion que usa corte.py. None si falla."""
    bin_ = os.environ.get("JARVIS_BIN") or os.path.join(os.path.expanduser("~"), "jarvis", "bin")
    try:
        r = subprocess.run([sys.executable, os.path.join(bin_, "radar-sql"), sql], capture_output=True,
                           text=True, encoding="utf-8", env=ENV, timeout=90)
        d = json.loads(r.stdout)
        return d if isinstance(d, list) else None
    except Exception:
        return None


def alertas_radar():
    """La línea `const ALERTAS_RADAR = {...};` con las cuentas de hoy, o None.
    Solo números: nada de clientes, vendedores ni montos."""
    lista = ",".join("'%s'" % t for t in TIPOS_ALERTA)
    filas = radar("select tipo, count(*) filter (where estado='abierta') abiertas, "
                  "count(*) filter (where estado='abierta' and creada_at > now()-interval '7 days') nuevas "
                  f"from alertas_operacion where tipo in ({lista}) group by tipo")
    rentas = radar("select count(*) total, count(fecha_fin) con_fin, "
                   "(now() at time zone 'America/Tegucigalpa')::date::text hoy from rentas")
    if not filas or not rentas:
        return None
    tipos = {t: [0, 0] for t in TIPOS_ALERTA}
    for f in filas:
        tipos[f["tipo"]] = [int(f["abiertas"]), int(f["nuevas"])]
    r = rentas[0]
    return ('const ALERTAS_RADAR = { fecha:"%s", tipos:%s, rentas:{total:%d, conFin:%d} };'
            % (r["hoy"], json.dumps(tipos, separators=(",", ":")), int(r["total"]), int(r["con_fin"])))


def cambiar(s, patron, nuevo, que, flags=0):
    s2, n = re.subn(patron, lambda m: nuevo(m) if callable(nuevo) else nuevo, s, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f"No encontré {que} en index.html: ¿cambió el formato? No se escribió nada.")
    return s2


def main():
    probar = "--probar" in sys.argv
    corte, lectura = correr("corte.py"), correr("lectura.py")
    html = open(INDEX, encoding="utf-8", newline="").read()
    crlf = "\r\n" in html
    s = html.replace("\r\n", "\n")
    avisos = []

    # ── CRUCE_TALLER ────────────────────────────────────────────────
    m = re.search(r"^const CRUCE_TALLER = \{.*\};$", corte, re.M)
    if m:
        s = cambiar(s, r"^const CRUCE_TALLER = \{.*\};$", m.group(0), "CRUCE_TALLER", re.M)
    else:
        avisos.append("CRUCE_TALLER queda viejo: la base del taller no dejó leer (sesión de Nexo).")

    # ── CORTE ───────────────────────────────────────────────────────
    hoy = re.search(r"^CORTE\.fecha: (\S+)", corte, re.M).group(1)
    s = cambiar(s, r'(const CORTE = \{\n  fecha: ")[^"]+(")', lambda m: m.group(1) + hoy + m.group(2), "CORTE.fecha")
    for nom in ("MT Rental", "Monhaco"):
        n = re.search(r'nombre:"%s", \.\.\. renta:(\d+), disp:(\d+), rep:(\d+), mant:(\d+), total:(\d+)' % nom, corte)
        if not n:
            raise SystemExit(f"corte.py no trajo la fila de {nom}")
        renta, disp, rep, mant, total = n.groups()

        def fila(m, v=(renta, disp, rep, mant, total)):
            t = m.group(0)
            for k, val in zip(("renta", "disp", "rep", "mant", "total"), v):
                t = re.sub(r"(%s:)\s*\d+" % k, lambda x: x.group(1) + val, t)
            return t
        s = cambiar(s, r'\{ nombre:"%s",[^}]*\}' % nom, fila, f"la fila {nom} de CORTE")
    p = re.search(r"plata: en_renta (\d+) / disponible (\d+) / reparacion (\d+) / mantenimiento (\d+)", corte)
    for etiqueta, val in zip(("En renta", "Disponible", "En reparación", "En mantenimiento"), p.groups()):
        s = cambiar(s, r'(\{ estado:"%s[^"]*",\s*usd:)\d+' % re.escape(etiqueta),
                    lambda m, v=val: m.group(1) + v, f"plata «{etiqueta}»")
    sp = re.search(r"paradosSinPrecio: (\{.*\})", corte).group(1)
    sp = json.loads(sp.replace("'", '"'))
    s = cambiar(s, r'paradosSinPrecio: \{[^}]*\}',
                'paradosSinPrecio: { "MT Rental":%d, "Monhaco":%d }' % (sp["MT Rental"], sp["Monhaco"]),
                "paradosSinPrecio")
    if "OJO:" in corte:
        avisos.append(corte[corte.index("OJO:"):].splitlines()[0])

    # ── ALERTAS_RADAR (solo cuentas: el repo es público) ────────────
    al = alertas_radar()
    if al:
        s = cambiar(s, r"^const ALERTAS_RADAR = \{.*\};$", al, "ALERTAS_RADAR", re.M)
    else:
        avisos.append("ALERTAS_RADAR queda viejo: RADAR no contestó la consulta de alertas.")

    # ── LECTURA ─────────────────────────────────────────────────────
    f = re.search(r'^LECTURA\.fecha: "([^"]+)"', lectura, re.M).group(1)
    s = cambiar(s, r'(const LECTURA = \{\n  fecha: ")[^"]+(")', lambda m: m.group(1) + f + m.group(2), "LECTURA.fecha")
    for bloque in ("perdidas", "frenado", "demanda"):
        nuevo = re.search(r"^  %s: \{.*?^  \}" % bloque, lectura, re.M | re.S)
        if not nuevo:
            raise SystemExit(f"lectura.py no trajo el bloque {bloque}")
        s = cambiar(s, r"^  %s: \{.*?^  \}" % bloque, nuevo.group(0), f"LECTURA.{bloque}", re.M | re.S)

    if crlf:
        s = s.replace("\n", "\r\n")
    if s == html:
        print("Sin cambios: el tablero ya estaba al día.")
        return
    if probar:
        import difflib
        d = difflib.unified_diff(html.splitlines(), s.splitlines(), lineterm="", n=0)
        print("\n".join(l for l in d if not l.startswith(("---", "+++"))))
    else:
        open(INDEX, "w", encoding="utf-8", newline="").write(s)
        print(f"index.html al día: CORTE {hoy}, LECTURA {f}.")
    for a in avisos:
        print("AVISO:", a)


if __name__ == "__main__":
    main()
