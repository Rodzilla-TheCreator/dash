# Dash

El tablero de la raíz es el **Tablero de Flota** que pidió Cristian: cuántos equipos
hay, cuáles generan renta, cuáles están parados y cuánta plata representan. Página
autocontenida (un solo `index.html` con CSS y JS adentro).

- **En vivo**: los conteos salen de RADAR (`/api/dashboard`) cada vez que se abre.
- **Corte**: el reparto por empresa y el dinero potencial son una **foto fechada**
  hecha con SQL, porque el endpoint no los entrega abiertos por empresa.
- **Taller y Oficina**: leen Firebase Realtime Database por REST.

Se despliega con GitHub Pages.

> **Hubo otro dash acá y ya no está.** Era el de Omar, con tiles de KPIs, caja chica
> y el botón de MUNDO. Se quitó el 25 de septiembre de 2026: el tablero de Cristian
> lo reemplazó en la raíz y **no se le mezcló nada** de aquel, a propósito. Lo que
> Omar necesitaba ver quedó en el reporte que se le mandó aparte.
>
> Consecuencia a tener presente: **al Mundo ya no se entra desde el dash.** Se abre
> directo en `mundo/`. Si alguna vez hace falta el botón, hay que agregarlo a mano.

## Módulos

- `index.html` — el Tablero de Flota (el de Cristian).
- `cristian/` — **solo un cartel que redirige a la raíz.** El tablero vivía ahí y el
  link viejo anda repartido en WhatsApp y en pantallas de inicio; un 404 no le explica
  nada a nadie.
- `mundo/` — **Mundo Montasa**: la misma operación como un mundo isométrico
  pixel-art recorrible (taller, patio, campo/clientes, contabilidad, bodega,
  oficina). Se entra desde el botón **MUNDO ▸** del header. Ver
  [`mundo/README.md`](mundo/README.md).
- `mundo/oficina.html` — **Oficina Virtual**: cada empleado entra con su
  código de Bitácora SGI y trabaja con agentes de IA (Claude) sobre los
  datos reales. Las tareas salen de la base; ninguna escritura ocurre sin
  que el empleado la autorice en pantalla. Necesita el proxy de
  [`mundo/servidor/`](mundo/servidor/README.md) para tener motor.
- `mundo/procesos/` — la entrevista que cada empleado corre en **su propio
  Claude** para que sus agentes trabajen con su proceso real y no con uno
  supuesto. No necesita API. Ver [`mundo/procesos/README.md`](mundo/procesos/README.md).
- `mundo/claude-code/` — el puente para enganchar el Claude Code de cada
  empleado a su oficina: levanta sus encargos, los trabaja en su máquina y
  devuelve el resultado.
- `bitacora/` — app SGI de control interno (fork de la de Christian).
