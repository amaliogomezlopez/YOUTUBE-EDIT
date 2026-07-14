# Shortsmith

Herramienta local para convertir un vídeo largo en transcripción, clips verticales, metadata editable, Stories y paquetes de publicación mediante APIs oficiales.

## Qué incluye

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
- Dashboard local organizado en Producción, Biblioteca y Storysmith.
- Historial persistente de jobs, recuperación tras recargar y estado seguro de proveedores.
- Edición real y persistente de título, resumen, hashtags, timestamps y copy por plataforma.
- Confirmación explícita e idempotencia antes de publicar en plataformas externas.
- Preview MP4 con HTTP Range para buscar dentro de los clips.
- Upload web en streaming a disco, con límites independientes para vídeo y transcript.
- Colas persistentes para proceso, rerender y publicación, con cancelación, reintento y recuperación tras reinicio.
- Editor de inicio/final, layout, calidad y posición manual de webcam con rerender en segundo plano.
- Detección facial local con YuNet/ONNX y fallback seguro a pantalla completa cuando no existe una webcam estable.
- STT de vídeos largos por fragmentos solapados, con deduplicación, timeout y limpieza temporal.
- Upload resumible de YouTube y reconciliación oficial del estado final de TikTok.
- Reanudación persistente de sesiones e identificadores remotos en los cuatro conectores, con parada segura ante estados ambiguos.
- Publicación programada mediante la cola local y registro de métricas por clip/plataforma.
- Seguridad opcional para acceso remoto, control de espacio, retención y limpieza con vista previa.

## Uso rápido

```bash
npm test
npm run smoke
npm run server
```

Abre `http://127.0.0.1:3000`. Por seguridad el servidor escucha solo en localhost salvo que configures `HOST` de forma explícita.

Para exponer el panel fuera del equipo es obligatorio usar un token de al menos 24 caracteres y un proxy HTTPS:

```text
HOST=0.0.0.0
SHORTSMITH_AUTH_TOKEN=una-clave-larga-y-aleatoria
SHORTSMITH_ALLOWED_HOSTS=studio.example
SHORTSMITH_ALLOWED_ORIGINS=https://studio.example
SHORTSMITH_ALLOWED_MEDIA_ROOTS=D:\\VIDEOS-YOUTUBE
```

En ese modo el navegador solicitará autenticación Basic; también se acepta `Authorization: Bearer` para clientes API. Las rutas locales quedan bloqueadas salvo dentro de las raíces declaradas.

Para videos largos en local, usa el campo **Ruta local del video** en vez de subir el archivo. Así el servidor procesa el archivo directamente desde disco y evita cargar un directo de varias horas en memoria.

La subida desde navegador también se procesa en streaming y admite hasta 20 GB por defecto. Ajusta `SHORTSMITH_MAX_UPLOAD_BYTES` y `SHORTSMITH_MAX_TRANSCRIPT_BYTES` si necesitas otros límites.

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

Para vídeos largos puedes ajustar el troceado y los reintentos:

```text
TRANSCRIPTION_CHUNK_SECONDS=600
TRANSCRIPTION_CHUNK_OVERLAP_SECONDS=3
TRANSCRIPTION_TIMEOUT_MS=900000
TRANSCRIPTION_RETRIES=2
```

Las colas usan concurrencia conservadora para no saturar CPU, disco ni cuota de APIs:

```text
JOB_CONCURRENCY=1
PUBLISH_CONCURRENCY=1
JOB_RETRY_DELAY_MS=1500
PUBLISH_RETRY_DELAY_MS=3000
```

Antes de una sesión de publicación comprueba los conectores sin realizar ninguna subida:

```bash
npm run publishing:doctor
```

La Biblioteca muestra espacio libre y permite simular la limpieza. Los temporales caducan por defecto a las 24 horas. Los proyectos y renders solo se eliminan si configuras `SHORTSMITH_JOB_RETENTION_DAYS` con un valor mayor que cero.

## Limitaciones actuales

- La detección YuNet sigue una única región de webcam estable; podcasts multicámara o cambios de plano complejos requieren revisión manual en el editor.
- El scoring heurístico es útil para ranking inicial. Las métricas pueden registrarse para análisis, pero todavía no recalibran automáticamente el ranking.
- El texto plano sin timestamps se aproxima por duración; para resultados serios usa SRT/VTT/JSON.
- El render actual usa FFmpeg. Remotion queda como siguiente capa para plantillas más ricas, animaciones y edición visual avanzada.
- Si la fuente es 360p/480p, el export puede ser `1080x1920` pero no tendrá detalle real 1080p. Para resultados nítidos usa fuente mínima `1280x720` horizontal o `720x1280` vertical.
- Las APIs externas pueden imponer revisión de aplicación, scopes, cuotas o planes. Cuando no permiten automatización, Shortsmith conserva el asset/caption y marca `requires_manual_action`.

## Siguiente versión

- Tracking dinámico de cara entre planos y soporte multicámara.
- Sincronización oficial automática de métricas desde cada plataforma.
- Plantillas Remotion.
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
