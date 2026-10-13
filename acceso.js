/* =====================================================================
   ACCESO A LA BASE DE NEXO — para el Tablero, el Mundo y la Oficina
   ---------------------------------------------------------------------
   Desde el 2026-10-13 Miguel cierra `montasa/...` en la base: solo leen los
   telefonos que el aprobo en Gerencia (Personal -> 📱 Accesos). Estas paginas
   entran IGUAL que un telefono de Nexo (ver ACCESO.md en el repo de la app):

     1. abren una sesion anonima de Firebase (sin usuario ni contrasena);
     2. la primera vez piden nombre y apellido y se registran en
        `accesos/<uid>` como "pendiente";
     3. Miguel aprueba ese navegador una vez (con permiso "consulta": solo
        lee), y desde ahi cada lectura va con la sesion.

   POR QUE NO LA LLAVE DE LA BASE NI UNA CUENTA DE SERVICIO
   Estas paginas son publicas (GitHub Pages, repo publico). Todo lo que este
   aca adentro lo puede leer cualquiera que abra el codigo. Una llave puesta
   aca le daria a internet entero acceso a TODA la base, que es justo lo que el
   candado existe para evitar. La sesion anonima no es secreta y no hace
   falta que lo sea: lo que abre la puerta es que Miguel la aprobo.

   La llave de API de abajo es publica a proposito: es la misma que traen las
   nueve apps de Nexo en su codigo. No da acceso a nada por si sola.

   La identidad vive en el navegador (localStorage del sitio), y la
   comparten las tres paginas: se registra una vez para todas. En una ventana
   privada, o si se borran los datos del sitio, se pide de nuevo.
   ===================================================================== */
(function(){
  "use strict";
  var API_KEY = "AIzaSyCDXVpqQw62z0OI9fqDrdZQhCv7V0RvhiE";
  var DB      = "https://montasa-app-default-rtdb.firebaseio.com";
  var LS      = "nx_dash_sesion";
  var ses = null;                         // { uid, refresh, id, exp }
  try{ ses = JSON.parse(localStorage.getItem(LS) || "null"); }catch(e){ ses = null; }
  function guardar(){ try{ localStorage.setItem(LS, JSON.stringify(ses)); }catch(e){} }

  function tomar(uid, refresh, id, segs){
    /* un minuto de margen: que no se venza a mitad de una lectura */
    ses = { uid:uid, refresh:refresh, id:id, exp: Date.now() + ((Number(segs) || 3600) - 60) * 1000 };
    guardar();
  }

  function nueva(){
    return fetch("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ returnSecureToken:true })
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error("sesion anonima: HTTP " + r.status + " " + t.slice(0, 160)); });
      return r.json();
    }).then(function(d){ tomar(d.localId, d.refreshToken, d.idToken, d.expiresIn); });
  }

  function renovar(){
    return fetch("https://securetoken.googleapis.com/v1/token?key=" + API_KEY, {
      method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(ses.refresh)
    }).then(function(r){
      if(r.status === 400){
        /* La sesion ya no existe (la borraron, o el token se invalido). Se
           abre una nueva: este navegador va a tener que registrarse otra vez. */
        ses = null; guardar(); return nueva();
      }
      if(!r.ok) throw new Error("renovar sesion: HTTP " + r.status);
      return r.json().then(function(d){ tomar(d.user_id, d.refresh_token, d.id_token, d.expires_in); });
    });
  }

  var enCurso = null;
  function token(){
    if(ses && ses.id && ses.exp > Date.now()) return Promise.resolve(ses.id);
    if(!enCurso){
      enCurso = (ses && ses.refresh ? renovar() : nueva())
        .then(function(){ return ses && ses.id; })
        .finally(function(){ enCurso = null; });
    }
    return enCurso;
  }

  /* LA URL DE UNA RUTA, CON LA SESION.
     Si la sesion no se puede abrir (sin senal, o el servicio caido) se lee
     sin ella: mientras la rama siga abierta funciona igual, y si esta cerrada
     la lectura falla como fallaria de todos modos. */
  function url(ruta, extra){
    return token().catch(function(e){ console.warn("[Acceso]", e.message); return null; })
      .then(function(t){
        var q = [];
        if(t) q.push("auth=" + encodeURIComponent(t));
        if(extra) q.push(extra);
        return DB + "/" + ruta + ".json" + (q.length ? "?" + q.join("&") : "");
      });
  }

  /* ── el registro, igual que en las apps de Nexo ───────────────────── */
  function dispositivo(){
    var u = navigator.userAgent || "";
    var so = /Windows/.test(u) ? "Windows" : /iPhone|iPad/.test(u) ? "iPhone" : /Android/.test(u) ? "Android"
           : /Mac OS/.test(u) ? "Mac" : "Otro";
    var nav = /Edg\//.test(u) ? "Edge" : /Firefox\//.test(u) ? "Firefox" : /Chrome\//.test(u) ? "Chrome"
            : /Safari\//.test(u) ? "Safari" : "Navegador";
    return so + " · " + nav + " · Mundo/Tablero";
  }

  function leerRegistro(){
    return url("accesos/" + ses.uid).then(function(u){ return fetch(u, { cache:"no-store" }); })
      .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function escribir(ruta, valor){
    return url(ruta).then(function(u){
      return fetch(u, { method:"PUT", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(valor) });
    }).then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); });
  }

  var ESTILO = "position:fixed;z-index:99990;font-family:'IBM Plex Mono',ui-monospace,monospace;" +
               "background:#1f2224;border:1px solid #3a3f43;color:#e8e6e1;";

  function aviso(estado){
    var v = document.getElementById("nx-acc-aviso"); if(v) v.remove();
    if(estado === "aprobado") return;
    var d = document.createElement("div"); d.id = "nx-acc-aviso";
    d.style.cssText = ESTILO + "left:50%;transform:translateX(-50%);bottom:64px;padding:8px 12px;" +
                      "font-size:11px;border-radius:6px;max-width:92vw;text-align:center;line-height:1.45";
    d.innerHTML = estado === "rechazado"
      ? "⛔ Este navegador no tiene acceso a los datos de Nexo. Si es un error, habla con Gerencia."
      : "⏳ Este navegador espera que Gerencia lo apruebe en <b>Personal → 📱 Accesos</b>. " +
        "Mientras no lo aprueben, los datos del taller no van a cargar.";
    document.body.appendChild(d);
  }

  function pedirNombre(){
    if(document.getElementById("nx-acc-ov")) return;
    var ov = document.createElement("div"); ov.id = "nx-acc-ov";
    ov.style.cssText = "position:fixed;inset:0;z-index:99991;background:rgba(10,12,13,.72);display:flex;" +
                       "align-items:center;justify-content:center;padding:16px";
    var CAMPO = "width:100%;box-sizing:border-box;padding:10px;margin-top:8px;background:#17191a;" +
                "border:1px solid #3a3f43;color:#e8e6e1;border-radius:6px;font:inherit;font-size:14px";
    ov.innerHTML =
      '<div style="' + ESTILO + 'position:static;border-radius:10px;max-width:380px;width:100%;padding:20px;box-sizing:border-box">' +
      '<div style="font-weight:700;font-size:15px;color:#f5a524;margin-bottom:6px">Registrá este navegador</div>' +
      '<div style="font-size:12px;color:#a8acb0;line-height:1.5">La base del taller ahora pide permiso. ' +
      'Escribí tu nombre y apellido para que Gerencia sepa quién mira el mundo y el tablero, y lo apruebe. ' +
      'Se pide una sola vez en este navegador.</div>' +
      '<input id="nx-acc-nom" placeholder="Nombre" autocomplete="given-name" style="' + CAMPO + '">' +
      '<input id="nx-acc-ape" placeholder="Apellido" autocomplete="family-name" style="' + CAMPO + '">' +
      '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button id="nx-acc-luego" style="flex:1;padding:10px;background:transparent;border:1px solid #3a3f43;' +
      'color:#a8acb0;border-radius:6px;cursor:pointer;font:inherit">Ahora no</button>' +
      '<button id="nx-acc-ok" style="flex:2;padding:10px;background:#f5a524;border:0;color:#1a1a1a;' +
      'border-radius:6px;cursor:pointer;font:inherit;font-weight:700">Pedir acceso</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#nx-acc-luego").onclick = function(){ ov.remove(); aviso("pendiente"); };
    var btn = ov.querySelector("#nx-acc-ok");
    btn.onclick = function(){
      var n = ov.querySelector("#nx-acc-nom").value.replace(/\s+/g, " ").trim();
      var a = ov.querySelector("#nx-acc-ape").value.replace(/\s+/g, " ").trim();
      if(!n || !a){ alert("Escribí tu nombre y tu apellido."); return; }
      var ahora = Date.now();
      /* misma forma que el registro de las apps de Nexo (ACCESO.md §3) */
      var reg = { nombre:n, apellido:a, app:"Mundo y Tablero (dash)", empresa:"montasa",
                  area:"Mundo y Tablero", dispositivo: dispositivo(),
                  creado:ahora, ultimaVez:ahora, estado:"pendiente" };
      btn.disabled = true; btn.textContent = "Guardando…";
      escribir("accesos/" + ses.uid, reg).then(function(){
        ov.remove(); estadoActual = "pendiente"; aviso("pendiente");
      }).catch(function(){
        btn.disabled = false; btn.textContent = "Pedir acceso";
        alert("No se pudo guardar. Revisá la conexión e intentá de nuevo.");
      });
    };
  }

  var estadoActual = null, revisado = false;
  function revisar(){
    if(revisado) return; revisado = true;
    token().then(function(){
      if(!ses) return;
      return leerRegistro().then(function(reg){
        if(!reg){ pedirNombre(); return; }
        estadoActual = reg.estado;
        aviso(reg.estado);
        /* una vez por visita, como las apps */
        escribir("accesos/" + ses.uid + "/ultimaVez", Date.now()).catch(function(){});
      });
    }).catch(function(e){ console.warn("[Acceso]", e.message); });
  }

  window.ACCESO = {
    url: url,
    uid: function(){ return ses && ses.uid; },
    estado: function(){ return estadoActual; }
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", revisar);
  else revisar();
})();
