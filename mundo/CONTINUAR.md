# CONTINUAR ACÁ

**Para el próximo Claude Code que agarre este proyecto.**
Leé este archivo completo antes de tocar nada. Al final hay una tarea
concreta que hay que ir a buscar a **otro repo**.

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
                                    JARVIS · MAQUINÓN
                             [FINANZAS] [MI OFICINA] [ALMACÉN]
```

- El **bullpen** está al centro; adentro viven **JARVIS y MAQUINÓN**, las dos
  IA centrales. Las siete oficinas lo rodean y cada puerta da directo al
  bullpen.
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
pedir mejoras, mandar encargos entre oficinas con traducción.

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

## 6. LO QUE TENÉS QUE IR A BUSCAR

Esta es la tarea. **Jarvis está en el bullpen con su nombre y su lugar, pero
sin cablear.**

Yo no pude leerlo: el acceso de GitHub de mi sesión estaba limitado a
`rodzilla-thecreator/dash`, y `add_repo` no acepta repos de otro dueño. La
cuenta de Rodz sí tiene acceso (`can_push: true`), así que **vos probablemente
sí podés**.

### Andá a `Fabriziomont7/jarvis` y leé, en este orden:

1. **`CLAUDE.md`** — es la base del proyecto. Qué es Jarvis, para qué existe,
   cómo está armado.
2. **`i3.md`** — referencia lo que Rodz ya hizo. Es el puente entre los dos
   proyectos.
3. Después, lo que haga falta del repo para contestar las preguntas de abajo.

### Las preguntas que hay que contestar con eso

- **¿Qué es Jarvis?** ¿Un agente que corre en algún lado, una capa sobre RADAR,
  una app, otra cosa?
- **¿Dónde corre?** ¿Tiene servidor propio, es local, es serverless?
- **¿Con qué habla?** ¿Toca la misma base de Firebase? ¿RADAR? ¿SAP?
- **¿Qué relación tiene con Maquinón?** Esta es la que más importa. Hoy los
  puse como pares en el bullpen. Puede que esté mal: puede que Maquinón sea una
  pieza de Jarvis, o al revés, o que sean dos cosas que ni se tocan.
- **¿Qué se puede reusar?** Si Jarvis ya resuelve algo que acá está pendiente
  (el que piensa solo, la memoria, un motor), no lo dupliques.

### Después de eso

Cableá Jarvis en el bullpen de `mundo/index.html`. Hoy su ficha
(`fichaCentral`) dice explícitamente que no se pudo leer el repo — **reemplazá
ese texto por lo que Jarvis realmente es**. Está en `CENTRALES` y en
`fichaCentral()`.

Y traé al repo lo que haga falta para que esto no se vuelva a perder: copiá o
resumí en `mundo/docs/jarvis/` lo que el mundo necesita saber de él.

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
