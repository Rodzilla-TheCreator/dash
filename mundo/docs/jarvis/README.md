# Jarvis, para el Mundo

> `CONTINUAR.md` §6 pedía ir a `Fabriziomont7/jarvis` y contestar cinco preguntas.
> Acá están contestadas, leyendo el repo. Última revisión: **2026-09-14**.

---

## ¿Qué es Jarvis?

Un **asistente de voz** cuyo cerebro es el **CLI de Claude Code corriendo headless**
(`claude -p --output-format json`). Le hablás, te contesta en voz alta, y sabe lo que ya
sabe tu Claude Code: tu memoria, tus skills, tus servidores MCP y tus repos.

No es una capa sobre RADAR ni un agente dentro de otra app. Es un **servidor propio**
(`server.js`, ~1.100 líneas de Node sin framework) con su interfaz web: un reactor animado
cuyo anillo se mueve con el micrófono de verdad, paneles de estado, y una consola para
escribirle cuando estás en una reunión.

### La decisión que explica todo lo demás

El cerebro es **el CLI, no el Agent SDK ni la API**, y es a propósito: usa la suscripción de
Claude que la persona ya paga, en vez de una API key con factura aparte.

**Esto es lo más importante para el Mundo**, y conviene leerlo dos veces: es exactamente el
mecanismo que permite que cada empleado use *sus propios* tokens. Ver `../../CONEXION.md`.

## ¿Dónde corre?

En los dos lados:

- **Local**: `http://localhost:4545`, arrancado con `~/jarvis/jarvis`.
- **En la nube**: desplegado en **Railway** por Docker desde el commit `aa0dbb5`. La memoria
  vive en un volumen para sobrevivir a los despliegues.

> El `README.md` de Jarvis todavía listaba "mudarlo a Railway" como pendiente. Estaba viejo
> y ya se corrigió: la nube **existe**. Lo que falta para alcanzarlo desde afuera no es
> código, son dos datos — la URL del servicio y la `JARVIS_CLAVE`.

Escucha solo en `127.0.0.1` salvo que se le pase `JARVIS_PUBLICO=1`, y en ese caso
**aborta el arranque si no hay clave**. Tiene freno de cinco intentos cada quince minutos.

## ¿Con qué habla?

| fuente | cómo | permiso |
|---|---|---|
| **RADAR** (Supabase) | `bin/radar-sql "SELECT ..."` | solo lectura, por la URL del MCP |
| **Firebase `montasa-app`** | `bin/firebase-lectura RUTA` | solo lectura, **el método está clavado en GET** |
| **Taller** (análisis) | `bin/taller-tiempos` | derivado de lo anterior |
| **Vercel** | `bin/vercel-estado` | estado de despliegues de RADAR |
| **Notion** | MCP | lectura |

O sea: **sí, toca la misma base de Firebase que el Mundo.** Las dos mitades de Montasa —
la comercial (RADAR/SAP) y la operativa (Firebase) — se leen desde un solo lugar, y ninguna
se escribe.

**SAP no se toca directo.** RADAR le habla por el Service Layer y sincroniza hacia Supabase
cada 2 h; Jarvis lee ese espejo. Es la ruta correcta: pedir credenciales de SAP sería mucho
más sensible y no hace falta.

### El candado

`config.json` → `modo` es **una palabra** y decide todo:

- `lectura` — mira pero no toca. **Es el default y así se entrega.**
- `trabajo` — puede editar archivos y correr comandos **sin preguntar**, porque en headless
  no hay a quién preguntarle.

`git push` no está en ninguna lista, a propósito.

> Esto encaja con la regla 2 del Mundo ("ninguna escritura sin confirmación humana"), pero
> por un camino distinto: el Mundo pide confirmación *en pantalla*; Jarvis **no tiene
> pantalla donde pedirla**, así que resuelve lo mismo quitándole la capacidad. Si alguna vez
> se juntan los dos, el que tiene pantalla es el que debe autorizar.

## ¿Qué relación tiene con Maquinón?

**Hoy el Mundo los dibuja como pares en el bullpen, y está mal.**

**Maquinón no es una IA.** Es una computadora: la ASUS ROG Zephyrus M16 de Rodz, 32 GB de
RAM y una RTX 4070, que es donde corre el trabajo pesado. Las tres máquinas se llaman **i3**
(la Dell desde donde se trabaja, solo terminal), **maquinón** (el fierro) y **superspeed**
(un SSD externo con Linux — tampoco es una computadora, es el disco).

O sea que la relación correcta no es *par*, es **anfitrión**: maquinón es uno de los lugares
donde Jarvis *puede* correr. Jarvis es el agente; maquinón es una casa.

Para el bullpen eso significa una de dos:

- Dejar **solo a Jarvis** como central, y mover maquinón al plano de infraestructura (donde
  viven Railway y Vercel, no donde viven los agentes), o
- Dibujar maquinón como **una casa con Jarvis adentro**, que es lo que literalmente es.

La segunda es más fiel y además explica visualmente el modo enlazado: cada empleado va a
tener su propia casa con su propio Jarvis adentro.

## ¿Qué se puede reusar?

| el Mundo tiene pendiente | Jarvis ya lo tiene |
|---|---|
| "el que piensa solo" (agentes sin energía) | el CLI headless andando, con streaming |
| llegar a Firebase sin inventar datos | `bin/firebase-lectura`, GET clavado, lista negra, tope de salida |
| llegar a RADAR | `bin/radar-sql`, solo lectura por la URL del MCP |
| que el agente sepa qué herramientas tiene | auto-registro por cabecera `# que hace:` en `bin/` |
| memoria del asistente | memoria de Claude Code + `memoria-montasa/` (en diseño) |
| tratar los datos como datos | marcas de dato-no-confiable con nonce en la salida |

**No dupliquen `bin/`.** Si el Mundo necesita leer Firebase o RADAR desde un agente, la
respuesta es llamar a esos guiones, no escribir otros. Ya tienen resueltos los casos borde
que se descubren a los tres días: el tope de salida, los estados escritos a mano, el desfase
de zona horaria.

## Lo que Jarvis sabe y el Mundo todavía no

Cosas verificadas leyendo la base que valen para cualquiera que trabaje acá:

- **No existe ningún dato de costo en el taller.** Se revisaron las 170 órdenes y las 131
  solicitudes: cero campos de dinero. El taller registra *qué* se hizo y *cuánto tardó*, no
  cuánto costó.
- **Los viáticos no están en `bitacora/data-viajes`** — ese nodo no existe. Están *dentro*
  de las órdenes de taller, con combustible, peaje, hospedaje y facturas.
- **`fechaInicio` se guarda en UTC y `fechaFin` en hora local.** 63 de 170 órdenes tienen
  duración negativa por eso. Restando 6 h se recuperan 59.
- **Monhagro no tiene nodo en Firebase**: toda pregunta sobre esa empresa devuelve **vacío,
  no cero**. Son cosas distintas.
- El campo `viaticos` incluye **número de identidad y cuenta bancaria** del gestor, en una
  base que hoy lee cualquiera.

---

Protocolo de conexión: **`../../CONEXION.md`**.
