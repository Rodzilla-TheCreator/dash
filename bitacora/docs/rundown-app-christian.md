# Rundown de la app de Christian — Bitácora de Control SGI

Respuestas basadas en el código real (HTML/JS de la app + Apps Script). Marco **"No está definido en el código"** donde aplica.

---

## 1. Panorama general

1. **¿Qué es en una frase?** Una app de control interno para Montasa Handling Co. (MONHACO): Caja Chica, Gastos de Viaje, Almacén, Extintores, Botiquín, Incidentes de Seguridad, No Conformidades, Marketing Digital y consumo de luz, con un flujo de aprobación de varios pasos entre distintos roles.
2. **¿Quién la usa?** 11 roles: Gerente General, Gerente Comercial, RRHH (solo lectura), Almacén SPS, Almacén Choloma (bodegas, cada una aislada a su propia sede), Ventas 1 a 4 (cada uno ve solo sus propios gastos de viaje), Contabilidad (pantalla dedicada de liquidación), y el Admin (Christian, control total).
3. **¿Qué piezas la componen?**
   - Un **frontend**: un solo archivo HTML/JS (sin backend propio, corre en el navegador).
   - Un **backend**: Google Apps Script publicado como aplicación web (`/exec`).
   - Una **Google Sheet** como base de datos, con una pestaña `Data` (columnas `key`/`value`).
4. **¿En qué cuenta vive?** **No está definido en el código** — es la cuenta de Google personal de Christian; solo él puede confirmar cuál es.

## 2. Backend (Apps Script)

5. **Funciones de entrada:** tiene ambas.
   ```javascript
   function doGet(e) { ... }
   function doPost(e) { ... }
   ```
6. **Todas las `action` que soporta hoy:**

   | Acción | Método | Parámetros | Qué hace | Ejemplo de respuesta |
   |---|---|---|---|---|
   | `get` | GET | `key` | Devuelve el valor guardado bajo esa clave | `{"found":true,"value":"[...]"}` o `{"found":false}` |
   | `set` | POST (body JSON) | `key`, `value` | Guarda/actualiza el valor de una clave | `{"ok":true}` |
   | `delete` | POST (body JSON) | `key` | Borra una clave | `{"ok":true}` |
   | `sap_purchase_orders` | GET | ninguno | Trae hasta 100 Órdenes de Compra desde SAP Business One (Service Layer) | `{"ok":true,"purchaseOrders":[...]}` |
   | `cajachica_decidir` | GET | `id`, `decision` (`aprobar`/`rechazar`), `por` | Aprueba o rechaza un gasto específico de `data-cajachica` | `{"ok":true,"id":"...","estado":"..."}` |

7. **¿Patrón genérico clave-valor?** Sí. Claves que maneja hoy:
   - `data-cajachica`, `data-viajes`, `data-almacen`, `data-extintores`, `data-incidentes`, `data-botiquin`, `data-ambiente`, `data-marketing`, `data-noconformidades`, `data-bitacora`
   - `cajachica-fondo-SPS`, `cajachica-fondo-Choloma`, `cajachica-fondo-General` (fondo fijo de caja chica por sede)
   - `auth-config` (códigos de acceso de los 11 roles, guardados con hash SHA-256, no en texto plano)
8. **¿Dónde guarda los datos?** En la Google Sheet, pestaña `Data`. No usa `PropertiesService` para datos de negocio; sí usa `CacheService` para guardar temporalmente la sesión de SAP (`sap_session`, 25 minutos).
9. **¿Cómo serializa las respuestas?** Con `ContentService` y `MimeType.JSON` — **y ahora también `MimeType.JAVASCRIPT` cuando la request trae `callback=...`** (ver Parte B, ya aplicada).

## 3. Modelo de datos de Caja Chica

10. **¿Cómo se guarda `data-cajachica`?** Es **un string JSON de un arreglo**, guardado completo dentro de **una sola celda** de la Hoja (columna `value`, en la fila cuya columna `key` = `data-cajachica`). No son filas normales de hoja de cálculo — cada gasto es un objeto dentro de ese arreglo.

11. **Esquema completo de un gasto**, con ejemplo real (anonimizado):

    ```json
    {
      "fecha": "2026-08-12",
      "sede": "SPS",
      "tipo": "Gasto",
      "concepto": "Reembolso combustible",
      "categoria": "Transporte local",
      "monto": "620.00",
      "estado": "Pendiente de liquidar",
      "comprobante": "F-00123",
      "responsable": "Kevin Deras",
      "notas": "",
      "id": "m9k2p1x7a",
      "registradoPor": "Almacén SPS",
      "registradoEn": "2026-08-12T15:03:11.000Z",
      "fechaLiquidacion": null,
      "decididoPor": null,
      "decididoEn": null
    }
    ```
    - `monto` es **texto**, no número (ej. `"620.00"`), y siempre en Lempiras (HNL) — no hay campo de moneda.
    - `fechaLiquidacion` se agrega cuando Contabilidad liquida.
    - `decididoPor` / `decididoEn` se agregan cuando se decide vía `cajachica_decidir` (recién agregados en la Parte B de este documento).
    - Si se edita manualmente desde la app, también se agregan `ultimaModificacionPor` / `ultimaModificacionEn`.

12. **Todos los valores posibles de `estado`:**
    - `"Pendiente de liquidar"` (inicial)
    - `"Enviado a revisión"` (el departamento lo marca listo)
    - `"Aprobado por Gerencia"` (el Admin lo aprueba — **este es el texto exacto que usa `cajachica_decidir` cuando `decision=aprobar`**, no cambiar)
    - `"Liquidado"` (Contabilidad lo confirma)
    - `"Rechazado"` (nuevo — resultado de `decision=rechazar`)

    Transición: `Pendiente de liquidar → Enviado a revisión → Aprobado por Gerencia → Liquidado`, o puede desviarse a `Rechazado` en el paso de decisión.

13. **Todos los valores posibles de `sede`:** `"SPS"`, `"Choloma"`, `"General"` (esta última es para gastos no atados a una bodega en particular — no hay más).

14. **¿El `id` es único y estable?** Sí, es único en la práctica. Se genera así (JavaScript, del lado de la app):
    ```javascript
    function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
    ```
    No es un correlativo secuencial (no es 1, 2, 3...) — es un texto corto basado en fecha/hora + aleatorio.

## 4. La acción de decidir (aprobar/rechazar)

15. **¿Existe `cajachica_decidir`?** Sí, ya estaba implementada desde una iteración anterior, y en este mismo documento se actualizó para agregar JSONP e idempotencia (ver el código completo en el archivo de la guía técnica adjunto).

16. **Qué hace exactamente:**
    - Modifica `estado` → `"Aprobado por Gerencia"` si `decision=aprobar`, o `"Rechazado"` si `decision=rechazar`.

      ⚠️ **Nota importante:** se usa el texto **"Aprobado por Gerencia"**, no `"Aprobado"` a secas. Esto es intencional: la app de Christian usa ese texto exacto, en varios lugares de su lógica interna, para saber que un gasto ya puede ser liquidado por Contabilidad. Si se cambiara a `"Aprobado"`, la app dejaría de reconocerlo y Contabilidad nunca lo vería como listo para liquidar. Si el Dash necesita mostrar algo más corto en pantalla, se puede simplificar solo en el **frontend del Dash** (ej. mostrar "Aprobado" al usuario aunque el valor guardado sea "Aprobado por Gerencia"), sin tocar el dato real.

    - Guarda quién decidió y cuándo, en los campos `decididoPor` y `decididoEn` (recién agregados/renombrados en la Parte B).
    - Devuelve exactamente `{ok:true, id, estado}`.
    - **Si el `id` no existe:** devuelve `{ok:false, error:'id no encontrado'}`.
    - **Si ya fue decidido antes** (estado ya es "Aprobado por Gerencia", "Rechazado", o "Liquidado"): devuelve `{ok:false, error:'este gasto ya fue decidido (estado actual: ...)'}` — **esto se agregó ahora**, antes no existía esta protección y una segunda llamada accidental lo hubiera sobreescrito sin avisar.

17. Ya existía, así que no aplica implementarla desde cero — solo se reforzó (JSONP + idempotencia + nombres de campo).

## 5. Entrada de datos y flujo

18. **¿Cómo entra un gasto nuevo?** Alguien de Almacén SPS, Almacén Choloma, o el Admin lo registra manualmente en el formulario de Caja Chica dentro de la app (no hay carga automática ni por Excel para esto — Excel se usa para importar en bloque, aparte).
19. **¿Quién puede crear/editar/borrar?** Almacén SPS y Choloma pueden crear y editar/borrar *solo mientras el gasto sigue en "Pendiente de liquidar"* — una vez que avanza de ahí, solo el Admin puede tocarlo (para proteger el rastro de auditoría). Contabilidad no crea gastos, solo los liquida. Gerente General/Comercial/RRHH no pueden crear, editar ni borrar nada (son de solo lectura).
20. **Flujo completo:**
    ```
    Creado (Pendiente de liquidar)
      → Enviado a revisión (lo hace el mismo departamento)
      → [Omar decide vía Dash, o el Admin desde la app]
          ├── Aprobado por Gerencia → Liquidado (lo confirma Contabilidad)
          └── Rechazado (fin del camino — hay que corregir y volver a ingresar)
    ```

## 6. Acceso, despliegue y seguridad

21. **Despliegue:** "Ejecutar como" y "Quién tiene acceso" — **no está definido en el código**, son configuraciones del panel de Apps Script que solo Christian puede confirmar (se le pidió explícitamente que revise esto, ya que es la causa más probable del error de `doGet` que reportaron).
22. **¿La URL `/exec` es estable?** Sí, mientras se re-implemente como **"Nueva versión"** de la misma implementación (no una implementación nueva desde cero). Si se crea una implementación nueva en vez de una nueva versión, la URL sí cambia.
23. **¿Hay token/secreto en las requests?** **No.** El endpoint es abierto — cualquiera con la URL puede leer o escribir cualquier clave. Es una limitación conocida, aceptable para un equipo interno pequeño, pero no es seguridad de nivel empresarial.
24. **¿Datos sensibles expuestos por el `get` genérico?** Sí, con el mismo `action=get` cualquiera puede pedir `key=auth-config` y ver la estructura de códigos de acceso (aunque los códigos en sí están hasheados, no en texto plano). También se puede leer cualquier otro módulo (Almacén, Incidentes, etc.) sin restricción.

## 7. Límites y problemas conocidos

25. **¿Cuántos gastos hay hoy?** **No está definido en el código** — depende de cuántos se hayan cargado en la Hoja real de Christian, no algo que se pueda saber desde el código de la app.
26. **Errores/límites conocidos:**
    - Cada clave vive en **una sola celda** de Google Sheets — hay un límite práctico de tamaño por celda (~50,000 caracteres). Si `data-cajachica` crece mucho (cientos de gastos con muchos campos), podría acercarse a ese límite.
    - Cada operación de guardado (`set`) reescribe el **arreglo completo**, no una fila individual — a más registros, más lento cada guardado.
    - Ya se corrigió una condición de carrera: antes, si dos personas guardaban casi al mismo tiempo sin refrescar, se podían perder cambios; ahora cada escritura relee la versión más reciente antes de escribir.
27. **Gotchas para quien integre:**
    - Las respuestas de `set` (POST) **hay que verificarlas de verdad** (`{ok:true}`) — Apps Script puede devolver una respuesta que *parece* exitosa sin haber guardado nada, por un problema conocido de redirecciones internas de Google. La app de Christian ya se corrigió para chequear esto explícitamente.
    - El campo `monto` es texto, no número — hay que convertirlo antes de hacer sumas o comparaciones.
    - No hay paginación en `get` — siempre devuelve el arreglo completo.

---

**URL `/exec` actual:** la misma que ya usa el Dash — Christian no cambió la URL, solo el código detrás de ella (ver Parte B, aplicada).

**Preguntas que no se pudieron responder desde el código** (requieren confirmación directa de Christian): 1 (cuenta de Google dueña), 21 (configuración exacta de "Ejecutar como"/"Quién tiene acceso" en el panel de Apps Script), 25 (cantidad actual de registros).
