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

Esta copia es **independiente de Christian**. NO usa Google Sheets ni su Apps Script.
La capa de almacenamiento (`storageGet/GetSafe/Set`, ~línea 252) apunta a
**Firebase Realtime Database** — el mismo proyecto que ya usa el Dash de Omar:

- Base: `https://montasa-app-default-rtdb.firebaseio.com`
- Espacio propio: **`/bitacora/{key}`** (aislado de `montasa`/`monhaco`).
- Cada clave (`data-cajachica`, `data-viajes`, `auth-config`, `cajachica-fondo-*`, …)
  se guarda como JSON nativo. Firebase manda CORS, así que `fetch` GET/PUT funciona
  desde este sitio estático — sin permisos de Google, sin depender de nadie.

La base **arranca vacía**: al abrir por primera vez, la app pide crear los códigos
de acceso de cada rol (se guardan en `/bitacora/auth-config`, hasheados SHA-256).

El módulo **Órdenes de Compra (SAP)** queda deshabilitado en esta copia (ese puente
vive en el Apps Script de Christian).

## Datos / respaldo

`data/respaldo-control-auditorias-2026-08-17.xlsx` es el respaldo que envió Christian,
pero **está vacío** (las 10 hojas sin registros) — no había nada que importar. Si se
consigue un respaldo CON datos, se puede sembrar en Firebase.

## Seguridad

- Firebase está con reglas **abiertas** (lectura y escritura sin auth) — igual que
  hoy lo usa el Dash. Es una limitación conocida; sin capa de seguridad todavía.
- Los códigos de acceso de los roles se guardan hasheados SHA-256, no en este HTML.
