# Auditoría de indicadores — 2026-09-18

> **Segunda pasada, 18 de septiembre.** A los cuatro rojos del principio se les sumaron
> siete hallazgos más (12 a 18) al revisar los 78 indicadores del tablero de Cristian uno por
> uno y contra datos vivos. Cada uno lleva ✅ o ⚠️ con lo que da ahora.
>
> **El más caro no estaba en el tablero nuevo sino en el de Oficina:** la renta del año se
> mostraba en $43,304 y son $1,170,070 — ver el hallazgo 12, que ahora trae las dos
> comprobaciones independientes. El 19 arregla la condición que lo permitió: que la pantalla
> no decía de qué moneda era nada.

Revisión de los tres tableros (**Oficina**, **Taller**, **Cristian**) contra los datos vivos
de RADAR y de la base de Miguel. No es una lista de ideas: cada punto se comprobó
consultando la fuente, y dice cómo.

**Resumen:** de los 78 del tablero de Cristian, **63 dan dato** y **15 salen como hueco con
el motivo escrito**. Ninguno sale con el texto genérico de "todavía no conectado", que era
mentira en seis de ellos: RADAR sí explica qué le falta y ahora se muestra su explicación.

**28 de los 63 se parten por empresa**, y cuáles no se adivinó: se pidió el endpoint con los
cuatro cortes y se sumaron las empresas contra el grupo. Los del taller se parten por los dos
nodos de Firebase que existen.

El patrón de todos los hallazgos es el mismo y vale más que la lista: **acá los datos no
fallan con un error, fallan devolviendo un número.** Cero, el mismo número repetido, o el
número correcto dividido entre 27.

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

✅ **Hecho.** `cargarViajes()` ahora distingue "el nodo devolvió null" de "la lista está
vacía", y la tarjeta muestra el hueco con el motivo y manda a `T7.1`. Verificado: dice
*"El nodo data-viajes no existe…"* en vez de `0`.

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

✅ **Hecho.** Se agregó `personas()` y `topPersonas()`: parten por coma, descartan los
registros de prueba, y una orden de cuadrilla suma a cada integrante (las horas que esa
persona estuvo, no una fracción). Antes `T3.1` mostraba cuadrillas con 1 o 2; ahora:
Fernando Benavides 78, Kevin Deras 64, Jonathan Martinez 64, Elkin Perez 54. `T3.2` da
236h 30min para el primero. También corregidos `T3.3` y `T6.3`.

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

✅ **Hecho.** Tope de 2.000 km por viaje. Pasó de **403.229 km en 28 viajes** a
**4.306 km en 27 viajes, 2 descartados por odómetro inconsistente** — unos 160 km por
viaje, que ya es creíble.

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

⚠️ **Parcial.** Se filtran los registros de prueba y los de aseo, y la tarjeta ahora avisa
que es texto libre y manda a `T4.1` para tendencia. Pero el primer lugar quedó
*"Preparación de equipo para renta en El Salvador"*, que tampoco es una avería: **el campo
mezcla trabajos con fallas y eso no se arregla del lado del tablero.** Queda para hablar
con Miguel.

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

### 11. `1.3` `1.4` `2.6` `10.1` en el de Cristian — cuatro listas que no leen nada

Los cuatro pedían un campo **que no existe en el payload**: `facturado` (el real es `mes`)
y `razon` (el real es `motivo`). `topLista` no se cae con eso: `undefined` sale como `—` y la
ordenada queda en cero, así que **se dibujaban los nombres correctos con todos los valores en
raya y en un orden que no era ranking**. En Oficina los mismos cuatro sí dan dato porque ahí
están escritos con el campo bueno.

✅ **Hecho.** Corregidos los nombres de campo. Ahora `1.3` da Audry Garcia $52,697 · 
Administracion $17,134 · Christian Quesada $14,372, y `10.1` Monhaco $82,768.

En el `1.4` se agregó de paso una conversión a dólares, copiando lo que hace Oficina.
**Eso estaba mal y se revirtió el mismo día** — ver el hallazgo 12.

**Hallazgo suelto:** `por_vendedor` trae *"Administracion"* y *"Administraci�n"* como dos
vendedores distintos — el mismo nombre con la tilde mal codificada en el origen. Pasa igual en
Oficina. Es dato de SAP, no del tablero.

### 12. 🔴 La renta del año aparecía en **$43,304** y son **$1,170,070**

El error más caro de toda la auditoría, y estaba en el tablero de **Oficina**, que es el que
mira Omar.

`fixUsd()` divide entre el tipo de cambio los montos de `ventas.por_categoria` y de
`flota.ingresos_renta_mes`. El comentario explicaba por qué: RADAR sumaba
`factura_lineas_sap.total_linea`, que viene en la moneda nativa del documento, así que los
montos llegaban en lempiras.

**Eso fue cierto y dejó de serlo.** RADAR ahora suma `total_usd`. Se comprobó por dos
caminos independientes, porque cambiar un número de dinero con una sola comprobación no
alcanza.

**Camino 1 — por categoría, contra la base.** Coinciden al centavo:

| | RADAR dice | `sum(total_linea)` | `sum(total_usd)` |
|---|---|---|---|
| renta | 1,170,070 | 73,729,645 | **1,170,070** |
| repuestos | 119,516 | 26,280,713 | **119,516** |
| venta_equipo | 223,435 | 5,913,120 | **223,435** |

Y la renta del mes: `flota.ingresos_renta_mes` = 72,366.77, y el SQL da 72,366.77.

**Camino 2 — la cabecera del documento en SAP, que no pasa por las líneas.** `facturas_sap`
trae su propia `moneda` y su propio `total_usd`:

| `moneda` | docs | `doc_total` (moneda nativa) | `total_usd` | razón |
|---|---|---|---|---|
| HNL | 440 | L 14,790,461 | $549,422 | 26.9 |
| USD | 370 | 1,133,501 | $1,133,501 | **1.00** |
| CRC | 7 | ₡4,217,686 | $8,190 | 515 |

**Un documento emitido en dólares tiene `doc_total` idéntico a `total_usd`.** Eso sólo puede
pasar si esa columna son dólares. Y las razones de los otros dos son exactamente el lempira y
el colón del día. Sumando las tres: **$1,691,113 contra los $1,691,809 que muestra RADAR** —
la diferencia son un par de documentos fuera del cruce. La renta de $1,170,070 es un
subconjunto de esos $1.69M, o sea que cierra por arriba también.

**Y la conversión, cuando haga falta, no se inventa:** Fabrizio mantiene `tipo_cambio_log`,
una fila por día y por empresa con la tasa, la fuente (BCH para Honduras, Hacienda-CR para
Costa Rica) y una bandera `sap_ok` de si se subió a SAP. Esa tabla es para convertir lo que
llegue en moneda nativa. Lo que ya viene en `total_usd` no se toca.

Así que seguir dividiendo hundía los números **27 veces**:

| | antes | ahora |
|---|---|---|
| `1.4` renta del año | $43,304 | **$1,170,070** |
| `5.3` renta del mes | $2,679 | **$72,367** |

Y no era sólo un número feo: con $43,304 la renta parecía el **2.6%** de lo facturado, cuando
es el **69%**. Una empresa de renta de montacargas se veía como si viviera de otra cosa.

✅ **Hecho** en los dos tableros. La función queda en el archivo con la explicación de por
qué ya no se usa y qué comprobar antes de volver a usarla — porque el día que RADAR cambie
otra vez, el comentario de hoy va a ser el que engañe.

`total_linea` no sirve para plata en ningún caso: mezcla LPS, USD y colones en la misma
columna, y las filas marcadas `USD` traen valores 545 veces más grandes que su `total_usd`.

### 13. 🔴 125 oportunidades tienen `empresa_id = 'all'`

Sumando los cuatro cortes de empresa contra el corte de grupo, el pipeline no cuadra: 1,113
contra 1,149 abiertas, y $5.46M contra $5.83M. Faltan 36 en el dashboard, y en la tabla la
causa es más grande:

```
honduras   2403    $15,348,294
costarica   219     $1,535,959
all         125       $638,204   ← el literal del filtro, no una empresa
monhagro      2        $32,037
```

**`'all'` es la palabra que usa el filtro, no una compañía.** Esas oportunidades aparecen en
el total del grupo y en ninguna empresa, así que no las ve nadie que mire su propio corte.

⚠️ **Mostrado, no arreglado.** El arreglo es de datos, no de tablero. Mientras tanto, los
cuatro indicadores partidos que lo sufren (`2.1`, `2.3`, `2.7`) dicen al pie cuántas quedaron
sin empresa, en vez de dejar que la suma no cuadre en silencio.

### 14. 🔴 Pedir por empresa devuelve ceros y repetidos, sin avisar

Este endpoint no falla con un error: falla devolviendo algo. Se probaron los cuatro cortes y
hay tres comportamientos distintos, y sólo uno es correcto:

| bloque | qué pasa al pedir por empresa |
|---|---|
| ventas, cobros, cashflow, clientes | **suma igual al grupo** — se puede partir |
| `flota.*`, `taller.equipos_en_reparacion` | **devuelve 0** en las cuatro |
| `actividad.*`, `leads.*`, `clientes.tickets`, `taller.mant_*`, `ventas.forecast` | **el mismo número en las cuatro** |

Lo tercero es lo peligroso: `leads.por_canal` da **882 en cada empresa y 881 en el grupo** —
o sea que ni filtra, ni cuadra, y por empresa da más que el total.

✅ **Hecho.** Los 28 que sí cuadran se parten en secciones por empresa. Los 15 que no traen
escrito el motivo en la tarjeta, con el número comprobado. Ninguno se parte "por si acaso".

### 15. 🔴 `T8.3` decía **0 equipos sin horómetro** y son **186 de 212**

Un bug de una línea, en el tablero nuevo de Cristian. La función que lee números hacía
`Number(String(v))`, y `Number("")` es **0**, no `NaN`. Así que un horómetro en blanco no
contaba como "falta el dato" sino como **cero horas**, y el indicador de calidad de datos
reportaba calidad perfecta.

Arrastraba a dos más: el `10.3` decía lo mismo, y el texto del `T5.2` también.

✅ **Hecho.** Ahora: Montasa 59 de 84, Monhaco 127 de 128, grupo 186 de 212 — el mismo número
que da Oficina, que es la comprobación.

### 16. 🟡 `4.4` Caja chica: 15 registros, los 15 liquidados, todos del mismo día

El nodo existe y tiene datos, así que "0 pendientes" habría pasado por dato bueno. Pero los
15 registros que hay están todos en `Liquidado`, todos en Choloma, todos cargados el
2026-08-06 con `origen: "Liquidacion MONHACO 2026-08-06 (Excel Christian)"`, por L 9,223.

No es una cola de gastos por aprobar: es **una carga de Excel que pasó una vez**. Cero
pendientes es literalmente cierto y como indicador no dice nada — el mismo caso que el `4.5`.

✅ **Hecho.** Sale como hueco explicando que son 15 de una sola carga, en vez de un cero.

### 17. 🟡 `T6.2` no muestra repuestos, muestra trabajos

El campo de las solicitudes es `desc` y trae *"Mantenimiento 250 horas"* (23 veces),
*"Cambio de aceite y filtros"*, *"prueba"*. Ninguno es un repuesto. La app no tiene campo de
pieza pedida.

✅ **Parcial.** Se filtran los registros de prueba y la tarjeta dice qué está contando. El
indicador no se puede tener hasta que la app guarde el repuesto.

### 18. 🟡 `T5.2` y `T5.3` no se pueden calcular sin inventar un intervalo

Los preventivos no traen fecha de próximo vencimiento. El intervalo está escrito en las notas
(*"Mantenimiento 250 horas"*), o sea que depende del horómetro — y el horómetro falta en 186
de 212 equipos (hallazgo 15).

✅ **Dicho, no inventado.** Salen como "No calculable" con el motivo y mandan al `6.1`, que
es la cuenta que RADAR sí lleva. Elegir un intervalo por defecto habría dado un número
inventado con cara de dato.

### 19. ✅ Ahora se ve de qué moneda es cada número

El hallazgo 12 pasó porque **nada en la pantalla decía en qué moneda estaba nada**. Un `$` a
secas, en Honduras, se lee como lempira más de una vez. Así que además de arreglar el número
se arregló la condición que permitió el error:

**En el código.** Los dos tableros tenían formateadores sueltos (`usd()`, `lps()`, `fmtL()`)
que decidían el símbolo por su cuenta. Ahora pasan por `dinero(monto, moneda)`, y **la moneda
es un argumento obligatorio que tira error si falta** — no se puede imprimir plata sin decir
de qué es. Arriba de esa función quedó la tabla de qué origen trae qué moneda y **cómo se
comprobó cada uno**, con el aviso de no convertir nada sin correr antes el SQL.

**En la pantalla.** Cada monto lleva su unidad escrita y su color: los dólares en verde, los
lempiras en ocre. Y hay una leyenda arriba de los widgets, no al pie, porque hay que saber
leer los números antes de mirarlos.

Se comprobó en el navegador: **125 montos, los 125 con unidad, 117 en dólares y 8 en
lempiras**, y ni un `$` suelto en ninguno de los dos tableros.

Lo que esto compra: los viáticos del taller (L 45,881) y la cartera de RADAR ($931,734) ya no
se pueden comparar de un vistazo como si fueran la misma plata.

### 20. 🔴 Hay **dos juegos de `empresa_id`** en la misma base, y `honduras` significa cosas distintas en cada uno

Salió de una pregunta de Rodz mirando la pantalla: la tabla de flota de arriba decía
*MT Rental / Monhaco / Honduras* y los indicadores de abajo decían *Monhaco / Monhagro /
Costa Rica*. No era un problema de etiquetas.

| tabla | valores de `empresa_id` |
|---|---|
| `equipos` (flota) | `monhaco` 219 · `mtrental` 89 · `honduras` 26 |
| `clientes`, `facturas_sap`, `oportunidades` (comercial) | `honduras` 3,800 · `montasa` 3,314 · `costarica` 1,553 · `monhagro` 4 |

**`honduras` está en los dos y no es lo mismo:** en la flota son 22 equipos, en lo comercial
es Monhaco con 2,291 facturas. `mtrental` no existe del lado comercial, y `monhagro` y
`costarica` no existen del lado de la flota.

Esto es más grave que un tablero mal rotulado. Cualquiera que cruce flota con facturación por
`empresa_id` —una consulta que parece obvia— va a unir cosas que no van juntas y el resultado
no va a dar error. Y es exactamente el tipo de pregunta que le van a hacer a Jarvis.

⚠️ **Mostrado, no arreglado.** Arreglarlo es migrar datos y eso es de Fabri. Mientras tanto,
cada tabla se muestra **con el nombre que usa su propia fuente y con el `empresa_id` literal
al lado**, y el aviso explica las dos particiones. Traducir una a la otra habría sido inventar
una equivalencia que nadie confirmó.

### 21. ✅ El ranking mostraba 4 vendedores y Oficina 6

No faltaba gente: **Oficina lista los que facturaron cero** y acá se filtraban. De los 13
vendedores que hay en SAP, **4 facturaron este mes**.

✅ **Hecho.** Se muestran hasta 6 por empresa y el pie dice *"4 de 13 facturaron este mes.
Los otros 9 están en SAP sin facturación, por eso no aparecen — el tablero de Oficina sí los
lista, en cero"*. La diferencia entre los dos tableros deja de ser un misterio y pasa a ser
una frase.

De paso: la cuenta del pie sale del corte de **grupo**. La primera versión sumaba los ceros de
las tres empresas y daba 13 en vez de 9, porque cada payload por empresa trae la lista
completa de vendedores.

### 22. ✅ Media pantalla en blanco

Los widgets tenían dos cosas que les sobraban, y las dos eran suposiciones mías y no del
contenido:

1. Una clase `h2` de **alto doble fijo** (232px) aplicada a 20 indicadores. El ranking de
   vendedores llenaba 90px y ocupaba 232.
2. La rejilla estiraba cada tarjeta al alto de **la más alta de su fila**, así que un número
   solo quedaba con media tarjeta vacía si le tocaba al lado de una lista de siete filas.

✅ **Hecho.** Se quitó `h2` —el alto ahora lo pone el contenido— y la rejilla va con
`align-items:start`. Las alturas pasaron de un bloque plano de 232px a un rango de **96 a
242px** según lo que cada uno tenga que decir.

Y el ancho también dejó de ser fijo: **si un indicador termina dibujando cuatro secciones**
—pasa cuando Montasa HN, que está retirada, sí tiene número— **se ensancha solo** de dos a
tres columnas. Son siete los que lo hacen.

Comprobado en el navegador: **cero textos recortados** en escritorio y en teléfono, contra
cinco que había antes (nombres largos de deudores y de sistemas). Los que igual no caben
ahora llevan el nombre completo en el `title`.

### 23. ✅ Media pantalla sin usar, y tarjetas infladas por su propia explicación

Tres cosas separadas que se veían como una sola:

**El lienzo tenía `max-width:1180px`.** En un monitor de 1360 eso dejaba 180px muertos a la
derecha, y en uno de 1920 sobraba media pantalla. Se quitó el tope: la rejilla reparte el
ancho en más columnas, no en columnas más gordas. Pasó de 4 a **6 columnas** a 1360px, y el
espacio muerto de 180px a 15 (la barra de scroll). Los bloques de texto corrido sí conservan
tope, que es donde el ancho sí molesta.

**El mínimo de un widget era muy grande.** Bajó de 226 a **184px**, con menos relleno y
tipografía más chica. Y 22 indicadores que tenían ancho doble volvieron a una columna: un
conteo o un porcentaje no necesitan dos.

**Las notas inflaban la tarjeta.** Un dato de una línea con tres líneas de explicación debajo
deja de ser un dato de una línea. Las notas **no se borraron** —son la mitad del valor de esta
auditoría— pero se fueron detrás de un botón `?` en el encabezado. Son 23 tarjetas las que lo
tienen; quien quiera el detalle lo abre.

De paso, las etiquetas de las listas **se parten en dos líneas en vez de recortarse con
puntitos**. Al angostar las tarjetas, *"Unicamente para presupuesto del cliente"* o el nombre
de un cliente no caben en una línea, y cortarlos dejaba el dato ilegible. Cuesta un renglón
sólo en las filas que lo necesitan.

Comprobado a 1360px y en teléfono: **cero textos recortados, cero desbordes, cero scroll
horizontal**. Las alturas van de 83 a 284px con mediana de 133, contra el bloque plano de
232px de antes.

### 24. ✅ El panel decía de qué base sale el dato, no si hay dato

La insignia de cada indicador en el panel escondido decía `radar` o `taller` — o
sea, **de dónde sale**. Esa es la pregunta equivocada: a quien marca casillas no le importa de
qué base viene, le importa si va a ver un número. Y había indicadores etiquetados `radar` que
al marcarlos salen vacíos: el `1.2` es el caso claro, porque RADAR no tiene metas cargadas. La
insignia prometía algo que la tarjeta no cumplía.

✅ **Hecho.** Ahora dice `radar fix` o `taller fix` cuando ese indicador **no da dato en vivo**.
Son **15 de 78**, y el pie del panel lo resume en una línea. Se eligió «fix» y no «sin dato»
porque casi ninguno está roto en el tablero: les falta algo en el origen, y arreglarlo es
trabajo de Fabri o de Miguel.

Tres decisiones que valen más que el cambio:

**La insignia y la tarjeta salen de la misma función.** Si la marca tuviera su propia lógica,
podría decir «radar» mientras la tarjeta sale vacía, y entonces el panel estaría mintiendo
sobre el tablero. Comprobado en el navegador: **cero desacuerdos** entre lo que marca la
insignia y lo que renderiza la tarjeta, en los 78.

**No se marca hasta que las dos fuentes contestaron.** La primera versión miraba la etiqueta
del catálogo para saber a qué fuente esperaba cada indicador, y **esa etiqueta miente en
cuatro**: el `5.1`, el `5.2`, el `6.1` y el `10.3` dicen «taller» y en realidad leen RADAR. Con
eso, ocho salían marcados `fix` sólo porque Firebase había contestado antes que RADAR. Un
`fix` falso en una presentación es peor que no tener la marca, así que ahora espera a las dos
y mientras tanto el pie dice por qué no hay marcas.

**Se retiró la etiqueta `falta`.** Los dos indicadores que la tenían (`4.2`, `4.3`) son de
RADAR igual; lo que les pasa es que RADAR no los puede calcular, que es exactamente lo que
dice `fix`. Tener una tercera palabra daba `falta fix`, que no se lee.

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
- **Supabase:** se usó para el potencial de renta, para confirmar la composición de flota,
  para saber qué columna suma RADAR en las categorías (hallazgo 12) y para encontrar el
  `empresa_id='all'` (hallazgo 13).
- **Los cuatro cortes por empresa** (`?empresa=honduras|montasa|monhagro|costarica`) se
  bajaron y se sumaron contra `?empresa=all`, métrica por métrica. Es lo que separó los 28
  que se pueden partir de los 15 que no.
- **Los 78 del tablero de Cristian** se renderizaron en el navegador con los payloads reales
  y se leyó el texto de cada tarjeta. Así salieron el `T8.3` en cero (hallazgo 15), los ids
  opacos del `T4.2` y el `null` que imprimía el `2.6`.

## Orden sugerido

1. Los cuatro rojos, en ese orden. El `4.5` es el más barato y el más peligroso.
2. El `5.2`, porque es el que rompe la confianza en los dos tableros a la vez.
3. Las etiquetas (5, 6, 7, 9) son media hora cada una.
4. `T4.3` y `T6.1` necesitan una decisión sobre el dato de origen, no código. Eso es
   conversación con Miguel.
