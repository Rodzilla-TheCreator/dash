/* =====================================================================
   PROXY DE CLAUDE PARA LA OFICINA VIRTUAL
   ---------------------------------------------------------------------
   Funcion serverless (Vercel / Node 18+). Es la UNICA pieza de este
   proyecto que NO es estatica, y existe por una sola razon:

     La API key de Anthropic no puede vivir en el navegador.

   El repo `dash` es publico y se sirve por GitHub Pages. Cualquier key
   que se ponga en un .html se puede leer con "ver codigo fuente" y se
   cobra a la cuenta del dueño. Por eso la oficina virtual NUNCA habla
   directo con api.anthropic.com: le habla a esta funcion, y esta funcion
   —que corre en un servidor, con la key en una variable de entorno—
   habla con Anthropic.

   COMO DESPLEGARLA: ver el README.md de esta carpeta.
   ===================================================================== */

import Anthropic from "@anthropic-ai/sdk";

/* --- Limites duros. El navegador NO los puede subir. ------------------
   Quien llegue a esta URL puede gastar tokens de la cuenta, asi que el
   gasto por peticion queda acotado aca y no en el cliente. */
const MODELO          = "claude-opus-5";
const MAX_TOKENS       = 8000;    // techo por respuesta
const MAX_MENSAJES     = 40;      // techo de turnos en una tarea
const MAX_CARACTERES   = 120000;  // techo de payload total

/* Origenes permitidos. Agregar aca cualquier dominio nuevo donde se
   publique la oficina (ej. un dominio propio de Montasa). */
const ORIGENES = [
  "https://rodzilla-thecreator.github.io",
  "http://localhost:8899",
  "http://127.0.0.1:8899"
];

function cors(req, res){
  const origen = req.headers.origin || "";
  if(ORIGENES.includes(origen)){
    res.setHeader("Access-Control-Allow-Origin", origen);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return ORIGENES.includes(origen);
}

export default async function handler(req, res){
  const origenOk = cors(req, res);

  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST")    return res.status(405).json({ error: "Solo POST" });
  if(!origenOk)                return res.status(403).json({ error: "Origen no permitido" });

  const key = process.env.ANTHROPIC_API_KEY;
  if(!key) return res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en el servidor" });

  /* ---- validacion de la peticion ---- */
  const body = req.body || {};
  const system   = typeof body.system === "string" ? body.system : "";
  const mensajes = Array.isArray(body.messages) ? body.messages : null;

  if(!system)  return res.status(400).json({ error: "Falta 'system'" });
  if(!mensajes || !mensajes.length) return res.status(400).json({ error: "Falta 'messages'" });
  if(mensajes.length > MAX_MENSAJES)
    return res.status(400).json({ error: "Demasiados turnos (max " + MAX_MENSAJES + ")" });

  const forma = mensajes.every(m =>
    m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  if(!forma) return res.status(400).json({ error: "Cada mensaje debe ser {role:'user'|'assistant', content:string}" });

  const tamano = system.length + mensajes.reduce((a, m) => a + m.content.length, 0);
  if(tamano > MAX_CARACTERES)
    return res.status(413).json({ error: "Payload demasiado grande" });

  /* ---- streaming SSE hacia el navegador ----
     Se traduce el stream de Anthropic a un formato chiquito y propio,
     para que el cliente no tenga que entender todo el protocolo:
       {t:"pensando", x}  -> resumen del razonamiento (la parte "cooking")
       {t:"texto",    x}  -> el texto de la respuesta
       {t:"fin", stop, usage}
       {t:"error", msg}                                                */
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const enviar = (obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");

  try{
    const client = new Anthropic({ apiKey: key });
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: MAX_TOKENS,
      /* Pensamiento adaptativo con resumen visible: es lo que el
         empleado ve "cocinando" en la pantalla del agente. */
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort: "medium" },
      system,
      messages: mensajes
    });

    for await (const ev of stream){
      if(ev.type === "content_block_delta"){
        if(ev.delta.type === "thinking_delta") enviar({ t:"pensando", x: ev.delta.thinking });
        else if(ev.delta.type === "text_delta") enviar({ t:"texto", x: ev.delta.text });
      }
    }
    const final = await stream.finalMessage();
    enviar({ t:"fin", stop: final.stop_reason, usage: final.usage });
  }catch(e){
    console.error("[claude-proxy]", e);
    enviar({ t:"error", msg: (e && e.message) ? e.message : "error desconocido" });
  }finally{
    res.end();
  }
}
