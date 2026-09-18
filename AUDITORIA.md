# Auditoría de indicadores — 2026-09-18

Revisión de los tres tableros (**Oficina**, **Taller**, **Cristian**) contra los datos vivos
de RADAR y de la base de Miguel. No es una lista de ideas: cada punto se comprobó
consultando la fuente, y dice cómo.

**Resumen:** de 78 indicadores, **36 de los 37 de RADAR dan dato correcto**. Los problemas
están casi todos del lado del taller, y **cuatro dan números que parecen buenos y están
mal** — que es peor que no tener el dato.

---

## 🔴 Dan un número creíble y es falso

Estos son los urgentes. Alguien puede tomar una decisión con ellos.

### 1. `4.5` Viáticos pendientes dice **0** y no hay de dónde leer

El Dash lee `bitacora/data-viajes`, **ese nodo no existe**, y el manejo de error convierte
la falta de datos en un arreglo vacío. Resultado: la tarjeta dice *"0 viáticos por revisar"*,
que se lee como "no hay pendientes" cuando la verdad es "no hay fuente".

Y los viáticos **sí existen**: están dentro de las órdenes de taller (`viaticos`), que es de
donde los saca `T7.1`. Son L 45,880 en 8 viajes.

**Arreglo:** que `4.5` lea las órdenes como `T7.1`, o que muestre hueco. Cero no.

### 2. `T3.1` `T3.2` `T3.3` `T6.3` — el ranking por técnico no es por técnico

**97 de 188 órdenes** traen varios nombres en un solo campo `tecnico`:

```
"Miguel (Pruebas), Jonathan Martinez, Kevin Deras, Elkin Perez, Fernando Benavides, Eliberto Peña"
```

Los cuatro indicadores agrupan por ese texto completo, así que **cada combinación de cuadrilla
cuenta como un técnico distinto** y el trabajo de una persona queda repartido entre todas las
combinaciones en las que aparece. Por eso `T3.3` muestra filas como
*"Elkin Perez, Fernando Benavides — 1"*.

**Arreglo:** partir el campo por coma y contar por persona. Una orden de cuadrilla cuenta
para cada integrante (o se reparte, pero hay que decidirlo y decirlo).

**Bonus del mismo hallazgo:** *"Miguel (Pruebas)"* aparece en la producción. Hay registros de
prueba mezclados con los reales.

### 3. `T7.4` — **403,229 km en 28 viajes** es imposible

Son 14,400 km por viaje. `kmSalida` y `kmRetorno` son **lecturas absolutas de odómetro**, no
distancias, y al menos un par está corrupto:

```
salida=399422   retorno=39999   →  −359,423     (se cayó un dígito)
salida=69528    retorno=69586   →  58           (este sí)
salida=397369   retorno=397471  →  102
```

El total se contamina con pares que pertenecen a odómetros distintos.

**Arreglo:** tope por viaje (nada de más de ~2,000 km) y descartar lo que no pase, diciendo
cuántos se descartaron.

### 4. `T4.3` Fallas más repetidas — la falla número uno es la palabra **"prueba"**

```
prueba                                          9×
Preparación de equipo para renta en El Salvador 6×
Reparaciones hidráulicas varias                 4×
Aseo del taller                                 2×
```

Ninguna de las tres primeras es una falla. Son registros de prueba y trabajos que no son
averías.

**Arreglo:** el campo `falla` es texto libre y no sirve para rankear tal cual. `T4.1`
(por `sistema`) sí funciona porque ese campo es una lista cerrada. O se limpia el dato en el
origen, o este indicador se retira.

---

## 🟡 El número es correcto pero la etiqueta miente

### 5. `5.2` Utilización de flota: **58% en Oficina, 67.6% en el de Cristian**

El mismo indicador, dos números, porque cada tablero usa otra fuente:

| | fuente | rentados | total | utilización |
|---|---|---|---|---|
| Oficina | Firebase (app de Miguel) | 123 | **212** | **58%** |
| Cristian | RADAR `/api/dashboard` | 123 | **182** | **67.6%** |

Coinciden en los rentados. Difieren en el denominador: RADAR **excluye** 107 no rentables y
21 vendidos; Firebase los cuenta todos.

Ninguno está "mal" — miden cosas distintas con el mismo nombre. Pero el día que alguien
compare los dos tableros, deja de creerle a los dos.

**Arreglo:** una sola definición de "flota rentable", y que ambos la usen. La de RADAR es la
correcta para utilización.

### 6. `5.1` llama **"Mant."** a los equipos en **MAL ESTADO**

`bucketEstado()` mapea `MAL ESTADO` al balde `mant`. Un equipo en mal estado no
necesariamente está en mantenimiento. Son 47 equipos etiquetados con algo que no son.

### 7. `T1.4` Órdenes por prioridad — cuenta **todas las órdenes de la historia**

Muestra `Normal 78 · Alta 39 · Urgente 36` = 153, que son todas las órdenes, cerradas
incluidas. El título dice "órdenes por prioridad" y en un tablero eso se lee como "las
abiertas ahora". Las abiertas son **4**.

### 8. `T6.1` "142 de 142 solicitudes sin entregar"

Cien por ciento pendiente no es creíble, y la razón es que **el único estado que existe es
`Enviada`** — las 142 lo tienen. El flujo nunca marca la entrega, o ese campo no se usa.

El número es literalmente cierto y como indicador no dice nada.

### 9. `T7.1` `T7.2` Viáticos — sin ventana de tiempo

Suman **todos los viáticos de la historia** (L 45,880 en 8 viajes). En un tablero se leen
como del mes.

### 10. `1.2` Ventas vs meta — badge **"live"** sin nada que mostrar

Es el único de los 37 de RADAR que devuelve `null`, y por un motivo legítimo: RADAR dice
*"No hay metas cargadas para este mes"*. Pero el badge sigue diciendo `live`, así que promete
un dato que no hay hasta que se hace clic.

En el tablero de Cristian esto **ya está bien**: muestra hueco con la nota de RADAR.

---

## 🟢 Comprobados y sanos

- **36 de 37 mapeadores de RADAR** devuelven dato: ventas, pipeline completo, cobros con su
  antigüedad, clientes, tipo de cambio, marketing.
- `4.2` y `4.3` (cuentas por pagar, cashflow proyectado) están marcados `gap` y muestran su
  hueco. Eso es correcto, no un defecto.
- Los 8 de `NO_DISP` muestran la razón que da RADAR, no una inventada.
- `T2.1` `T2.2` (tiempos por servicio y por sistema) traen la mediana, el rango y el `n`, y
  aplican la corrección del desfase UTC. `T8.2` reporta cuántas corrigió: 43.
- `T8.1` `T8.3` son indicadores de calidad de dato y funcionan como deben: 4 órdenes sin
  tiempo, 186 de 212 equipos sin horómetro.

---

## Cómo se comprobó

- **RADAR:** los 37 mapeadores corridos en Node contra el payload real de
  `GET /api/dashboard?empresa=all`, contando cuáles devuelven `null`.
- **Firebase:** los 27 de Taller y los 6 de Oficina renderizados en el navegador con datos
  vivos, y los campos sospechosos (`tecnico`, `estado` de solicitudes, `kmSalida`/`kmRetorno`,
  `falla`) contados directo contra la base.
- **Supabase:** se usó para el potencial de renta y para confirmar la composición de flota.

## Orden sugerido

1. Los cuatro rojos, en ese orden. El `4.5` es el más barato y el más peligroso.
2. El `5.2`, porque es el que rompe la confianza en los dos tableros a la vez.
3. Las etiquetas (5, 6, 7, 9) son media hora cada una.
4. `T4.3` y `T6.1` necesitan una decisión sobre el dato de origen, no código. Eso es
   conversación con Miguel.
