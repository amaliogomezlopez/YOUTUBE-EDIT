---
name: intro-a-camara
description: Monta la introducción 16:9 de un vídeo largo a partir de clips grabados a cámara (cara, cuerpo, habitación), assets de apoyo y una pista de música, con efectos, transiciones y logos que entran por detrás del sujeto. Úsala cuando el encargo sea "hazme la intro de este vídeo", "monta una introducción con estos clips", o al retocar, reencuadrar o cambiar el estilo de una intro ya montada. NO es para Shorts verticales ni para las animaciones editoriales del canal de finanzas.
---

# Montar la introducción de un vídeo a cámara

La intro es la cabecera de un vídeo largo: sale un MP4 1920×1080 que se coloca al
principio en el editor. **No se publica sola**, así que aquí no hay etapa de
metadata ni de publicación. Si la buscas, te has equivocado de skill.

El módulo está construido para que los errores no se repitan: las reglas son
ejecutables y `intro:build` las corre antes de escribir nada. Tu trabajo no es
acordarte de las reglas, es **no puentear el motor que las comprueba**.

## Paso 0 — Obligatorio, antes de tocar nada

Lee, en este orden:

1. `src/modules/intro-studio/rules/intro-rules.json` — **el JSON, no el
   markdown**. Son las reglas que el build va a ejecutar, con id y validador.
2. `src/modules/intro-studio/intro-profiles.json` — los perfiles de estilo. Aquí
   viven los umbrales, no en las reglas.
3. `docs/intros-desde-cero.md` — el procedimiento completo. Esta skill es el
   índice; ese documento es la referencia.

`docs/intro-playbook.md` se **genera** desde el JSON. Nunca lo edites a mano:
`npm run intro:playbook:check` te va a pillar.

## El flujo

```bash
npm run intro:ingest -- --source "<carpeta de clips>" --slug <slug> --assets "<carpeta>" --music "<pista.mp3>"
```

Remuxea a MP4, normaliza a −14 LUFS, detecta la cara con YuNet, transcribe con
Faster-Whisper y estima la rejilla de beats de la música. Todo se cachea: repetir
la ingesta no vuelve a transcribir ni a analizar la pista salvo `--retranscribe`.

Luego se edita `intro-plan.json` a mano, y el resto no toca código:

```bash
npm run intro:build -- --slug <slug>
```

```bash
npm run intro:render -- --slug <slug>
```

## Las seis reglas duras

1. **El beat es el ancla, no el segundo.** `atBeat` indexa la rejilla global de la
   pieza; `atWord`, la transcripción de *su* clip. `atSeconds` solo se acepta
   cuando no hay ni música ni transcripción, y el build lo rechaza en cuanto las
   hay. Un golpe a 80 ms del beat no se lee como adelanto, se lee como montaje
   mal hecho.
2. **Los cortes de escena también caen en beat.** El build no lo impone, pero es
   la diferencia entre una intro que suena montada y una que suena pegada. Elige
   los extremos de cada `trim` para que la frontera caiga en un múltiplo del
   periodo (`60 / bpm`).
3. **Nada tapa la cara.** El build proyecta el `faceBox` de la ingesta al
   rectángulo que la cara ocupa en la composición. Si IN-R-011 salta, el arreglo
   no es subir la tolerancia: es cambiar de slot, mandar el cue a `depth: "back"`
   o cambiar el layout.
4. **Los logos "por detrás" no llevan máscara de persona.** La profundidad la dan
   el layout (`frame`, `hero-left`, `hero-right`) y la profundidad de campo. Los
   únicos slots que se leen como *detrás de la persona* son `behind-left` y
   `behind-right`, porque cruzan el borde del sujeto. Los `back-*` y `orbit-*`
   caen enteros fuera y solo dan profundidad por desenfoque.
5. **La presentación la decide la medida del arte, no el nombre del fichero.** El
   build mide cada asset y las reglas leen esa medida. Y ojo con `blend`: sólo
   funciona si detrás hay vídeo o backdrop. Sobre el fondo del tema, `screen`
   borra el logo entero (IN-R-022).
6. **El sonido se pide por familia**, nunca por fichero. Cada tipo de cue, cada
   efecto, cada transición y cada movimiento de cámara tienen familia por defecto.
   Para silenciar algo hay que decirlo con `"sound": false` **y** justificarlo con
   `soundNote`.

## El estilo va en el perfil, no en el plan

La superficie define *qué* se puede hacer; el perfil define *cuánto*. Si el
usuario pide "más tranquilo" o "más agresivo", la respuesta casi nunca es tocar el
plan escena por escena: es cambiar `profileId`, o proponer un perfil nuevo en
`intro-profiles.json`.

| Perfil | Para qué |
|---|---|
| `hype-tech` | Vídeos de modelos, agentes y herramientas. Fondo protagonista, golpes frecuentes. |
| `sobrio-finanzas` | Canal de finanzas. Sin glitch ni aberración: un glitch le cuesta credibilidad. |
| `directo-personal` | Solo presencia: cámara en mano, un logo, un titular. |

Los umbrales del perfil viajan al build como `budget`, y las reglas de ritmo los
leen de ahí. **Nunca metas un umbral dentro de un validador**: si lo haces, el
perfil sobrio y el nervioso dejan de poder compartir regla y aparecen las
excepciones.

## Cuando el usuario corrige algo

Este es el paso que hace que el sistema mejore en vez de repetir el error:

```bash
npm run intro:feedback -- --note "…" --section <layers|legibility|safe-area|rhythm|sound|pacing> --severity <error|warning|review>
```

Crea la regla con id estable, el esqueleto del validador y un fixture que la
incumple. **La regla no está cerrada mientras el validador devuelva `TODO`**:
`npm test` está rojo hasta que lo implementas de verdad.

Dos cosas que distinguen una regla buena de una anotación:

- El fixture tiene que incumplir **solo** su regla. Si dispara otras, el test de
  aislamiento lo caza y no sabrás cuál estás validando.
- Si el contexto no permite evaluar, usa `notEvaluable(reason)`. Reportar una
  regla como cumplida cuando no había datos enseña a ignorar avisos, que es justo
  lo que este motor existe para evitar.

## Diagnóstico rápido

| Síntoma | Causa casi segura |
|---|---|
| Los golpes suenan "casi" | Efectos anclados con `atWord` en vez de `atBeat`, o cortes de escena fuera de rejilla |
| El logo no se ve | `blend` sin vídeo ni backdrop detrás, o arte oscuro sobre fondo oscuro |
| Un cue de fondo parece pegado delante | Está en un slot `back-*`, que no cruza al sujeto; usa `behind-*` |
| Solo asoma el marco del logo, no el arte | `presentation: "card"` en un cue de fondo; usa `plain` |
| La intro se siente muerta | IN-R-060 lo dice: hay un tramo sin cambio visible |
| El BPM detectado es la mitad o el doble | Fija `bpm` y `offsetSeconds` en `plan.music` |

## Antes de dar algo por terminado

```bash
npm test
```

```bash
npm run remotion:check
```

```bash
npm run intro:playbook:check
```

Y mira el render, no solo el JSON: la mitad de los fallos de una intro
(profundidad, legibilidad, ritmo) no se ven leyendo el plan. Saca stills con
`npx remotion still src/index.ts Intro-<Slug> <salida.png> --frame=<n>` desde
`remotion-animations/`.

Tras añadir o quitar composiciones:

```bash
npm run remotion:capabilities
```

## Qué NO hacer

- No edites `docs/intro-playbook.md` (se genera).
- No escribas `atSeconds` cuando hay música o transcripción.
- No pidas un fichero de sonido concreto.
- No metas un umbral de ritmo dentro de un validador: va en el perfil.
- No subas la tolerancia de una regla para que deje de saltar.
- No añadas una etapa de publicación: la intro va dentro del vídeo largo.
