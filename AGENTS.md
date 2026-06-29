# Shortsmith / YouTube Edit Agent Guide

## Rol del Agente

Eres un agente de ingenieria para `D:\2-YOUTUBE-EDIT`, una herramienta local para convertir videos largos de YouTube en Shorts verticales, generar historias editoriales de Instagram, producir metadata de publicacion y preparar el flujo futuro de subida multi-plataforma.

Trabaja con autonomia responsable: lee el codigo antes de cambiarlo, respeta el estilo Node.js existente, evita duplicar pipelines, ejecuta tests y documenta cambios relevantes.

## Producto

Shortsmith ayuda a procesar videos largos y convertirlos en clips verticales listos para YouTube Shorts, Instagram Reels, TikTok y X.

Debe cubrir:
- Generar Shorts verticales 9:16 desde videos largos.
- Para videos horizontales, usar layout webcam/cara arriba + pantalla debajo cuando se detecte webcam.
- Mantener alta calidad de render con FFmpeg.
- Aceptar transcripciones SRT, VTT, JSON o texto plano.
- Usar LLM para scoring de clips, titulos, resumenes, captions, 14 hashtags y timestamps.
- Preparar metadata editable para publicar.
- Preparar futura publicacion con APIs oficiales, no scraping.
- Convertir noticias, transcripciones o notas verificables en secuencias de Instagram Stories 9:16.
- Usar MiniMax M3 para estructurar el relato y un renderer SVG determinista para componer textos, flechas, etiquetas, color y layouts sin deformaciones.
- Permitir temas y layouts variables manteniendo una identidad editorial consistente.

## Estructura

- `src/cli.js`: CLI principal.
- `src/server.js`: servidor web local.
- `src/lib/pipeline.js`: orquestacion del job.
- `src/lib/ffmpeg.js`: probe, audio y render vertical.
- `src/lib/webcam.js`: deteccion de webcam/cara.
- `src/lib/transcript.js`: parser SRT/VTT/JSON/TXT.
- `src/lib/stt.js`: transcripcion opcional.
- `src/lib/scoring.js`: candidatos y scoring heuristico.
- `src/lib/llm.js`: MiniMax/OpenAI-compatible para scoring y JSON.
- `src/lib/publishing.js`: resumen, titulos, hashtags, timestamps y posts por plataforma.
- `src/lib/asset-host.js`: subida temporal de assets por SSH/SCP para obtener una URL HTTPS publica.
- `src/lib/stories/planner.js`: plan editorial de Stories mediante MiniMax M3 y fallback local.
- `src/lib/stories/renderer.js`: renderer SVG 1080x1920, temas y layouts deterministas.
- `public/`: UI local.
- `data/jobs/`: jobs locales generados.
- `data/output/`: Shorts y metadata exportada.
- `samples/`: videos/transcripts de prueba.
- `tests/`: tests Node.

## Comandos

```bash
npm install
npm test
npm run smoke
npm run server
```

Abrir:

```text
http://localhost:3000
```

Procesar por CLI:

```bash
npm run process -- --video "D:\videos\directo.mp4" --transcript "D:\videos\directo.srt" --top 5
```

Opciones utiles:

```bash
--top 8
--min 18
--max 60
--render-mode pip
--quality high
--subtitle-mode words
--no-llm
```

## Configuracion MiniMax M3

`.env` debe contener:

```text
LLM_PROVIDER=minimax
LLM_BASE_URL=https://api.minimax.io/v1/text/chatcompletion_v2
LLM_API_KEY=pegar_token_aqui
LLM_MODEL=MiniMax-M3
```

Tambien se aceptan aliases:

```text
MINIMAX_API_URL=https://api.minimax.io/v1/text/chatcompletion_v2
MINIMAX_API_KEY=pegar_token_aqui
MINIMAX_MODEL=MiniMax-M3
```

MiniMax se usa para resumenes, titulos, hashtags, captions, timestamps y scoring semantico. Para transcripcion de audio se recomienda otro modelo/STT.

## Instagram Storysmith

La UI incluye un estudio para pegar una fuente, elegir identidad visual y generar entre 4 y 7 Stories. Con MiniMax configurado, el planner devuelve JSON editorial; sin API o ante un fallo genera una secuencia local y muestra un warning.

Contratos:
- La fuente debe tener al menos 40 caracteres y es la unica evidencia autorizada.
- MiniMax no compone pixeles ni escribe dentro de imagenes: solo decide `layout`, `label`, `headline`, `body`, `accent`, `stat` e `imageQuery`.
- El renderer produce SVG 1080x1920 con tipografia, progreso, flechas y margenes seguros.
- Temas disponibles: `signal`, `cobalt`, `acid`, `night`.
- Layouts disponibles: `cover`, `statement`, `stat`, `split`, `solution`, `cta`.
- Las imagenes remotas son opcionales y deben usar URLs HTTPS con licencia adecuada; nunca inventar atribuciones.
- Endpoints: `POST /api/stories/plan` y `POST /api/stories/render`.
- La UI permite revisar cada pieza y descargar PNG 1080x1920 listo para Instagram; internamente conserva SVG para una composicion nitida.

## Transcripcion

El MVP ya acepta transcript proporcionado. Para audio sin transcript, existe STT opcional con OpenAI. Objetivo recomendado para transcripcion local:

```text
TRANSCRIPTION_PROVIDER=faster-whisper
TRANSCRIPTION_MODEL=small
TRANSCRIPTION_LANGUAGE=auto
```

Modelos recomendados:
- `small`: equilibrio inicial.
- `medium`: mejor precision, mas lento.
- `large-v3`: maxima calidad si hay recursos.

## Metadata de Publicacion

Cada job debe generar `publishing-metadata.json` con:
- `summary.short`, `summary.medium`, `summary.youtube_description`.
- 10 titulos por plataforma cuando haya LLM.
- `hashtags`: exactamente 14 hashtags en una sola linea.
- `timestamps`: capitulos YouTube, primero `00:00`, ordenados.
- `platform_posts.youtube`, `youtube_shorts`, `instagram`, `tiktok`, `x`.

Reglas:
- No inventar datos que no esten en la transcripcion.
- Evitar clickbait falso.
- Mantener idioma espanol salvo peticion contraria.
- Si falla el LLM, usar fallback local y guardar warning.

## Publicacion Multi-Plataforma Futura

Debe implementarse con conectores independientes:

```text
src/lib/publishers/youtube.js
src/lib/publishers/instagram.js
src/lib/publishers/tiktok.js
src/lib/publishers/x.js
```

Usar APIs oficiales:
- YouTube Data API.
- Meta/Instagram Graph API para Reels.
- TikTok Content Posting API.
- X API.

Estados esperados:
- `pending`
- `validating`
- `uploading`
- `processing`
- `published`
- `failed`
- `requires_manual_action`
- `skipped`

Si una API, cuenta, scope o plan no permite publicar automaticamente, marcar `requires_manual_action` y exportar caption/assets.

## Instagram Reels y Hosting HTTPS

Instagram Graph API no acepta subir un MP4 local directamente desde Shortsmith. Para publicar Reels necesita crear primero un contenedor con:

```text
POST /{ig-user-id}/media
media_type=REELS
video_url=https://dominio-publico/ruta/clip.mp4
caption=...
```

Contrato actual:
- YouTube puede subir el archivo local directamente con YouTube Data API.
- Instagram requiere `video_url` HTTPS publico y accesible por Meta.
- `src/lib/publishers/instagram.js` debe usar `videoUrl` si existe; si no existe, debe intentar subir el MP4 mediante `src/lib/asset-host.js`.
- Si el asset host no esta configurado o falla, devolver `requires_manual_action` o `failed` con mensaje claro, sin exponer tokens ni rutas privadas innecesarias.
- No usar scraping ni APIs no oficiales.

Asset host SSH/SCP:
- Configuracion esperada en `.env`:
  - `ASSET_HOST_PROVIDER=ssh`
  - `ASSET_HOST_SSH_HOST`
  - `ASSET_HOST_SSH_PORT`
  - `ASSET_HOST_SSH_USER`
  - `ASSET_HOST_SSH_KEY_PATH`
  - `ASSET_HOST_REMOTE_DIR`
  - `ASSET_HOST_PUBLIC_BASE_URL`
- El modulo sube el MP4 con `scp`, crea la carpeta remota con `ssh mkdir -p`, y devuelve la URL publica.
- No imprimir claves SSH, tokens Meta ni contenido de `.env`.

Contexto VPS conocido para pruebas:
- Host: `sibelion.ddns.net`
- SSH: puerto `2223`, usuario `amalio`
- Claves locales que conectan: `C:\Users\amalio\.ssh\sibelion_poly.key` y `C:\Users\amalio\.ssh\id_ed25519`
- Nginx sirve `sibelion.ddns.net` y HTTPS en `8443`, pero actualmente proxya `/` a `127.0.0.1:5050`.
- `/var/www/html` existe, pero no esta publicado por la configuracion nginx activa.
- Infraestructura actual: nginx sirve `location /shortsmith/videos/` desde `/var/www/shortsmith/videos/`, carpeta escribible por `amalio` y legible por `www-data`.
- URL publica base verificada: `https://sibelion.ddns.net:8443/shortsmith/videos/`.
- No modificar nginx/apache/caddy sin explicar el cambio y validar con `nginx -t`.

## Reglas de Trabajo

- No mezclar este proyecto con Scanio/TicketExpo.
- No introducir Python/FastAPI duplicado si el pipeline Node existente resuelve el caso.
- No hardcodear tokens ni secretos.
- No commitear `.env`, videos privados, audio, jobs ni output generado.
- Usar APIs oficiales para publicacion.
- Mantener la UI simple: subir/ruta local, revisar resultados, reproducir clips y editar metadata.
- Ejecutar `npm test` tras cambios de logica.
- Si se toca render, ejecutar `npm run smoke` cuando sea viable.
- Si se toca publicacion multi-plataforma, actualizar `docs/multiplatform-video-publishing.md`.
