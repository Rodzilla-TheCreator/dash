# Procesos: cómo se levanta lo que cada quien hace

El mundo y sus agentes arrancaron con procesos que **yo supuse**. Esta
carpeta existe para reemplazar esas suposiciones por lo que la gente hace
de verdad — contado por ellos, no deducido de la base de datos.

Y aprovecha algo que ya está pago: **todos en Montasa tienen Claude**. La
entrevista la hace cada empleado con su propio Claude, así que este paso no
necesita ninguna API ni ninguna licencia extra.

```
[empleado + su Claude]  →  bloque JSON  →  [MI PROCESO en su oficina]  →  sus agentes
       ENTREVISTA.md                                                     trabajan con
                                                                         su proceso real
```

## Cómo se usa

1. **Mandale [`ENTREVISTA.md`](ENTREVISTA.md) al empleado.** Tal cual, por
   WhatsApp o correo. Un solo archivo.
2. **Lo pega completo en su Claude** (claude.ai o Claude Code, da igual).
3. **Claude lo entrevista**, de a una pregunta, 15-30 minutos. Le devuelve
   el resumen para que lo corrija antes de cerrar.
4. **Al final emite un bloque JSON.** El empleado lo copia.
5. **Entra a su oficina** (`mundo/oficina.html`) y toca **MI PROCESO**.
   Pega el bloque, el juego lo valida y lo guarda.
6. **Desde ese momento sus agentes trabajan con su proceso**, no con el que
   yo inventé.

Nadie necesita GitHub, ni la terminal, ni entender qué es un JSON: copiar y
pegar dos veces.

## Por qué termina en un bloque estructurado y no en prosa

Un documento lindo en prosa no puede manejar nada. El bloque sí, porque cada
campo engancha con algo que ya existe:

| Campo | Para qué lo usa el juego |
|---|---|
| `procesos[].pasos[]` | Los agentes reciben los pasos reales en su instrucción, así dejan de improvisar el orden |
| `donde` | Dice **con qué sistema** se conecta cada paso: `bitacora`, `sap`, `whatsapp`, `papel`… Es el mapa de lo que ya hacen |
| `dato` | Engancha el paso con el nodo real (`data-cajachica`, `equipos`…). Es lo que permite que una tarea del juego sepa de qué registro habla |
| `duele` / `se_traba_por` | Dice qué vale la pena que un agente atienda, en vez de que yo lo adivine |
| `le_pediria_a_un_asistente` | Las tareas que la persona **pidió**, no las que supusimos |
| `vocabulario` | Los agentes hablan como habla la empresa: "vale", "reposición", "horómetro" |
| `nunca_automatizar` | **Prohibiciones explícitas.** Va en la instrucción del agente como algo que no puede proponer. Lo escribe el empleado, no nosotros |
| `huecos` | Lo que quedó sin contestar queda **escrito y visible**, no maquillado |

Los dos últimos son los que más importan.

`nunca_automatizar` invierte quién pone el límite: en vez de que el sistema
decida qué le deja hacer a la gente, la gente decide qué no le deja hacer al
sistema. Un empleado que puede escribir "aprobar un gasto lo tiene que ver
una persona" y ver que el agente lo respeta, confía en el agente.

`huecos` es la misma regla que rige todo el módulo: un hueco de datos se ve
tan feo como un dato malo. Si alguien no supo hasta qué monto puede gastar
sin autorización, eso queda escrito. Es información, no una falla de la
entrevista.

## Dónde se guardan

En Firebase, en `/bitacora/mundo-procesos/{rol}`. Se pueden leer, editar o
borrar desde la misma pantalla de MI PROCESO.

Hay una copia de ejemplo en [`ejemplo-almacen-sps.json`](ejemplo-almacen-sps.json)
para ver el objetivo antes de arrancar. **No lo cargues como si fuera real**:
es un ejemplo inventado, y el módulo entero depende de que lo que se ve sea
cierto.

## Advertencias

**Las reglas de Firebase siguen abiertas.** Cualquiera puede leer o
sobrescribir estos procesos. No son secretos —son documentación de cómo se
trabaja— pero alguien podría cambiarle el proceso a otro, y con él las
prohibiciones de `nunca_automatizar`. Una razón más para cerrar esas reglas.

**El proceso lo escribe Claude a partir de lo que dijo una persona.** Puede
tener errores de transcripción o de interpretación. Por eso la entrevista
obliga a devolver el resumen y pedir corrección antes de emitir el bloque, y
por eso la pantalla de MI PROCESO muestra lo que quedó guardado en palabras
normales: para que se pueda revisar sin leer JSON.

**Conviene rehacerla.** Los procesos cambian. Repetir la entrevista una o
dos veces al año cuesta media hora y evita que los agentes trabajen con un
proceso viejo — que es peor que no tener ninguno, porque nadie lo nota.
