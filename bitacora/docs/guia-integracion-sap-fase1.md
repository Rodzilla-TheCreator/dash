# Integración SAP Business One — Fase 1 (solo lectura de Órdenes de Compra)

Esta guía asume que ya tienes funcionando la conexión de la app a tu Hoja de Google (guía anterior). Ahora vamos a **ampliar ese mismo Apps Script** para que también sirva de puente hacia SAP.

---

## Parte 1 — Actualizar el código de Apps Script

1. Abre tu Hoja de Google → **Extensiones → Apps Script**.
2. **Reemplaza todo el contenido** del editor por este código completo (incluye lo que ya tenías, más la parte nueva de SAP):

```javascript
// ====================================================================
// CONFIGURACIÓN SAP BUSINESS ONE
// Rellena esto cuando tu equipo de SAP te dé los datos de conexión.
// Mientras tanto, déjalo tal cual — la app seguirá funcionando normal,
// solo el módulo de Órdenes de Compra mostrará un aviso de "no configurado".
// ====================================================================
var SAP_SERVICE_LAYER_URL = 'https://TU_SERVIDOR_SAP:50000/b1s/v1'; // sin "/" al final
var SAP_COMPANY_DB        = 'NOMBRE_DE_TU_BASE_DE_DATOS_SAP';
var SAP_USERNAME          = 'usuario_integracion';
var SAP_PASSWORD          = 'contraseña_del_usuario_integracion';

function sapConfigurado_() {
  return SAP_SERVICE_LAYER_URL.indexOf('TU_SERVIDOR_SAP') === -1;
}

function sapLogin_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('sap_session');
  if (cached) return cached;

  var res = UrlFetchApp.fetch(SAP_SERVICE_LAYER_URL + '/Login', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ CompanyDB: SAP_COMPANY_DB, UserName: SAP_USERNAME, Password: SAP_PASSWORD }),
    muteHttpExceptions: true,
    validateHttpsCertificates: false // muchos SAP B1 usan certificado autofirmado
  });
  var body = JSON.parse(res.getContentText());
  if (!body.SessionId) throw new Error('No se pudo iniciar sesión en SAP: ' + res.getContentText());

  cache.put('sap_session', body.SessionId, 25 * 60); // la sesión de SAP dura ~30 min, guardamos 25
  return body.SessionId;
}

function sapFetch_(path) {
  var sessionId = sapLogin_();
  var res = UrlFetchApp.fetch(SAP_SERVICE_LAYER_URL + path, {
    method: 'get',
    headers: { 'Cookie': 'B1SESSION=' + sessionId },
    muteHttpExceptions: true,
    validateHttpsCertificates: false
  });
  if (res.getResponseCode() === 401) {
    // La sesión venció: forzamos un login nuevo y reintentamos una vez.
    CacheService.getScriptCache().remove('sap_session');
    sessionId = sapLogin_();
    res = UrlFetchApp.fetch(SAP_SERVICE_LAYER_URL + path, {
      method: 'get',
      headers: { 'Cookie': 'B1SESSION=' + sessionId },
      muteHttpExceptions: true,
      validateHttpsCertificates: false
    });
  }
  return JSON.parse(res.getContentText());
}

function sapGetPurchaseOrders_() {
  // Trae las últimas 100 Órdenes de Compra, más recientes primero.
  var data = sapFetch_(
    "/PurchaseOrders?$select=DocEntry,DocNum,CardCode,CardName,DocDate,DocDueDate,DocTotal,DocumentStatus&$orderby=DocEntry desc&$top=100"
  );
  if (!data.value) return [];
  return data.value.map(function (po) {
    return {
      docEntry: po.DocEntry,
      numero: po.DocNum,
      proveedorCodigo: po.CardCode,
      proveedor: po.CardName,
      fecha: po.DocDate,
      fechaVencimiento: po.DocDueDate,
      total: po.DocTotal,
      estado: po.DocumentStatus === 'O' ? 'Abierta' : 'Cerrada'
    };
  });
}

// ====================================================================
// RESPUESTA: JSON normal, o JSONP si la request trae ?callback=...
// (necesario para el Dash de Omar, que no puede usar fetch por CORS).
// ====================================================================
function _responder(e, obj) {
  var json = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    cb = String(cb).replace(/[^\w$.]/g, ''); // sanitiza el nombre del callback
    return ContentService
      .createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ====================================================================
// LO QUE YA TENÍAS (Hoja de Google como base de datos)
// ====================================================================
function doGet(e) {
  var action = e.parameter.action;

  if (action === 'sap_purchase_orders') {
    if (!sapConfigurado_()) {
      return _responder(e, { ok: false, error: 'SAP todavía no está configurado. Completa las variables SAP_SERVICE_LAYER_URL, SAP_COMPANY_DB, SAP_USERNAME y SAP_PASSWORD al inicio del código.' });
    }
    try {
      var pos = sapGetPurchaseOrders_();
      return _responder(e, { ok: true, purchaseOrders: pos });
    } catch (err) {
      return _responder(e, { ok: false, error: String(err) });
    }
  }

  var sheet = getSheet();

  if (action === 'cajachica_decidir') {
    var row = findRow(sheet, 'data-cajachica');
    if (!row) return _responder(e, { ok:false, error:'no existe data-cajachica' });
    var arr = JSON.parse(row[1] || '[]');
    var id  = e.parameter.id;
    var i   = arr.findIndex(function(x){ return x.id === id; });
    if (i === -1) return _responder(e, { ok:false, error:'id no encontrado' });

    // Idempotencia: si ya fue decidido/liquidado, no lo volvemos a tocar.
    var yaDecidido = ['Aprobado por Gerencia', 'Rechazado', 'Liquidado'].indexOf(arr[i].estado) !== -1;
    if (yaDecidido) {
      return _responder(e, { ok:false, error:'este gasto ya fue decidido (estado actual: ' + arr[i].estado + ')' });
    }

    // NOTA IMPORTANTE: el estado se deja como "Aprobado por Gerencia" (no "Aprobado" a secas),
    // porque así es como la app de Christian reconoce internamente que un gasto ya está listo
    // para que Contabilidad lo liquide. Si se cambia este texto, la app deja de detectarlo.
    arr[i].estado       = (e.parameter.decision === 'aprobar') ? 'Aprobado por Gerencia' : 'Rechazado';
    arr[i].decididoPor  = e.parameter.por || 'Omar';
    arr[i].decididoEn   = new Date().toISOString();
    upsertRow(sheet, 'data-cajachica', JSON.stringify(arr));

    // registrar en la bitácora (mismas últimas 500 que ya maneja la app)
    var bRow = findRow(sheet, 'data-bitacora');
    var bit  = bRow ? JSON.parse(bRow[1] || '[]') : [];
    bit.unshift({
      id: 'dash_' + Date.now(),
      fecha: new Date().toISOString(),
      accion: 'Cambió estado',
      modulo: 'Caja Chica',
      descripcion: 'Gasto ' + id + ' → ' + arr[i].estado + ' (desde Dash de Omar)',
      usuario: e.parameter.por || 'Omar'
    });
    upsertRow(sheet, 'data-bitacora', JSON.stringify(bit.slice(0, 500)));

    return _responder(e, { ok:true, id:id, estado:arr[i].estado });
  }

  if (action === 'get') {
    var key = e.parameter.key;
    var row2 = findRow(sheet, key);
    if (row2) return _responder(e, { found: true, value: row2[1] });
    return _responder(e, { found: false });
  }
  return _responder(e, { error: 'acción desconocida' });
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
  var sheet = getSheet();
  if (body.action === 'set') {
    upsertRow(sheet, body.key, body.value);
    return _responder(e, { ok: true });
  }
  if (body.action === 'delete') {
    deleteRow(sheet, body.key);
    return _responder(e, { ok: true });
  }
  return _responder(e, { error: 'acción desconocida' });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Data');
  if (!sheet) {
    sheet = ss.insertSheet('Data');
    sheet.appendRow(['key', 'value']);
  }
  return sheet;
}

function findRow(sheet, key) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i];
  }
  return null;
}

function upsertRow(sheet, key, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function deleteRow(sheet, key) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}
```

3. Guarda (ícono de disquete).
4. **Vuelve a implementar**: Implementar → Administrar implementaciones → ícono de lápiz (editar) → en "Versión" elige "Nueva versión" → Implementar. (Esto actualiza tu mismo enlace `/exec` sin tener que cambiar la URL en la app).

---

## Parte 2 — Acción nueva: recibir la decisión de Omar (Aprobar/Rechazar)

Esta parte ya está incluida en el código de la Parte 1 de arriba (busca `cajachica_decidir` dentro de `doGet`). El Dash de Omar la llama así, por GET, sin problemas de CORS:

```
{tu_url}/exec?action=cajachica_decidir&id=<id>&decision=aprobar&por=Omar
{tu_url}/exec?action=cajachica_decidir&id=<id>&decision=rechazar&por=Omar
```

- `decision=aprobar` → deja el gasto en estado `"Aprobado por Gerencia"` (el mismo paso que ya usa tu app cuando tú apruebas manualmente).
- `decision=rechazar` → lo deja en `"Rechazado"` (estado nuevo, agregado especialmente para esto).
- Ambos casos quedan anotados en tu Historial de Cambios, como si lo hubieras hecho tú mismo desde la app.

⚠️ **Después de pegar el código nuevo, tienes que volver a implementar una versión nueva** (Implementar → Administrar implementaciones → lápiz → "Nueva versión" → Implementar) — esto **no lo puedo hacer yo**, solo existe dentro de tu cuenta de Google. Es el mismo paso que ya causaba el error del `doGet` — así que este paso soluciona los dos problemas de una vez.

---

## Parte 3 — Cuando tu equipo de SAP te dé los datos

Reemplaza estas 4 líneas al inicio del script:

```javascript
var SAP_SERVICE_LAYER_URL = 'https://TU_SERVIDOR_SAP:50000/b1s/v1';
var SAP_COMPANY_DB        = 'NOMBRE_DE_TU_BASE_DE_DATOS_SAP';
var SAP_USERNAME          = 'usuario_integracion';
var SAP_PASSWORD          = 'contraseña_del_usuario_integracion';
```

Con los datos reales que te den. Guarda, vuelve a implementar (mismo paso 4 de arriba), y listo — no hay que tocar nada más.

---

## Requisito importante para tu equipo de SAP

El **Service Layer tiene que poder recibir peticiones desde internet** (no solo desde la red interna de la empresa). Esto es responsabilidad de tu equipo de IT/SAP — normalmente se logra con:
- Un reverse proxy o gateway que exponga el puerto del Service Layer de forma segura, o
- Reglas de firewall que permitan el tráfico entrante hacia ese puerto.

Pídeles también que creen un **usuario de SAP dedicado solo a esta integración**, con permisos limitados a lo necesario (por ahora, solo lectura de Órdenes de Compra).
