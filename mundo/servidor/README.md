# Servidor de la Oficina Virtual

Dos funciones. Son las únicas piezas no estáticas del repo.

| Archivo | Endpoint | Qué hace |
|---|---|---|
| `sesion.js` | `POST /api/sesion` | Verifica el código del empleado **contra la base, del lado del servidor**, y devuelve un token firmado (8 h) |
| `claude-proxy.js` | `POST /api/claude` | Habla con Anthropic. **Exige ese token.** Devuelve el stream en SSE |

## Antes que nada: qué licencia hace falta

**La licencia de Claude Enterprise no sirve para esto.** Son asientos para
que la gente chatee en claude.ai; su superficie de administración expone
miembros, invitaciones, grupos y topes de gasto — nada de inferencia. No hay
forma de que una app de terceros gaste el asiento de un empleado, y tampoco
existe un "iniciar sesión con Claude" para eso.

Lo que hace falta es una organización del **Developer Platform**
(`console.anthropic.com`): workspaces, API keys, reportes de uso. Es un alta
aparte de Enterprise, aunque el acuerdo comercial pueda cubrir las dos.

Recomendado al darla de alta: **un workspace propio para el mundo**. Aísla
límites de tasa y de costo del resto de la organización, y los reportes de
uso salen por workspace, así que se sabe exactamente cuánto costó el módulo.

## Por qué existen estas dos funciones

**La API key no puede vivir en el navegador.** Este repo es público y se
sirve por GitHub Pages: cualquier key en un `.html` se lee con "ver código
fuente" y se cobra a la cuenta del dueño. Es el mismo razonamiento por el
que conviene revisar el `RADAR_TOKEN` hardcodeado, pero peor, porque esta se
cobra por token.

**Y el login tenía que mudarse al servidor.** La oficina validaba el código
en el navegador. Eso alcanza para decidir qué pantalla mostrar, pero el
servidor no puede confiar en una validación que ocurrió en la máquina de
quien llama — cualquiera podía saltarse la pantalla y pegarle directo al
proxy. Ahora la comparación ocurre donde el cliente no llega, y el resultado
es un token que el proxy sí puede verificar.

## Desplegarlas (Vercel, ~5 minutos)

RADAR ya vive en Vercel (`montasa-web.vercel.app`), así que lo más simple es
poner esto al lado.

```
mi-proyecto/
  api/
    sesion.js        <- copiar servidor/sesion.js
    claude.js        <- copiar servidor/claude-proxy.js
  package.json
```

`claude-proxy.js` importa `./sesion.js` para verificar el token, así que los
dos archivos van en la misma carpeta. Si renombrás `sesion.js`, ajustá el
`import`.

`package.json`:

```json
{
  "type": "module",
  "dependencies": { "@anthropic-ai/sdk": "^0.70.0" }
}
```

Después:

1. En Vercel → Settings → Environment Variables:
   - **`ANTHROPIC_API_KEY`** — la key del workspace del mundo.
   - **`MUNDO_SESSION_SECRET`** — una cadena larga y al azar, solo para
     firmar tokens. Generala con `openssl rand -base64 48`. Si la cambiás,
     todas las sesiones abiertas se caen (que es justo lo que querés si
     alguna vez se filtra).

   Ninguna de las dos va en el código ni en el repo.
2. Deploy. La base queda `https://<tu-proyecto>.vercel.app/api`.
3. En `mundo/oficina.html`, pegar esa base en **`CLAUDE.apiBase`**
   (sin barra final; está al principio del `<script>`, señalado con un
   comentario).
4. Si publicás la oficina en un dominio distinto a
   `rodzilla-thecreator.github.io`, agregalo a la lista `ORIGENES` de
   **los dos** archivos.

Mientras `apiBase` esté vacío, la oficina corre en **modo local**: el código
se verifica en el navegador y los agentes se dibujan **sin energía**. Las
tareas y el contexto siguen siendo reales; lo único que falta es quién los
procese. No inventa respuestas.

## Qué controla el servidor y qué no

Lo que el navegador **no** puede cambiar:

| | |
|---|---|
| Modelo | `claude-opus-5` |
| `max_tokens` | 8 000 por respuesta |
| Turnos por tarea | 40 (el cliente además se corta en 12) |
| Tamaño del payload | 120 000 caracteres |
| Origen | lista blanca `ORIGENES` |
| Quién llama | token firmado, 8 h, emitido solo tras verificar el código |

Cada respuesta deja en el log del servidor el rol y los tokens que consumió,
así que se puede sacar consumo por rol sin depender de nada del cliente.

## Lo que todavía NO resuelve

**Las reglas de Firebase siguen abiertas a lectura y escritura sin auth.**
Esto cierra el proxy, no la base. Mientras la base esté abierta, alguien
puede cambiar los hashes de `auth-config` sin pasar por ninguna puerta — y
entonces la puerta deja de servir. **Cerrar esas reglas es el trabajo que
falta, y ahora importa más que antes, no menos.**

**No hay cuota por empleado.** Los topes de arriba son por petición, no por
persona ni por día. Un tope real necesita estado compartido; hacerlo sobre
Firebase con las reglas abiertas sería un control que cualquiera puede
editar, o sea, ninguno. Cuando las reglas estén cerradas, ahí sí.

**Si algún día hay proveedor de identidad** (Google Workspace, Microsoft
Entra), conviene reemplazar la API key por **federación de identidad (WIF)**:
el servidor intercambia el token OIDC por credenciales de vida corta y deja
de haber un secreto permanente. Se arma con un *federation issuer* y una
*federation rule* apuntando a un service account del workspace del mundo —
la regla la tiene que crear una persona en la Console con token `org:admin`.
Hoy Montasa no tiene IdP formal, así que el código de Bitácora SGI
verificado en el servidor es lo correcto.
