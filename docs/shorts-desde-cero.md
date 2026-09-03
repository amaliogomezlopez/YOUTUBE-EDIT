# Shorts desde cero

Flujo para montar un Short vertical a partir de clips grabados a propósito, no
recortando un vídeo largo. Es un pipeline distinto del de `src/lib/pipeline.js`:

| | Long → Short (`src/lib/pipeline.js`) | Shorts desde cero (`src/modules/shorts-studio`) |
|---|---|---|
| Entrada | un vídeo largo | varios clips cortos + imágenes |
| Selección | scoring por LLM elige los tramos | el montaje lo decide el plan editorial |
| Composición | FFmpeg, filtros y ASS quemado | Remotion, React, 1080×1920 @ 60 fps |
| Subtítulos | ASS progresivo con libass | karaoke en React, palabra activa iluminada |
| Efectos | ninguno | zoom, transiciones, logos con SFX |

## Dónde vive cada cosa

La ingesta, la línea de tiempo, el catálogo de sonido, los subtítulos, el registro de
composiciones y el intake de feedback **no son propios de shorts**: viven en
`src/modules/video-studio/` y los comparte con la superficie de intros
([intros-desde-cero.md](intros-desde-cero.md)). Lo propio de esta superficie es la
geometría vertical, sus layouts y su set de reglas.

```text
src/modules/video-studio/           capa común (ingesta, sonido, reglas, registro)
src/modules/shorts-studio/          lógica propia del vertical (build, geometría, reglas)
scripts/shorts-ingest.js            CLI de ingesta
scripts/shorts-build.js             CLI de compilación del plan
remotion-animations/src/shorts/     composición Remotion 9:16
remotion-animations/projects/shorts-<slug>/
  manifest.json                     inventario derivado de la ingesta
  transcripts/NN.json               palabras con tiempos (fuente de verdad temporal)
  short-plan.json                   EL PLAN EDITORIAL: esto es lo que se edita a mano
  short-build.json                  derivado; lo consume Remotion
  publishing-metadata.json          derivado; titulos, hashtags, capitulos y posts
remotion-animations/src/shorts/registry.generated.ts
                                    derivado; la lista de composiciones que ve Root.tsx
remotion-animations/public/projects/shorts/<slug>/
  clips/NN.mp4                      clips remuxeados y normalizados (ignorado por git)
  assets/<id>.<ext>                 imágenes (ignorado por git)
```

## El ciclo completo

```bash
npm run shorts:ingest -- --source "C:\ruta\con\clips" --slug mi-short
```

Luego se edita `short-plan.json` a mano, y el resto no vuelve a tocar código:

```bash
npm run shorts:build -- --slug mi-short
```

```bash
npm run shorts:render -- --slug mi-short
```

```bash
npm run shorts:publishing -- --slug mi-short
```

Y cuando el usuario corrige algo del montaje, la corrección se convierte en regla:

```bash
npm run shorts:feedback -- --note "<corrección>" --section <id> --severity error
```

## 1. Ingesta

```bash
npm run shorts:ingest -- --source "C:\ruta\con\clips" --slug mi-short
```

Por cada clip: remuxea a MP4 (Chrome no decodifica Matroska), normaliza el audio a
−14 LUFS con techo en −1.5 dBTP, detecta la cara con YuNet para obtener el punto
focal del recorte vertical, y transcribe con Faster-Whisper local.

La detección de cara guarda además `focusTrack`: un punto focal por muestra
temporal. Si la escena no fija `focus` en el plan, `ClipStage` interpola ese track
frame a frame y el encuadre **sigue al sujeto** en vez de quedarse en un punto
fijo.

Las transcripciones se reutilizan entre ejecuciones porque son la parte caras del
proceso; `--retranscribe` fuerza a rehacerlas. Otras opciones: `--assets <carpeta>`
si las imágenes no están en una subcarpeta `ASSETS`, `--no-face`, `--no-transcribe`
y `--force` (borra la media ya preparada).

## 2. Plan editorial

`short-plan.json` es el único fichero que se edita a mano. Una escena:

```json
{
  "id": "veredicto",
  "clipId": "04",
  "layout": "split",
  "camera": "punch-in",
  "transitionIn": "fade",
  "label": "Composio\n28 tareas identicas",
  "trim": {"start": 0, "end": 14.05},
  "cues": [
    {"type": "logo", "assetId": "kimi", "atWord": 13, "slot": "podium-1",
     "text": "KIMI CODE", "holdSeconds": 6, "sound": "pop"}
  ]
}
```

Reglas del formato:

- **`trim` es opcional y por defecto recorta el silencio.** Si falta `start` o
  `end`, el build lo deduce de la primera y la última palabra de la transcripción
  dejando `silencePaddingSeconds` de aire (0.5 s por defecto). Un extremo declarado
  se respeta siempre: es como se parte un clip en dos escenas con distinto layout
  sin cortar el audio. El build avisa de cuántos segundos ha recortado en cada
  escena.
- **`atWord` es el ancla canónica.** Es el índice de la palabra en
  `transcripts/NN.json`. `atSeconds` solo se acepta si el clip no tiene
  transcripción, y el build lo rechaza en caso contrario. Así, si se reajusta el
  recorte de la escena, los cues siguen cayendo sobre la palabra correcta.
- **El sonido se pide por familia**, nunca por fichero: `impact`, `hit`, `whoosh`,
  `whip`, `pop`, `reveal`, `tick`, `ui`, `chime`, `shimmer`, `tension`, `alert`,
  `burst`, `rewind`, `camera`, `texture` (ver
  `src/modules/shorts-studio/sound.js`).
- **Todo suena, y suena distinto cada vez.** Cada cue tiene familia por defecto
  según su tipo, cada transición de escena y cada movimiento de cámara añade la
  suya, y cada familia declara varias tomas que rotan con un leve desplazamiento de
  tono. Tres logos seguidos no repiten fichero. La rotación es determinista: dos
  builds del mismo plan suenan igual. Para silenciar algo hay que decirlo:
  `"sound": false`, `"transitionSound": false`, `"cameraSound": false`.
- **Dos cues no pueden compartir slot a la vez.** El build falla con el par
  concreto y el slot; es el error más fácil de introducir al alargar un
  `holdSeconds`.
- El texto en pantalla debe **añadir** información. Un chip que repite la locución
  palabra por palabra sobra: lo dice ya el subtítulo.
- **Los subtítulos tienen dos modos.** `captions: {"mode": "karaoke"}` (por
  defecto) mantiene la página entera visible e ilumina la palabra que suena.
  `captions: {"mode": "progressive"}` revela las palabras al sonar y compone la
  palabra más pesada de cada página en su propia línea, en mayúsculas y ~1.5×
  (portado del planner progresivo del pipeline de video largo).
- **Cama musical opcional.** `sound: {"music": {"assetId": "mi-pista", "volume":
  0.35, "duckGainDb": -10}}` (o `"assetId": "music"` para la pista ingerida con
  `--music`). Suena en bucle y cede durante las ventanas de locución.

### Layouts

- `full`: clip a sangre. Para el hook y los remates.
- `split`: cara arriba (0–960), escenario debajo (988–1528). El reparto por
  defecto.
- `stage`: la cara baja a una tarjeta de 392 px arriba a la izquierda y el
  escenario ocupa 552–1492. **Es el único layout en el que una captura de texto
  denso se lee.** Si una escena empieza con la cara y luego necesita mostrar una
  captura, se parte en dos escenas con el mismo `clipId` y trims contiguos: el
  audio sigue siendo continuo y el layout cambia.
- `pip`: réplica del montaje webcam + pantalla del pipeline de video largo. Fondo
  con el propio clip desenfocado y oscurecido, la pantalla a 1600 px con la webcam
  incrustada enmascarada, y la cara recortada en una tarjeta con borde negro
  arriba. Exige `webcamBox` (en la escena o en el clip del manifest) y la cámara
  queda fija en `static`.
- `fit`: para clips horizontales sin webcam: fondo desenfocado + el clip entero a
  1080 px de ancho centrado. Sin requisitos.

### Slots

`stage-full`, `stage-left`, `stage-right`, `stage-header`, `stage-footer`,
`stage-badge`, `podium-1..3`, `podium-3-verdict`, `overlay-top`,
`overlay-center`.

### Presentación de imágenes

- `card` (por defecto): tarjeta oscura con borde y halo. Para logos claros sobre
  transparencia.
- `plate`: placa clara. **Obligatoria** si el arte del logo es negro sobre alfa;
  sobre tarjeta oscura sería invisible.
- `plain`: sin marco, para lo que ya trae su propio fondo.
- `blend`: suma con `screen`, que hace desaparecer un fondo negro sólido. Para
  wordmarks exportados en JPG sin alfa.

## 3. Compilar y renderizar

```bash
npm run shorts:build -- --slug mi-short
```

Resuelve el plan a frames, pagina los subtítulos, ancla los cues, genera la pista
de efectos y las ventanas de *ducking* de la locución, y escribe
`short-build.json`. Valida solapes de slot, `atWord` fuera de rango, assets
inexistentes y recortes imposibles.

También regenera `remotion-animations/src/shorts/registry.generated.ts`, que es de
donde `Root.tsx` saca la lista de composiciones: **un proyecto nuevo no exige tocar
código**. El registro se genera y no se importa por glob porque el Root lo empaqueta
el bundler y los `short-build.json` tienen que estar importados estáticamente. El id
de la composición sale del slug: `harness-vs-modelo` → `Short-Harness-vs-Modelo`.

Renderizar:

```bash
npm run shorts:render -- --slug mi-short
```

Delega en `remotion-animations/scripts/render-safe.mjs`, así que cada render reserva
su propio directorio de ejecución en `remotion-animations/out/shorts-<slug>/runs/` con
su manifiesto. Por defecto codifica H.264 con CRF 17 (el estándar del pipeline de
video largo); se puede pisar con `--crf` o la variable `REMOTION_CRF`. Cualquier
opción extra (`--frames`, `--scale`, `--concurrency`) viaja tal cual a Remotion.
Para revisar en el estudio antes de renderizar:

```bash
npm run remotion:studio
```

Tras añadir o quitar composiciones hay que regenerar el manifest de capacidades o
`npm test` falla:

```bash
npm run remotion:capabilities
```

## Shorts desde video largo con este renderer

El pipeline de extracción (`npm run process`) puede renderizar los cortes
seleccionados con este mismo motor en vez del filtergraph ffmpeg de
`src/lib/ffmpeg.js`:

```bash
npm run process -- --video "D:\videos\directo.mp4" --transcript "D:\videos\directo.srt" \
  --top 5 --render-engine remotion
```

Con `--render-engine remotion`, cada candidato pasa por
`src/modules/shorts-studio/from-long-video.js`: corta el segmento con loudnorm,
rebaja la transcripción al reloj del corte, genera `manifest.json` +
`short-plan.json` (una escena), compila con `shorts:build` y renderiza con
`render-safe.mjs`. El MP4 termina en `data/output/<job>/<clip>/short.mp4`, como
siempre, y la metadata del clip declara `renderSettings.engine: "remotion"` y el
`slug` del proyecto generado (`short-<job>-<clip>`), editable y re-renderizable
como cualquier otro proyecto de este flujo. El modo de subtítulos es
`progressive`.

El layout se clasifica **por segmento**, no por job: los videos reales mezclan
cara a pantalla completa y grabación de pantalla con webcam en una esquina, y el
mismo renderMode no sirve para las dos. Sin `--render-mode` explícito, cada
candidato se resuelve así:

1. Fuente vertical → `crop` (layout `full` con `focusTrack`).
2. Fuente horizontal con webcam en esquina detectada **dentro de la ventana del
   candidato** (`detectWebcamBox` con `window`) → `pip` con ese `webcamBox`.
3. Si no, cara a pantalla completa sobre el clip cortado (`trackFace`) → `crop`.
4. Si tampoco → `fit` (fondo blur + centrado).

Con `--render-mode` explícito se fuerza el modo para todos los cortes (y en
`pip` se usa el `webcamBox` de nivel job, detectado como siempre). En la rama
Remotion sin modo explícito la detección de webcam de nivel job no se ejecuta:
la clasificación la hace cada segmento.

El default sigue siendo `ffmpeg`, y los re-renders editoriales (`rerenderClip`,
la UI) también usan ffmpeg de momento.

## 4. Metadata de publicación

```bash
npm run shorts:publishing -- --slug mi-short
```

Escribe `publishing-metadata.json` en el proyecto con el contrato de `AGENTS.md`:
`summary.short`, `summary.medium`, `summary.youtube_description`, 10 títulos por
plataforma, exactamente 14 hashtags en una sola línea, `timestamps` (el primero
`00:00`) y `platform_posts` para `youtube`, `youtube_shorts`, `instagram`, `tiktok`
y `x`. Reutiliza `generatePublishingMetadata` y `buildClipPublishing` de
`src/lib/publishing.js`, así que con MiniMax configurado los títulos y hashtags los
decide el LLM y sin él se derivan del texto con fallback local y un `warning` en el
JSON.

La transcripción que describe es la del short **montado**, no la de los clips
crudos: cada escena aporta solo las palabras dentro de su recorte y los tiempos se
rebasan al reloj del short. En `harness-vs-modelo` eso son casi 6 s de silencio que
no existen en el resultado, y el clip 02 partido en dos escenas, cuyas palabras no
deben contarse dos veces.

Opciones: `--no-llm` fuerza el fallback local; `--out` deja además una copia en
`data/output/shorts-<slug>/` junto al MP4; `--out <carpeta>` la deja donde se pida.

## 5. Publicar

```bash
npm run shorts:publish -- --slug mi-short [--platforms youtube,instagram,tiktok,x]
```

Consume el `publishing-metadata.json` del proyecto y el último MP4 renderizado, y
delega en los conectores de `src/lib/publishers/`: el short se publica con el
mismo contrato que un clip del pipeline de vídeo largo, sin duplicarlo. Lo que no
se pueda publicar automáticamente (sin credenciales, o Instagram sin hosting
HTTPS vía `asset-host`) queda en `requires_manual_action` con caption y asset
listos en `publish-runs.json`, que se escribe en el proyecto y no se versiona.

## 6. Reglas de montaje y bucle de feedback

`shorts:build` ejecuta un set de reglas contra el `short-build.json` que acaba de
resolver: falla en `error` (y no escribe el JSON, para que no quede un short
renderizable que incumple el contrato) y avisa en `warning`. El contrato está en
`src/modules/shorts-studio/rules/shorts-rules.json` y su versión legible en
[shorts-playbook.md](shorts-playbook.md), generada desde el JSON.

Reutiliza el motor del canal editorial
(`src/modules/editorial-video/visuals/rules-engine.js`), que ya es genérico. Lo
único propio de shorts es el contexto —el `short-build.json`— y el directorio de
validadores, `src/modules/shorts-studio/rules/checks/`.

Los validadores que no dependen del formato viven en
`src/modules/video-studio/checks/` con ámbito `catalog` y los cargan todas las
superficies. Ya han ascendido tres, nacidas aquí: `art-dark-on-alpha-needs-plate`,
`art-solid-background-needs-blend` y `cue-not-silent`.

Una corrección se convierte en regla con una sola orden:

```bash
npm run shorts:feedback -- --note "la captura no se lee en split" --section legibility --severity error
```

Registra la nota en `rules/feedback-log.jsonl`, crea la regla con id estable
(`SH-R-###`), deja el esqueleto del validador y un fixture en
`tests/fixtures/shorts-rules/` que la **incumple**, y regenera el playbook. Mientras
el validador siga devolviendo su incidencia `TODO`, `npm test` está rojo: una regla
no se puede dar por cerrada sin comprobación real.

Lo que el validador recibe: `context.scenes` con `layout`, `cues` (slot,
`fromFrame`, `durationInFrames`, `presentation`, `art`, `sound`) y `captionPages`;
más `format`, `soundCues`, `duckWindows`, `silencePaddingSeconds` y, por escena,
`speechLeadSeconds` / `speechTailSeconds`.

Dos datos los calcula el build a propósito para las reglas:

- **`cue.art`**: medidas del asset (cobertura opaca, luma media, oscuridad del
  borde) con `sharp`. Es lo que distingue un logo negro sobre alfa de un wordmark
  con fondo negro sólido, y por tanto qué `presentation` necesita cada uno. Sin la
  media presente las reglas de presentación se declaran no evaluables en vez de
  inventarse un veredicto.
- **`speechLeadSeconds` / `speechTailSeconds`**: silencio que queda dentro de la
  escena tras el recorte, para cazar un extremo declarado a mano con dos segundos
  de nadie hablando.

La geometría de la zona segura no se duplica: vive en
`remotion-animations/src/shorts/geometry.json` y la leen tanto `layout.ts` (para
dibujar) como el validador (para medir).

## Zona segura

La interfaz de Shorts y Reels dibuja título, avatar y botones en la franja
inferior. Nada informativo baja de `y = 1748`. El bloque de subtítulos se ancla por
abajo y crece hacia arriba, y su cuerpo se ajusta midiendo el texto real con
`measureText`, de modo que una página larga reduce la tipografía en vez de
desbordarse. El tope de 22 caracteres por página en el build evita llegar a ese
extremo.

## Verificación

```bash
npm test
```

```bash
npm run remotion:check
```

```bash
npm run shorts:playbook:check
```
