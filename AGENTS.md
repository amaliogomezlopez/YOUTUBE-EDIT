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

## Shorts desde cero

Si el encargo es "en esta carpeta tengo unos clips y quiero montar un short", no es
el pipeline de `src/lib/pipeline.js` (ese recorta un video largo). Es
`src/modules/shorts-studio` + `remotion-animations/src/shorts`, documentado en
`docs/shorts-desde-cero.md`.

Las reglas duras de ese flujo no son consejos: son un set ejecutable en
`src/modules/shorts-studio/rules/shorts-rules.json` que `shorts:build` corre contra
el `short-build.json` resuelto, fallando en `error` y avisando en `warning`. La
version legible es `docs/shorts-playbook.md`, generada desde el JSON. Antes de tocar
un plan, leer ese JSON.

- El indice de palabra de la transcripcion es el ancla de los cues (`atWord`).
  `atSeconds` solo vale si el clip no tiene transcripcion.
- El sonido se pide por familia, nunca por fichero, y ningun cue entra en silencio
  sin `soundNote` que lo justifique (SH-R-050).
- Dos cues no comparten slot a la vez (SH-R-010).
- El texto en pantalla anade informacion; no repite la locucion (SH-R-030).
- Una captura de texto denso exige layout `stage`, no `split` (SH-R-020).
- Un logo oscuro sobre alfa necesita `plate`; uno con fondo negro solido, `blend`
  (SH-R-021 y SH-R-022). Lo decide la medida del arte, no el nombre del fichero.
- Nada informativo por debajo de `y = 1748`: ahi dibuja la interfaz de Shorts
  (SH-R-040).

Todo feedback del usuario sobre el montaje vertical se convierte en regla con
`npm run shorts:feedback`, que crea regla, validador y fixture de una vez. La regla
no esta cerrada mientras su validador siga devolviendo `TODO`: `npm test` lo caza.

El ciclo es `shorts:ingest` -> editar `short-plan.json` -> `shorts:build` ->
`shorts:render` -> `shorts:publishing` -> `shorts:publish`, y no exige tocar
codigo: `shorts:build`
regenera `remotion-animations/src/shorts/registry.generated.ts`, que es de donde
`Root.tsx` saca las composiciones. Tras anadir o quitar una, `npm run
remotion:capabilities`.

Contratos que se suman a ese ciclo: los layouts `pip` (webcam + pantalla, exige
`webcamBox`, replica el filtergraph del pipeline de video largo) y `fit`
(horizontal sin webcam); los subtitulos admiten `captions.mode: "progressive"`
(revelado palabra a palabra con palabra heroe) ademas del `karaoke` por defecto;
la ingesta guarda `focusTrack` y el encuadre sigue a la cara salvo que el plan
fije `focus`; y `sound.music` anade una cama musical con ducking. El pipeline de
video largo puede renderizar sus cortes con este mismo motor con
`--render-engine remotion` (puente: `src/modules/shorts-studio/from-long-video.js`;
el default sigue siendo ffmpeg). En esa rama el layout se clasifica **por
segmento**: webcam en esquina dentro de la ventana del candidato -> `pip` con ese
box; si no, cara a pantalla completa -> `full` con `focusTrack`; si tampoco ->
`fit`. Un `--render-mode` explicito fuerza el modo para todos los cortes y usa el
webcamBox de nivel job. Los renders salen en H.264 CRF 17 por defecto.

La metadata de publicacion del short sale de `npm run shorts:publishing -- --slug
<slug>`, que reutiliza `generatePublishingMetadata` y `buildClipPublishing` de
`src/lib/publishing.js` y escribe `publishing-metadata.json` con el contrato de la
seccion "Metadata de Publicacion". Describe la transcripcion del short **montado**
(palabras dentro del recorte de cada escena, rebasadas al reloj del short), no la de
los clips crudos. `npm run shorts:publish -- --slug <slug>` publica con esa metadata
y el ultimo MP4 renderizado usando los conectores de `src/lib/publishers/`, con los
mismos estados que el pipeline de video largo (`requires_manual_action` cuando
falta una credencial o el hosting HTTPS de Instagram).

## Superficies de montaje y capa comun

Hay tres superficies de montaje, y la diferencia entre ellas **no se resuelve
ramificando codigo**:

| Superficie | Formato | Ancla temporal | Contrato |
|---|---|---|---|
| `shorts-studio` | 1080x1920 @60 | palabra (`atWord`) | `rules/shorts-rules.json` |
| `intro-studio` | 1920x1080 @60 | beat (`atBeat`) | `rules/intro-rules.json` |
| `editorial-video` | 1920x1080 @30 | palabra | `channels/<canal>/brand/editing-rules.json` |

`src/modules/video-studio/` es lo comun a las tres: ingesta (remux, loudness, cara,
transcripcion, musica), rejilla de beats, recorte y ventanas de locucion, medidas del
arte, paginacion de subtitulos, catalogo de familias de sonido, generacion del
registro de composiciones, intake de feedback y carga de sets de reglas. Antes de
escribir algo en una superficie, comprobar si ya existe ahi.

Dos ejes ortogonales, y hay que elegir el correcto al colocar una decision:

- **Superficie**: que se puede hacer. Formato, geometria, layouts, slots, allowlist
  de efectos, reglas propias.
- **Perfil de estilo**: cuanto. Umbrales de ritmo, densidad, duracion, opacidad de
  fondo. En la intro viven en `src/modules/intro-studio/intro-profiles.json` y el
  build los copia al JSON compilado como `budget`.

**Una regla de ritmo no lleva su umbral dentro**: lo lee del `budget` del perfil y se
declara *no evaluable* si no esta. Es lo que permite que el perfil sobrio y el
nervioso compartan validador en vez de necesitar excepciones.

Un validador que se cumple igual en dos superficies asciende a `catalog` y se mueve a
`src/modules/video-studio/checks/`, desde donde lo cargan todas. Ya han ascendido
`art-dark-on-alpha-needs-plate`, `art-solid-background-needs-blend` y
`cue-not-silent`.

## Introducciones a camara

Si el encargo es "tengo clips grabados a camara y quiero la introduccion de mi
video", es `src/modules/intro-studio` + `remotion-animations/src/intro`, documentado
en `docs/intros-desde-cero.md`. No es el flujo de shorts (vertical, se publica solo)
ni el motor editorial (explica datos): la intro es la cabecera de un video largo y su
entregable es un MP4 1920x1080 que se coloca al principio en el editor. **No hay etapa
de metadata ni de publicacion.**

Reglas duras de este flujo, ejecutables en
`src/modules/intro-studio/rules/intro-rules.json`:

- **El beat es el ancla.** `atBeat` es un indice de la rejilla global de la pieza;
  `atWord`, un indice dentro de la transcripcion de su clip. `atSeconds` solo se
  acepta cuando no hay ni musica ni transcripcion. La rejilla la estima la ingesta y
  el plan la puede fijar con `bpm` y `offsetSeconds`.
- **Nada tapa la cara.** El build proyecta el `faceBox` de la ingesta al rectangulo
  que la cara ocupa en la composicion; ningun cue de primer plano ni la banda del
  titular la tapan mas del 12 % (IN-R-011).
- **Los logos por detras no llevan mascara de persona.** La profundidad la dan el
  layout (`frame`, `hero-left`, `hero-right`) y la profundidad de campo: un cue
  `depth: "back"` va reducido y desenfocado (IN-R-010).
- **El ritmo se mide en las dos direcciones**: techo de golpes por segundo en ventana
  deslizante (IN-R-041) y suelo de cambio visible (IN-R-060). El segundo es el fallo
  real de la mayoria de intros caseras.
- **Todo golpe fuerte cae en un beat** o declara `offBeatNote` (IN-R-040).
- Nada informativo baja de `y = 972`: ahi dibuja el reproductor de YouTube su barra y
  sus controles (IN-R-030).

El ciclo es `intro:ingest` -> editar `intro-plan.json` -> `intro:build` ->
`intro:render`, y no exige tocar codigo: `intro:build` regenera
`remotion-animations/src/intro/registry.generated.ts`. Tras anadir o quitar una
composicion, `npm run remotion:capabilities`.

Todo feedback del usuario sobre la intro se convierte en regla con `npm run
intro:feedback`, que crea regla, validador y fixture de una vez. La regla no esta
cerrada mientras su validador siga devolviendo `TODO`: `npm test` lo caza.

El proyecto de referencia es `demo-canal`, con media sintetica que regenera `node
scripts/intro-demo-media.js`.

## Motor de animacion editorial

Si el encargo es "en esta carpeta estan los clips del episodio N, haz las
animaciones", usar la skill `episodio-animado`
(`.claude/skills/episodio-animado/SKILL.md`): lleva el flujo completo de carpeta
de clips a bloques aprobados.

Antes de tocar animaciones de un episodio editorial, leer
`docs/animation-engine-operating-manual.md`. La primera accion del agente es
leer `channels/<canal>/brand/editing-rules.json` (el JSON, no el markdown) y
`channels/<canal>/brand/rule-exceptions.json`: son las reglas que el build va a
ejecutar, con id estable y validador.

Reglas duras del motor:

- El indice de palabra de la transcripcion es la unica fuente de verdad
  temporal. `atSeconds` es un derivado; escribirlo a mano hace fallar el build.
- Los cues los mina `src/modules/editorial-video/visuals/cue-mining.js`. Un cue
  manual solo se justifica por rotulo, destino u orden narrativo.
- El sonido se pide por familia (`{family, intensity}`), nunca por fichero.
- Una escena nueva se resuelve con el catalogo o el catalogo crece; nunca con un
  componente de un solo uso.
- Todo feedback del usuario se convierte en regla con
  `npm run channel:feedback`, y la regla necesita validador y fixture.

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
- `src/modules/video-studio/`: capa comun de las superficies de montaje.
- `src/modules/shorts-studio/`: superficie vertical 9:16.
- `src/modules/intro-studio/`: superficie de introducciones 16:9 a camara.
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
- Clave local configurada en `.env` mediante `ASSET_HOST_SSH_KEY_PATH`; no documentar rutas privadas reales en repositorios publicos.
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
