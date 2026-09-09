# Jarvis — lo que el mundo necesita saber de él

**Fuente:** `Fabriziomont7/jarvis` (privado, Rodz tiene `WRITE`).
`CLAUDE.md` está en `main`. **`i3.md` NO está en `main`** — vive solo en la
rama `rodz/firebase-y-rutas`, sin mergear a propósito (ver "Por qué esa rama
no está en main", abajo). Se lee así:

```bash
git show origin/rodz/firebase-y-rutas:i3.md
```

Este archivo es un resumen para el mundo. **La verdad está en aquel repo**; si
algo acá se contradice con `CLAUDE.md`, gana `CLAUDE.md`.

---

## Qué es

Un **asistente de voz sobre el CLI de Claude Code**. Le hablás, contesta en voz
alta, y hereda lo que tu Claude Code ya sabe: memoria, skills, servidores MCP y
repos.

```
voz → navegador (Web Speech API) → server.js → claude -p
    → memoria/skills/MCP/repos → navegador (speechSynthesis) → voz
```

**La decisión que explica todo lo demás:** el cerebro es el CLI corriendo
headless (`claude -p --output-format json`), **no el Agent SDK ni la API**. Es
deliberado — usa la suscripción que el usuario ya paga en vez de una API key
con factura aparte. Cambiar el CLI por la API rompe esa premisa.

Para el mundo esto importa por una razón concreta: **el mundo sí necesita la
API** (`mundo/servidor/claude-proxy.js`, una organización del Developer
Platform). Son dos caminos de cobro distintos y no se sustituyen. Jarvis no
resuelve el *SIN ENERGÍA* de las oficinas.

## Dónde corre

Servidor Node propio, `localhost:4545`, y también desplegado en **Railway**
(Docker; la memoria vive en un volumen, no en la imagen). No es serverless.
Chrome o Safari — Firefox no tiene reconocimiento de voz.

## Con qué habla

| fuente | cómo | permiso |
|---|---|---|
| **RADAR** (Supabase) | MCP `supabase`, `project_ref=xstrugwgpozoipgjjspy` | `read_only=true` en la URL |
| **RADAR** (consulta directa) | `bin/radar-sql` | solo lectura |
| **Firebase** `montasa-app-default-rtdb` | `bin/firebase-lectura` | **GET clavado**, sin bandera que lo vuelva escritura |
| **Notion** | MCP `notion` | según el token |
| **Vercel** | `bin/vercel-estado` | lectura |

**Es la misma base Firebase del mundo.** La app de flota de Miguel, el Dash y
la bitácora comparten `montasa-app-default-rtdb`. Ahí es donde Jarvis y el
mundo se tocan de verdad.

## El candado

`config.json` → `modo`, **una sola palabra**:

- `lectura` — mira pero no toca. **Es el default y así se entrega.**
- `trabajo` — edita archivos y corre comandos **sin preguntar**: en headless no
  hay a quien preguntarle.

`git push` no está en ninguna lista, a propósito.

> **Ojo, choca con la regla 2 del mundo.** El mundo exige *confirmación humana
> en pantalla* antes de cualquier escritura. Jarvis en `trabajo` actúa sin
> confirmación. Si algún día se conectan, **el mundo no puede heredar `trabajo`
> tal cual**: la confirmación tiene que quedar del lado del mundo, que sí tiene
> pantalla y sí tiene a quién preguntarle.

## Qué se puede reusar (y no duplicar)

- **`bin/firebase-lectura`** (~290 líneas, Python 3). Ya resuelve leer la base
  compartida: filtro `--donde` del lado del cliente (el `orderBy` de Firebase
  exige índices en las reglas, que no controlamos), tope de salida de 60k
  caracteres, `bitacora/auth-config` en lista negra, y la salida envuelta en
  **marcas de dato no confiable con nonce** — porque esa base la escribe gente
  sin identificarse y un registro no debe poder hacerse pasar por instrucción.
  Esa última idea vale para el mundo tal cual.
- **El auto-registro de `bin/`**: un guion se anuncia solo en el prompt por su
  cabecera `# que hace:` (`server.js:249-273`), y `bin/` va al frente del PATH.
  Agregar una capacidad es agregar un archivo, sin tocar el servidor.
- **El candado de una palabra** de `config.json`: el mismo principio de la
  regla 2, resuelto del otro lado.

## Por qué esa rama no está en main

Los cambios de `rodz/firebase-y-rutas` tocan `Dockerfile`, `arranque.sh` y
`server.js` — la ruta de despliegue. Si el servicio de Railway de Fabrizio está
conectado a este repo, un push a `main` **le redespliega su Jarvis en vivo**.
Esa decisión es de Fabrizio, no nuestra.

---

## Y Maquinón, ¿qué es?

**Maquinón es una máquina, no una IA.** Es la PC de Rodz: se llega por
`ssh maquinon` (puerto 2222), corre **WSL2 Ubuntu**, y en `i3.md` aparece
siempre como hardware — nunca como agente:

- "Cómo retomar **en** el maquinón"
- Bloqueadores: *node y npm no están instalados en el WSL2 del maquinón*; *la
  llave del maquinón está generada pero no registrada en GitHub*
- En la prueba de resolución de `$HOME` es uno de los cinco casos, al lado de
  "Fabri" y "Railway"

La i3 y el maquinón son **las dos computadoras** del hilo de trabajo. Ninguna
es un cerebro.

### Qué estaba mal en el mundo

El bullpen tenía a **JARVIS y MAQUINÓN dibujados como dos IA pares**. Eso no es
"impreciso", es un dato inventado — de los que prohíbe la **regla 1**: se ve
prolijo y no se nota que es falso. Le enseñaba a quien mira el mapa que hay dos
cerebros. Hay uno.

Tampoco es que uno contenga al otro. Son **categorías distintas**: Jarvis es el
software; Maquinón es un host donde Jarvis *podría* correr y **hoy todavía no
corre** (falta Node ≥20 en ese WSL2).

En `docs/MESA-REDONDA.md` "Maquinón" figura como participante de la mesa. Eso
es **la sesión de Claude Code corriendo en esa máquina**, no un personaje del
mundo. El acta se deja como está — es un acta, registra lo que pasó.

**Qué se hizo:** Maquinón salió del bullpen. Queda Jarvis solo, y el trabajo de
mantener el mundo quedó nombrado por lo que es: una persona con Claude Code, no
una IA residente.
