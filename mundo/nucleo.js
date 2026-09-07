/* =====================================================================
   NÚCLEO DEL MUNDO MONTASA
   ---------------------------------------------------------------------
   Reglas, datos y estado. NO dibuja nada y no toca el DOM.

   Existe porque el mundo va a tener tres vistas —escritorio, celular y modo
   sobrio— y tres vistas que copian la lógica son tres versiones del mismo
   bug. Acá vive la verdad; las vistas la miran.

   Cómo hablan el núcleo y una vista:
       Mundo.on("tareas", fn)     el núcleo avisa, la vista dibuja
       Mundo.emit(...)            solo lo usa el núcleo
   El núcleo NUNCA llama a una función de la vista. Si necesita que algo se
   vea, emite. Esa es la regla que hace que valga la pena haberlo separado.

   Se carga con <script src="nucleo.js"> antes del script de la vista.
   Sigue sin build y sin bundler: es un archivo estático más.
   ===================================================================== */

/* ---------- avisos del núcleo a la vista ---------- */
const _oyentes = {};
const Mundo = {
  on(ev, fn){ (_oyentes[ev] = _oyentes[ev] || []).push(fn); return Mundo; },
  emit(ev, dato){
    (_oyentes[ev] || []).forEach(function(fn){
      try{ fn(dato); }catch(e){ console.error("[nucleo] oyente de " + ev + ":", e); }
    });
  }
};
/* atajos que se usan a cada rato */
function avisar(txt){ Mundo.emit("aviso", txt); }


/* =====================================================================
   1. CONFIGURACIÓN DEL SERVIDOR
   ---------------------------------------------------------------------
   >>> PEGAR ACÁ LA BASE DE LA API DESPLEGADA <<<
   Una sola URL, sin barra final. De ahí salen dos endpoints:
       {apiBase}/sesion   verifica el código contra la base y emite token
       {apiBase}/claude   habla con Anthropic (exige ese token)
   Ver mundo/servidor/README.md.

   La API key NO va acá ni en ningún archivo de este repo: el repo es
   público y una key en un .html es una key regalada. Vive en el servidor.

   Mientras esto quede vacío, la oficina funciona en MODO LOCAL: el código
   se verifica en el navegador (alcanza para elegir qué pantalla mostrar,
   no para confiar en nadie) y los agentes se dibujan SIN ENERGÍA. No se
   inventa ninguna respuesta.
   ===================================================================== */
const CLAUDE = {
  apiBase:  "",                    // ej: "https://montasa-web.vercel.app/api"
  modelo:   "claude-opus-5",       // informativo: el modelo real lo fija el servidor
  maxTurnos: 12                    // techo de idas y vueltas por tarea
};
function motorListo(){ return !!CLAUDE.apiBase; }
function urlSesion(){ return CLAUDE.apiBase + "/sesion"; }
function urlClaude(){ return CLAUDE.apiBase + "/claude"; }

/* =====================================================================
   2. CAPA DE DATOS
   ---------------------------------------------------------------------
   COPIA de ../index.html (el dash) y de index.html (el mundo). Cada página
   de este repo es autocontenida —sin build, sin bundler— así que la única
   forma de reusar las reglas es duplicarlas. SI CAMBIAN ALLÁ, CAMBIAN ACÁ.
   Los ROLES y PERMISSIONS son copia de bitacora/index.html.
   ===================================================================== */
const DB_BASE = "https://montasa-app-default-rtdb.firebaseio.com";
const CC_FB   = DB_BASE + "/bitacora";
async function getJSON(path){
  const r = await fetch(DB_BASE + "/" + path + ".json?_=" + Date.now(), { cache:"no-store" });
  if(!r.ok) throw new Error("HTTP " + r.status + " en " + path);
  return await r.json();
}
async function getBit(key){
  const r = await fetch(CC_FB + "/" + key + ".json?_=" + Date.now(), { cache:"no-store" });
  if(!r.ok) throw new Error("HTTP " + r.status);
  return await r.json();
}
const NODO_EMPRESA = { montasa:"montasa", monhaco:"monhaco", monhagro:null };
const CC_SEDES     = { montasa:["SPS"], monhaco:["Choloma"], monhagro:[] };

function bucketEstado(estadoRaw){
  const e = (estadoRaw||"").toString().trim().toUpperCase();
  if(e === "DISPONIBLE") return "disp";
  if(e === "EN RENTA")   return "renta";
  if(e === "MAL ESTADO") return "mant";
  return "uso";
}
const INTERVALO_DIAS = 90, INTERVALO_HORAS = 250, UMBRAL_AMARILLO = 0.75;
const CAMPOS_HOROMETRO_ACT        = ["horometro","horometroActual","horas","horometer","hrs"];
const CAMPOS_ULT_FECHA_EQUIPO     = ["ultimoMant","fechaUltimoMant","ultimoMantenimiento"];
const CAMPOS_ULT_HOROMETRO_EQUIPO = ["horometroUltimoMant","horometroMant","hrsUltimoMant"];
const NODOS_MANT           = ["preventivos","correctivos"];
const CAMPOS_MANT_EQUIPOID = ["equipoId","equipoID","idEquipo"];
const CAMPOS_FECHA         = ["fechaCompletado","fecha","fechaFin"];
const CAMPOS_HOROMETRO_SNAP= ["horometro"];
const CAMPOS_CLIENTE       = ["cliente","clienteNombre","clienteId","razonSocial","empresa"];

function primerCampo(obj, posibles){
  for(const k of posibles){ if(obj && obj[k] != null && obj[k] !== "") return obj[k]; }
  return null;
}
function aFecha(v){
  if(v == null) return null;
  if(typeof v === "number") return new Date(v);
  const d = new Date(v); return isNaN(d) ? null : d;
}
function aNumero(v){
  if(v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g,""));
  return isNaN(n) ? null : n;
}
function diasDesde(f){ return (Date.now() - f.getTime()) / 86400000; }
function fmtL(m){
  const n = aNumero(m);
  return n == null ? (m==null?"—":String(m))
    : "L " + n.toLocaleString("es-HN",{minimumFractionDigits:2,maximumFractionDigits:2});
}
function evaluarEquipo(eq, ultimoDeHistorial){
  const codigo = eq.codigo || eq.id || "?";
  const horoAct = aNumero(primerCampo(eq, CAMPOS_HOROMETRO_ACT));
  const fechaUlt = aFecha(primerCampo(eq, CAMPOS_ULT_FECHA_EQUIPO)) ||
                   (ultimoDeHistorial ? ultimoDeHistorial.fecha : null);
  const horoUlt  = aNumero(primerCampo(eq, CAMPOS_ULT_HOROMETRO_EQUIPO)) ??
                   (ultimoDeHistorial ? ultimoDeHistorial.horometro : null);
  let rT=null, etqT=null;
  if(fechaUlt){
    const d = diasDesde(fechaUlt);
    rT = d / INTERVALO_DIAS;
    etqT = (d >= INTERVALO_DIAS) ? ("+"+Math.round(d-INTERVALO_DIAS)+"d") : (Math.round(d)+"d");
  }
  let rH=null, etqH=null;
  if(horoAct != null && horoUlt != null){
    const h = horoAct - horoUlt;
    rH = h / INTERVALO_HORAS;
    etqH = (h >= INTERVALO_HORAS) ? ("+"+Math.round(h-INTERVALO_HORAS)+"h") : (Math.round(h)+"h");
  }
  let urgencia=null, etiqueta="sin datos";
  if(rT != null || rH != null){
    if(rT == null){ urgencia=rH; etiqueta=etqH; }
    else if(rH == null){ urgencia=rT; etiqueta=etqT; }
    else if(rH >= rT){ urgencia=rH; etiqueta=etqH; }
    else { urgencia=rT; etiqueta=etqT; }
  }
  let color = "nodata";
  if(urgencia != null) color = urgencia >= 1 ? "crit" : (urgencia >= UMBRAL_AMARILLO ? "warn" : "ok");
  return { codigo, urgencia, color, etiqueta };
}

/* --- roles y permisos: COPIA de bitacora/index.html --- */
const ROLES = [
  {id:'gerente_general',   label:'Gerente General',   dot:'#4f8fe0'},
  {id:'gerente_comercial', label:'Gerente Comercial', dot:'#3ecf7e'},
  {id:'rrhh',              label:'RRHH',              dot:'#f5a524'},
  {id:'almacen_sps',       label:'Almacén SPS',       dot:'#5DBBE8'},
  {id:'almacen_choloma',   label:'Almacén Choloma',   dot:'#3FAEDB'},
  {id:'ventas1',           label:'Ventas 1',          dot:'#C77DD1'},
  {id:'ventas2',           label:'Ventas 2',          dot:'#C77DD1'},
  {id:'ventas3',           label:'Ventas 3',          dot:'#C77DD1'},
  {id:'ventas4',           label:'Ventas 4',          dot:'#C77DD1'},
  {id:'contabilidad',      label:'Contabilidad',      dot:'#a78bfa'},
  {id:'admin',             label:'SGI y Mercadeo Administrador', dot:'#a3e635'}
];
const PERMISSIONS = {
  admin:             { modules:'all', readOnly:false },
  gerente_general:   { modules:'all', readOnly:true  },
  gerente_comercial: { modules:'all', readOnly:true  },
  rrhh:              { modules:'all', readOnly:true  },
  almacen_sps:       { modules:['mi_panel','cajachica','viajes','almacen'], readOnly:false, sede:'SPS' },
  almacen_choloma:   { modules:['mi_panel','cajachica','viajes','almacen'], readOnly:false, sede:'Choloma' },
  ventas1:{ modules:['mi_panel','viajes'], readOnly:false, ownOnly:true },
  ventas2:{ modules:['mi_panel','viajes'], readOnly:false, ownOnly:true },
  ventas3:{ modules:['mi_panel','viajes'], readOnly:false, ownOnly:true },
  ventas4:{ modules:['mi_panel','viajes'], readOnly:false, ownOnly:true },
  contabilidad:      { modules:['cajachica','viajes'], readOnly:false }
};
function permisos(){ return PERMISSIONS[sesion && sesion.rolId] || { modules:[], readOnly:true }; }
function puedeModulo(m){ const p = permisos(); return p.modules === 'all' || p.modules.indexOf(m) >= 0; }
function soloLectura(){ return !!permisos().readOnly; }

/* ===================== ESTADO GLOBAL ===================== */
let sesion = null;           // { rolId, label, empresa }
const state = {
  equipos:{}, preventivos:{}, correctivos:{},
  caja:null, viajes:null, almacen:null,
  flotaErr:null, bitErr:null, cargando:false
};
let tareas = [];             // tareas vivas (generadas de los datos)
let resueltas = 0;
/* El proceso REAL del empleado, levantado con su propio Claude usando
   mundo/procesos/ENTREVISTA.md y guardado en /bitacora/mundo-procesos/{rol}.
   null = todavía no lo cargó; los agentes trabajan con lo que supusimos. */
let proceso = null;

async function hashCode(t){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function empresaDeRol(id){
  const p = PERMISSIONS[id] || {};
  if(p.sede === "Choloma") return "monhaco";
  return "montasa";
}

/* =====================================================================
   LOS AGENTES
   ---------------------------------------------------------------------
   Acá va lo que define QUÉ es cada agente: su oficio, qué módulo necesita
   el rol para verlo, y qué datos alcanza. Dónde se para en la sala es cosa
   de la vista — el celular no tiene sala y no debería cargar con eso.
   ===================================================================== */
const AGENTES = [
  { id:"mant",   nombre:"ORACLE-MT", oficio:"Mantenimiento",           col:"#e5534b", modulo:"all",
    alcance:"equipos, preventivos y correctivos: urgencias, vencidos y huecos de datos" },
  { id:"caja",   nombre:"CONTA-01",  oficio:"Caja chica y viáticos",   col:"#f5a524", modulo:"cajachica",
    alcance:"data-cajachica y data-viajes: el flujo de 4 estados, montos y responsables" },
  { id:"bodega", nombre:"STOCK-9",   oficio:"Bodega",                  col:"#a9741f", modulo:"almacen",
    alcance:"data-almacen: entradas, salidas y existencia neta por producto y sede" },
  { id:"flota",  nombre:"RENTA-3",   oficio:"Flota y rentas",          col:"#3ecf7e", modulo:"all",
    alcance:"equipos por estado: disponibles, en renta, en taller y en cliente" },
  { id:"radar",  nombre:"RADAR-X",   oficio:"Ventas y KPIs",           col:"#4f8fe0", modulo:"all",
    alcance:"lo que el mundo ya leyó de la operación; RADAR se consulta desde el dash" },
  { id:"mejoras",nombre:"FORJA-1",   oficio:"Departamento de Mejoras", col:"#c9c6bd", modulo:"all",
    alcance:"los pedidos de todas las oficinas sobre cómo funciona el mundo, y el estado del mundo mismo" }
];
const AG = {}; AGENTES.forEach(a => AG[a.id] = a);
const estadoAgente = {};
AGENTES.forEach(a => estadoAgente[a.id] = "libre");
function agentesVisibles(){
  return AGENTES.filter(a => a.modulo === "all" || puedeModulo(a.modulo));
}

/* =====================================================================
   CARGA DE DATOS
   ===================================================================== */
/* =====================================================================
   EL REGISTRO
   ---------------------------------------------------------------------
   Un renglón por cada cosa que pasa, y NUNCA se reescribe: se anexa.

   Es una sola pieza y resuelve cuatro cosas que parecían distintas:

     · CONCURRENCIA. Antes cada escritura traía la lista entera, cambiaba un
       renglón y la volvía a escribir. Dos personas guardando a la vez se
       pisaban sin enterarse. Anexando, no hay nada que pisar.
     · MEMORIA. Lo que el asistente recuerda sale de acá, no de un resumen
       inventado: son las decisiones que de verdad se tomaron, con fecha.
     · MEDICIÓN. Cuántas decisiones se tomaron en el mundo, cuántas tareas
       se abandonaron. Del sistema, nunca de las personas (decisión 4).
     · COSTO. Cada llamada anota los tokens que gastó.

   El POST de Firebase genera la llave: es la primitiva de "anexar" sin
   leer-modificar-escribir.
   ===================================================================== */
const NODO_REGISTRO  = "mundo-registro";

async function registrar(tipo, datos){
  if(!sesion) return null;
  /* Los campos reservados van AL FINAL: si no, un `tipo` dentro de `datos`
     pisa el tipo del renglón y el registro queda mintiendo sobre sí mismo. */
  const fila = Object.assign({}, datos || {}, {
    t: Date.now(), tipo: tipo,
    rol: sesion.rolId, persona: sesion.label, empresa: sesion.empresa
  });
  try{
    const r = await fetch(CC_FB + "/" + NODO_REGISTRO + ".json", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(fila), keepalive: true });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return j && j.name;
  }catch(e){
    /* Que falle el registro no puede voltear la acción que lo generó: si el
       gasto se aprobó, se aprobó. Se avisa por consola y sigue. */
    console.warn("[nucleo] no se pudo registrar", tipo + ":", e.message);
    return null;
  }
}

/* Los últimos N renglones. Las llaves de Firebase salen en orden
   cronológico, así que limitToLast son "los más recientes". */
async function leerRegistro(cuantos){
  try{
    const r = await fetch(CC_FB + "/" + NODO_REGISTRO + ".json?orderBy=%22%24key%22&limitToLast=" +
                          (cuantos || 200) + "&_=" + Date.now(), { cache:"no-store" });
    if(!r.ok) throw new Error("HTTP " + r.status);
    const o = await r.json();
    if(!o || typeof o !== "object") return [];
    return Object.keys(o).map(k => Object.assign({ _k:k }, o[k]))
                         .sort((a,b) => (a.t||0) - (b.t||0));
  }catch(e){ console.warn("[nucleo] registro:", e.message); return []; }
}

/* ---------- helpers de "anexar" para nodos que son nuestros ---------- */
/* Los nodos del mundo dejan de ser arreglos y pasan a ser objetos con llave.
   Se sigue leyendo un arreglo viejo si quedó alguno, para no perder nada. */
function comoLista(o){
  if(Array.isArray(o)) return o.filter(Boolean).map((x,i) => Object.assign({ _k:String(i) }, x));
  if(o && typeof o === "object") return Object.keys(o).map(k => Object.assign({ _k:k }, o[k]));
  return [];
}
async function anexar(nodo, obj){
  const r = await fetch(CC_FB + "/" + nodo + ".json", {
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(obj) });
  if(!r.ok) throw new Error("no se pudo guardar (HTTP " + r.status + ")");
  const j = await r.json();
  return j && j.name;
}
async function parchar(nodo, llave, campos){
  const r = await fetch(CC_FB + "/" + nodo + "/" + llave + ".json", {
    method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify(campos) });
  if(!r.ok) throw new Error("no se pudo guardar (HTTP " + r.status + ")");
  return true;
}

const NODO_PROCESOS  = "mundo-procesos";
const NODO_MEJORAS   = "mundo-mejoras";
const NODO_PRESENCIA = "mundo-presencia";
const NODO_ENCARGOS  = "mundo-encargos";

/* --- PRESENCIA ------------------------------------------------------------
   Las oficinas son cerradas: no se ve adentro. Lo que sí se ve es la puerta,
   y la puerta dice dos cosas ciertas: si la persona está, y cuánto tiene
   entre manos. El latido se manda cada 20 s mientras la pestaña está abierta;
   a los 90 s sin latir, la puerta dice que no está. */
const LATIDO_MS   = 20000;
const VIVO_MS     = 90000;
let presencia = {};
async function latir(salgo){
  if(!sesion) return;
  const cocinando = Object.keys(estadoAgente).filter(k => estadoAgente[k] === "cocinando").length;
  const abiertas  = tareas.filter(t => ["cocinando","espera"].indexOf(t.estado) >= 0).length;
  const reg = {
    rol: sesion.rolId, persona: sesion.label,
    visto: salgo ? 0 : Date.now(),
    trabajando: salgo ? 0 : abiertas,
    cocinando: salgo ? 0 : cocinando
  };
  try{
    await fetch(CC_FB + "/" + NODO_PRESENCIA + "/" + sesion.rolId + ".json", {
      method:"PUT", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(reg), keepalive: true });
  }catch(e){ /* el latido no es crítico: si falla, la puerta dice que no está */ }
}
async function cargarPresencia(){
  try{
    const r = await getBit(NODO_PRESENCIA);
    presencia = (r && typeof r === "object") ? r : {};
  }catch(e){ presencia = {}; }
}
function estaEn(rolId){
  const p = presencia[rolId];
  return !!(p && p.visto && (Date.now() - p.visto) < VIVO_MS);
}
function haceCuanto(rolId){
  const p = presencia[rolId];
  if(!p || !p.visto) return "nunca entró";
  const m = Math.round((Date.now() - p.visto) / 60000);
  if(m < 1) return "recién";
  if(m < 60) return "hace " + m + " min";
  const h = Math.round(m/60);
  return h < 24 ? ("hace " + h + " h") : ("hace " + Math.round(h/24) + " d");
}

/* --- ENCARGOS entre oficinas ---------------------------------------------
   Un encargo NO se le manda directo al otro: pasa por el Centro de
   Distribución, que lo traduce al entorno de quien lo recibe usando SU
   proceso y SU vocabulario. Sin esa traducción, lo que llega es la jerga de
   otro departamento y termina archivado sin que nadie lo entienda. */
let encargos = [];
async function cargarEncargos(){
  try{
    encargos = comoLista(await getBit(NODO_ENCARGOS));
  }catch(e){ encargos = []; }
}
function encargosParaMi(){
  return encargos.filter(e => e.para_rol === sesion.rolId &&
    ["Entregado","Aceptado"].indexOf(e.estado) >= 0);
}
function encargosMios(){
  return encargos.filter(e => e.de_rol === sesion.rolId &&
    ["Hecho","Rechazado"].indexOf(e.estado) < 0);
}
/* Mismo flujo de estados que caja chica: la empresa ya lo tiene en la cabeza,
   no hace falta enseñarle uno nuevo. */
const EST_MEJORA = ["Nueva","En análisis","Aceptada","Hecha","Descartada"];
const TIPO_MEJORA = {
  falla:      "Algo está mal / no funciona",
  idea:       "Se me ocurre algo",
  "dato-malo":"El mundo muestra un dato equivocado",
  permiso:    "Necesito que mi agente pueda hacer algo más"
};
let mejoras = [];
async function cargarMejoras(){
  try{
    mejoras = comoLista(await getBit(NODO_MEJORAS));
  }catch(e){ console.warn("[Oficina] mejoras:", e.message); mejoras = []; }
}
function misMejoras(){ return mejoras.filter(m => m.rol === sesion.rolId); }
/* Triar (mover de estado) es del administrador del SGI: es quien mantiene el
   mundo. El resto pide; no decide sobre los pedidos de los demás. */
function puedeTriar(){ return sesion && sesion.rolId === "admin"; }
async function cargarProceso(){
  try{
    const r = await getBit(NODO_PROCESOS + "/" + sesion.rolId);
    proceso = (r && typeof r === "object" && Array.isArray(r.procesos)) ? r : null;
  }catch(e){ console.warn("[Oficina] proceso:", e.message); proceso = null; }
}

async function cargarTodo(){
  if(state.cargando) return;
  state.cargando = true;
  const nodo = NODO_EMPRESA[sesion.empresa];
  try{
    if(nodo){
      const [eq, pv, cr] = await Promise.all([
        getJSON(nodo + "/equipos"),
        getJSON(nodo + "/preventivos").catch(()=>({})),
        getJSON(nodo + "/correctivos").catch(()=>({}))
      ]);
      state.equipos = eq || {}; state.preventivos = pv || {}; state.correctivos = cr || {};
      state.flotaErr = null;
    }else{
      state.equipos = {}; state.preventivos = {}; state.correctivos = {};
      state.flotaErr = "esta empresa no tiene nodo de flota";
    }
  }catch(e){ console.error("[Oficina] flota:", e); state.flotaErr = e.message; }

  try{
    const [cj, vj, al] = await Promise.all([
      getBit("data-cajachica"), getBit("data-viajes"), getBit("data-almacen")
    ]);
    state.caja    = Array.isArray(cj) ? cj : [];
    state.viajes  = Array.isArray(vj) ? vj : [];
    state.almacen = Array.isArray(al) ? al : [];
    state.bitErr  = null;
  }catch(e){ console.error("[Oficina] bitacora:", e); state.bitErr = e.message; }
  await cargarProceso();
  await cargarMejoras();
  await cargarPresencia();
  await cargarEncargos();
  await cargarMemoria();
  state.cargando = false;
}

/* --- resúmenes que alimentan tanto las tareas como el contexto de Claude --- */
function resumenFlota(){
  const ultimo = {};
  NODOS_MANT.forEach(function(n){
    const regs = state[n]; if(!regs) return;
    Object.values(regs).forEach(function(r){
      if(r.completado === false) return;
      const id = primerCampo(r, CAMPOS_MANT_EQUIPOID);
      const f  = aFecha(primerCampo(r, CAMPOS_FECHA));
      if(!id || !f) return;
      const snap = aNumero(primerCampo(r, CAMPOS_HOROMETRO_SNAP));
      if(!ultimo[id] || f > ultimo[id].fecha) ultimo[id] = { fecha:f, horometro:snap };
    });
  });
  const filas = Object.values(state.equipos || {}).map(function(eq){
    const ev = evaluarEquipo(eq, ultimo[eq.id] || null);
    return { eq, ev, bucket: bucketEstado(eq.estado), cliente: primerCampo(eq, CAMPOS_CLIENTE) };
  });
  return {
    filas,
    total: filas.length,
    crit:   filas.filter(f=>f.ev.color==="crit").sort((a,b)=>b.ev.urgencia-a.ev.urgencia),
    warn:   filas.filter(f=>f.ev.color==="warn").sort((a,b)=>b.ev.urgencia-a.ev.urgencia),
    nodata: filas.filter(f=>f.ev.color==="nodata"),
    disp:   filas.filter(f=>f.bucket==="disp"),
    renta:  filas.filter(f=>f.bucket==="renta"),
    taller: filas.filter(f=>f.bucket==="mant"),
    otros:  filas.filter(f=>f.bucket==="uso")
  };
}
function misSedes(){
  const p = permisos();
  if(p.sede) return [p.sede];
  return CC_SEDES[sesion.empresa] || [];
}
function resumenCaja(){
  const sedes = misSedes();
  const todos = (state.caja || []).filter(r => !sedes.length || sedes.indexOf(r.sede) >= 0);
  const por = e => todos.filter(r => String(r.estado||"").trim() === e);
  return { todos, sedes,
    revision: por("Enviado a revisión"),
    pendiente: por("Pendiente de liquidar"),
    aprobado: por("Aprobado por Gerencia"),
    rechazado: por("Rechazado"),
    liquidado: por("Liquidado") };
}
function resumenViajes(){
  const v = state.viajes || [];
  return { todos:v, revision: v.filter(r => String(r.estado||"").trim() === "Enviado a revisión") };
}
function resumenBodega(){
  const sedes = misSedes();
  const arr = (state.almacen || []).filter(r => !sedes.length || sedes.indexOf(r.sede || "General") >= 0);
  const m = new Map();
  arr.forEach(function(r){
    const k = (r.sede||"General") + " · " + String(r.producto||"—").trim();
    if(!m.has(k)) m.set(k, { clave:k, sede:r.sede||"General", producto:String(r.producto||"—").trim(),
                             neto:0, unidad:r.unidad||"", movs:0 });
    const p = m.get(k), q = aNumero(r.cantidad) || 0;
    p.neto += (String(r.tipo||"").trim().toLowerCase() === "entrada") ? q : -q;
    p.movs++;
  });
  const prods = [...m.values()];
  return { prods, negativos: prods.filter(p => p.neto < 0), enCero: prods.filter(p => p.neto === 0) };
}

/* =====================================================================
   6b. EL PROCESO DEL EMPLEADO
   ---------------------------------------------------------------------
   Se valida antes de guardar. Un bloque a medias es peor que ninguno: los
   agentes lo tomarían como verdad. Si algo falta, se dice qué falta y no
   se guarda nada.
   ===================================================================== */
const DONDE_OK = ["bitacora","firebase","sap","excel","whatsapp","correo","papel",
                  "app-montacargas","radar","cabeza","otro"];

function extraerBloque(txt){
  /* la gente pega el markdown entero: se busca el bloque ```json */
  const t = (txt || "").trim();
  let crudo = t;
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(f) crudo = f[1].trim();
  else{
    const a = crudo.indexOf("{"), b = crudo.lastIndexOf("}");
    if(a >= 0 && b > a) crudo = crudo.slice(a, b+1);
  }
  return crudo;
}
function validarProceso(txt){
  const fallas = [];
  let o;
  try{ o = JSON.parse(extraerBloque(txt)); }
  catch(e){ return { fallas:["No es JSON válido: " + e.message +
    ". Pegá el bloque completo, desde la primera llave hasta la última."] }; }

  if(!o || typeof o !== "object") return { fallas:["El bloque no es un objeto."] };
  if(!ROLES.some(r => r.id === o.rol))
    fallas.push("El campo \"rol\" no es uno de los 11 roles (llegó: " + JSON.stringify(o.rol) + ").");
  if(o.rol && o.rol !== sesion.rolId)
    fallas.push("Ese proceso es del rol \"" + o.rol + "\" y vos entraste como \"" +
                sesion.rolId + "\". Cada quien carga el suyo.");
  if(!Array.isArray(o.procesos) || !o.procesos.length)
    fallas.push("No trae ningún proceso en \"procesos\".");
  else o.procesos.forEach(function(pr, i){
    const d = "proceso " + (i+1) + (pr && pr.nombre ? (" (" + pr.nombre + ")") : "");
    if(!pr || typeof pr !== "object") return fallas.push(d + ": no es un objeto.");
    if(!pr.id)     fallas.push(d + ": le falta \"id\".");
    if(!pr.nombre) fallas.push(d + ": le falta \"nombre\".");
    if(!Array.isArray(pr.pasos) || !pr.pasos.length) fallas.push(d + ": no tiene pasos.");
    else pr.pasos.forEach(function(ps, k){
      if(!ps || !ps.hace) fallas.push(d + ", paso " + (k+1) + ": le falta \"hace\".");
      else if(ps.donde && DONDE_OK.indexOf(ps.donde) < 0)
        fallas.push(d + ", paso " + (k+1) + ": \"donde\" dice \"" + ps.donde +
                    "\" y tiene que ser uno de: " + DONDE_OK.join(", ") + ".");
    });
  });
  if(fallas.length) return { fallas };

  /* Avisos: no impiden guardar, pero se dicen. */
  const avisos = [];
  if(!Array.isArray(o.nunca_automatizar) || !o.nunca_automatizar.length)
    avisos.push("No dice qué NO se debe automatizar. Sin eso, los agentes no " +
                "tienen ninguna prohibición explícita tuya.");
  if(!Array.isArray(o.huecos) || !o.huecos.length)
    avisos.push("No quedó ningún hueco anotado. Suele significar que algo quedó " +
                "a medias y no se escribió.");
  return { ok:o, avisos };
}

/* =====================================================================
   MEMORIA
   ---------------------------------------------------------------------
   Sale del registro, no de un resumen inventado: son las decisiones que de
   verdad se tomaron, con su fecha. Es del ROL, no de la persona, y son
   decisiones de trabajo — nunca conversaciones.
   ===================================================================== */
let memoria = [];
async function cargarMemoria(){
  if(!sesion) return;
  const todo = await leerRegistro(300);
  memoria = todo.filter(r => !r.olvidado && r.rol === sesion.rolId &&
                             ["decision","encargo","mejora"].indexOf(r.tipo) >= 0)
                .slice(-40).reverse();
}
function memoriaParaAgente(){
  const d = memoria.filter(r => r.tipo === "decision").slice(0, 12);
  if(!d.length) return null;
  const L = ["LO QUE YA SE DECIDIÓ ANTES EN ESTE PUESTO (de más nuevo a más viejo).",
             "Sirve para ser consistente, no para repetir a ciegas: cada renglón tiene su",
             "fecha, y lo que era cierto hace meses puede no serlo hoy."];
  d.forEach(function(r){
    const f = new Date(r.t).toISOString().slice(0,10);
    L.push("· " + f + " · " + (r.concepto || r.id) +
           (r.monto != null ? (" · L " + r.monto) : "") +
           " → " + (r.estado || r.a) + (r.motivo ? (" · " + r.motivo) : ""));
  });
  return L.join("\n");
}
/* Borrarla es de la persona y no le pide permiso a nadie: quedan marcados los
   renglones como olvidados, y el registro conserva que se olvidaron. */
async function olvidarMemoria(){
  const míos = memoria.slice();
  for(const r of míos){
    try{ await parchar(NODO_REGISTRO, r._k, { olvidado:true }); }catch(e){}
  }
  await registrar("olvido", { cuantos: míos.length });
  memoria = [];
}

/* Lo que ve el agente. Texto plano: es parte de su instrucción. */
function procesoParaAgente(){
  if(!proceso) return null;
  const L = [];
  L.push("PROCESO REAL DE " + (proceso.persona || sesion.label).toUpperCase() +
         " (lo contó esta persona en una entrevista; actualizado " +
         (proceso.actualizado || "sin fecha") + "):");
  if(proceso.resumen) L.push(proceso.resumen);
  proceso.procesos.forEach(function(pr){
    L.push("");
    L.push("· " + pr.nombre + " [" + (pr.frecuencia || "sin frecuencia") + "]" +
           (pr.disparador ? (" — arranca: " + pr.disparador) : ""));
    (pr.pasos||[]).forEach(function(ps){
      L.push("   " + (ps.n || "-") + ". " + ps.hace +
        (ps.donde ? ("  [" + ps.donde + (ps.dato ? "/" + ps.dato : "") + "]") : "") +
        (ps.depende_de ? ("  depende de: " + ps.depende_de) : "") +
        (ps.duele ? ("  DUELE: " + ps.duele) : ""));
    });
    if(pr.termina_cuando) L.push("   termina cuando: " + pr.termina_cuando);
    if((pr.se_traba_por||[]).length) L.push("   se traba por: " + pr.se_traba_por.join(" · "));
    if((pr.le_pediria_a_un_asistente||[]).length)
      L.push("   te pediría: " + pr.le_pediria_a_un_asistente.join(" · "));
  });
  if((proceso.vocabulario||[]).length){
    L.push("");
    L.push("CÓMO HABLAN ACÁ: " + proceso.vocabulario
      .map(v => "\"" + v.dice + "\" = " + v.significa).join(" · "));
  }
  if((proceso.huecos||[]).length){
    L.push("");
    L.push("HUECOS QUE ESTA PERSONA NO SUPO CONTESTAR (no los rellenes vos):");
    proceso.huecos.forEach(h => L.push("- " + h));
  }
  return L.join("\n");
}

/* =====================================================================
   7. GENERADOR DE TAREAS
   ---------------------------------------------------------------------
   Las tareas SALEN DE LOS DATOS. Ninguna es decorativa: si no hay
   condición real, no hay tarea, y la bandeja se ve vacía. El `id` es
   determinista (mismo problema = misma tarea) para que un refresco no
   duplique lo que ya estás trabajando.
   ===================================================================== */
function generarTareas(){
  const out = [];
  const f  = resumenFlota();
  const cj = resumenCaja();
  const vj = resumenViajes();
  const bd = resumenBodega();

  /* "1 equipos" queda feo y se nota; el plural se calcula. */
  function pl(n, sing, plur){ return n + " " + (n === 1 ? sing : plur); }
  function T(id, agente, nivel, titulo, detalle, contexto, sugerencia, especial){
    out.push({ id, agente, nivel, titulo, detalle, contexto, sugerencia, especial:especial||null,
               estado:"abierta", conv:null, informe:null, pendiente:null });
  }

  if(state.flotaErr){
    T("flota-err","flota","crit","No se pudo leer la flota",
      state.flotaErr,
      "El nodo de equipos de " + sesion.empresa + " no respondió: " + state.flotaErr,
      "¿Qué hago mientras no se pueda leer la flota?");
  }else{
    if(f.crit.length)
      T("mant-crit","mant","crit", pl(f.crit.length, "equipo pasado", "equipos pasados") + " de mantenimiento",
        "Ratio ≥ 1.0 sobre el intervalo de " + INTERVALO_DIAS + " días / " + INTERVALO_HORAS + " h",
        "Equipos vencidos (código · urgencia · atraso · estado):\n" +
          f.crit.slice(0,25).map(x => "· " + x.ev.codigo + " · " + Math.round(x.ev.urgencia*100) + "% · " +
            x.ev.etiqueta + " · " + (x.eq.estado||"?")).join("\n"),
        "Armame el orden de atención para esta semana y decime cuáles frenan renta.");
    if(f.warn.length)
      T("mant-warn","mant","warn", pl(f.warn.length, "equipo", "equipos") + " por vencer",
        "Ratio entre " + UMBRAL_AMARILLO + " y 1.0",
        "Por vencer:\n" + f.warn.slice(0,25).map(x => "· " + x.ev.codigo + " · " +
          Math.round(x.ev.urgencia*100) + "% · " + x.ev.etiqueta).join("\n"),
        "¿Cuáles conviene adelantar para no parar equipo rentado?");
    if(f.nodata.length)
      T("mant-nodata","mant","crit", pl(f.nodata.length, "equipo", "equipos") + " sin datos de mantenimiento",
        "Ni fecha de último mantenimiento ni horómetro comparable",
        "Sin datos (son los fantasmas del taller en el mundo):\n" +
          f.nodata.slice(0,25).map(x => "· " + x.ev.codigo + " · estado " + (x.eq.estado||"?")).join("\n"),
        "Decime qué dato falta en cada uno y cómo lo levanto rápido.");
    if(f.disp.length === 0 && f.total > 0)
      T("flota-vacia","flota","warn","Patio vacío: nada disponible",
        "Ningún equipo en estado DISPONIBLE",
        "Total de flota: " + f.total + " · en renta: " + f.renta.length +
          " · en taller: " + f.taller.length + " · otros: " + f.otros.length,
        "¿Qué hago si entra una solicitud de renta hoy?");
    if(f.taller.length)
      T("taller","mant","warn", pl(f.taller.length, "equipo", "equipos") + " en taller (MAL ESTADO)",
        "Están fuera de servicio y no generan renta",
        "En taller:\n" + f.taller.slice(0,25).map(x => "· " + x.ev.codigo + " · " +
          x.ev.color + " · " + x.ev.etiqueta).join("\n"),
        "Priorizá la salida del taller por impacto en ingreso.");
  }

  if(state.bitErr){
    T("bit-err","caja","crit","No se pudo leer la bitácora", state.bitErr,
      "El nodo /bitacora no respondió: " + state.bitErr,
      "¿Cómo sigo sin acceso a caja chica?");
  }else if(puedeModulo("cajachica")){
    if(cj.revision.length)
      T("caja-rev","caja","crit", pl(cj.revision.length, "gasto espera", "gastos esperan") + " tu decisión",
        "Estado: Enviado a revisión · sede " + (cj.sedes.join(", ") || "todas"),
        "Gastos en revisión:\n" + cj.revision.slice(0,25).map(r => "· id " + r.id + " · " +
          (r.concepto||"—") + " · " + fmtL(r.monto) + " · " + (r.responsable||"—") +
          " · " + (r.fecha||"—")).join("\n") +
        "\n\nFondo y totales: pendiente de liquidar " + cj.pendiente.length +
          ", aprobado " + cj.aprobado.length + ", liquidado " + cj.liquidado.length,
        "Revisá uno por uno y decime cuáles aprobarías y por qué.");
    if(vj.revision.length)
      T("viaje-rev","caja","warn", pl(vj.revision.length, "viático", "viáticos") + " en revisión",
        "data-viajes · estado Enviado a revisión",
        "Viáticos en revisión:\n" + vj.revision.slice(0,25).map(r => "· " + (r.viajero||"—") +
          " → " + (r.destino||"—") + " · " + fmtL(r.monto) + " · anticipo " +
          fmtL(r.anticipo) + " · " + (r.fecha||"—")).join("\n"),
        "¿Cuáles cuadran contra el anticipo y cuáles no?");
    const sinComp = cj.todos.filter(r => !r.comprobante || String(r.comprobante).trim() === "" ||
                                          String(r.comprobante).trim().toUpperCase() === "S/N");
    if(sinComp.length >= 3)
      T("caja-sincomp","caja","warn", pl(sinComp.length, "gasto", "gastos") + " sin comprobante",
        "Comprobante vacío o S/N",
        "Sin comprobante (los primeros 20):\n" + sinComp.slice(0,20).map(r => "· " +
          (r.concepto||"—") + " · " + fmtL(r.monto) + " · " + (r.fecha||"—") +
          " · " + (r.responsable||"—")).join("\n"),
        "Agrupá por responsable y armame el texto para pedirles el comprobante.");
  }

  if(puedeModulo("almacen") && !state.bitErr){
    if(bd.negativos.length)
      T("bodega-neg","bodega","crit", pl(bd.negativos.length, "producto", "productos") + " con existencia negativa",
        "Salieron más unidades de las que entraron: hay movimientos sin registrar",
        "Existencia negativa:\n" + bd.negativos.slice(0,25).map(p => "· " + p.clave + " · " +
          p.neto + " " + p.unidad + " · " + p.movs + " movimientos").join("\n"),
        "¿Qué revisamos primero para cuadrar esto?");
    if(bd.enCero.length >= 3)
      T("bodega-cero","bodega","warn", pl(bd.enCero.length, "producto", "productos") + " en cero",
        "Existencia neta 0 según entradas menos salidas",
        "En cero:\n" + bd.enCero.slice(0,25).map(p => "· " + p.clave).join("\n"),
        "¿Cuáles hay que reponer sí o sí y cuáles pueden esperar?");
  }

  /* ---- Encargos que me llegaron de otras oficinas ---- */
  encargosParaMi().forEach(function(e){
    const de = (ROLES.find(r => r.id === e.de_rol) || {}).label || e.de_rol;
    const t = { id:"enc-" + e.id, agente:"mejoras",
      nivel: e.estado === "Aceptado" ? "info" : "warn",
      titulo: (e.traduccion ? e.traduccion.titulo : e.texto_original).slice(0, 70),
      detalle: "Encargo de " + de + (e.traduccion ? "" : " · SIN TRADUCIR"),
      contexto:"", sugerencia:"", especial:"encargo",
      estado:"abierta", conv:null, informe:null, pendiente:null, encargoId:e.id };
    out.push(t);
  });
  const salieron = encargosMios();
  if(salieron.length)
    T("enc-mios","mejoras","info",
      pl(salieron.length, "encargo tuyo", "encargos tuyos") + " en otras oficinas",
      "Lo que mandaste y en qué va",
      salieron.map(e => "· [" + e.estado + "] a " +
        ((ROLES.find(r=>r.id===e.para_rol)||{}).label || e.para_rol) + ": " +
        e.titulo_visible + (e.respuesta ? ("\n  respondió: " + e.respuesta) : "")).join("\n"),
      "");

  /* ---- Departamento de Mejoras: lo ve todo el mundo ---- */
  const mias   = misMejoras();
  const nuevas = mejoras.filter(m => m.estado === "Nueva");
  const abiertasMias = mias.filter(m => ["Nueva","En análisis","Aceptada"].indexOf(m.estado) >= 0);

  T("mejora-pedir","mejoras","info","Pedir una mejora del mundo",
    "Algo que falla, algo que se te ocurre, un dato equivocado o un permiso que te falta",
    "", "", "form-mejora");

  if(abiertasMias.length)
    T("mejora-mias","mejoras","info",
      pl(abiertasMias.length, "pedido tuyo", "pedidos tuyos") + " en curso",
      "Lo que pediste y en qué va", "", "", "form-mejora");

  if(puedeTriar() && nuevas.length)
    T("mejora-cola","mejoras", nuevas.length >= 5 ? "crit" : "warn",
      pl(nuevas.length, "pedido sin revisar", "pedidos sin revisar"),
      "Llegaron de las oficinas y nadie los ha triado",
      colaMejoras(nuevas),
      "Agrupá los que hablan de lo mismo y decime cuáles aceptarías, en qué orden y por qué.");

  T("mejora-ronda","mejoras","info","Revisar el mundo y proponer mejoras",
    "Una mirada al estado del mundo y a lo que pidieron las oficinas",
    "PEDIDOS DE TODAS LAS OFICINAS (" + mejoras.length + "):\n" +
      (mejoras.length ? colaMejoras(mejoras.slice(-30)) : "(todavía no hay ninguno)"),
    "Mirá el estado del mundo y lo que pidió la gente, y decime las tres mejoras " +
    "que más rendirían y por qué. Sé concreto: qué cambiaría y para quién.");

  if(!proceso){
    T("sin-proceso","radar","warn","Tus agentes no conocen tu proceso",
      "Nadie cargó todavía cómo trabajás vos",
      "Los agentes están usando procesos que supuso quien armó el módulo, no los tuyos.\n\n" +
      "Se arregla en media hora y sin que nadie escriba código:\n" +
      "1. Pedí el archivo ENTREVISTA.md (está en mundo/procesos/)\n" +
      "2. Pegalo completo en tu propio Claude\n" +
      "3. Te entrevista y te devuelve un bloque\n" +
      "4. Tocá MI PROCESO acá arriba y pegalo",
      "");
  }

  /* Tarea libre: siempre disponible, para lo que no cae en ninguna alerta. */
  T("libre","radar","info","Consulta libre",
    "Preguntale a RADAR-X cualquier cosa sobre la operación cargada",
    contextoGeneral(),
    "");

  /* se conserva el trabajo en curso de las tareas que ya existían */
  const antes = {}; tareas.forEach(t => antes[t.id] = t);
  tareas = out.map(function(t){
    const v = antes[t.id];
    if(v && v.estado !== "abierta"){
      return Object.assign({}, t, { estado:v.estado, conv:v.conv, informe:v.informe, pendiente:v.pendiente });
    }
    return t;
  });
  sincronizarAgentes();
  Mundo.emit("tareas");
}

function colaMejoras(lista){
  return lista.map(function(m){
    return "· [" + m.estado + "] " + m.id + " · " + (TIPO_MEJORA[m.tipo] || m.tipo) +
      " · pedido por " + (m.persona || m.rol) + " (" + (m.fecha||"").slice(0,10) + ")\n" +
      "  " + m.titulo + (m.detalle ? ("\n  " + m.detalle) : "") +
      (m.nota ? ("\n  nota: " + m.nota) : "");
  }).join("\n");
}

/* El contexto general: lo que TODO agente ve de la operación. Se arma de
   los datos ya cargados, nunca de supuestos. */
function contextoGeneral(){
  const f = resumenFlota(), cj = resumenCaja(), bd = resumenBodega(), vj = resumenViajes();
  const L = [];
  L.push("EMPRESA ACTIVA: " + sesion.empresa + " (nodo " + (NODO_EMPRESA[sesion.empresa] || "no existe") + ")");
  L.push("USUARIO: " + sesion.label + (soloLectura() ? " [solo lectura]" : ""));
  L.push("");
  if(state.flotaErr){
    L.push("FLOTA: no disponible (" + state.flotaErr + ")");
  }else{
    L.push("FLOTA (" + f.total + " equipos): disponibles " + f.disp.length + " · en renta " +
           f.renta.length + " · en taller " + f.taller.length + " · otros/interno " + f.otros.length);
    L.push("MANTENIMIENTO: vencidos " + f.crit.length + " · por vencer " + f.warn.length +
           " · SIN DATOS " + f.nodata.length + "   (intervalo " + INTERVALO_DIAS + " d / " +
           INTERVALO_HORAS + " h, ámbar al " + (UMBRAL_AMARILLO*100) + "%)");
    const cl = {};
    f.renta.forEach(x => { const k = x.cliente || "sin cliente en la base"; cl[k] = (cl[k]||0)+1; });
    const ks = Object.keys(cl);
    if(ks.length) L.push("EN CLIENTE: " + ks.map(k => k + " (" + cl[k] + ")").join(" · "));
  }
  L.push("");
  if(state.bitErr){
    L.push("BITÁCORA: no disponible (" + state.bitErr + ")");
  }else{
    L.push("CAJA CHICA (sede " + (cj.sedes.join(", ") || "todas") + "): en revisión " +
           cj.revision.length + " · pendiente de liquidar " + cj.pendiente.length +
           " · aprobado " + cj.aprobado.length + " · liquidado " + cj.liquidado.length +
           " · rechazado " + cj.rechazado.length);
    L.push("VIÁTICOS: en revisión " + vj.revision.length + " de " + vj.todos.length);
    L.push("BODEGA: " + bd.prods.length + " productos · negativos " + bd.negativos.length +
           " · en cero " + bd.enCero.length);
  }
  if(mejoras.length){
    const porEst = {};
    mejoras.forEach(m => { porEst[m.estado] = (porEst[m.estado]||0)+1; });
    L.push("");
    L.push("DEPARTAMENTO DE MEJORAS: " +
      Object.keys(porEst).map(k => k + " " + porEst[k]).join(" · "));
  }
  return L.join("\n");
}

/* Agentes ocupados por delegación (no por una tarea propia). */
const delegados = {};

/* El estado de cada agente sale de sus tareas: no es una animación suelta. */
function sincronizarAgentes(){
  AGENTES.forEach(function(a){
    if(!motorListo()){ estadoAgente[a.id] = "apagado"; return; }
    if(delegados[a.id]){ estadoAgente[a.id] = "cocinando"; return; }
    const mias = tareas.filter(t => t.agente === a.id);
    if(mias.some(t => t.estado === "cocinando")) estadoAgente[a.id] = "cocinando";
    else if(mias.some(t => t.estado === "espera")) estadoAgente[a.id] = "espera";
    else if(mias.some(t => t.estado === "listo")) estadoAgente[a.id] = "listo";
    else estadoAgente[a.id] = "libre";
  });
}

/* =====================================================================
   8. EL MOTOR: Claude adentro del juego
   ---------------------------------------------------------------------
   El agente y Claude hablan con un SOBRE JSON. Claude siempre contesta un
   objeto con `estado`, y ese estado es lo que mueve el juego:

     "pregunta"     -> pop-up de seguimiento; la respuesta vuelve al hilo
     "confirmacion" -> pop-up con la acción EXACTA; sin un sí, no se escribe
     "listo"        -> informe final

   Las herramientas son deliberadamente pocas. Cada una escribe en la base
   y NINGUNA se ejecuta sin confirmación humana en pantalla.
   ===================================================================== */
const HERRAMIENTAS = {
  decidir_caja_chica: {
    modulo: "cajachica",
    descripcion: "Aprobar o rechazar UN gasto de caja chica que esté en 'Enviado a revisión'. " +
                 "args: { id: string, decision: \"aprobar\"|\"rechazar\", motivo: string }",
    resumir: a => "Caja chica " + a.id + " → " +
                  (a.decision === "aprobar" ? "Aprobado por Gerencia" : "Rechazado") +
                  (a.motivo ? ("\nMotivo: " + a.motivo) : ""),
    ejecutar: ejecDecidirCaja
  },
  triar_mejora: {
    modulo: "mejoras",
    descripcion: "Mover un pedido del Departamento de Mejoras a otro estado y dejarle una nota. " +
                 "args: { id: string, estado: \"En análisis\"|\"Aceptada\"|\"Hecha\"|\"Descartada\", nota: string }",
    resumir: a => "Pedido " + a.id + " → " + a.estado + (a.nota ? ("\nNota: " + a.nota) : ""),
    ejecutar: ejecTriarMejora
  },
  nota_bitacora: {
    modulo: "all",
    descripcion: "Dejar una nota en el historial de cambios (/bitacora/data-bitacora). " +
                 "No cambia ningún registro: solo deja constancia. " +
                 "args: { modulo: string, descripcion: string }",
    resumir: a => "Nota en bitácora [" + (a.modulo || "General") + "]:\n" + (a.descripcion || ""),
    ejecutar: ejecNotaBitacora
  }
};
function herramientasDe(agente){
  return Object.keys(HERRAMIENTAS).filter(function(k){
    const h = HERRAMIENTAS[k];
    if(soloLectura()) return false;                    // gerencias miran, no escriben
    if(h.modulo === "mejoras") return puedeTriar();
    return h.modulo === "all" || puedeModulo(h.modulo);
  });
}

function systemDe(tarea){
  const a = AG[tarea.agente];
  const libres = herramientasDe(tarea.agente);
  const proc = procesoParaAgente();
  /* A quién puede repartirle trabajo: solo agentes que este rol ve. */
  const pares = agentesVisibles().filter(x => x.id !== a.id);
  const bloqueDeleg = pares.length
    ? ("PODÉS REPARTIR TRABAJO. En esta oficina hay otros agentes y trabajan EN PARALELO:\n" +
       pares.map(x => "- " + x.id + " (" + x.nombre + "): " + x.alcance).join("\n") +
       "\nDelegá cuando el pedido toca áreas distintas y las partes no dependen una de otra. " +
       "Si es una sola cosa, hacela vos: repartir cuesta y no siempre rinde. " +
       "Los que reciben NO pueden repartir a su vez ni escribir en la base: analizan y te contestan.")
    : "";
  /* Prohibiciones que escribió el propio empleado. Van con el mismo peso que
     la regla de no inventar datos: el límite lo pone quien hace el trabajo. */
  const veda = (proceso && Array.isArray(proceso.nunca_automatizar) && proceso.nunca_automatizar.length)
    ? ["", "LO QUE " + sesion.label.toUpperCase() + " DIJO QUE NUNCA SE AUTOMATIZA. " +
       "No lo propongas, ni siquiera con confirmación. Si el pedido lo requiere, " +
       "decí que eso lo tiene que hacer una persona y por qué:"]
      .concat(proceso.nunca_automatizar.map(x => "- " + x)).join("\n")
    : "";
  const bloqueTools = libres.length
    ? ("HERRAMIENTAS QUE PODÉS PEDIR (siempre vía estado \"confirmacion\"):\n" +
       libres.map(k => "- " + k + ": " + HERRAMIENTAS[k].descripcion).join("\n"))
    : "NO TENÉS HERRAMIENTAS DISPONIBLES en esta sesión (el rol es de solo lectura o no " +
      "tiene ese módulo). No propongas escrituras: analizá y recomendá.";

  return [
"Sos " + a.nombre + ", un agente de IA que trabaja en la oficina virtual de Montasa.",
"Tu oficio: " + a.oficio + ". Tu alcance de datos: " + a.alcance + ".",
"",
"Hablás con " + sesion.label + ", un empleado real, en su celular, en español de Honduras.",
"Sé directo y breve. Nada de relleno ni de felicitaciones. Los montos son Lempiras (HNL).",
"",
"REGLA QUE NO SE ROMPE: no inventes datos. Si algo no está en el contexto que te doy,",
"decí que no está. Un número inventado en un tablero de operaciones es peor que un hueco,",
"porque el hueco se ve y el invento no. Si te falta un dato para decidir, preguntá.",
veda,
"",
(memoriaParaAgente() || ""),
"",
(proc
  ? (proc + "\n\nTrabajá SOBRE ese proceso: usá sus pasos, sus tiempos y sus palabras. " +
     "Si lo que te piden se sale de ahí, decilo en vez de inventar un paso nuevo.")
  : "ESTA PERSONA TODAVÍA NO CARGÓ SU PROCESO, así que no sabés cómo trabaja de verdad. " +
    "No supongas pasos ni tiempos: preguntale cómo lo hace ella, y si el pedido depende " +
    "de un procedimiento que no conocés, decilo."),
"",
bloqueTools,
"",
bloqueDeleg,
"",
"FORMATO DE RESPUESTA — contestá SIEMPRE con un solo objeto JSON, sin texto alrededor,",
"sin ``` y sin comentarios. Estas son las formas válidas:",
"",
'{\"estado\":\"pregunta\",\"mensaje\":\"<lo que necesitás saber, 1-2 frases>\",\"opciones\":[\"<opción corta>\",\"<opción corta>\"]}',
"   Usalo cuando te falta un dato o una decisión del empleado. `opciones` es opcional:",
"   ponelas cuando la respuesta sea una elección; omitilas si necesitás texto libre.",
"",
'{\"estado\":\"confirmacion\",\"mensaje\":\"<por qué querés hacerlo>\",\"accion\":{\"herramienta\":\"<nombre>\",\"args\":{...}}}',
"   Usalo ANTES de cualquier escritura. El empleado ve la acción exacta y decide.",
"   Una acción por vez. Si hay varias, pedí la primera y seguí después.",
"",
'{\"estado\":\"listo\",\"mensaje\":\"<resumen en una frase>\",\"informe\":\"<el resultado completo, texto plano con saltos de línea y viñetas con ·>\"}',
"   Usalo cuando terminaste. El informe queda guardado en la oficina.",
"",
(pares.length
  ? '{\"estado\":\"delegar\",\"mensaje\":\"<qué estás repartiendo y por qué>\",\"subtareas\":[{\"agente\":\"<id>\",\"pedido\":\"<qué tiene que averiguar, completo y sin depender de contexto que no tiene>\"}]}\n' +
    "   Máximo 4 subtareas, y arrancan todas a la vez. Te vuelven las respuestas juntas\n" +
    "   y seguís desde ahí. Cada `pedido` tiene que entenderse solo: el que lo recibe no ve\n" +
    "   esta conversación."
  : ""),
"",
"No uses markdown en `informe`: texto plano, viñetas con «· ». Nada de tablas."
  ].filter(x => x !== "").join("\n");
}

/* El sub-agente: mismo oficio, pero sin herramientas y sin repartir. Contesta
   texto plano, no sobre JSON: su respuesta es material para el líder. */
function systemSub(agenteId, pedidoDe){
  const a = AG[agenteId];
  const proc = procesoParaAgente();
  return [
"Sos " + a.nombre + ", agente de IA en la oficina virtual de Montasa.",
"Tu oficio: " + a.oficio + ". Tu alcance de datos: " + a.alcance + ".",
"",
"Te está consultando " + AG[pedidoDe].nombre + ", que está atendiendo a " + sesion.label + ".",
"Contestá SOLO tu parte, en texto plano, breve y concreto. Nada de JSON, nada de markdown.",
"",
"REGLA QUE NO SE ROMPE: no inventes datos. Si algo no está en el contexto que te doy,",
"decí que no está. Si tu parte no se puede contestar con lo que hay, decilo en una frase.",
"",
"No podés escribir en la base ni repartir trabajo a nadie: analizás y contestás.",
(proc ? ("\n" + proc) : "")
  ].join("\n");
}

/* --- la llamada, con streaming, vía el proxy --- */
async function llamarClaude(system, mensajes, onPensar, onTexto){
  if(!motorListo()) throw new Error("SIN_MOTOR");
  if(!sesion || !sesion.token) throw new Error("SIN_SESION");
  const r = await fetch(urlClaude(), {
    method: "POST",
    headers: { "Content-Type": "application/json",
               "Authorization": "Bearer " + sesion.token },
    body: JSON.stringify({ system, messages: mensajes })
  });
  if(r.status === 401){ Mundo.emit("sesion:vencida"); throw new Error("SESION_VENCIDA"); }
  if(!r.ok){
    let msg = "HTTP " + r.status;
    try{ const j = await r.json(); if(j && j.error) msg = j.error; }catch(e){}
    throw new Error(msg);
  }
  if(!r.body) throw new Error("el proxy no devolvió stream");

  const lector = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", texto = "", err = null, uso = null;
  while(true){
    const { value, done } = await lector.read();
    if(done) break;
    buf += dec.decode(value, { stream:true });
    const partes = buf.split("\n\n");
    buf = partes.pop();
    for(const p of partes){
      const linea = p.split("\n").find(l => l.indexOf("data: ") === 0);
      if(!linea) continue;
      let ev; try{ ev = JSON.parse(linea.slice(6)); }catch(e){ continue; }
      if(ev.t === "pensando") onPensar && onPensar(ev.x);
      else if(ev.t === "texto"){ texto += ev.x; onTexto && onTexto(ev.x); }
      else if(ev.t === "fin") uso = ev.usage || null;
      else if(ev.t === "error") err = ev.msg;
    }
  }
  if(err) throw new Error(err);
  /* El costo se anota siempre. Es la única forma de contestar "¿cuánto cuesta
     esto por día?" cuando alguien pregunte, y alguien va a preguntar. */
  if(uso) registrar("gasto", { entrada: uso.input_tokens, salida: uso.output_tokens });
  return texto;
}

/* --- lectura del sobre ---
   Claude devuelve JSON. Si algo sale mal, NO se adivina el contenido: se
   muestra crudo y se marca como respuesta no entendida. */
function leerSobre(txt){
  const t = (txt || "").trim();
  let crudo = t;
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(fence) crudo = fence[1].trim();
  else{
    const a = crudo.indexOf("{"), b = crudo.lastIndexOf("}");
    if(a >= 0 && b > a) crudo = crudo.slice(a, b+1);
  }
  let o = null;
  try{ o = JSON.parse(crudo); }catch(e){ return { estado:"crudo", texto:t }; }
  if(!o || typeof o !== "object" || !o.estado) return { estado:"crudo", texto:t };
  if(["pregunta","confirmacion","listo","delegar"].indexOf(o.estado) < 0) return { estado:"crudo", texto:t };
  return o;
}

/* =====================================================================
   9. HERRAMIENTAS (las escrituras reales)
   ---------------------------------------------------------------------
   Se llaman DESPUÉS de que el empleado confirmó en el pop-up. Cada una
   devuelve un texto que se le manda de vuelta a Claude como resultado.
   ===================================================================== */
async function ejecDecidirCaja(args){
  const id = args && args.id;
  const dec = args && args.decision;
  if(!id) throw new Error("falta el id del gasto");
  if(dec !== "aprobar" && dec !== "rechazar") throw new Error("decision debe ser aprobar o rechazar");
  if(soloLectura()) throw new Error("tu rol es de solo lectura");
  if(!puedeModulo("cajachica")) throw new Error("tu rol no tiene el módulo de caja chica");

  const arr = await getBit("data-cajachica");
  if(!Array.isArray(arr)) throw new Error("no hay datos de caja chica");
  const i = arr.findIndex(x => x.id === id);
  if(i === -1) throw new Error("id no encontrado: " + id);

  const sedes = misSedes();
  if(sedes.length && sedes.indexOf(arr[i].sede) < 0)
    throw new Error("ese gasto es de la sede " + arr[i].sede + " y tu rol no la maneja");
  if(["Aprobado por Gerencia","Rechazado","Liquidado"].indexOf(arr[i].estado) >= 0)
    throw new Error("ya fue decidido (estado: " + arr[i].estado + ")");

  /* data-cajachica es un arreglo y lo comparte la app de Bitácora SGI, así que
     no le podemos cambiar la forma. Lo que sí se puede: parchar SOLO el índice
     de ese gasto en vez de reescribir el arreglo entero. Si otro está
     guardando otro gasto al mismo tiempo, ya no se pisan. */
  const campos = {
    estado: (dec === "aprobar") ? "Aprobado por Gerencia" : "Rechazado",
    decididoPor: sesion.label,
    decididoEn: new Date().toISOString()
  };
  await parchar("data-cajachica", String(i), campos);
  Object.assign(arr[i], campos);
  state.caja = arr;
  await registrar("decision", { modulo:"cajachica", id:id, decision:dec,
    estado:campos.estado, monto:aNumero(arr[i].monto), concepto:arr[i].concepto,
    motivo: args.motivo || null });
  await anotarBitacora("Caja Chica", "Gasto " + id + " → " + arr[i].estado +
    " (Oficina virtual · " + AG.caja.nombre + (args.motivo ? " · " + args.motivo : "") + ")");
  return "Hecho. El gasto " + id + " (" + (arr[i].concepto||"—") + ", " + fmtL(arr[i].monto) +
         ") quedó en estado \"" + arr[i].estado + "\", decidido por " + sesion.label + ".";
}
async function ejecTriarMejora(args){
  if(!puedeTriar()) throw new Error("solo el administrador del SGI mueve pedidos de estado");
  const id = args && args.id, est = args && args.estado;
  if(!id) throw new Error("falta el id del pedido");
  if(EST_MEJORA.indexOf(est) < 1) throw new Error("estado inválido: " + est);
  const lista = comoLista(await getBit(NODO_MEJORAS));
  const m = lista.find(x => x.id === id);
  if(!m) throw new Error("pedido no encontrado: " + id);
  const antes = m.estado;
  const campos = { estado:est, nota: args.nota || m.nota || "",
                   decididoPor: sesion.label, decididoEn: new Date().toISOString() };
  await parchar(NODO_MEJORAS, m._k, campos);      // solo ese renglón
  Object.assign(m, campos);
  mejoras = lista;
  await registrar("mejora", { id:id, de:antes, a:est, titulo:m.titulo });
  await anotarBitacora("Mundo", "Pedido de mejora " + id + ": " + antes + " → " + est);
  return "Listo. El pedido " + id + " (\"" + (m.titulo||"") + "\") pasó de " +
         antes + " a " + est + ".";
}

async function ejecNotaBitacora(args){
  const d = args && args.descripcion;
  if(!d) throw new Error("falta la descripción");
  if(soloLectura()) throw new Error("tu rol es de solo lectura");
  await anotarBitacora(args.modulo || "General", d);
  return "Nota registrada en el historial de cambios.";
}
async function anotarBitacora(modulo, descripcion){
  try{
    let bit = await getBit("data-bitacora");
    if(!Array.isArray(bit)) bit = [];
    bit.unshift({ id:"oficina_"+Date.now(), fecha:new Date().toISOString(),
      accion:"Cambió estado", modulo:modulo, descripcion:descripcion,
      usuario: sesion.label + " (Oficina virtual)" });
    await fetch(CC_FB + "/data-bitacora.json", { method:"PUT",
      headers:{"Content-Type":"application/json"}, body: JSON.stringify(bit.slice(0,500)) });
  }catch(e){ console.warn("[Oficina] bitácora:", e.message); }
}


/* =====================================================================
   CENTRO DE DISTRIBUCIÓN
   ---------------------------------------------------------------------
   Un encargo entre oficinas no se entrega crudo. Cada departamento tiene su
   jerga, sus pasos y sus tiempos: lo que para Ventas es "urgente para el
   cliente", para Taller es un equipo con un código y un horómetro. El Centro
   traduce el pedido al entorno de quien lo recibe, usando SU proceso y SU
   vocabulario — los que esa persona cargó en MI PROCESO.

   Si el que manda no tiene motor, el encargo igual se entrega, pero SIN
   traducir y diciéndolo. Nunca se inventa la traducción.
   ===================================================================== */
async function procesoDe(rolId){
  try{
    const r = await getBit(NODO_PROCESOS + "/" + rolId);
    return (r && Array.isArray(r.procesos)) ? r : null;
  }catch(e){ return null; }
}
function systemCentro(procA, procB, rolB){
  const etiqB = (ROLES.find(r => r.id === rolB) || {}).label || rolB;
  return [
"Sos el Centro de Distribución de la oficina virtual de Montasa.",
"Tu único trabajo: traducir un encargo de un departamento al entorno de otro.",
"",
"QUIÉN MANDA: " + sesion.label + ".",
(procA ? ("Así trabaja quien manda:\n" + JSON.stringify({ resumen:procA.resumen,
   procesos:(procA.procesos||[]).map(p => p.nombre) })) : "Quien manda no cargó su proceso."),
"",
"QUIÉN RECIBE: " + etiqB + ".",
(procB
  ? ("Así trabaja quien recibe — usá SUS pasos, SUS palabras y SUS tiempos:\n" +
     JSON.stringify(procB))
  : "QUIEN RECIBE NO CARGÓ SU PROCESO. No sabés cómo trabaja: no inventes sus pasos. " +
    "Traducí solo lo que se pueda y decilo en `avisos`."),
"",
"REGLAS:",
"- No agregues pedidos que no estén en el texto original. Traducir no es ampliar.",
"- Si el que manda pide algo que el otro no hace, decilo en `avisos` en vez de forzarlo.",
"- Usá el vocabulario de quien recibe. Si dice \"vale\", escribí \"vale\".",
"- Si algo del original es ambiguo, va en `avisos`, no en una suposición.",
"",
"Contestá SOLO con este objeto JSON, sin texto alrededor y sin ```:",
'{\"titulo\":\"<una línea, en las palabras de quien recibe>\",\"por_que\":\"<para qué lo necesita quien manda, en una frase>\",\"que_necesita\":\"<qué tiene que hacer o entregar, concreto>\",\"pasos_sugeridos\":[\"<paso en el proceso de quien recibe>\"],\"datos\":[\"<nodo o app que va a tocar: data-cajachica, equipos, SAP...>\"],\"avisos\":[\"<lo que no se pudo traducir o quedó ambiguo>\"]}'
  ].join("\n");
}
async function traducirEncargo(reg){
  if(!motorListo()) return null;
  const procB = await procesoDe(reg.para_rol);
  const txt = await llamarClaude(
    systemCentro(proceso, procB, reg.para_rol),
    [{ role:"user", content:
       "ENCARGO ORIGINAL, tal como lo escribió " + sesion.label + ":\n\n" + reg.texto_original +
       "\n\nCONTEXTO DE LA OPERACIÓN AHORA:\n" + contextoGeneral() }],
    null, null);
  const t = txt.trim();
  let crudo = t;
  const f = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if(f) crudo = f[1].trim();
  else { const a = crudo.indexOf("{"), b = crudo.lastIndexOf("}"); if(a>=0 && b>a) crudo = crudo.slice(a,b+1); }
  try{
    const o = JSON.parse(crudo);
    return (o && o.titulo) ? o : null;
  }catch(e){ return null; }
}

async function crearEncargo(reg){
  reg._k = await anexar(NODO_ENCARGOS, reg);
  encargos.push(reg);
  await registrar("encargo", { id:reg.id, para:reg.para_rol, estado:reg.estado,
    titulo:reg.titulo_visible, traducido: !!reg.traduccion });
  return reg;
}
async function moverEncargo(id, estado, respuesta){
  const lista = comoLista(await getBit(NODO_ENCARGOS));
  const e = lista.find(x => x.id === id);
  if(!e) throw new Error("ese encargo ya no está");
  const antes = e.estado;
  const campos = { estado:estado };
  if(respuesta != null) campos.respuesta = respuesta;
  if(["Hecho","Rechazado"].indexOf(estado) >= 0) campos.cerradoEn = new Date().toISOString();
  await parchar(NODO_ENCARGOS, e._k, campos);
  Object.assign(e, campos);
  encargos = lista;
  await registrar("encargo", { id:id, de:antes, a:estado, de_rol:e.de_rol });
  await anotarBitacora("Mundo", "Encargo " + id + " → " + estado);
  return e;
}


/* =====================================================================
   11. EL CICLO DE TRABAJO
   ===================================================================== */
function arrancar(t, entry){
  t.conv = [{ role:"user", content:
    "CONTEXTO REAL (leído de la base hace instantes):\n" + t.contexto +
    "\n\n--- estado general de la operación ---\n" + contextoGeneral() +
    "\n\nLO QUE TE PIDE " + sesion.label.toUpperCase() + ":\n" + entry }];
  t._pensado = "";
  seguir(t);
}
function responder(t, texto){
  if(!t.conv) return;
  t.conv.push({ role:"user", content: texto });
  seguir(t);
}
async function confirmar(t, autorizado, errorFijo){
  const p = t.pendiente;
  if(!p || !t.conv) return;
  const acc = p.sobre.accion || {};
  if(errorFijo){ t.conv.push({ role:"user", content:"NO SE EJECUTÓ. " + errorFijo }); return seguir(t); }
  if(!autorizado){
    t.conv.push({ role:"user", content:
      sesion.label + " NO autorizó la acción. No la vuelvas a pedir igual: " +
      "explicá por qué la proponías, o seguí sin ella." });
    return seguir(t);
  }
  const her = HERRAMIENTAS[acc.herramienta];
  Mundo.emit("herramienta:corriendo", { tarea:t, herramienta:acc.herramienta });
  try{
    const res = await her.ejecutar(acc.args || {});
    await registrar("herramienta", { herramienta:acc.herramienta, args:acc.args, ok:true, tarea:t.id });
    avisar("Hecho · " + acc.herramienta);
    t.conv.push({ role:"user", content:"AUTORIZADO Y EJECUTADO. Resultado: " + res });
  }catch(e){
    await registrar("herramienta", { herramienta:acc.herramienta, args:acc.args, ok:false, error:e.message, tarea:t.id });
    avisar("No se pudo: " + e.message);
    t.conv.push({ role:"user", content:"AUTORIZADO PERO FALLÓ. Error: " + e.message +
      "\nNo lo reintentes igual: explicá qué pasó o proponé otra cosa." });
  }
  seguir(t);
}

async function seguir(t){
  if(!motorListo()){ avisar("Falta conectar el motor de Claude."); return; }
  if(t.conv.filter(m => m.role === "assistant").length >= CLAUDE.maxTurnos){
    t.estado = "listo";
    t.informe = { estado:"listo", mensaje:"Se acabaron los turnos",
      informe:"Esta tarea llegó al tope de " + CLAUDE.maxTurnos + " idas y vueltas y se cortó acá.\n" +
              "Es un tope de gasto, no un error. Podés volver a pedirle con una pregunta más acotada." };
    sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:listo", t); return;
  }

  t.estado = "cocinando"; t.pendiente = null; t._pensado = "";
  sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:cocina", t);

  try{
    const txt = await llamarClaude(systemDe(t), t.conv,
      function(x){ t._pensado = (t._pensado || "") + x; Mundo.emit("tarea:pensando", t); },
      null);
    t.conv.push({ role:"assistant", content: txt });
    const sobre = leerSobre(txt);

    if(sobre.estado === "delegar"){
      await repartir(t, sobre);
      return;
    }
    if(sobre.estado === "pregunta" || sobre.estado === "confirmacion"){
      t.estado = "espera";
      t.pendiente = { tipo: sobre.estado, sobre: sobre };
      sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:pendiente", t);
      return;
    }
    t.estado = "listo"; t.informe = sobre;
    if(sobre.estado === "listo"){
      resueltas++;
      await registrar("informe", { tarea:t.id, agente:t.agente, titulo:t.titulo,
        turnos:t.conv.filter(m => m.role === "assistant").length });
    }
    sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:listo", t);

  }catch(e){
    console.error("[Oficina] motor:", e);
    t.estado = "listo";
    t.informe = { estado:"crudo", texto:
      (e.message === "SIN_MOTOR"  ? "No hay motor de Claude configurado (falta apiBase)."
       : e.message === "SIN_SESION" ? "Esta sesión no tiene token del servidor. Volvé a entrar."
       : e.message === "SESION_VENCIDA" ? "La sesión venció mientras el agente trabajaba."
       : "El motor falló: " + e.message) };
    sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:listo", t);
    await registrar("falla", { tarea:t.id, agente:t.agente, error:e.message });
  }
}

/* --- Reparto en paralelo -------------------------------------------------
   El líder parte el trabajo y los sub-agentes arrancan TODOS a la vez. En la
   sala se ve: varias estaciones encendidas al mismo tiempo. Las respuestas
   vuelven juntas al líder, que sigue desde ahí. Profundidad 1 a propósito:
   un sub-agente no puede volver a repartir, ni escribir en la base. Repartir
   sin fondo se vuelve caro y deja de ser auditable. */
const MAX_SUBTAREAS = 4;
async function repartir(t, sobre){
  const visibles = agentesVisibles().map(x => x.id);
  const subs = (Array.isArray(sobre.subtareas) ? sobre.subtareas : [])
    .filter(x => x && x.pedido && AG[x.agente] && x.agente !== t.agente && visibles.indexOf(x.agente) >= 0)
    .slice(0, MAX_SUBTAREAS);

  if(!subs.length){
    t.conv.push({ role:"user", content:
      "NO SE REPARTIÓ NADA: las subtareas venían vacías o nombraban agentes que no existen " +
      "o que este rol no tiene. Agentes disponibles: " +
      visibles.filter(x => x !== t.agente).join(", ") + ". Hacelo vos o pedí lo que te falte." });
    return seguir(t);
  }

  t.estado = "cocinando"; t._pensado = (t._pensado || "") +
    "\n\n— repartiendo a " + subs.map(x => AG[x.agente].nombre).join(", ") + " —\n";
  subs.forEach(x => { delegados[x.agente] = true; });
  sincronizarAgentes(); Mundo.emit("tareas"); Mundo.emit("tarea:cocina", t);

  const contexto = "CONTEXTO REAL (leído de la base hace instantes):\n" + contextoGeneral();
  const hechos = await Promise.all(subs.map(async function(x){
    try{
      const txt = await llamarClaude(
        systemSub(x.agente, t.agente),
        [{ role:"user", content: contexto + "\n\nLO QUE TE PIDE " + AG[t.agente].nombre + ":\n" + x.pedido }],
        function(frag){ t._pensado = (t._pensado||"") + frag; Mundo.emit("tarea:pensando", t); },
        null);
      return { agente:x.agente, ok:true, texto:txt };
    }catch(e){
      return { agente:x.agente, ok:false, texto:"no pudo contestar: " + e.message };
    }finally{
      delegados[x.agente] = false; sincronizarAgentes();
    }
  }));

  t.conv.push({ role:"user", content:
    "RESPUESTAS DE LOS AGENTES A LOS QUE REPARTISTE:\n\n" +
    hechos.map(h => "=== " + AG[h.agente].nombre + (h.ok ? "" : " (FALLÓ)") + " ===\n" + h.texto).join("\n\n") +
    "\n\nSeguí desde acá. Si alguno falló, decilo en vez de suponer qué habría contestado." });
  seguir(t);
}

/* Cuál es la tarea más urgente de un agente. La vista decide qué hacer con
   ella; el núcleo solo sabe cuál es. */
function tareaTopDe(agenteId){
  const mias = tareas.filter(t => t.agente === agenteId);
  const orden = { espera:0, listo:1, cocinando:2, abierta:3 };
  mias.sort((a,b)=> (orden[a.estado]-orden[b.estado]) ||
                    ({crit:0,warn:1,info:2}[a.nivel] - {crit:0,warn:1,info:2}[b.nivel]));
  return mias[0] || null;
}
