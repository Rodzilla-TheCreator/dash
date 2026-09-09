# CONTINUAR ACÁ

**Para el próximo Claude Code que agarre este proyecto.**
Leé este archivo completo antes de tocar nada. Las nueve reglas de la
sección 4 no se rompen: salieron de dos mesas redondas y sin ese contexto se
rompen sin querer.

---

## 1. Qué es esto, en cinco líneas

Montasa (montacargas y equipo industrial, San Pedro Sula y Choloma, Honduras)
tiene un dashboard de operaciones. Encima de eso construimos **el Mundo
Montasa**: un mundo isométrico pixel-art donde la operación real se recorre
como un lugar, y donde cada empleado tiene una **oficina virtual** con agentes
de IA que trabajan sobre los datos de verdad.

Todo es **estático**: HTML + JS servidos por GitHub Pages. **No hay build, no
hay npm, no hay bundler.** Eso no es una limitación a superar, es una decisión
del repo. Respetala.

---

## 2. Dónde está todo

```
dash/
  index.html                  el dashboard original (tiles de KPIs) + botón MUNDO
  README.md
  bitacora/                   app SGI de control interno (fork de la de Christian)
    docs/ESQUEMA-BASE-DE-DATOS.md   ← el esquema real, confirmado
  mundo/
    index.html                EL MAPA: distrito de equipos + el edificio
    nucleo.js                 reglas, datos, estado, el registro — NO dibuja
    oficina.html              LA VISTA de escritorio: canvas, modales, eventos
    CONTINUAR.md              este archivo
    README.md                 cómo está hecho, en detalle
    docs/MESA-REDONDA.md      las 15 decisiones de diseño y por qué
    docs/jarvis/README.md     qué es Jarvis y por qué Maquinón no va en el bullpen
    docs/jarvis/PREGUNTAS.md  qué puede contestar, con la fuente de cada respuesta
    procesos/ENTREVISTA.md    lo que cada empleado pega en SU Claude
    claude-code/PUENTE.md     lo que cada empleado pega en SU Claude Code
    servidor/                 sesion.js + claude-proxy.js (sin desplegar)
```

**Urls en vivo:** `rodzilla-thecreator.github.io/dash/` (dash),
`/dash/mundo/` (mapa), `/dash/mundo/oficina.html` (oficina).

---

## 3. Cómo está armado

### El mapa (`mundo/index.html`)

Dos cosas separadas, porque son dos negocios distintos:

```
DISTRITO DE EQUIPOS          EL EDIFICIO
todo lo que es montacargas   todo lo que no lo es

TALLER · PATIO · CAMPO       [FABRIZIO] [OMAR] [HR·Elia]
                             [VENTAS]  BULLPEN  [COMPRAS]
                                        JARVIS
                             [FINANZAS] [MI OFICINA] [ALMACÉN]
```

- El **bullpen** está al centro; adentro vive **JARVIS**. Las siete oficinas lo
  rodean y cada puerta da directo al bullpen. (Antes también se dibujaba ahí a
  MAQUINÓN, como si fuera una segunda IA. No lo es: es una **máquina**. Salió.
  Ver `docs/jarvis/README.md`.)
- Los **puntos que cruzan** son registros reales viajando: oficina → bullpen
  (se procesa) → otra oficina. Azul = encargos, ámbar = gastos esperando
  decisión, hueso = pedidos de mejora. Si no hay nada pendiente, no cruza nada.
- Geometría: en isométrico un anillo mide **4·k tiles de ancho** en pantalla,
  el doble de lo que mide de alto. `EDIF.k` está en 10 por eso. Subirlo saca
  el edificio del celular por los costados.

### La oficina (`nucleo.js` + `oficina.html`)

```
nucleo.js      reglas, datos, estado, el registro   ← la verdad
oficina.html   dibujo, DOM, eventos                 ← una vista
```

Hablan por un bus **en un solo sentido**:

```js
Mundo.on("tareas", pintarChips)      // el núcleo avisa, la vista dibuja
Mundo.emit("tarea:listo", t)         // solo lo usa el núcleo
```

**El núcleo nunca llama a una función de la vista.** Si se rompe esa regla, en
un mes son otra vez dos archivos pegados. El núcleo existe porque vienen tres
vistas (escritorio, celular, modo sobrio).

### El registro

`/bitacora/mundo-registro`, **solo se anexa** (POST de Firebase). Una pieza que
resuelve cuatro cosas: concurrencia, memoria del asistente, medición y costo.
Tipos: `decision`, `encargo`, `mejora`, `proceso`, `informe`, `herramienta`,
`falla`, `gasto`, `olvido`.

### Los datos

Firebase Realtime Database (`montasa-app`), por REST. Nodos por empresa
(`equipos`, `preventivos`, `correctivos`) y el nodo `/bitacora/*` compartido
con la app SGI. **El esquema real está en `bitacora/docs/ESQUEMA-BASE-DE-DATOS.md`** —
no lo adivines, está confirmado ahí.

---

## 4. Las reglas que NO se rompen

Estas salieron de dos mesas redondas con cuatro perfiles distintos (un niño de
10, un gerente de 60 que odia los juegitos, un ingeniero, y una usuaria que es
el piso real de comprensión). Están explicadas en `docs/MESA-REDONDA.md`. Si
vas a romper una, leé primero por qué existe.

1. **No inventar datos.** Si un dato no está, se dibuja el hueco. Un
   montacargas fantasma en el taller, un KPI sin energía, un "sin traducir".
   Un número inventado en un tablero de operaciones es peor que un hueco,
   porque el hueco se ve y el invento no.
2. **Ninguna escritura sin confirmación humana en pantalla.** El agente
   propone la acción exacta; la persona autoriza. Ese candado es a la vez la
   mecánica del juego y la regla de seguridad.
3. **La puerta no juzga.** La presencia sirve para coordinar, nunca para
   vigilar. Nada de rankings, acumulados de ausencias ni historial de entradas.
4. **Nadie tiene que pegar un JSON.** La ruta principal para cargar un proceso
   es acompañada. Si el sistema solo funciona para quien pega bloques, funciona
   para tres personas.
5. **La plata se firma sentado.** Aprobar dinero se confirma en escritorio, no
   con el dedo en el bus.
6. **El núcleo no toca el DOM.** Ver arriba.
7. **Nunca reescribir una lista completa.** Se anexa (POST) o se parcha un
   renglón (PATCH). `data-cajachica` sigue siendo arreglo porque lo comparte la
   app SGI: ahí se parcha por índice.
8. **Autocontenido, sin build.** Cada página es HTML con su CSS y su JS.
   `nucleo.js` es un `<script src>`, no un módulo empaquetado.
9. **Lo que el empleado prohíbe, se respeta.** El campo `nunca_automatizar` de
   su proceso entra en la instrucción del agente como prohibición.

---

## 5. Estado actual

**Anda sin tocar nada:** el mapa completo, el login con el código de Bitácora
(modo local), las tareas generadas de datos reales, el pasillo con presencia,
pedir mejoras, mandar encargos entre oficinas con traducción. **Jarvis ya está
cableado en el bullpen** (sección 6) — cableado como *ficha*, que es lo que
había que hacer: el mundo todavía no lo llama.

**Anda pero apagado:** los agentes salen *SIN ENERGÍA*. Falta desplegar
`mundo/servidor/` (dos funciones, ~5 min en Vercel) y pegar la URL en
`CLAUDE.apiBase` dentro de `oficina.html`. Ojo: **la licencia de Claude
Enterprise no sirve** para esto — hace falta una organización del Developer
Platform (console.anthropic.com), que es un alta aparte.

**Orden de obra** (de la mesa redonda, 10 pasos). Hechos el **1** (separar el
núcleo) y el **2** (el registro). Sigue el **3**: la tabla de tono — dos
columnas de palabras y un interruptor, para que la misma pantalla se lea como
juego o como oficina formal.

**Pendiente del dueño, no técnico:** las reglas de Firebase están abiertas a
lectura y escritura sin auth. Rodz dijo que el ambiente es controlado y que se
profesionaliza después. Queda anotado, no para insistir.

---

## 6. Jarvis: hecho, y lo que quedó abierto

**Esta sección era una tarea. Ya está hecha** — se leyó `Fabriziomont7/jarvis`
y Jarvis quedó cableado en el bullpen. Se deja el resultado, no el encargo.

### Lo que se encontró

- **Jarvis es un asistente de voz sobre el CLI de Claude Code.** Le hablás,
  contesta en voz alta, y hereda memoria, skills, MCP y repos de tu Claude
  Code. El cerebro es el **CLI headless** (`claude -p`), no la API — a
  propósito, para usar la suscripción que ya se paga.
- **Corre** en un servidor Node propio: `localhost:4545` y Railway. No es
  serverless.
- **Habla con esta misma base de Firebase** (por `bin/firebase-lectura`, GET
  clavado), con RADAR/Supabase en solo lectura, Notion y Vercel.
- **No resuelve el *SIN ENERGÍA* de las oficinas.** Los agentes del mundo
  necesitan la **API** (Developer Platform); Jarvis usa la **suscripción** por
  el CLI. Dos caminos de cobro distintos, no se sustituyen.

### Maquinón no era una IA

Era el error que había que encontrar. **Maquinón es una máquina** — la PC de
Rodz, WSL2 por `ssh maquinon` al puerto 2222, donde Jarvis **ni siquiera corre
todavía** (falta Node ≥ 20). Estaba dibujado en el bullpen como una segunda IA
par de Jarvis: un cerebro inventado, justo lo que prohíbe la **regla 1**.

**Salió del bullpen.** Queda Jarvis solo. En `docs/MESA-REDONDA.md` "Maquinón"
sigue figurando como participante — eso es un acta y se deja como está: era la
sesión de Claude Code corriendo en esa máquina.

### Dónde quedó todo

- `docs/jarvis/README.md` — qué es, dónde corre, con qué habla, qué se puede
  reusar, y por qué Maquinón no va en el bullpen.
- `docs/jarvis/PREGUNTAS.md` — **el catálogo**: cada pregunta con su fuente
  exacta y su estado (contesta hoy / falta guion / hueco de datos / necesita
  permiso). Incluye las **preguntas trampa**, que son las que miden si es
  honesto.
- `mundo/index.html` — `CENTRALES` y `fichaCentral()` ya cableados.

### Dos cosas que aparecieron al medir la base

Ninguna la causó este trabajo, pero cambian lo que se puede prometer:

1. **De las 14 claves de `bitacora/` que documenta el esquema, en Firebase
   existen 3**: `auth-config`, `data-bitacora`, `data-cajachica`. El esquema
   describe la **Google Sheet original**; la migración va por la tercera parte.
   `data-viajes` nunca se creó — por eso el KPI de viáticos sale vacío.
2. **Caja chica lleva seis semanas sin un registro nuevo** (los 15 que hay son
   todos de Choloma, todos liquidados, todos de julio). "¿Qué espera mi
   aprobación?" contesta *ninguna*, y es correcto — pero lo que hay que contar
   es lo otro.

### Lo que sigue con Jarvis

Está ordenado al final de `docs/jarvis/PREGUNTAS.md`. Lo primero no es un
guion nuevo: es **la memoria de empresa**. Hoy Jarvis carga la memoria
*personal* de Fabrizio, y un cerebro de empresa necesita saber qué significa
`MAL ESTADO` o que `honduras` en RADAR es Monhaco. **Es la diferencia entre un
asistente y el cerebro.**

Y sigue pendiente, sin ser técnico: **preguntarle a Omar qué quiso decir con
"cotizar"**. Son tres cosas distintas con tres permisos distintos, y cinco
minutos de conversación deciden semanas de trabajo.

---

## 7. Cómo trabajar en esto

- **Probalo en navegador.** Hay Chromium con Playwright. Casi todos los bugs de
  este proyecto aparecieron solo al correrlo, nunca al leerlo: tres constantes
  que vivían en un bloque borrado, un campo que pisaba otro en el registro, un
  `disp` que en realidad se llamaba `patio`. Servir con
  `npx http-server -p 8899 -s .` desde la raíz del repo e interceptar Firebase
  con `page.route`.
- **Commits en español**, explicando *por qué*, no solo qué. Mirá `git log`.
- **Rama de trabajo:** `claude/mundo-isometrico-montasa-0ap5tp`, y de ahí
  fast-forward a `main` (GitHub Pages sirve desde `main`).
- **Decile a Rodz lo que no funciona.** Este proyecto se construyó diciendo la
  verdad sobre los huecos, incluso cuando era incómodo. Seguí así.
