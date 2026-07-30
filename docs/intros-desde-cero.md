# Introducciones desde cero

Flujo para montar la **introducción** de un vídeo de YouTube a partir de clips
grabados a cámara —mi cara, mi cuerpo, la habitación— más assets de apoyo y una
pista de música. La intro no se publica sola: el entregable es un MP4 1920×1080 que
se coloca al principio del vídeo largo en el editor.

Es una **superficie** distinta del short vertical y del motor editorial 16:9, y
comparte con ellas todo lo que no depende del formato.

| | Shorts (`shorts-studio`) | Intro (`intro-studio`) | Motor editorial |
|---|---|---|---|
| Formato | 1080×1920 @ 60 | 1920×1080 @ 60 | 1920×1080 @ 30 |
| Ancla temporal | palabra (`atWord`) | **beat** (`atBeat`) | palabra |
| Objetivo | explicar algo en vertical | engancharte en 10 s | explicar un dato |
| Zona segura | interfaz de Shorts | reproductor de YouTube | margen editorial |
| Publicación | sí, con metadata | no: va dentro del vídeo largo | por bloques |

## Las tres capas

```text
src/modules/video-studio/       COMÚN a las tres superficies
  paths.js                      reparto de carpetas por superficie
  media-ingest.js               remux, loudness, cara, transcripción, música
  music.js                      estimación de BPM y rejilla de beats
  timeline.js                   recorte, ventanas de locución, medida del arte
  captions.js                   paginación karaoke
  artwork.js                    medidas del arte de un asset
  sound-families.js             catálogo de familias de sonido y rotación
  composition-registry.js       generación del registro que importa Root.tsx
  rule-intake.js                feedback → regla + validador + fixture
  rule-set.js                   carga de reglas por superficie
  checks/                       validadores de ámbito `catalog`

src/modules/intro-studio/       PROPIO de la intro
  constants.js                  formato, layouts, cámaras, efectos
  geometry.js                   zona segura, slots, proyección de la cara
  intro-profiles.json           perfiles de estilo (los umbrales)
  profiles.js
  sound.js                      qué familia suena por defecto en cada cosa
  build.js                      intro-plan.json → intro-build.json
  registry.js
  rules/intro-rules.json        el contrato
  rules/checks/                 sus validadores

remotion-animations/src/intro/  el render
  geometry.json                 fuente única de la geometría
  layout.ts, schemas.ts
  IntroVideo.tsx                composición
  SubjectStage.tsx              el clip encuadrado, con cámara
  BackdropLayer.tsx             fondo con paralaje
  IntroCueLayer.tsx             arte, por profundidad
  EffectLayer.tsx               los golpes
  TitleCard.tsx                 el titular

remotion-animations/projects/intro-<slug>/
  manifest.json                 derivado de la ingesta
  transcripts/NN.json           palabras con tiempos
  music.json                    rejilla de beats (derivado, cacheado)
  intro-plan.json               EL PLAN: esto es lo que se edita a mano
  intro-build.json              derivado; lo consume Remotion
```

## El ciclo completo

```bash
npm run intro:ingest -- --source "C:\ruta\con\clips" --slug mi-intro --music "C:\ruta\pista.mp3"
```

```bash
npm run intro:build -- --slug mi-intro
```

```bash
npm run intro:render -- --slug mi-intro
```

Y cuando algo del montaje no te gusta, la corrección se convierte en regla:

```bash
npm run intro:feedback -- --note "<corrección>" --section layers --severity error
```

## 1. Ingesta

Reutiliza la ingesta común: remuxea a MP4 (Chrome no decodifica Matroska), normaliza
el audio a −14 LUFS con techo en −1.5 dBTP, detecta la cara con YuNet y transcribe
con Faster-Whisper local. Sobre eso añade dos cosas propias de la intro:

- **Assets de vídeo**, no solo imágenes. Una intro se apoya en b-roll y en overlays
  (destellos, grano). La carpeta `ASSETS` admite las dos cosas y el manifest declara
  el `kind` de cada una.
- **Pista de música con rejilla de beats.** `--music <fichero>` copia la pista y
  estima su tempo: ffmpeg saca PCM mono a 8 kHz, se calcula la envolvente de energía
  y sobre su derivada positiva se pasa un filtro de peine por cada tempo candidato.
  El análisis se cachea en `music.json` porque es determinista.

Si la pista no tiene percusión marcada la estimación puede fallar; el aviso lo dice
(`confianza` por debajo de 1,5) y la salida es declarar `bpm` y `offsetSeconds` en el
plan, que recalcula la rejilla aritméticamente.

## 2. El plan

`intro-plan.json` es el único fichero que se edita a mano.

```json
{
  "profileId": "hype-tech",
  "music": {"assetId": "music", "gainDb": -9},
  "titleCard": {"text": "AMALIOMETRIA", "kicker": "cada semana", "atBeat": 17},
  "scenes": [
    {
      "id": "marca",
      "clipId": "02",
      "layout": "frame",
      "camera": "static",
      "transitionIn": "flash-cut",
      "trim": {"start": 0, "end": 5},
      "backdrop": {"assetId": "textura", "motion": "parallax-right"},
      "cues": [
        {"type": "logo", "assetId": "marca", "slot": "back-left", "atBeat": 6, "holdSeconds": 2.5}
      ],
      "effects": [
        {"id": "rgb-split", "atBeat": 6, "intensity": 0.8}
      ]
    }
  ]
}
```

### El beat es el ancla

En el short manda la palabra porque el short explica algo mientras se habla. En la
intro manda el **beat**, porque una intro se monta contra la música. Un flash 80 ms
antes del golpe no se percibe como un adelanto: se percibe como un montaje mal hecho.

- **`atBeat`** es un índice de la rejilla global de la pieza.
- **`atWord`** sigue disponible: es un índice dentro de la transcripción de *su* clip.
- **`atSeconds`** solo se acepta cuando no hay ni música ni transcripción, para que no
  se cuelen tiempos a mano que dejan de encajar al mover una escena.

El build guarda en cada efecto su `beatDeltaSeconds` contra la rejilla real, y la
regla IN-R-040 lo mide.

### Layouts

- `hero`: el clip a sangre. Para el arranque y el remate.
- `hero-left` / `hero-right`: el sujeto ocupa 1180 px y libera una columna de 608 px.
- `frame`: el sujeto baja a una tarjeta de 736×828 centrada, con el fondo visible
  alrededor. Es el layout con más profundidad aparente.
- `insert`: el sujeto se va a una esquina y manda el b-roll.

### Logos por detrás: sin máscara de persona

No hay segmentación de silueta. La profundidad se consigue con dos cosas: el reparto
del layout y la profundidad de campo.

- `depth: "back"` dibuja el arte **antes** del sujeto; `front`, después. La
  profundidad la decide el slot salvo que el plan diga otra cosa: los slots `back-*`
  y `orbit-*` existen para eso.
- Un cue de fondo entra reducido y desenfocado. Los valores por defecto los pone el
  perfil y la regla IN-R-010 no deja sobrescribirlos a 1 y 0: sin reducir ni
  desenfocar, un logo detrás del sujeto no se lee como fondo, compite con la cara.

Con `frame` y `hero-left`/`hero-right` el efecto es convincente porque hay un plano
más cerca que otro. En `hero`, el clip llega a los bordes y un cue `back` queda tapado
por el propio sujeto: ahí los logos entran por los slots de primer plano laterales.

### Slots

Fondo: `back-left`, `back-right`, `back-center`, `orbit-1..4`.
Primer plano: `fore-left`, `fore-right`, `corner-tl`, `corner-tr`, `banner-top`,
`banner-bottom`, `center`, `strip`.

Son rectángulos absolutos declarados en `geometry.json`, no aritmética sobre el
escenario. Se pisan a propósito —`center` cae dentro de `banner-bottom`— para poder
elegir composición, y la regla IN-R-012 es la que impide que haya dos cosas dentro a
la vez.

### Cámaras y efectos

Cámaras: `static`, `punch-in`, `push-out`, `drift-left`, `drift-right`, `handheld`
(temblor con ruido determinista) y `snap-zoom` (salto a mitad de escena, para anclar
a un beat).

Transiciones: `cut`, `fade`, `whip`, `slide-up`, `zoom-blur`, `flash-cut`,
`glitch-cut`.

Efectos: `flash`, `rgb-split`, `shake`, `zoom-punch`, `glitch`, `light-leak`, `grain`,
`scanlines`, `vignette-pulse`, `letterbox-snap`, `speed-blur`. Los seis primeros
—salvo `light-leak`— cuentan como **golpe**: son los que tienen que caer en un beat y
los que se cuentan para el techo de densidad.

No están en `catalog/animations/effects.json` a propósito: ese catálogo tiene contrato
de verdad gráfica y sus efectos explican un dato. Estos marcan ritmo.

`rgb-split` es aberración cromática de verdad, con un filtro SVG que aísla los canales
rojo y azul, los desplaza y los recompone con `screen`. No hace falta pintar el clip
tres veces.

## 3. Perfiles de estilo

La superficie decide **qué** se puede hacer; el perfil decide **cuánto**. Es la misma
separación que el canal editorial hace entre `channel.config.json` y
`brand-profiles.json`, y sirve para que la intro de un vídeo de finanzas y la de uno
de modelos salgan del mismo código.

| Perfil | Fondo | Golpes/s | Cadencia | Duración | Efectos |
|---|---|---|---|---|---|
| `hype-tech` | 0,55 | 3 | 2,5 s | 5–25 s | todos |
| `sobrio-finanzas` | 0,28 | 1,5 | 3,5 s | 6–22 s | sin glitch ni aberración |
| `directo-personal` | 0,2 | 1 | 4 s | 5–18 s | mínimos |

El build copia esos umbrales al `intro-build.json` como `budget`, y las reglas de
ritmo los leen de ahí. **Ninguna regla de ritmo lleva su umbral dentro**: sin `budget`
se declaran *no evaluables* en vez de inventarse un veredicto. Eso es lo que permite
que un perfil sobrio y uno nervioso compartan validador en vez de necesitar
excepciones.

Cambiar de estilo es cambiar `profileId` en el plan.

## 4. Reglas de montaje y bucle de feedback

`intro:build` ejecuta las reglas contra el `intro-build.json` que acaba de resolver:
falla en `error` (y no escribe el JSON, para que no quede una intro renderizable que
incumple el contrato) y avisa en `warning`. El contrato está en
`src/modules/intro-studio/rules/intro-rules.json` y su versión legible en
[intro-playbook.md](intro-playbook.md), generada desde el JSON.

Las tres piezas que más valor dan:

- **IN-R-011, la cara.** El build traduce el `faceBox` de la ingesta al rectángulo
  que la cara ocupa en la composición, replicando el encuadre `cover` con punto focal
  del renderer, y comprueba que ningún cue de primer plano ni la banda del titular la
  tapen más del 12 %. Es el fallo más caro de una intro y el más invisible leyendo el
  JSON.
- **IN-R-041 y IN-R-060, las dos direcciones del ritmo.** Un techo de golpes por
  segundo en ventana deslizante, para que la intro no sea parpadeo; y un suelo de
  cambio visible, para que no sean cuatro segundos de alguien hablando sin que pase
  nada. El segundo es el fallo real de la mayoría de intros caseras.
- **IN-R-040, el beat.** Todo golpe fuerte cae dentro de la tolerancia del perfil o
  declara `offBeatNote`. Un golpe anticipado a propósito crea tensión; la excepción se
  declara, no se tolera en silencio.

Una corrección se convierte en regla con una sola orden:

```bash
npm run intro:feedback -- --note "el logo tapa mi cara" --section layers --severity error
```

Registra la nota en `rules/feedback-log.jsonl`, crea la regla con id estable
(`IN-R-###`), deja el esqueleto del validador y un fixture en
`tests/fixtures/intro-rules/` que la **incumple**, y regenera el playbook. Mientras el
validador siga devolviendo su incidencia `TODO`, `npm test` está rojo.

### Promoción de reglas entre superficies

Una regla que se cumple igual en dos superficies asciende a `catalog` y su validador
se mueve a `src/modules/video-studio/checks/`, desde donde lo cargan todas. Ya han
ascendido tres, nacidas montando shorts:

- `art-dark-on-alpha-needs-plate`
- `art-solid-background-needs-blend`
- `cue-not-silent`

## 5. Zona segura

El límite no lo pone el formato sino el reproductor: YouTube dibuja la barra de
progreso y los controles en la franja inferior, y las tarjetas de sugerencias arriba a
la derecha. Nada informativo baja de `y = 972` ni se sale de los 96 px laterales. Un
rótulo perfectamente legible en el MP4 queda tapado en el reproductor real, así que el
render no delata el fallo: lo caza IN-R-030.

La geometría vive en `remotion-animations/src/intro/geometry.json` y la leen tanto
`layout.ts` (para dibujar) como `geometry.js` (para medir).

## Proyecto de referencia

`demo-canal` es la plantilla y la prueba de regresión del build. Su media es sintética
y la regenera:

```bash
node scripts/intro-demo-media.js
```

No tiene cara que detectar ni voz que transcribir, así que ancla **todo** por
`atBeat`, que es justamente el ancla canónica de esta superficie. Por eso IN-R-011 sale
como *no evaluable* en su build: sin cara no hay oclusión que medir, y decirlo es más
honesto que dar un veredicto inventado.

## Verificación

```bash
npm test
```

```bash
npm run remotion:check
```

```bash
npm run intro:playbook:check
```

Tras añadir o quitar composiciones:

```bash
npm run remotion:capabilities
```
