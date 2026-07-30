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

```text
src/modules/shorts-studio/          lógica Node (ingesta, build, sonido, subtítulos)
scripts/shorts-ingest.js            CLI de ingesta
scripts/shorts-build.js             CLI de compilación del plan
remotion-animations/src/shorts/     composición Remotion 9:16
remotion-animations/projects/shorts-<slug>/
  manifest.json                     inventario derivado de la ingesta
  transcripts/NN.json               palabras con tiempos (fuente de verdad temporal)
  short-plan.json                   EL PLAN EDITORIAL: esto es lo que se edita a mano
  short-build.json                  derivado; lo consume Remotion
remotion-animations/public/projects/shorts/<slug>/
  clips/NN.mp4                      clips remuxeados y normalizados (ignorado por git)
  assets/<id>.<ext>                 imágenes (ignorado por git)
```

## 1. Ingesta

```bash
npm run shorts:ingest -- --source "C:\ruta\con\clips" --slug mi-short
```

Por cada clip: remuxea a MP4 (Chrome no decodifica Matroska), normaliza el audio a
−14 LUFS con techo en −1.5 dBTP, detecta la cara con YuNet para obtener el punto
focal del recorte vertical, y transcribe con Faster-Whisper local.

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

### Layouts

- `full`: clip a sangre. Para el hook y los remates.
- `split`: cara arriba (0–960), escenario debajo (988–1528). El reparto por
  defecto.
- `stage`: la cara baja a una tarjeta de 392 px arriba a la izquierda y el
  escenario ocupa 552–1492. **Es el único layout en el que una captura de texto
  denso se lee.** Si una escena empieza con la cara y luego necesita mostrar una
  captura, se parte en dos escenas con el mismo `clipId` y trims contiguos: el
  audio sigue siendo continuo y el layout cambia.

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

Después, registrar la composición en `remotion-animations/src/Root.tsx` (importando
el `short-build.json`) y renderizar:

```bash
npm run remotion:studio
```

```bash
npx remotion render src/index.ts Short-<Nombre> salida.mp4
```

Tras añadir una composición hay que regenerar el manifest o `npm test` falla:

```bash
npm run remotion:capabilities
```

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
