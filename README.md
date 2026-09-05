# Dash de Omar

Tablero de operaciones para Omar (Montasa / Monhaco / Monhagro).
Página web autocontenida (un solo archivo `index.html` con CSS y JS embebidos) + PWA.

- **Flota** y **Mantenimientos**: leen Firebase Realtime Database por REST.
- **Caja Chica**: lee/escribe el Apps Script de Christian vía JSONP.
- **Finanzas / Mecánicos / Almacén**: sin conectar (muestran "Sin conectar").

Se despliega con GitHub Pages. Refresca datos cada 60 s.

## Módulos

- `index.html` — el dash (tiles de KPIs).
- `mundo/` — **Mundo Montasa**: la misma operación como un mundo isométrico
  pixel-art recorrible (taller, patio, campo/clientes, contabilidad, bodega,
  oficina). Se entra desde el botón **MUNDO ▸** del header. Ver
  [`mundo/README.md`](mundo/README.md).
- `bitacora/` — app SGI de control interno (fork de la de Christian).
