# Bitácora de Control — Sistema de Auditorías SGI (Montasa Handling Co.)

App de control interno: Caja Chica, Gastos de Viaje, Almacén, Extintores, Botiquín, Incidentes de Seguridad, No Conformidades, Marketing Digital y consumo de luz — con un flujo de aprobación de varios pasos entre distintos roles.

## Arquitectura (3 piezas)

```
control-auditorias.html  →  Code.gs (Google Apps Script)  →  Google Sheet ("BD Control Auditorias MONHACO")
     (frontend, 100%          (backend, hace de puente          (base de datos real —
      HTML/JS, sin build)      hacia la Hoja y hacia SAP)         pestaña "Data", clave-valor)
```

- **`control-auditorias.html`** — la app completa. Un solo archivo, sin dependencias de build. Se puede servir como página estática desde cualquier lado (Netlify, GitHub Pages, etc.).
- **`Code.gs`** — el código que corre en Google Apps Script. No vive en este repo por defecto (vive en la cuenta de Google del dueño de la Hoja) — se incluye aquí como referencia y para poder versionarlo.
- **La Google Sheet** — no es un archivo de este repo; es un recurso externo. Ver `ESQUEMA-BASE-DE-DATOS.md` para replicar su estructura en otro motor si hace falta.

## Cómo levantar una copia desde cero

1. **Base de datos:** crear una Google Sheet nueva, con una pestaña llamada `Data` (columnas `key`, `value` en la fila 1).
2. **Backend:** en esa Hoja, ir a Extensiones → Apps Script, pegar el contenido de `Code.gs`, y publicarlo como aplicación web (Implementar → Nueva implementación → tipo "Aplicación web" → Ejecutar como "Yo" → Acceso "Cualquier persona"). Copiar la URL que termina en `/exec`.
3. **Frontend:** abrir `control-auditorias.html`, buscar la línea `const API_URL = '...'` y pegar ahí la URL del paso 2. Servir el archivo desde donde se prefiera (Netlify, GitHub Pages, etc.).
4. **SAP (opcional, Fase 1 en construcción):** si se va a conectar con SAP Business One, rellenar las 4 variables al inicio de `Code.gs` (`SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD`) — ver `guia-integracion-sap-fase1.md`.

## Archivos de este paquete

| Archivo | Qué es |
|---|---|
| `control-auditorias.html` | La aplicación completa (frontend) |
| `Code.gs` | El backend (Google Apps Script) — clave-valor + puente a SAP + integración con el Dash de Omar |
| `ESQUEMA-BASE-DE-DATOS.md` | Estructura completa de datos: todas las claves, campos y ejemplos reales de cada tipo de registro |
| `rundown-app-christian.md` | Levantamiento técnico completo: roles, endpoints, flujos, seguridad, límites conocidos |
| `guia-integracion-sap-fase1.md` | Cómo conectar con SAP Business One (Service Layer) y con el Dash de Omar (JSONP) |
| `manual-de-usuario-bitacora-control.docx` | Manual de usuario funcional — qué hace cada pantalla, para quien vaya a usar la app, no a programarla |

## Notas importantes de seguridad antes de subir esto a un repo compartido/público

- **`Code.gs` NO debe subirse con las credenciales de SAP rellenadas.** Si ya se configuraron (`SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USERNAME`, `SAP_PASSWORD`), hay que sacarlas de ahí primero y moverlas a **Script Properties** de Apps Script (configuración por fuera del código), dejando el archivo del repo con placeholders.
- El endpoint de Apps Script (`/exec`) es **abierto** — cualquiera con la URL puede leer o escribir cualquier clave de la Hoja. Es una limitación conocida y aceptable para un equipo interno pequeño, pero no es seguridad de nivel empresarial. Si esto se va a productizar más, valdría la pena agregarle algún control de acceso (token compartido, por ejemplo).
- Los códigos de acceso de los roles (dentro de la app) se guardan con hash SHA-256, no en texto plano.

## Datos reales (semilla)

Este paquete **no incluye los datos reales** de Montasa (los gastos, movimientos, etc.) — esos siguen viviendo en la Google Sheet original. Si se necesita una copia de los datos actuales para poblar una réplica, Christian puede generarla desde dentro de la app: **Configuración → "📦 Descargar respaldo completo"** (rol Admin) — genera un Excel con una hoja por cada módulo, con todos los datos tal como están hoy.
