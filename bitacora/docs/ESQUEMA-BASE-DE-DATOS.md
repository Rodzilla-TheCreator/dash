# Esquema de Base de Datos — Bitácora de Control SGI

La "base de datos" hoy es una **Google Sheet** con una sola pestaña llamada **`Data`**, con dos columnas: `key` y `value`. Es un almacén clave-valor: cada clave guarda **un string JSON completo** (normalmente un arreglo con todos los registros de ese módulo).

Si se va a replicar en otro motor (Postgres, Firebase, Mongo, etc.), lo más directo es: **una colección/tabla por clave**, donde cada documento/fila es uno de los objetos del arreglo JSON.

---

## Lista completa de claves

| Clave | Contenido | Estructura |
|---|---|---|
| `data-cajachica` | Movimientos de Caja Chica (gastos y reposiciones) | Arreglo de objetos — ver esquema abajo |
| `data-viajes` | Gastos de Viaje | Arreglo de objetos |
| `data-almacen` | Entradas/salidas de inventario | Arreglo de objetos |
| `data-extintores` | Inventario de extintores | Arreglo de objetos |
| `data-incidentes` | Incidentes de seguridad | Arreglo de objetos |
| `data-botiquin` | Entradas/salidas de insumos médicos | Arreglo de objetos |
| `data-ambiente` | Registros de consumo de luz | Arreglo de objetos |
| `data-marketing` | Campañas de marketing digital | Arreglo de objetos |
| `data-noconformidades` | Hallazgos de auditoría | Arreglo de objetos |
| `data-bitacora` | Historial de cambios de toda la app (máx. 500 entradas, las más viejas se descartan) | Arreglo de objetos |
| `cajachica-fondo-SPS` | Fondo fijo de Caja Chica, sede SPS | Objeto único: `{"monto": number}` |
| `cajachica-fondo-Choloma` | Fondo fijo de Caja Chica, sede Choloma | Objeto único: `{"monto": number}` |
| `cajachica-fondo-General` | Fondo fijo de Caja Chica, categoría General | Objeto único: `{"monto": number}` |
| `auth-config` | Códigos de acceso de los 11 roles (hash SHA-256, no texto plano) | Objeto: `{"roles": {"<rol_id>": {"code": "<hash>"}}}` |

---

## Esquema de cada tipo de registro

### `data-cajachica` (Caja Chica)
```json
{
  "id": "m9k2p1x7a",
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
  "registradoPor": "Almacén SPS",
  "registradoEn": "2026-08-12T15:03:11.000Z",
  "fechaLiquidacion": null,
  "decididoPor": null,
  "decididoEn": null,
  "ultimaModificacionPor": null,
  "ultimaModificacionEn": null
}
```
- `sede`: `"SPS"` | `"Choloma"` | `"General"`
- `tipo`: `"Gasto"` | `"Reposición de fondo"`
- `estado`: `"Pendiente de liquidar"` → `"Enviado a revisión"` → `"Aprobado por Gerencia"` → `"Liquidado"` (o `"Rechazado"` en vez de aprobar)
- `monto`: string numérico (ej. `"620.00"`), no number — siempre en Lempiras (HNL)

### `data-viajes` (Gastos de Viaje)
```json
{
  "id": "m9k3x0a2b",
  "fecha": "2026-08-10",
  "viajero": "Juan Pérez",
  "destino": "Tegucigalpa",
  "motivo": "Visita a cliente",
  "categoria": "Transporte",
  "monto": "450",
  "anticipo": "500",
  "estado": "Aprobado por Gerencia",
  "comprobante": "R-882",
  "notas": "",
  "registradoPor": "Ventas 1",
  "montoReembolsado": null,
  "fechaLiquidacion": null
}
```
- `estado`: mismo flujo de 4 pasos que Caja Chica (con `"Pendiente de rendir"` como estado inicial en vez de `"Pendiente de liquidar"`).

### `data-almacen` (Entradas/Salidas de inventario)
```json
{
  "id": "m9k4a1c3d",
  "fecha": "2026-08-11",
  "sede": "Choloma",
  "tipo": "Entrada",
  "producto": "Tornillos 1/4",
  "cantidad": "200",
  "unidad": "unid",
  "motivo": "Compra",
  "responsable": "Bodeguero",
  "notas": "",
  "registradoPor": "Almacén Choloma"
}
```
- `tipo`: `"Entrada"` | `"Salida"`

### `data-extintores`
```json
{
  "id": "m9k5b2d4e",
  "codigo": "EXT-001",
  "ubicacion": "Bodega SPS - pasillo principal",
  "tipo": "PQS",
  "capacidad": "6 kg",
  "ingreso": "2026-01-15",
  "vencimiento": "2027-01-15",
  "notas": ""
}
```

### `data-incidentes`
```json
{
  "id": "m9k6c3e5f",
  "fecha": "2026-08-09",
  "tipo": "Casi accidente",
  "lugar": "Taller SPS",
  "gravedad": "Moderado",
  "personaInvolucrada": "N/A",
  "responsable": "Jefe de Taller",
  "estado": "Abierto",
  "descripcion": "Montacargas casi golpea a operario",
  "accionTomada": "Se reforzó señalización"
}
```
- `gravedad`: `"Leve"` | `"Moderado"` | `"Grave"`
- `estado`: `"Abierto"` | `"Cerrado"`

### `data-botiquin`
```json
{
  "id": "m9k7d4f6g",
  "tipo": "Entrada",
  "producto": "Alcohol en gel",
  "categoria": "Material",
  "cantidad": "10",
  "unidad": "frasco",
  "fecha": "2026-08-01",
  "caducidad": "2027-08-01",
  "lote": "L-22",
  "responsable": "RRHH",
  "notas": ""
}
```
- `tipo`: `"Entrada"` | `"Salida"` (la caducidad solo aplica a las Entradas)

### `data-marketing`
```json
{
  "id": "m9k8e5g7h",
  "fecha": "2026-08-05",
  "plataforma": "Facebook/Instagram (Meta)",
  "campana": "Promo agosto",
  "objetivo": "Leads",
  "presupuesto": "5000",
  "invertido": "4800",
  "resultado": "120 leads",
  "estado": "Activa",
  "responsable": "Mercadeo",
  "comprobante": "",
  "notas": ""
}
```

### `data-noconformidades`
```json
{
  "id": "m9k9f6h8i",
  "fecha": "2026-08-03",
  "modulo": "Caja Chica",
  "clasificacion": "No conformidad",
  "responsable": "Christian",
  "fechaCompromiso": "2026-08-20",
  "estado": "Abierta",
  "fechaCierre": "",
  "descripcion": "Gasto sin comprobante",
  "accion": "Solicitar factura",
  "evidencia": ""
}
```
- `clasificacion`: `"No conformidad"` | `"Observación"`
- `estado`: `"Abierta"` | `"Cerrada"`

### `data-bitacora` (Historial de Cambios)
```json
{
  "id": "m9k0g7i9j",
  "fecha": "2026-08-12T15:04:00.000Z",
  "accion": "Cambió estado",
  "modulo": "Caja Chica",
  "descripcion": "Gasto: Reembolso combustible · L 620.00 → estado: Liquidado",
  "usuario": "Contabilidad"
}
```
- `accion`: `"Creó"` | `"Editó"` | `"Cambió estado"` | `"Eliminó"`

---

## Identificadores

Todos los `id` se generan del lado del cliente (JavaScript), no son correlativos secuenciales:
```javascript
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
```
Son únicos en la práctica, pero **no son folios legibles** (ej. no son 1, 2, 3...).

## Roles (para la tabla de usuarios/permisos, si se replica aparte)

`gerente_general`, `gerente_comercial`, `rrhh`, `almacen_sps`, `almacen_choloma`, `ventas1`, `ventas2`, `ventas3`, `ventas4`, `contabilidad`, `admin`.
