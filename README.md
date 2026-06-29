# Shortsmith MVP

Sistema local para recibir un video largo y producir Shorts verticales con subtítulos, ranking de viralidad y metadata editable.

## Qué incluye el MVP

- Ingesta de video por CLI o panel web.
- Transcripción desde SRT, VTT, JSON o texto plano aproximado.
- STT opcional con OpenAI, faster-whisper o un endpoint local tipo Nemotron si no aportas transcript.
- Limpieza de solapes habituales en subtítulos automáticos de YouTube.
- Detección de clips candidatos por ventanas semánticas.
- Scoring heurístico crítico: hook, densidad, emoción, payoff, duración, tema y opinión editorial sobre IA/modelos/LLMs.
- Enriquecimiento opcional con modelos LLM OpenAI-compatible, incluyendo servidores usados por OpenCode si exponen `/v1/chat/completions`.
- Render vertical `1080x1920` con FFmpeg y subtítulos ASS quemados.
- Encoder de calidad alta por defecto: escalado Lanczos, `crf 17`, preset `slow` y buffer alto para evitar artefactos en textos/pantallas.
- Layout móvil adaptativo: videos horizontales usan webcam arriba + pantalla abajo cuando detecta webcam; videos verticales se recortan a pantalla completa.
- Subtítulos estilo Shorts: mayúsculas, amarillo con reborde negro, palabra por palabra.
- Panel web local para revisar clips y reproducir exports.

## Uso rápido

```bash
npm test
npm run smoke
npm run server
```

Abre `http://localhost:3000`.

Para videos largos en local, usa el campo **Ruta local del video** en vez de subir el archivo. Así el servidor procesa el archivo directamente desde disco y evita cargar un directo de varias horas en memoria.

Carpeta cómoda para pruebas:

```txt
samples/input/
samples/transcripts/
```

Puedes poner ahí `video.mp4` y `video.srt`, o usar cualquier otra ruta local.

## Procesar por CLI

```bash
npm run process -- --video "D:\videos\directo.mp4" --transcript "D:\videos\directo.srt" --top 5
```

Opciones:

```bash
--top 8
--min 18
--max 60
--render-mode pip
--quality high
--subtitle-mode words
--stt-provider faster-whisper
--stt-model small
--stt-language es
--no-llm
```

Los resultados quedan en:

```txt
data/output/<job-id>/<clip-id>/short.mp4
data/output/<job-id>/<clip-id>/metadata.json
```

## Formato transcript recomendado

SRT funciona bien:

```srt
1
00:00:00,000 --> 00:00:04,200
No sabes el error que casi nos cuesta el lanzamiento.
```

JSON también:

```json
[
  {"start": 0, "end": 4.2, "text": "No sabes el error que casi nos cuesta el lanzamiento."}
]
```

## Configurar LLM OpenCode

Copia `.env.example` a `.env` o define variables en la terminal. El proveedor debe ser compatible con OpenAI chat completions:

```bash
set LLM_PROVIDER=openai-compatible
set OPENCODE_BASE_URL=http://127.0.0.1:11434/v1
set OPENCODE_API_KEY=tu_key
set OPENCODE_MODEL=tu_modelo
```

También acepta `LLM_BASE_URL`, `LLM_API_KEY` y `LLM_MODEL`.

Si no configuras LLM, el sistema usa scoring heurístico. Esto es deliberado: el MVP debe funcionar offline con transcript.

## STT opcional

Si no proporcionas transcript:

```bash
set STT_PROVIDER=openai
set OPENAI_API_KEY=tu_key
set OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

Para probar local con faster-whisper compatible con CLI:

```bash
set TRANSCRIPTION_PROVIDER=faster-whisper
set FASTER_WHISPER_COMMAND=whisper
set TRANSCRIPTION_MODEL=small
set TRANSCRIPTION_LANGUAGE=es
npm run process -- --video "D:\videos\directo.mp4" --top 5 --no-llm
```

Para un servicio local tipo Nemotron ASR que acepte `multipart/form-data` con campo `file`:

```bash
set TRANSCRIPTION_PROVIDER=nemotron
set NEMOTRON_ASR_URL=http://127.0.0.1:8000/transcribe
set TRANSCRIPTION_LANGUAGE=es
npm run process -- --video "D:\videos\directo.mp4" --top 5 --no-llm
```

También puedes pasarlo por CLI:

```bash
npm run process -- --video "D:\videos\directo.mp4" --stt-provider nemotron --stt-language es --top 5
```

## Limitaciones críticas del MVP

- El auto-crop es centrado. Para hablar a cámara suele bastar; para podcasts multicámara conviene añadir detección de caras.
- La detección de webcam del MVP usa análisis de frames y color de piel. Producción debería usar YOLO/MediaPipe/RetinaFace vía ONNX para tracking más robusto.
- El scoring heurístico es útil para ranking inicial, no reemplaza entrenamiento con métricas reales.
- El texto plano sin timestamps se aproxima por duración; para resultados serios usa SRT/VTT/JSON.
- El render actual usa FFmpeg. Remotion queda como siguiente capa para plantillas más ricas, animaciones y edición visual avanzada.
- Si la fuente es 360p/480p, el export puede ser `1080x1920` pero no tendrá detalle real 1080p. Para resultados nítidos usa fuente mínima `1280x720` horizontal o `720x1280` vertical.
- El upload web sigue siendo simple. Para archivos grandes, usa rutas locales o la CLI.

## Siguiente versión

- Face tracking para crop dinámico.
- Word-level captions y resaltado por palabra.
- Editor de rango inicio/final en la UI.
- Plantillas Remotion.
- Publicación directa a YouTube/TikTok.
- Feedback loop con métricas reales para recalibrar el scoring.

## MiniMax M3 para metadata

Para usar MiniMax M3 en scoring, resumenes, titulos, 14 hashtags, captions y timestamps, configura `.env`:

```bash
LLM_PROVIDER=minimax
LLM_BASE_URL=https://api.minimax.io/v1/text/chatcompletion_v2
LLM_API_KEY=tu_token_de_minimax
LLM_MODEL=MiniMax-M3
```

El panel web muestra un bloque de metadata de publicacion por job cuando termina la transcripcion. Incluye resumen, hashtags, timestamps, descripcion de YouTube y textos para Instagram/TikTok/X.

MiniMax no sustituye al modelo de transcripcion. Para transcribir audio localmente, la siguiente capa recomendada es `faster-whisper` con modelo `small` o `medium`.
