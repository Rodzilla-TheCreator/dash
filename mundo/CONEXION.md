# Protocolo de conexión

> Cómo una persona de Montasa llega a Jarvis, y cómo su Jarvis le cuenta al Mundo lo que
> está pasando. Escrito el **2026-09-14**.
>
> **Nada de esto está implementado todavía.** Es el contrato, para que las dos puntas se
> escriban contra lo mismo. El §6 dice exactamente qué falta.

---

## 1. La idea

Los empleados de Montasa **ya trabajan con Claude**. La apuesta no es enseñarles una
herramienta nueva: es darles **la misma conversación que ya tienen, pero que además conozca
la empresa** — y que lo que hagan ahí se vea moverse en el Mundo.

Dos formas de llegar, y no son etapas de lo mismo: son dos cosas distintas que conviven.

|  | **Modo visita** | **Modo enlazado** |
|---|---|---|
| Cómo entra | con su código de Bitácora, desde el navegador | instala Jarvis en su máquina |
| Quién paga | la empresa | **el empleado, con su propia suscripción** |
| Qué instala | nada | Jarvis (`Fabriziomont7/jarvis`) |
| Dónde corre el cerebro | proxy en Vercel → API de Anthropic | el CLI de Claude Code en su compu |
| Qué alcanza | el Mundo, su oficina, los datos de la empresa | **además, sus archivos y su máquina** |
| Desde el celular | sí | no |
| Estado | escrito, sin desplegar (`servidor/`) | **Jarvis ya funciona**; falta que le cuente al Mundo |

La regla es **entrar y ya**. Nadie necesita instalar nada para usar Jarvis. Enlazarse es una
decisión que se toma cuando a uno le da la gana, no un requisito.

## 2. Por qué existen los dos (no es redundancia)

Es una diferencia de **quién paga** y de **qué puede tocar**, y sale de cómo está hecho
Jarvis.

El cerebro de Jarvis es el **CLI de Claude Code headless**, no la API. Eso significa que
corre con la *suscripción* de quien lo arranca, no con una API key facturada aparte
(ver `docs/jarvis/README.md`). De ahí:

- **Modo visita** necesita una API key del Developer Platform. La empresa paga por token,
  y por eso el proxy tiene topes: modelo fijo, 8 000 tokens por respuesta, 40 turnos,
  lista blanca de orígenes. Es la puerta abierta, y las puertas abiertas se miden.
- **Modo enlazado** usa la suscripción que el empleado **ya paga y ya usa todos los días**.
  A la empresa no le cuesta un centavo más, y el empleado gana algo que el modo visita no le
  puede dar nunca: Jarvis parado en *su* máquina, viendo *sus* archivos.

Por eso el modo enlazado no es "la versión pro". Es la versión donde la herramienta es
tuya.

### Sobre los tokens de Fabrizio

Hoy el Jarvis de Railway corre con `CLAUDE_CODE_OAUTH_TOKEN`, que es el token de la
suscripción de Fabrizio. O sea: **el modo visita ya funciona con sus tokens**, es lo que
existe.

Dos cosas que conviene resolver con él antes de abrirlo a todos, y son prácticas, no
filosóficas:

1. **Los límites de tasa son de su cuenta.** Un token de suscripción sirviendo a tres
   personas anda; sirviendo a veinte, se toca el techo y todos se quedan esperando a la vez.
   El proxy de `servidor/` existe justamente para eso: una key de workspace del Developer
   Platform aguanta el uso compartido y además **reporta consumo por rol**, que es cómo se
   sabe cuánto cuesta el módulo.
2. **Conviene confirmar con Anthropic si compartir una suscripción personal entre empleados
   está dentro de los términos.** No lo sabemos, y es barato preguntar antes que después.

Mientras tanto: el token de Fabri para arrancar y probar, el workspace para producción.

## 3. El contrato de eventos

Esta es la parte que importa y la que hay que respetar de los dos lados.

**Todo Jarvis —de visita o enlazado— le cuenta al Mundo por el registro que ya existe.** No
se inventa un canal nuevo:

```
POST https://montasa-app-default-rtdb.firebaseio.com/bitacora/mundo-registro.json
```

Es solo-anexa (regla 7), y `nucleo.js` ya lo lee con `limitToLast`. El renglón mantiene la
forma de siempre — `t`, `tipo`, `rol`, `persona`, `empresa` — más estos campos:

| campo | qué es |
|---|---|
| `modo` | `"visita"` o `"enlazado"` |
| `origen` | identificador **estable y anónimo** de la instancia (un hash, no el hostname) |
| `dominio` | de qué se habló: `taller`, `flota`, `caja`, `ventas`, `cobros`, `otro` |
| `fuente` | qué se leyó: `radar`, `firebase`, `taller`, `web`, `local` |
| `ms` | cuánto tardó |

### Los tipos nuevos

| tipo | cuándo | qué dibuja el Mundo |
|---|---|---|
| `jarvis:despierta` | arranca una instancia | se prende la luz de esa oficina |
| `jarvis:duerme` | se apaga o expira | se apaga |
| `jarvis:consulta` | alguien le preguntó algo | sale un punto de la oficina al bullpen |
| `jarvis:lectura` | leyó una fuente | el punto viaja del bullpen al distrito y vuelve |
| `jarvis:entrega` | produjo un resultado | el punto vuelve a la oficina y se apaga |
| `jarvis:espera` | quedó esperando confirmación humana | el punto se queda **quieto y ámbar** |

`jarvis:espera` es el que le da sentido al resto: ámbar quieto ya significa "esperando
decisión" en el mapa, y hace visible la regla 2 — se ve *quién está esperando que alguien
firme*, que es justo lo que en una oficina real no se ve.

### Lo que NUNCA viaja

**No se escribe el contenido. Nunca.** Ni la pregunta, ni la respuesta, ni nombres de
archivo, ni nombres de clientes, ni teléfonos, ni números de identidad o de cuenta.

Dos razones, y cada una alcanza sola:

1. **Ese nodo lo lee cualquiera.** Las reglas de Firebase están abiertas. Todo lo que se
   escriba ahí es público para quien tenga la URL. No es una precaución: es que **no hay
   dónde guardar un secreto en este canal.**
2. **La regla 3 dice que la puerta no juzga.** Un mundo donde se puede mirar qué preguntó
   cada quien no es un mapa, es vigilancia — y se muere solo, porque nadie se enlaza a una
   herramienta que lo delata.

El Mundo muestra **que** algo se movió y **entre dónde**. Nunca qué decía.

> Si algún día hace falta el detalle para depurar, va a un lugar con permisos, no a este
> nodo. No se resuelve poniéndolo acá "por ahora".

### El renglón, entero

```json
{
  "t": 1789400000000,
  "tipo": "jarvis:lectura",
  "rol": "almacen_sps",
  "persona": "Almacén SPS",
  "empresa": "monhaco",
  "modo": "enlazado",
  "origen": "a3f9c1",
  "dominio": "taller",
  "fuente": "firebase",
  "ms": 820
}
```

Diez campos, ninguno reconstruye la conversación. Si un renglón trae algo que no está en
esta tabla, es un error: **el Mundo lo ignora en vez de dibujarlo.**

## 4. Cómo se enlaza una persona

Tres pasos, sin pegar un solo JSON (regla 4):

1. **Instala Jarvis.** `git clone`, `cp .env.ejemplo .env`, arrancar. Desde que las rutas
   dejaron de apuntar a una sola máquina, no hay nada que configurar: usa su `$HOME`.
2. **Ya está logueado.** No hay API key que pedir: Jarvis usa la sesión de Claude Code que
   la persona ya tiene. Si expiró, `claude setup-token`.
3. **Se presenta al Mundo.** Pone su rol una vez (los mismos de `claude-code/PUENTE.md`:
   `gerente_general`, `almacen_sps`, `ventas1`…). A partir de ahí su oficina se prende sola
   cuando él prende Jarvis.

Lo que **no** pasa: nadie entra a su máquina. Su Jarvis sale a contar, no recibe órdenes de
afuera. Es el mismo razonamiento de `claude-code/PUENTE.md` §"Por qué es tu Claude sale a
buscar", y por las mismas tres razones.

### Y el que ya usa el PUENTE, ¿qué?

`claude-code/PUENTE.md` es esto mismo **hecho a mano**: un texto que la persona pega en su
Claude Code para que lea la fila de encargos. Sirve hoy y no hay que apurarse a jubilarlo.

La diferencia es que el puente es *un prompt que alguien pega*, y el modo enlazado es *una
app que ya sabe*. Cuando el modo enlazado exista, el puente pasa a ser el camino para quien
no quiere instalar nada — y su instructivo se reescribe para emitir los mismos eventos de
§3, así que las dos rutas alimentan el mismo mapa.

## 5. Qué ve cada quien

| | modo visita | modo enlazado |
|---|---|---|
| Datos de la empresa (RADAR, Firebase) | sí, solo lectura | sí, solo lectura |
| Memoria de empresa | sí | sí |
| Sus archivos y su máquina | no | **sí** |
| Correr comandos | no | solo si pone `modo: trabajo`, y es decisión suya |
| Escribir en la base de la empresa | no | **no** |

La última fila no cambia entre modos y no debería cambiar nunca: **escribir se hace desde la
oficina, con la persona confirmando en pantalla.** Regla 2. Jarvis no tiene pantalla donde
pedir permiso, así que no escribe — de los dos lados.

## 6. Qué falta (nada de esto existe hoy)

En orden, y cada uno se puede hacer sin el siguiente:

1. **Desplegar `servidor/`** en Vercel y pegar la URL en `CLAUDE.apiBase`. Es lo único que
   separa a los agentes de dejar de salir *SIN ENERGÍA*. Necesita el alta del Developer
   Platform — la licencia de Enterprise no sirve, ver `servidor/README.md`.
2. **Que Jarvis emita los eventos de §3.** Va en el repo de Jarvis, no acá. Es una función
   chica en `server.js`; no se toca todavía por decisión de Rodz.
3. **Que el Mundo los dibuje.** `nucleo.js` ya lee el registro: hay que mapear los seis
   tipos nuevos a los puntos que ya cruzan el bullpen.
4. **Arreglar el bullpen.** Maquinón está dibujado como par de Jarvis y **no es una IA, es
   una computadora** (ver `docs/jarvis/README.md`). Lo correcto es una casa con Jarvis
   adentro — que además es como se va a ver cada empleado enlazado.
5. **Cerrar las reglas de Firebase.** Es de Miguel, no nuestro, y no se toca. Pero hasta que
   pase: cualquiera puede inventar un renglón del registro. **El Mundo debe tratar lo que
   lee como un papel que apareció en el escritorio**, igual que ya dice el PUENTE.
6. **Cuota por empleado.** Hoy no hay. Necesita estado compartido, y sobre una base abierta
   sería un control que cualquiera edita, o sea ninguno.

---

**Para leer después:** `docs/jarvis/README.md` (qué es Jarvis), `servidor/README.md` (el
proxy y la licencia), `claude-code/PUENTE.md` (el puente manual), `CONTINUAR.md` (el estado
del Mundo).
