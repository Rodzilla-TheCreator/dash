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
| **OFICINA** | Los 51 KPIs del catálogo como objetos que se cuelgan de la pared, y **la puerta a la oficina virtual** | `KPI_GROUPS` + `localStorage["dash_kpis"]` |

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

## La Oficina Virtual (`oficina.html`)

El mundo se recorre; la oficina **se trabaja**. Cada empleado entra con su
código, cae en su propia oficina isométrica, y ahí tiene **agentes de IA**
parados en sus subestaciones.

```
[login por rol]  →  [tu oficina]  →  [tarea]  →  [cocinando]  ⇄  [pregunta]
                                                      ↓         ⇄  [confirmación]
                                                  [informe]
```

### Acceso

Usa el **mismo código** que la app de Bitácora SGI: SHA-256 del código
comparado contra `/bitacora/auth-config`, los mismos 11 roles y los mismos
permisos (`PERMISSIONS`). Una diferencia a propósito: **acá no se pueden
crear códigos**. Bitácora, si a un rol le falta el código, lo crea con lo
que escribas — está bien en una app interna de configuración, pero una
puerta que se abre sola no es una puerta.

Los permisos mandan sobre todo lo demás: un vendedor no ve al agente de
Caja Chica, y un rol de solo lectura (las gerencias) tiene agentes que
analizan pero no pueden proponer ninguna escritura.

### Los agentes

| Agente | Oficio | Ve |
|---|---|---|
| `ORACLE-MT` | Mantenimiento | equipos, preventivos, correctivos |
| `CONTA-01` | Caja chica y viáticos | `data-cajachica`, `data-viajes` |
| `STOCK-9` | Bodega | `data-almacen` |
| `RENTA-3` | Flota y rentas | equipos por estado |
| `RADAR-X` | Ventas y KPIs | el estado general de la operación |

### Las tareas salen de los datos

Ninguna tarea es decorativa. Se generan de condiciones reales y si la
condición no existe, la tarea tampoco: equipos vencidos, equipos **sin
datos** de mantenimiento, gastos en `Enviado a revisión`, gastos sin
comprobante, viáticos en revisión, existencia negativa en bodega, patio sin
nada disponible. Bandeja vacía significa que no hay nada que atender, no
que el juego se quedó sin contenido.

### El ciclo, y dónde está el candado

El empleado abre la tarea, ve el contexto real y escribe **qué quiere que
se haga**. El agente se pone a cocinar y su razonamiento se ve en vivo en
la pantalla. Claude contesta siempre un sobre JSON con uno de tres estados:

- **`pregunta`** → pop-up de seguimiento, con opciones o texto libre. La
  respuesta vuelve al hilo y sigue trabajando.
- **`confirmacion`** → pop-up con la **acción exacta** que quiere ejecutar
  (qué registro, qué cambio, con qué motivo). Sin un *Autorizar*, no se
  escribe nada.
- **`listo`** → queda el informe.

Ese candado es a la vez la mecánica del juego y la regla de seguridad:
**ninguna escritura ocurre sin confirmación humana en pantalla.** Las
herramientas son deliberadamente pocas — `decidir_caja_chica` y
`nota_bitacora` — y las dos escriben con el nombre del empleado y dejan
rastro en `/bitacora/data-bitacora`.

Si Claude devuelve algo que no se entiende, se muestra crudo y marcado como
*respuesta no entendida*. No se adivina qué quiso decir.

### Acceso verificado en el servidor

El código se compara **en el servidor** (`POST /api/sesion`), que devuelve un
token firmado de 8 horas; el proxy de Claude no atiende sin ese token. Antes
la comparación ocurría en el navegador: alcanzaba para decidir qué pantalla
mostrar, pero el servidor no podía confiar en ella y la URL del proxy quedaba
abierta a cualquiera.

Sin servidor configurado la oficina corre en **modo local** — verifica en el
navegador y los agentes quedan sin energía — y la pantalla de acceso lo dice.

Esto cierra el proxy, **no la base**: mientras las reglas de Firebase estén
abiertas, alguien puede cambiar los hashes de `auth-config` sin pasar por
ninguna puerta.

### El motor: hace falta desplegar un servidor

La oficina **no llama a Anthropic desde el navegador**. La API key no puede
vivir en este repo: es público, y una key en un `.html` es una key regalada.
Todo pasa por dos funciones serverless — están escritas y listas en
[`servidor/`](servidor/README.md), unos cinco minutos de despliegue en Vercel.

**Ojo con la licencia:** los asientos de **Claude Enterprise** (claude.ai) no
sirven para esto. Son para que la gente chatee en el navegador; no hay forma
de que una app de terceros gaste el asiento de un empleado. Hace falta una
organización del **Developer Platform** (`console.anthropic.com`), que es un
alta aparte, y conviene darle al mundo su propio *workspace* para aislar
límites y costo.

Mientras `CLAUDE.apiBase` esté vacío, la oficina funciona igual: el login,
la sala, las tareas y el contexto son reales. Lo único que pasa es que los
agentes se dibujan **sin energía** y cada tarea dice exactamente qué falta.
Misma gramática que los KPIs que RADAR no calcula: el hueco se ve, no se
disimula.

Lo que el servidor fija y el navegador no puede subir: modelo
(`claude-opus-5`), 8 000 tokens por respuesta, 40 turnos, 120 000 caracteres
de payload, una lista blanca de orígenes, y **quién llama**. En el cliente hay
además un tope de 12 idas y vueltas por tarea.

**Lo que todavía no está resuelto:** no hay cuota por empleado — los topes son
por petición, no por persona ni por día. Un tope real necesita estado
compartido, y montarlo sobre una base con las reglas abiertas sería un control
que cualquiera puede editar. Primero se cierran las reglas.

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
