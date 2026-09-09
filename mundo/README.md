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

## El mundo son dos cosas separadas

Son dos negocios distintos y el mapa no los mezcla:

```
DISTRITO DE EQUIPOS          EL EDIFICIO
todo lo que es montacargas   todo lo que no lo es

TALLER · PATIO · CAMPO       [FABRIZIO] [OMAR] [HR·Elia]
                             [VENTAS]  BULLPEN  [COMPRAS]
                                    JARVIS · MAQUINÓN
                             [FINANZAS] [MI OFICINA] [ALMACÉN]
```

### El edificio

**El bullpen está al centro y adentro viven JARVIS y MAQUINÓN**, las dos IA
centrales. Las siete oficinas lo rodean y **cada puerta da directo al
bullpen**: esa es la conexión.

Una nota de geometría que costó descubrir: en isométrico un anillo mide
**4·k tiles de ancho** en pantalla — el doble de lo que mide de alto. Por eso
`EDIF.k` está en 10 y no en 13: con 13 el edificio se salía de un celular por
los costados. Mover el edificio entero es mover `EDIF.cx`, `cy` y `k`.

| Oficina | Quiénes | Qué muestra |
|---|---|---|
| **OMAR** | Omar | los KPIs colgados |
| **FABRIZIO** | Fabrizio | estado de RADAR |
| **HR** | Elia | roles con acceso |
| **VENTAS** | dos, sin nombre aún | flota en renta y disponible |
| **COMPRAS** | dos, sin nombre aún | *todavía nada — la oficina existe, está vacía* |
| **FINANZAS** | dos, sin nombre aún | caja chica y viáticos |
| **ALMACÉN** | dos, sin nombre aún | existencias de bodega |

El octavo lugar del anillo es la **entrada**: de ahí se pasa a `oficina.html`,
que es donde se trabaja. El mapa es para mirar.

### Los mensajes que cruzan

**No son adorno.** Cada punto que viaja es un registro real: sale de la oficina
de quien lo pidió, entra al bullpen, ahí late mientras se procesa, y sigue
hacia la oficina que le toca.

| Color | Qué es | De dónde sale |
|---|---|---|
| azul | encargo entre oficinas | `mundo-encargos` |
| ámbar | gasto esperando decisión | `data-cajachica` en revisión |
| hueso | pedido de mejora | `mundo-mejoras` |

Si no hay nada pendiente, no cruza nada. Un edificio quieto significa que no
hay nada esperando, no que el mapa se rompió.

### Un modelo de IA por oficina

Cada depto tiene un campo `modelo`. **Está declarado pero no cableado**: el
mundo lo muestra, no lo llama. La idea es que Finanzas, Almacén y Ventas
puedan tener cada una la suya, especializada en lo suyo.

### Jarvis

Está en el bullpen, al lado de Maquinón, con su nombre y su lugar — pero
**sin cablear**. No pude leer `Fabriziomont7/jarvis` desde esta sesión: el
acceso de GitHub está limitado a `rodzilla-thecreator/dash` y `add_repo` no
acepta repos de otro dueño. Falta el `i3.md` y el `CLAUDE.md` para saber qué
hace y cómo se conecta. Su ficha en el mundo lo dice así, sin disimularlo.

## Las seis zonas

| Zona | Qué muestra | De dónde sale |
|---|---|---|
| **TALLER** | Equipos en `MAL ESTADO`, con barra de urgencia | `{empresa}/equipos` + `preventivos` / `correctivos` |
| **PATIO** | Equipos `DISPONIBLE` parqueados (+ "Otros / interno" al fondo) | `{empresa}/equipos` |
| **CAMPO / CLIENTES** | Equipos `EN RENTA`, agrupados por cliente en sitios con nave | `{empresa}/equipos` + RADAR `flota.ingresos_renta_mes` |
| **CONTABILIDAD** | Las 4 estaciones del flujo + papelera; cada registro es una hoja | `/bitacora/data-cajachica`, `/bitacora/data-viajes` |
| **BODEGA** | Estanterías; cajas = existencia neta por producto y sede | `/bitacora/data-almacen` |
| *(las tres de abajo se mudaron adentro del edificio: OFICINA → Omar, CONTABILIDAD → Finanzas, BODEGA → Almacén)* | | |

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
| `FORJA-1` | Departamento de Mejoras | los pedidos de todas las oficinas sobre el mundo mismo |

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

### Los agentes trabajan con el proceso real de cada quien

Los agentes arrancaron con procesos **supuestos**. Cada empleado los
reemplaza por los suyos: pega [`procesos/ENTREVISTA.md`](procesos/README.md)
en su propio Claude, lo entrevista 20 minutos, y pega el bloque que sale en
**MI PROCESO** (el botón ☰ de la barra). Desde ahí sus agentes usan sus
pasos, sus tiempos y sus palabras.

Como todos en Montasa ya tienen Claude, este paso **no necesita API ni
licencia extra**. Detalle completo en [`procesos/`](procesos/README.md).

Dos campos del bloque pesan más que el resto:

- **`nunca_automatizar`** entra en la instrucción del agente como
  prohibición. Lo escribe el empleado, no nosotros: el límite lo pone quien
  hace el trabajo.
- **`huecos`** deja escrito lo que quedó sin contestar, en vez de maquillarlo.

Sin proceso cargado el agente **lo dice** y pregunta cómo se hace, en lugar
de suponer pasos.

### Repartir trabajo entre agentes

Un agente puede partir un pedido y mandárselo a otros, que arrancan **todos
a la vez** — en la sala se ven varias estaciones encendidas al mismo tiempo.
Las respuestas vuelven juntas al que repartió, que sigue desde ahí.

Los límites son a propósito: máximo 4 subtareas, y **profundidad 1** — quien
recibe no puede volver a repartir ni escribir en la base. Repartir sin fondo
se vuelve caro y deja de ser auditable. El agente solo puede repartir a
agentes que ese rol ve: si Contabilidad no ve Almacén, tampoco puede
consultarlo por la puerta de atrás.

### El pasillo: puertas, presencia y quién está trabajando

Las oficinas son cerradas: desde afuera no se ve adentro. Lo que sí se ve es
**la puerta y su aviso** — el botón ▫ de la barra abre el pasillo con las
once puertas.

Cada puerta dice dos cosas que salen de un latido real, no de una animación:
si la persona está (verde), y **cuántas tareas tiene entre manos**. Si sus
agentes están cocinando, se ve la luz latir por debajo de la puerta. Si no
está, dice hace cuánto entró por última vez.

El latido se manda cada 20 s mientras la pestaña está abierta, y se apaga al
salir. A los 90 s sin latir, la puerta dice que no está. Se guarda en
`/bitacora/mundo-presencia/{rol}`.

### Centro de Distribución: mandarle trabajo a otra oficina

Al fondo del pasillo. Un encargo entre oficinas **no se entrega crudo**: cada
departamento tiene su jerga, sus pasos y sus tiempos. Lo que para Ventas es
"urgente para el cliente", para Taller es un equipo con un código y un
horómetro.

Escribís el encargo en **tus** palabras desde la puerta del otro. El Centro lo
traduce al entorno de quien lo recibe usando **su** proceso y **su**
vocabulario — los que esa persona cargó en MI PROCESO — y le llega a su
bandeja como una tarea propia, con el `por qué` de quien lo pidió y los pasos
en su propio proceso.

```
[vos, en tus palabras]  →  [Centro de Distribución]  →  [tarea nativa en su bandeja]
                            usa el proceso de quien recibe
```

Reglas: traducir no es ampliar (no agrega pedidos que no estaban), lo ambiguo
va a `avisos` en vez de a una suposición, y si quien recibe no cargó su
proceso, el Centro lo dice en vez de inventarle pasos. **Sin motor no hay
traducción**: el encargo se entrega igual, marcado *sin traducir* — retenerlo
sería peor.

Estados: `Sin traducir` → `Entregado` → `Aceptado` → `Hecho` / `Rechazado`.
Se guarda en `/bitacora/mundo-encargos`.

### El puente con Claude Code

Cada quien puede enganchar **su propio Claude Code** a su oficina pegando
[`claude-code/PUENTE.md`](claude-code/PUENTE.md). Su Claude levanta los
encargos de su fila, los trabaja en su máquina, y devuelve el resultado. La
puerta muestra **"+ Claude Code"** mientras esté prendido.

Va en ese sentido —**el Claude sale a buscar, la oficina no entra**— por tres
razones: el celular no llega a la laptop de nadie; una página HTTPS hablándole
a un servidor local funciona *a veces* y "a veces" no sirve para operación; y
si el puente dependiera de una conexión viva, un encargo que llega mientras
almorzás se pierde. Así, no hace falta abrir ningún puerto y los encargos
esperan en la fila.

### Departamento de Mejoras

En el centro de cada oficina está **FORJA-1**, que no es un agente de la
operación: es la mesa desde la que cada oficina le habla al equipo que
mantiene el mundo.

Cualquiera manda un pedido — algo que falla, una idea, un dato que se ve
mal, un permiso que le falta — y sigue en qué va. Los estados son los mismos
que la empresa ya tiene en la cabeza:

```
Nueva  →  En análisis  →  Aceptada  →  Hecha
                    ↘  Descartada
```

FORJA-1 además tría: agrupa los que hablan de lo mismo y propone qué hacer,
y tiene una tarea permanente de mirar el mundo y proponer mejoras. Mover un
pedido de estado es del **administrador del SGI** — el resto pide, no decide
sobre los pedidos ajenos.

Se guarda en `/bitacora/mundo-mejoras`.

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

## El núcleo y las vistas

```
nucleo.js      reglas, datos, estado, el registro   ← la verdad
oficina.html   dibujo, DOM, eventos                 ← una vista
```

`nucleo.js` **no dibuja nada y no toca el DOM**. Existe porque el mundo va a
tener tres vistas —escritorio, celular y modo sobrio— y tres vistas que copian
la lógica son tres versiones del mismo bug.

Hablan por un bus, en un solo sentido:

```js
Mundo.on("tareas", pintarChips)      // el núcleo avisa, la vista dibuja
Mundo.emit("tarea:listo", t)         // solo lo usa el núcleo
```

**El núcleo nunca llama a una función de la vista.** Si necesita que algo se
vea, emite. Esa es la regla que hace que valga la pena haberlo separado — si se
rompe, en un mes son otra vez dos archivos pegados.

Sigue sin build ni bundler: `nucleo.js` es un archivo estático más, cargado con
un `<script src>` antes del script de la vista.

Lo que es del núcleo: datos, reglas de negocio, roles y permisos, estado,
generación de tareas, el runtime de Claude, las herramientas, presencia,
encargos, memoria y el registro. Lo que es de la vista: el canvas isométrico,
dónde se para cada agente en la sala, los modales y el cableado de eventos.

## El registro

Un renglón por cada cosa que pasa, en `/bitacora/mundo-registro`, y **nunca se
reescribe: se anexa** (`POST`, que es la primitiva de anexar de Firebase).

Es una sola pieza y resuelve cuatro cosas que parecían distintas:

| | |
|---|---|
| **Concurrencia** | Antes cada escritura traía la lista entera, cambiaba un renglón y la reescribía: dos personas guardando a la vez se pisaban sin enterarse. Anexando no hay nada que pisar. |
| **Memoria** | Lo que el asistente recuerda sale de acá — decisiones que de verdad se tomaron, con fecha — y no de un resumen inventado. |
| **Medición** | Cuántas decisiones se tomaron, cuántas tareas se abandonaron. Del sistema, **nunca de las personas**. |
| **Costo** | Cada llamada anota los tokens que gastó. |

Tipos de renglón: `decision`, `encargo`, `mejora`, `proceso`, `informe`,
`herramienta`, `falla`, `gasto`, `olvido`.

Los nodos del mundo (`mundo-mejoras`, `mundo-encargos`) dejaron de ser arreglos
y son objetos con llave: se **anexa** con `POST` y se **parcha un renglón** con
`PATCH`. `data-cajachica` sigue siendo un arreglo porque lo comparte la app de
Bitácora SGI y no le podemos cambiar la forma — pero ahora se parcha por índice
en vez de reescribir el arreglo entero.

**Ninguna escritura de este módulo reescribe una lista completa.** Es la deuda
que quedó anotada en la mesa redonda, y estaba pagada por la misma pieza que
hacía falta para la memoria.

### La memoria

El asistente recibe las últimas decisiones de **su puesto** (no de la persona),
con fecha, y con la instrucción de que sirven para ser consistente y no para
repetir a ciegas: lo que era cierto hace meses puede no serlo hoy.

Son decisiones de trabajo — qué se aprobó, qué se rechazó y por qué. Nunca
conversaciones. `olvidarMemoria()` las marca como olvidadas y el registro
conserva que se olvidaron.

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
