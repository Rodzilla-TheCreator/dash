# Bitácora de Control — SGI (app de Christian)

Copia de la app de control interno de Montasa Handling Co. (MONHACO):
Caja Chica, Gastos de Viaje, Almacén, Extintores, Botiquín, Incidentes,
No Conformidades, Marketing y consumo de luz, con flujo de aprobación por roles.

- **`index.html`** — la app completa (frontend, un solo archivo autocontenido).
  Servida en GitHub Pages queda en `.../dash/bitacora/`.
- **`Code.gs`** — el backend (Google Apps Script), incluido como referencia/versionado.
  NO corre desde este repo; vive en la cuenta de Google dueña de la Hoja.
- **`docs/`** — esquema de datos, rundown técnico, guía SAP y manual de usuario.

## Backend / datos

`index.html` apunta (constante `API_URL`, ~línea 252) al mismo Apps Script `/exec`
que ya usa Christian en producción. **Esta copia lee y escribe la Hoja de Google
REAL de Christian** — no es una base aislada. Si se quiere una copia independiente,
hay que levantar una Hoja + Apps Script nuevos (ver `docs/README-original-christian.md`)
y cambiar `API_URL`.

## Seguridad

- El endpoint `/exec` es abierto (sin token) — limitación conocida del backend.
- Los códigos de acceso de los roles viven en la Hoja (`auth-config`), hasheados
  SHA-256, no en este HTML.
- El respaldo con datos reales está en `data/respaldo-control-auditorias-2026-08-17.xlsx`
  (incluido a pedido, aun sin capa de seguridad — el repo es público). Es un
  **snapshot** exportado desde la app (una hoja por módulo), no la base viva.
  La base viva sigue siendo la Google Sheet detrás de `API_URL`.
