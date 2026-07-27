# Shortsmith

Herramienta local para convertir un vídeo largo en transcripción, clips verticales, metadata editable, Stories, carruseles informativos y paquetes de publicación mediante APIs oficiales.

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
- Subtítulos progresivos editables: presets, jerarquía visual, palabras acumulativas, fuentes locales y fallback por palabra o línea.
- Dashboard local organizado en Producción, Biblioteca, Storysmith y Carouselsmith.
- Carouselsmith independiente: 10 layouts, imágenes importadas o generadas, overlays SVG, edición persistente y exportación PNG/JPEG 4:5 y 9:16.
- Animation Scout local: muestreo visual denso, hojas de contacto, perfil de movimiento y análisis multimodal opcional para llevar referencias a Remotion.
- Ingestión local de gráficas para preparar assets, calibrar ejes, seleccionar tramos y generar props de Remotion con fallback controlado.
- Review Studio de Remotion con Player, variantes A/B/C, contexto de vídeo,
  comentarios por frame, QA y aprobación antes del render final.
- Biblioteca responsive de patrones, temas y ritmos, importación normalizada de
  imágenes/SVG y selector semántico sensible a preferencias.
- Selector semántico local de iconos, dibujos e imágenes con fallback
  compuesto y validado, más manifest de capacidades para agentes.
- Cuatro perfiles de dirección artística y fuentes locales deterministas para
  evitar una apariencia repetitiva o dependiente del sistema.
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

## Scouting visual de animaciones

Para recorrer un vídeo y localizar tratamientos visuales interesantes sin
transcribirlo:

```bash
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode survey
```

Después, estudia un rango concreto a más de dos fotogramas por segundo:

```bash
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode study --start 00:42 --end 00:50 --fps 12 --analyze
```

El modo `study` usa 8 fps por defecto y admite hasta 60 fps, limitado por los
fps de la fuente y por `--max-frames`. Los resultados quedan en
`data/review/animation-scout/` e incluyen hojas de contacto, perfil heurístico,
informe visual y `remotion-handoff.json`. Solo `--analyze` envía las hojas de
contacto al proveedor configurado con `VISION_LLM_*`; nunca envía audio ni
transcripción. Las URLs requieren `yt-dlp`.

Consulta [docs/animation-scouting.md](docs/animation-scouting.md) para el flujo
de dos pasadas y la configuración del modelo multimodal.

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

## STT local y subtítulos progresivos

Instala Faster-Whisper en el entorno aislado del proyecto:

```bash
npm run stt:setup
```

La UI permite escoger `small`, `medium`, `large-v3` o `large-v3-turbo`, idioma, vocabulario contextual y GPU sin editar `.env`. Los modelos se descargan en `data/models/faster-whisper` —o se reutilizan desde la caché local de Hugging Face— y nunca se envía el audio a un servicio externo.

Por CLI:

```bash
npm run process -- --video "D:\videos\directo.mp4" --stt-provider faster-whisper --stt-model large-v3-turbo --stt-prompt "Kimi K3, GPT-5, Claude Opus" --subtitle-mode progressive --subtitle-preset progressive-punchy --top 5 --no-llm
```

En Windows, `--stt-device cuda --stt-compute-type float16` requiere CUDA 12/cuBLAS y cuDNN 9 compatibles con CTranslate2. Se puede usar el fallback completamente local `--stt-device cpu --stt-compute-type int8` mientras se prepara ese runtime.

El modo progresivo conserva timestamps por palabra, construye bloques acumulativos y genera `captions.ass` más `caption-plan.json` junto a cada Short. Copia fuentes TTF/OTF con licencia adecuada en `data/fonts` y selecciona su nombre de familia en la UI.

Prueba el renderer sin usar un vídeo privado:

```bash
npm run smoke:captions
```

Consulta [docs/local-progressive-captions.md](docs/local-progressive-captions.md) para el contrato, presets y diagnóstico de GPU.

Como alternativa local más lenta, el proveedor `whisper-cli` usa el Whisper clásico ya instalado y también solicita timestamps por palabra.

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

La Biblioteca muestra espacio libre y permite simular la limpieza. Los
temporales caducan por defecto a las 24 horas. Los proyectos y renders
generales solo se eliminan si configuras `SHORTSMITH_JOB_RETENTION_DAYS` con
un valor mayor que cero.

Los runs Remotion y los jobs de Animation Scout tienen una limpieza separada,
siempre en modo simulación por defecto:

```powershell
npm run cleanup:animations
```

Consulta `docs/animation-artifact-cleanup.md` antes de aplicar el borrado.
Archivar o eliminar un chat no borra archivos locales.

## Limitaciones actuales

- La detección YuNet sigue una única región de webcam estable; podcasts multicámara o cambios de plano complejos requieren revisión manual en el editor.
- El scoring heurístico es útil para ranking inicial. Las métricas pueden registrarse para análisis, pero todavía no recalibran automáticamente el ranking.
- El texto plano sin timestamps se aproxima por duración; para resultados serios usa SRT/VTT/JSON.
- El render principal usa FFmpeg. El módulo `remotion-animations/` añade composiciones parametrizables para motion graphics, gráficas nativas y anotaciones calibradas sobre imágenes.
- Si la fuente es 360p/480p, el export puede ser `1080x1920` pero no tendrá detalle real 1080p. Para resultados nítidos usa fuente mínima `1280x720` horizontal o `720x1280` vertical.
- Las APIs externas pueden imponer revisión de aplicación, scopes, cuotas o planes. Cuando no permiten automatización, Shortsmith conserva el asset/caption y marca `requires_manual_action`.

## Siguiente versión

- Tracking dinámico de cara entre planos y soporte multicámara.
- Sincronización oficial automática de métricas desde cada plataforma.
- Integración automática de las plantillas Remotion dentro de los jobs de Shortsmith.
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
