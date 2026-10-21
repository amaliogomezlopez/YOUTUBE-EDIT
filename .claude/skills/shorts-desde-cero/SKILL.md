---
name: shorts-desde-cero
description: Monta un Short vertical 9:16 a partir de clips grabados a propósito e imágenes de apoyo que el usuario deja en una carpeta, con el estilo viral aprobado (karaoke amarillo, cara abajo y b-roll oficial arriba que cuadra con cada frase, logos a panel completo, escenario nunca vacío, riser, whooshes y sonido de caja en el dinero). Úsala cuando el encargo sea "en esta carpeta tengo unos clips, monta un short", "haz un vertical con estos clips y estos assets", o al retocar el montaje, los cues o el ritmo de un short ya montado. NO es para recortar un vídeo largo (eso es create-ranked-shorts), ni para intros 16:9 (intro-a-camara), ni para las animaciones editoriales del canal de finanzas (create-remotion-animations / episodio-animado).
---

# Montar un Short desde cero

> **Receta obligatoria de STUDIO.** El guion, el arranque y el cierre del Short sigue la skill global `guion-video` (`D:\0000-STUDIO\skills\guion-video\SKILL.md`) con la receta `D:\0000-STUDIO\formats\short\`: promesa del canal, ficha y comprobación de su `rules.json` antes de dar el resultado por bueno. Si esta skill y la receta chocan, manda lo que fije el canal en su `AGENTS.md`; lo demás, la receta.

Un Short desde cero no es un recorte de un vídeo largo: es un montaje editorial de
clips cortos grabados a propósito más imágenes. No usa `src/lib/pipeline.js`; usa
`src/modules/shorts-studio` sobre la capa común `src/modules/video-studio`, y
compone con Remotion a 1080×1920 @ 60 fps.

El módulo está construido para que los errores no se repitan: las reglas son
ejecutables y `shorts:build` las corre contra el plan resuelto **antes de escribir
nada** (si falla en `error`, no queda un short renderizable que incumple el
contrato). Tu trabajo no es acordarte de las reglas, es **no puentear el motor que
las comprueba**.

## Paso 0 — Obligatorio, antes de tocar nada

Lee, en este orden:

1. `src/modules/shorts-studio/rules/shorts-rules.json` — **el JSON, no el
   markdown**. Son las reglas que el build va a ejecutar, con id y validador.
2. `docs/shorts-desde-cero.md` — el procedimiento completo. Esta skill es el
   índice; ese documento es la referencia.

`docs/shorts-playbook.md` se **genera** desde el JSON. Nunca lo edites a mano:
`npm run shorts:playbook:check` te va a pillar.

## Estilo aprobado (2026-10-15) — es el de todo short nuevo

El usuario aprobó este estilo con el short `suscripcion-x-v3`; su plan
(`remotion-animations/projects/shorts-suscripcion-x-v3/short-plan.json`) es la
plantilla. Partir de él, no de `shorts-deepseek` ni `harness-vs-modelo`, que son
anteriores.

1. **Investigar la noticia y reunir recursos reales antes de planificar.** Leer las
   fuentes que da el usuario y buscar material oficial: vídeos de los canales
   oficiales (Grok, Cursor, SpaceX…: buscar solo metadatos con
   `python -m yt_dlp "ytsearch6:<consulta>" --flat-playlist --print "%(id)s | %(channel)s | %(duration_string)s | %(title)s"`),
   tuits, páginas de precios, logos SVG de la web oficial. **Descargar exige permiso
   explícito**: listar fichero, fuente y tamaño aproximado y esperar el sí.
   - Con permiso, escribir un `asset-requests.json` (contrato de la apertura viral:
     cada recurso con `id`, `kind` —`youtube` con `start`/`duration` de 3-7 s, `x`,
     `web`, `image`, `local`—, `url` o `path` y `reason`, la frase que lo nombra) y
     ejecutar `npm run shorts:assets -- --requests <json> --out "<carpeta>/ASSETS"`:
     baja solo el tramo pedido y deja `<id>.<ext>` + `.provenance.json`. Luego
     `shorts:ingest --assets` (o `--slug <slug>` en `shorts:assets` para importarlos
     a un proyecto ya ingerido sin repetir la ingesta).
   - Para elegir el tramo, hacer una hoja de contactos del vídeo con ffmpeg
     (`fps=1,tile=6x2,drawtext` con el tiempo) y mirar dónde está lo que se busca.
   - Páginas protegidas (Cloudflare, 403): no saltarse la protección. Capturarlas
     con el navegador integrado (sus capturas quedan en disco) y anotar la
     procedencia a mano. Un logo SVG de la página se rasteriza en blanco a 960 px.
     Un logo oscuro se recolorea a blanco antes de usarlo sobre el panel oscuro.
2. **Corregir la transcripción** si Whisper oye mal un nombre («Brock» → Grok,
   «Grogbot» → Grok Bot): editar `text` de esas palabras en `transcripts/NN.json`
   sin añadir ni quitar palabras, para no mover los índices `atWord`.
3. **Layouts.** `talking-head` (cara abajo, recurso arriba a panel completo) para
   todo b-roll de vídeo, imagen o logo; `stage` para capturas con texto denso
   (tarjetas de precio, FAQ, tuits largos); `full` con `punch-in` para remates de
   2-4 s sin recurso. Sin `label` de escena ni `note` visibles: el texto propio se
   reduce a una cifra potente (`stat`, p. ej. «+50 %») y la marca del cierre.
4. **Lo que se ve cuadra con lo que se dice** y **el escenario nunca está vacío**
   (SH-R-063, más de 1,5 s avisa). Partir escenas por frases (trims contiguos del
   mismo clip) para que cada recurso entre con su palabra: si habla del plan de
   30 $, la tarjeta de 30 $; si dice «Claude… OpenAI», sus logos. El primer
   `broll` de una escena cubre desde el inicio de la escena.
5. **Logos como `broll` a panel completo** (`mediaFit: "contain"`,
   `mediaZoom: 1.1`, `sound: "pop"`), en cortes rápidos al nombrarlos. No poner
   logos encima de un vídeo: SH-R-011 lo prohíbe y no se lee. Una imagen apaisada
   que debe llenar el panel se rellena antes a 1080×960 con su color de fondo.
6. **Sonido viral.** La paleta `viral-reels` (sonidos de SONIDOS-REELS) se aplica
   por defecto; `npm run shorts:sonidos` la resuelve si faltan los ficheros. En el
   plan:
   - `broll` de vídeo con `sound: "whoosh"` y `mediaTransition: "cut"`.
   - Transiciones `whip` y `slide-up` entre escenas.
   - **Riser solo en el arranque**: en el cue que entra a los 1-3 s del gancho, con
     `sound: "riser", soundAlign: "end"`, para que termine justo en ese corte.
   - `sound: "money"` en cada cifra de dinero que aparece (precio, subida, cobro
     aparte) y `"message"` cuando entra un tuit, siempre con `soundNote`.
7. **Subtítulos**: no declararlos; el preset por defecto ya es el amarillo.

Revisión antes de entregar: hoja de contactos del MP4 con un fotograma por cue
(`ffmpeg -ss <s> -frames:v 1` y `tile`), comprobando para cada uno que el recurso
cuadra con la palabra, que no hay panel vacío y que nada tapa la cara. Medir que
los dos canales de audio están equilibrados (`volumedetect` por canal).

## El flujo

```bash
npm run shorts:ingest -- --source "<carpeta de clips>" --slug <slug>
```

Por clip: remuxea a MP4, normaliza el audio a −14 LUFS, detecta la cara con YuNet
(punto focal del encuadre vertical) y transcribe con Faster-Whisper. Las
transcripciones se cachean: repetir la ingesta no vuelve a transcribir salvo
`--retranscribe`. Opciones: `--assets <carpeta>` si las imágenes no están en una
subcarpeta `ASSETS`, `--no-face`, `--no-transcribe`, `--force`.

Luego se edita `short-plan.json` a mano (es el único fichero que se toca), y el
resto no exige código:

```bash
npm run shorts:build -- --slug <slug>
npm run shorts:render -- --slug <slug>
npm run shorts:publishing -- --slug <slug>
npm run shorts:publish -- --slug <slug> [--platforms youtube,instagram,tiktok,x]
```

A diferencia de la intro, el short **sí se publica solo**: la metadata sale de
`shorts:publishing` (describe la transcripción del short *montado*, no la de los
clips crudos) y `shorts:publish` delega en los conectores de `src/lib/publishers/`.

## Las siete reglas duras

1. **`atWord` es el ancla canónica, no el segundo.** Es el índice de la palabra en
   `transcripts/NN.json` de *ese* clip. `atSeconds` solo se acepta si el clip no
   tiene transcripción, y el build lo rechaza en cuanto la hay. Así, si reajustas
   el recorte de una escena, los cues siguen cayendo sobre la palabra correcta.
2. **Dos cues no comparten slot a la vez** (SH-R-010). Es el error más fácil de
   introducir al alargar un `holdSeconds`; el build falla con el par concreto y el
   slot.
3. **Una captura de texto denso exige layout `stage`, no `split`** (SH-R-020). Si
   una escena empieza con la cara y luego necesita mostrar una captura, se parte
   en dos escenas con el mismo `clipId` y trims contiguos: el audio sigue continuo
   y el layout cambia.
4. **La presentación la decide la medida del arte, no el nombre del fichero.** El
   build mide cada asset con `sharp` (cobertura opaca, luma, oscuridad del borde):
   un logo oscuro sobre alfa necesita `plate` (SH-R-021), uno con fondo negro
   sólido, `blend` (SH-R-022). Sin la medida, las reglas se declaran no evaluables
   en vez de inventarse un veredicto.
5. **Nada informativo baja de `y = 1748`**: ahí dibuja la interfaz de Shorts su
   título, avatar y botones (SH-R-040). La geometría vive en
   `remotion-animations/src/shorts/geometry.json` y la leen tanto el layout como
   el validador.
6. **Todo suena, y ningún cue entra en silencio sin `soundNote` que lo justifique**
   (SH-R-050). El sonido se pide por familia (`impact`, `hit`, `whoosh`, `whip`,
   `pop`, `reveal`, `tick`, `ui`, `chime`, `shimmer`, `tension`, `alert`, `burst`,
   `rewind`, `camera`, `texture`), nunca por fichero; cada familia rota varias
   tomas de forma determinista. Para silenciar algo hay que decirlo:
   `"sound": false`, `"transitionSound": false`, `"cameraSound": false`.
7. **El escenario nunca se queda vacío** más de 1,5 s (SH-R-063): en `split`,
   `stage` y `talking-head` siempre hay un recurso que cuadra con la frase. Si
   salta, adelanta el recurso o parte la escena para que entre con su palabra.

## Subtítulos: karaoke amarillo

No declares `captions` ni `captionStyle` en un plan nuevo. Sin ellos, el build
aplica el preset `talking-head-yellow` (desde 2026-10-15 sustituye al verde, a
petición del usuario): Schibsted Grotesk blanca `#FFFFFF`, contorno oscuro de 5 px,
la palabra que suena en amarillo `#FFD60A`, karaoke de hasta tres palabras por
página. El verde sigue disponible con `"preset": "talking-head-green"`. No copies el
bloque `captions` / `captionStyle` de `shorts-deepseek` o `shorts-harness-vs-modelo`:
llevan `"renderer": "theme"` solo para que los shorts ya publicados no cambien al
reconstruirse. Un modo `progressive` o más de tres palabras con el preset karaoke
hacen fallar el build (SH-R-033).

## El texto en pantalla añade, no repite

Un chip que repite la locución palabra por palabra sobra: eso ya lo dice el
subtítulo karaoke (SH-R-030). El texto en pantalla aporta el dato, el nombre o la
conclusión que la voz no dice.

El `trim` es opcional y por defecto recorta el silencio dejando
`silencePaddingSeconds` de aire. Un extremo declarado se respeta siempre: es como
se parte un clip en dos escenas sin cortar el audio. El build calcula
`speechLeadSeconds` / `speechTailSeconds` por escena precisamente para cazar un
extremo declarado a mano con segundos de nadie hablando.

## Cuando el usuario corrige algo

Este es el paso que hace que el sistema mejore en vez de repetir el error:

```bash
npm run shorts:feedback -- --note "…" --section <slots|legibility|information|safe-area|sound|pacing> --severity <error|warning|review>
```

Crea la regla con id estable (`SH-R-###`), el esqueleto del validador en
`src/modules/shorts-studio/rules/checks/` y un fixture en
`tests/fixtures/shorts-rules/` que la **incumple**. **La regla no está cerrada
mientras el validador devuelva `TODO`**: `npm test` está rojo hasta que lo
implementas de verdad.

Dos cosas que distinguen una regla buena de una anotación:

- El fixture tiene que incumplir **solo** su regla. Si dispara otras, el test de
  aislamiento lo caza y no sabrás cuál estás validando.
- Si el contexto no permite evaluar, usa `notEvaluable(reason)`. Reportar una
  regla como cumplida cuando no había datos enseña a ignorar avisos.
- Un validador que se cumple igual en dos superficies asciende a `catalog` y se
  mueve a `src/modules/video-studio/checks/`. Ya ascendieron tres nacidas aquí
  (`art-dark-on-alpha-needs-plate`, `art-solid-background-needs-blend`,
  `cue-not-silent`): antes de escribir uno nuevo, comprueba si ya existe ahí.

## Diagnóstico rápido

| Síntoma | Causa casi segura |
|---|---|
| El build falla con un par de cues y un slot | `holdSeconds` demasiado largo: dos cues se solapan (SH-R-010) |
| Una captura no se lee | Está en `split`; una captura densa exige `stage` (SH-R-020) |
| El logo no se ve | Arte oscuro sobre alfa con `card` en vez de `plate`, o `blend` sin nada detrás |
| Algo entra por debajo de la interfaz | Informativo por debajo de `y = 1748` (SH-R-040) |
| Hay segundos de nadie hablando al inicio o al final | Extremo de `trim` declarado a mano; mira `speechLeadSeconds` / `speechTailSeconds` |
| Un cue entra sin sonido | Falta `sound` de familia o falta el `soundNote` que justifique el silencio (SH-R-050) |
| Aviso de escenario vacío | El recurso entra tarde; adelántalo o parte la escena (SH-R-063) |
| Los sonidos suenan genéricos | La paleta `viral-reels` no está resuelta en esta máquina: `npm run shorts:sonidos` |
| Un efecto suena cortado | Paleta propia sin `sound.metadata` con la duración real del fichero |
| `shorts:render` muere con ENOSPC | Ya aísla `public/`; mira temporales `remotion-webpack-bundle-*` abandonados en C: |

## Antes de dar algo por terminado

```bash
npm test
npm run remotion:check
npm run shorts:playbook:check
```

Y mira el render, no solo el JSON: legibilidad, ritmo y solapes no se ven leyendo
el plan. Para revisar antes de renderizar, `npm run remotion:studio`; para un
frame concreto, `npx remotion still src/index.ts Short-<Slug> <salida.png>
--frame=<n>` desde `remotion-animations/`.

Tras añadir o quitar composiciones (el id sale del slug: `harness-vs-modelo` →
`Short-Harness-vs-Modelo`):

```bash
npm run remotion:capabilities
```

## Qué NO hacer

- No edites `docs/shorts-playbook.md` (se genera).
- No escribas `atSeconds` cuando el clip tiene transcripción.
- No pidas un fichero de sonido concreto: se pide por familia.
- No uses `src/lib/pipeline.js`: ese recorta vídeos largos, no monta desde cero.
- No subas la tolerancia de una regla para que deje de saltar.
- No pongas texto que repita la locución: para eso están los subtítulos.

## Efectos de sonido (desde 2026-10-16)

Los efectos van calibrados por sonoridad frente a la voz (-14 LUFS), no por pico: cada uno a su distancia por situación (`SFX_LEVELS_LU` en `src/modules/video-studio/sound-loudness.js`), sin `soundMix` ni ducking encima. Es automático en el build: no escribir volúmenes de efectos a mano. Para efectos nuevos sin atribución, `npm run sonidos:openverse -- buscar|adoptar|demo` (solo CC0/dominio público, descargar exige permiso). Detalle y revisión de la mezcla: `docs/sonido-calibrado.md`.
