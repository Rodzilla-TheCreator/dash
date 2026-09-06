/* =====================================================================
   SESIÓN DE LA OFICINA VIRTUAL
   ---------------------------------------------------------------------
   Verifica el código del empleado DEL LADO DEL SERVIDOR y devuelve un
   token firmado y de vida corta.

   Por qué existe: la oficina validaba el código en el navegador. Eso está
   bien para decidir qué pantalla mostrar, pero el servidor no puede
   confiar en una validación que ocurrió en la máquina de quien llama —
   cualquiera podía saltarse la pantalla y pegarle directo al proxy. Acá
   la comparación ocurre en un lugar que el cliente no controla, y el
   resultado es un token que el proxy sí puede verificar.

   NO reemplaza cerrar las reglas de Firebase: mientras la base esté
   abierta a escritura, alguien puede cambiar los hashes de auth-config
   sin pasar por ninguna puerta. Esto cierra el proxy, no la base.
   ===================================================================== */

import crypto from "node:crypto";

const DB_BASE   = "https://montasa-app-default-rtdb.firebaseio.com";
const VIDA_SEG  = 8 * 3600;         // 8 horas: una jornada
const ORIGENES  = [
  "https://rodzilla-thecreator.github.io",
  "http://localhost:8899",
  "http://127.0.0.1:8899"
];
/* Los mismos 11 roles de la app de Bitácora SGI. */
const ROLES = {
  gerente_general:"Gerente General", gerente_comercial:"Gerente Comercial", rrhh:"RRHH",
  almacen_sps:"Almacén SPS", almacen_choloma:"Almacén Choloma",
  ventas1:"Ventas 1", ventas2:"Ventas 2", ventas3:"Ventas 3", ventas4:"Ventas 4",
  contabilidad:"Contabilidad", admin:"SGI y Mercadeo Administrador"
};

/* --- JWT HS256 a mano: no hace falta una dependencia para 30 líneas --- */
const b64u = (buf) => Buffer.from(buf).toString("base64url");
export function firmar(payload, secreto, vidaSeg){
  const ahora = Math.floor(Date.now()/1000);
  const cuerpo = Object.assign({}, payload, { iat: ahora, exp: ahora + vidaSeg });
  const head = b64u(JSON.stringify({ alg:"HS256", typ:"JWT" }));
  const body = b64u(JSON.stringify(cuerpo));
  const firma = crypto.createHmac("sha256", secreto).update(head + "." + body).digest("base64url");
  return head + "." + body + "." + firma;
}
export function verificar(token, secreto){
  if(typeof token !== "string") return null;
  const p = token.split(".");
  if(p.length !== 3) return null;
  const esperada = crypto.createHmac("sha256", secreto).update(p[0] + "." + p[1]).digest("base64url");
  /* comparación en tiempo constante: un `===` filtra información por el tiempo que tarda */
  const a = Buffer.from(p[2]), b = Buffer.from(esperada);
  if(a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try{ payload = JSON.parse(Buffer.from(p[1], "base64url").toString("utf8")); }catch(e){ return null; }
  if(!payload || typeof payload.exp !== "number") return null;
  if(payload.exp < Math.floor(Date.now()/1000)) return null;
  return payload;
}

function cors(req, res){
  const o = req.headers.origin || "";
  if(ORIGENES.includes(o)){ res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary","Origin"); }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return ORIGENES.includes(o);
}
const sha256hex = (t) => crypto.createHash("sha256").update(t, "utf8").digest("hex");

export default async function handler(req, res){
  const origenOk = cors(req, res);
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST")    return res.status(405).json({ error:"Solo POST" });
  if(!origenOk)                return res.status(403).json({ error:"Origen no permitido" });

  const secreto = process.env.MUNDO_SESSION_SECRET;
  if(!secreto) return res.status(500).json({ error:"Falta MUNDO_SESSION_SECRET en el servidor" });

  const rol    = req.body && req.body.rol;
  const codigo = req.body && req.body.codigo;
  if(!ROLES[rol])                        return res.status(400).json({ error:"Rol desconocido" });
  if(typeof codigo !== "string" || !codigo) return res.status(400).json({ error:"Falta el código" });

  let cfg;
  try{
    const r = await fetch(DB_BASE + "/bitacora/auth-config.json", { cache:"no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    cfg = await r.json();
  }catch(e){
    return res.status(502).json({ error:"No se pudo leer auth-config: " + e.message });
  }

  const guardado = cfg && cfg.roles && cfg.roles[rol] && cfg.roles[rol].code;
  if(!guardado)
    return res.status(403).json({ error:"Ese rol todavía no tiene código. Se crea en la app de Bitácora SGI." });

  /* Comparación en tiempo constante, igual que la firma. */
  const a = Buffer.from(sha256hex(codigo)), b = Buffer.from(String(guardado));
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  /* Freno parejo para todas las respuestas fallidas: no acelera adivinar. */
  if(!ok){
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error:"Código incorrecto" });
  }

  const token = firmar({ rol, label: ROLES[rol] }, secreto, VIDA_SEG);
  console.log("[sesion] entró", rol);
  return res.status(200).json({ token, rol, label: ROLES[rol], expira_en: VIDA_SEG });
}
