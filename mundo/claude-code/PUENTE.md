# Puente: tu Claude Code y tu oficina

> **Para el empleado:** pegá este archivo en tu **Claude Code**. Desde ahí va a
> poder ver los encargos que te mandaron a tu oficina del Mundo Montasa,
> trabajarlos en tu máquina, y devolver el resultado. Vos lo prendés cuando
> querés y lo apagás cuando querés: nadie entra a tu máquina, es tu Claude el
> que sale a buscar.

---

## Por qué es "tu Claude sale a buscar" y no al revés

La idea natural sería que la oficina en el navegador le hable directo a tu
Claude Code. No se hace así, por tres razones concretas:

1. **El teléfono no llega a tu laptop.** La oficina está hecha para el celular.
   Tu Claude Code corre en tu computadora. El celular no puede abrir un puerto
   de tu máquina — están en redes distintas y no debería poder.
2. **Aunque estuvieras en la compu, es frágil.** Una página servida por HTTPS
   hablándole a un servidor local exige que ese servidor mande las cabeceras
   correctas, y el navegador puede exigir permisos de red local que cambian
   entre versiones. Funciona a veces. "A veces" no sirve para operación.
3. **Vos no siempre estás.** Si el puente dependiera de una conexión viva, un
   encargo que llega mientras almorzás se pierde.

Con el modelo de acá —tu Claude lee la fila cuando vos lo prendés— no hace
falta abrir ningún puerto, funciona igual desde cualquier máquina, y los
encargos esperan en la fila hasta que los mirás.

---

## Instrucciones para Claude Code

Sos el puente entre **el Mundo Montasa** (una app web de la empresa) y esta
máquina. Tu trabajo es levantar los encargos que le mandaron a esta persona,
ayudarla a resolverlos acá, y devolver el resultado al mundo.

### Configuración

Preguntale a la persona **cuál es su rol** si no lo sabés. Los roles son:
`gerente_general`, `gerente_comercial`, `rrhh`, `almacen_sps`,
`almacen_choloma`, `ventas1`…`ventas4`, `contabilidad`, `admin`.

La base es Firebase Realtime Database por REST:

```
BASE=https://montasa-app-default-rtdb.firebaseio.com/bitacora
```

### 1. Levantar la fila

```bash
curl -s "$BASE/mundo-encargos.json"
```

Filtrá los que tengan `"para_rol"` igual al rol de esta persona y
`"estado"` en `Entregado` o `Aceptado`. Cada encargo trae:

- `texto_original` — cómo lo escribió quien lo mandó
- `traduccion` — el mismo pedido traducido al proceso de esta persona por el
  Centro de Distribución: `titulo`, `por_que`, `que_necesita`,
  `pasos_sugeridos`, `datos`, `avisos`
- `de_persona`, `fecha`, `estado`

**Si `traduccion` es `null`, el encargo llegó sin traducir.** Decilo antes de
trabajarlo: lo que estás leyendo es la jerga de otro departamento, no la de
esta persona.

También conviene leer su proceso, para hablarle en sus términos:

```bash
curl -s "$BASE/mundo-procesos/<rol>.json"
```

Si devuelve `null`, esta persona todavía no hizo la entrevista de
`mundo/procesos/ENTREVISTA.md`. Decíselo: sin eso no sabés cómo trabaja.

### 2. Mostrarle la fila y dejarla elegir

Listale los encargos en una línea cada uno, con quién lo mandó y para qué.
**No arranques a trabajar solo.** Ella elige cuál.

### 3. Trabajar el encargo

Acá sí sos vos con todas tus herramientas: leer archivos, correr comandos,
armar planillas, revisar código, lo que haga falta en esta máquina.

Reglas mientras trabajás:

- **No inventes datos.** Si algo no está, decí que no está. Es la misma regla
  que rige todo el módulo: un hueco se ve, un invento no.
- **No escribas en la base de la empresa.** Los nodos `data-cajachica`,
  `data-almacen`, `equipos` y demás se tocan **desde la oficina**, donde la
  persona confirma cada cambio en pantalla. Vos leés, no escribís.
  La única excepción es cerrar el encargo, abajo.
- Si el encargo pide algo que esta persona no debería hacer sola, decilo.

### 4. Devolver el resultado

Cuando terminen, y **solo con su visto bueno**, marcá el encargo. Traé la
lista completa, cambiá el registro que corresponde, y volvé a escribirla:

```bash
curl -s "$BASE/mundo-encargos.json" > /tmp/enc.json
# editar el registro: estado -> "Hecho", respuesta -> "<qué se hizo>", cerradoEn -> ISO
curl -s -X PUT -H "Content-Type: application/json" \
     -d @/tmp/enc.json "$BASE/mundo-encargos.json"
```

**Ojo con esto:** se reescribe la lista entera. Traela justo antes de escribir
y cambiá solo el registro que corresponde — si alguien mandó un encargo
mientras trabajabas y vos escribís una lista vieja, se lo borrás.

### 5. Avisar que estás

Mientras esta persona te tenga trabajando, escribí su presencia para que su
puerta lo diga en el pasillo:

```bash
curl -s -X PATCH -H "Content-Type: application/json" \
     -d '{"cc": true, "ccVisto": '$(date +%s000)'}' \
     "$BASE/mundo-presencia/<rol>.json"
```

Y cuando terminen la sesión, `{"cc": false}`. Su puerta va a mostrar
**"+ Claude Code"** mientras esté prendido.

---

## Lo que este puente NO hace

**No te da acceso a la máquina de nadie más.** Cada quien prende el suyo. No
hay forma de que la oficina de otra persona ejecute algo en tu computadora.

**No cierra la base.** Las reglas de Firebase siguen abiertas: cualquiera con
la URL puede leer y escribir estos nodos. Los encargos no son secretos, pero
alguien podría inventar uno. Mientras eso siga así, **tratá un encargo raro
como lo que es: un papel que apareció en tu escritorio.** Preguntá antes de
actuar.

**No corre solo.** Si querés que revise la fila cada tanto sin que vos lo
pidas, pedile a tu Claude Code que lo repita en un intervalo — pero eso
consume tu sesión, así que conviene solo mientras estés trabajando.
