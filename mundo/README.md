# Mundo Montasa

Un **mundo isométrico pixel-art** que muestra la operación real de Montasa /
Monhaco / Monhagro como un lugar recorrible, en vez de tiles de números.

Un solo archivo: `mundo/index.html` (CSS + JS embebidos, canvas 2D, sin
librerías, sin build, sin npm). Se sirve igual que el resto del repo desde
GitHub Pages. Se entra desde el botón **MUNDO ▸** del header del dash.

---

## La idea

El flujo de aprobación de caja chica y viáticos, y el ratio de urgencia de
mantenimiento, **ya existen en la base**. Así que cada zona del mundo es una
máquina de estados real:

> Un objeto se mueve de estación en estación porque su registro cambió de
> estado en Firebase, no porque una animación lo diga.

Corolario, y es lo que hace que el módulo valga: **el hueco de datos se ve tan
feo como un dato malo.** Un equipo sin fecha de mantenimiento no es un texto
gris que nadie lee: es un montacargas fantasma parado en el taller. Un KPI que
RADAR todavía no calcula no es un tile que dice "pendiente": es un monitor
apagado colgado de la pared.

---

## Las seis zonas

| Zona | Qué muestra | De dónde sale |
|---|---|---|
| **TALLER** | Equipos en `MAL ESTADO`, con barra de urgencia | `{empresa}/equipos` + `preventivos` / `correctivos` |
| **PATIO** | Equipos `DISPONIBLE` parqueados (+ "Otros / interno" al fondo) | `{empresa}/equipos` |
| **CAMPO / CLIENTES** | Equipos `EN RENTA`, agrupados por cliente en sitios con nave | `{empresa}/equipos` + RADAR `flota.ingresos_renta_mes` |
| **CONTABILIDAD** | Las 4 estaciones del flujo + papelera; cada registro es una hoja | `/bitacora/data-cajachica`, `/bitacora/data-viajes` |
| **BODEGA** | Estanterías; cajas = existencia neta por producto y sede | `/bitacora/data-almacen` |
| **OFICINA** | Los 51 KPIs del catálogo como objetos que se cuelgan de la pared | `KPI_GROUPS` + `localStorage["dash_kpis"]` |

### Barra de urgencia (taller)

Sale de `evaluarEquipo()`, la misma función del dash (90 días / 250 h,
amarillo al 75 %):

- `ok` → verde, barra baja
- `warn` (≥ 0.75) → ámbar
- `crit` (≥ 1.0) → rojo, **y la barra se sale del marco**
- `nodata` → el sprite se dibuja translúcido, en silueta, con marco punteado

### Contabilidad: los pasos son reales

```
[ESCRITORIO]     [BANDEJA REVISIÓN]     [GERENCIA]      [ARCHIVO]
 Pendiente    →   Enviado a revisión →  Aprobado    →   Liquidado
 de liquidar                                ↓
                                       [PAPELERA] Rechazado
```

Tocar una hoja abre su ficha (concepto, monto en Lempiras, sede, responsable).
Las que están en `Enviado a revisión` **se aprueban o se rechazan desde ahí
mismo**, con la misma `decidirCajaChica()` del dash: escribe el nuevo estado en
`/bitacora/data-cajachica`, deja rastro en `/bitacora/data-bitacora`, y el papel
se desliza a su nueva mesa.

Los viáticos se ven pero no se deciden desde acá: el dash tampoco escribe
`data-viajes`, y no íbamos a inventar esa escritura.

### Oficina: colgar y descolgar

Los objetos leen y escriben la **misma llave** `localStorage["dash_kpis"]` que
el catálogo de checkboxes del dash. Colgar un cuadro acá enciende el tile allá,
y al revés. Los 8 KPIs que RADAR todavía no calcula
(`4.2 4.3 5.4 5.5 6.2 6.4 8.3 9.2`) se dibujan **sin energía**, con el cable
tachado, se cuelguen o no.

### Monhagro

`NODO_EMPRESA.monhagro === null`. Sus zonas de flota se dibujan **en
construcción**: andamios, sin techo. Es honesto y se explica solo.

---

## Cómo está hecho

- **Canvas 2D, proyección isométrica 2:1.** Un tile mide 32 × 16 px a 1×.
  `imageSmoothingEnabled = false` y escalado por enteros (1×–4×, arranca en 2×
  en celular y 3× en pantalla ancha), así el pixel art nunca se interpola.
- **Sprites generados por código** (rectángulos de 1 px sobre canvas fuera de
  pantalla, cacheados). Cero binarios en el repo, cero peticiones extra.
  El montacargas es un sprite de 24 × 22; los edificios, mesas, estanterías y
  cajas son cuboides isométricos dibujados con `isoBox()`.
- **Los rótulos se dibujan en espacio de pantalla**, no escalados con el mundo,
  para que se lean sin zoom en un celular de 380 px.
- **La escena se arma una vez por refresco de datos**, no por frame; se pinta
  sólo lo que cae dentro de la vista, y el resultado de `evaluarEquipo` se
  cachea entre refrescos.
- **Refresco cada 60 s**, igual que el dash (más un refresco al volver a la
  pestaña).

### Controles

| | |
|---|---|
| Moverse | arrastrar (dedo o mouse), flechas del teclado |
| Ir a una zona | botones de abajo |
| Ver un objeto | tocarlo |
| Zoom | botones `+` / `−`, rueda del mouse |
| Cerrar la ficha | `Esc`, la `✕`, o tocar el piso |

---

## Duplicación a propósito

Cada página de este repo es autocontenida (sin build, sin bundler). La única
forma de reusar las reglas de negocio es **copiarlas**. Están todas juntas al
principio del `<script>`, bajo un comentario que dice de dónde salieron:

`getJSON`, `NODO_EMPRESA`, `bucketEstado`, `primerCampo`, `aFecha`, `aNumero`,
`diasDesde`, `evaluarEquipo`, `CC_FB`, `CC_SEDES`, `fmtL`, `RADAR_*`, `fixUsd`,
`NO_DISP`, `KPI_GROUPS`, `decidirCajaChica`.

**Si cambian en `../index.html`, hay que cambiarlas acá también.**

---

## Pendiente / a confirmar

### 1. Cómo se identifica al cliente en un equipo `EN RENTA`

**No está confirmado.** El entorno donde se escribió este módulo no tenía
salida de red hacia `montasa-app-default-rtdb.firebaseio.com`, así que no se
pudo abrir `equipos.json` para ver el esquema real.

Se usa el mismo patrón de sondeo que ya usa el dash con horómetros y fechas:

```js
const CAMPOS_CLIENTE   = ["cliente","clienteNombre","clienteId","razonSocial","empresa"];
const CAMPOS_UBICACION = ["ubicacion","sede","zona","proyecto","direccion"];
```

- Si algún equipo trae uno de esos campos → **un sitio por cliente**, rotulado.
- Si ninguno lo trae → **un solo sitio genérico "EN CLIENTE"** con el conteo,
  y el rótulo lo dice: *"sin campo de cliente en la base"*. No se inventa
  ningún nombre.

**Cuando se confirme el campo real, dejar sólo ese en la lista**, igual que
hace el dash con horómetros y fechas.

Ojo: `contratos_renta_activos` está en `NO_DISP` — RADAR todavía no lo calcula,
así que el mundo **no** dibuja vencimientos de contrato.

### 2. Seguridad — leer antes de que esto entre a producción

El `README.md` del repo lo dice: las reglas de Firebase están **abiertas a
lectura y escritura sin auth**. La zona de Contabilidad **escribe**
(aprobar / rechazar caja chica).

Agregar un mundo recorrible encima de una base que cualquiera puede escribir
**multiplica el problema en vez de contenerlo**. Las reglas hay que cerrarlas
antes, no después.

Segundo punto: `RADAR_TOKEN` está hardcodeado en el repo público. Fue una
decisión consciente del dueño, pero conviene reevaluarla ahora que hay un
segundo módulo generando tráfico con él.

---

## Degradación honesta

Si un fetch falla o un nodo viene vacío, el objeto se dibuja apagado, fantasma
o directamente no se dibuja, y el rótulo dice por qué. **Nunca se inventan
datos de relleno.** Todo el valor de esto depende de que lo que se ve sea
cierto.
