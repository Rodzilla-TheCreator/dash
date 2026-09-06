# Servidor de la Oficina Virtual

Una sola función: `claude-proxy.js`. Es la única pieza no estática del repo.

## Por qué existe

La API key de Anthropic **no puede vivir en el navegador**. Este repo es
público y se sirve por GitHub Pages: cualquier key en un `.html` se lee con
"ver código fuente" y se cobra a la cuenta del dueño. Así que la oficina
virtual nunca habla directo con `api.anthropic.com` — le habla a esta
función, que corre en un servidor con la key en una variable de entorno.

Es el mismo razonamiento por el que conviene revisar el `RADAR_TOKEN` que
hoy está hardcodeado: un secreto en el repo es un secreto público.

## Desplegarla (Vercel, ~5 minutos)

RADAR ya vive en Vercel (`montasa-web.vercel.app`), así que lo más simple es
poner esto al lado, en ese mismo proyecto o en uno nuevo.

```
mi-proyecto/
  api/
    claude.js        <- copiar acá el contenido de claude-proxy.js
  package.json
```

`package.json`:

```json
{
  "type": "module",
  "dependencies": { "@anthropic-ai/sdk": "^0.70.0" }
}
```

Después:

1. En Vercel → Settings → Environment Variables, agregar
   **`ANTHROPIC_API_KEY`** con la key de la consola de Anthropic.
   *No* la pongas en el código ni en el repo.
2. Deploy. La URL queda `https://<tu-proyecto>.vercel.app/api/claude`.
3. En `mundo/oficina.html`, pegar esa URL en `CLAUDE.proxyUrl`
   (está al principio del `<script>`, con un comentario que lo señala).
4. Si publicás la oficina en un dominio distinto a
   `rodzilla-thecreator.github.io`, agregalo a la lista `ORIGENES` de
   `claude-proxy.js`.

Mientras `proxyUrl` esté vacío, la oficina funciona igual pero los agentes
se dibujan **sin energía** y cada tarea dice exactamente qué falta. No
inventa respuestas.

## Qué controla el servidor y qué no

Lo que el navegador **no** puede cambiar (está fijo en la función):

| | |
|---|---|
| Modelo | `claude-opus-5` |
| `max_tokens` | 8 000 por respuesta |
| Turnos por tarea | 40 |
| Tamaño del payload | 120 000 caracteres |
| Origen | lista blanca `ORIGENES` |

Lo que el navegador sí manda: el `system` del agente y los mensajes de la
conversación. Eso es a propósito — el cliente *es* la app.

## Lo que este proxy NO resuelve

**No hay autenticación de usuario.** Quien tenga la URL puede gastar tokens
de la cuenta, aunque los topes de arriba acotan cuánto por petición. La
lista de orígenes ayuda contra un sitio ajeno, pero no contra alguien que
llame la URL directo con `curl`.

Para cerrarlo de verdad hacen falta dos cosas, en este orden:

1. **Que el login de la oficina emita un token verificable.** Hoy el login
   valida contra `/bitacora/auth-config` **en el navegador**, así que el
   servidor no puede confiar en él. Cuando exista un endpoint de sesión
   (propio o de RADAR), esta función debería exigir ese token antes de
   llamar a Anthropic.
2. **Cerrar las reglas de Firebase**, que hoy están abiertas a lectura y
   escritura sin auth. Mientras eso siga así, el login de la oficina es una
   puerta con cerradura en una casa sin paredes: cualquiera puede escribir
   en la base sin pasar por la puerta.

Ninguna de las dos es trabajo de esta función — pero sin ellas, esto es un
control de gasto, no un control de acceso.
