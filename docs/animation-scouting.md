# Animation Scout

## Objetivo

Animation Scout convierte un vídeo de referencia en evidencia visual manejable
por un agente: fotogramas con timestamps, hojas de contacto cronológicas,
perfil de cambio visual y un handoff para el sistema Remotion de Shortsmith.

Está pensado para:

- descubrir motion graphics, transiciones y tratamientos de cámara;
- estudiar cómo evolucionan sus capas entre estados;
- describir ritmo, trayectoria, escala, opacidad y posibles easings;
- reutilizar la mecánica visual dentro de una pieza editorial propia.

No transcribe, no extrae audio y no usa lo dicho en el vídeo. Tampoco recupera
los archivos fuente, vectores, tipografías o curvas originales: infiere una
reconstrucción a partir de píxeles.

## Skill de orquestación

Invocar `$scout-animations` cuando el usuario aporte una referencia y quiera
explorar, recrear o incorporar su mecánica visual. La skill coordina la pasada
`survey`, los estudios densos, la revisión frame a frame y la propuesta para el
catálogo Remotion.

Si no hay un modelo multimodal compatible, la skill realiza revisión visual
local y genera `manual-visual-analysis.json`. Cuando el objetivo incluye el
catálogo, añade `catalog-proposal.json` sin modificar React por defecto.

## Flujo de dos pasadas

### 1. Survey

Recorre el vídeo completo y localiza ventanas con actividad visual:

```powershell
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode survey
```

Valores predeterminados:

- 2 fps solicitados;
- máximo de 240 frames;
- frames de hasta 960 px de ancho;
- hojas de contacto de 4 × 3 frames.

Si el vídeo es largo, el presupuesto de frames reduce automáticamente los fps
para conservar cobertura desde el principio hasta el final. El manifest
registra `requestedFps`, `effectiveFps` y el aviso correspondiente.

Con análisis multimodal:

```powershell
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode survey --analyze --goal "Busca gráficas, zooms editoriales y transiciones de texto"
```

El resultado de `survey` sirve para elegir rangos. No debería usarse como única
referencia para reconstruir una animación rápida.

### 2. Study

Vuelve a procesar únicamente el rango elegido con muestreo denso:

```powershell
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode study --start 00:42 --end 00:50 --fps 12 --analyze
```

`study` usa 8 fps por defecto, admite hasta 60 fps y nunca deduplica frames. El
valor efectivo queda limitado por los fps reales de la fuente y por
`--max-frames`. Para ocho segundos a 12 fps se obtienen aproximadamente 96
frames.

Para una región concreta:

```powershell
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode study --start 42 --end 48 --fps 12 --crop "220:80:1480:820" --analyze
```

El recorte usa `x:y:ancho:alto` en píxeles de la fuente y se aplica antes del
escalado.

## Configuración del LLM visual

Animation Scout usa una configuración independiente del LLM editorial porque
el modelo de metadata puede no admitir imágenes:

```text
VISION_LLM_PROVIDER=openai-compatible
VISION_LLM_BASE_URL=https://api.openai.com/v1
VISION_LLM_API_KEY=pegar_clave
VISION_LLM_MODEL=modelo_con_vision
VISION_LLM_IMAGE_DETAIL=high
VISION_LLM_MAX_IMAGES_PER_REQUEST=4
VISION_LLM_TIMEOUT_MS=180000
VISION_LLM_RETRIES=2
VISION_LLM_JSON_MODE=true
```

Requisitos del endpoint:

- contrato compatible con `POST /v1/chat/completions`;
- mensajes multimodales con bloques `image_url`;
- soporte de URLs `data:image/jpeg;base64,...`;
- salida JSON o texto que contenga JSON válido.

Si un endpoint compatible rechaza `response_format=json_object`, usa:

```text
VISION_LLM_JSON_MODE=false
```

Un modelo de solo texto no es compatible aunque exponga Chat Completions.
LongCat-2.0 no debe configurarse como LLM visual.

La clave queda en `.env`, que está excluido de Git. No se imprime en consola ni
se guarda en los artefactos.

## Privacidad

Sin `--analyze`, todo ocurre localmente.

Con `--analyze`:

- se suben únicamente las hojas de contacto JPEG;
- no se sube el vídeo original;
- no se extrae ni sube audio;
- no se genera ni sube transcripción;
- las imágenes se agrupan según `VISION_LLM_MAX_IMAGES_PER_REQUEST`;
- los análisis parciales se fusionan en una última petición textual.

El manifest guarda estas decisiones en `privacy`.

## URLs

Las rutas locales solo necesitan FFmpeg y FFprobe. Para una URL pública:

```powershell
winget install yt-dlp.yt-dlp
npm run scout:animations -- --source "https://www.youtube.com/watch?v=..." --mode survey
```

`yt-dlp` descarga la referencia dentro del job de scouting. No usa cookies,
cuentas ni scraping autenticado. Utiliza únicamente referencias cuyo análisis
y reutilización estén autorizados.

## Artefactos

Cada ejecución crea:

```text
data/review/animation-scout/<scout-id>/
├── frames/
├── contact-sheets/
├── analysis-batches/          # solo con --analyze
├── manifest.json
├── motion-profile.json
├── visual-analysis.json       # solo con --analyze
├── remotion-handoff.json
└── README.md
```

La skill puede añadir, según el alcance:

```text
manual-visual-analysis.json    # revisión local sin LLM multimodal
catalog-proposal.json          # propuesta de reutilización o ampliación
SCOUT-REPORT.md                # informe humano
```

### `manifest.json`

Incluye fuente, probe, rango, crop, fps solicitado y efectivo, frames,
timestamps, cambios visuales, ventanas heurísticas y hojas de contacto.

### `motion-profile.json`

Calcula una diferencia visual normalizada entre cada par de frames reducidos a
32 × 32 en escala de grises. Es una señal de scouting, no optical flow:

- `hold`: casi sin cambio;
- `subtle-motion`: cambio pequeño;
- `motion`: cambio visible;
- `probable-cut`: diferencia compatible con un corte.

Las ventanas se premian cuando el cambio se sostiene durante varios frames y
se penalizan cuando dependen principalmente de cortes.

### `visual-analysis.json`

Separa:

- observaciones visibles;
- mecanismo inferido;
- capas;
- timeline;
- easing estimado;
- plan inicial para Remotion;
- incertidumbres.

### `remotion-handoff.json`

Conecta el scouting con:

- `catalog/animation-patterns.json`;
- `catalog/animation-effects.json`;
- `schemas/animation-spec.schema.json`;
- `src/motion/Toolkit.tsx`;
- `src/motion/Effects.tsx`.

Este archivo describe lenguaje y mecánica visual. La pieza final necesita su
propia evidencia editorial y un `animation-spec.json` válido antes de tocar
React.

## Opciones

```text
--source          ruta o URL
--mode            survey | study
--start           segundos | MM:SS | HH:MM:SS
--end             segundos | MM:SS | HH:MM:SS
--fps             0.05-60
--max-frames      presupuesto de frames, hasta 5000
--resolution      ancho 320-3840
--crop            x:y:ancho:alto
--columns         columnas de la hoja
--rows            filas de la hoja
--tile-width      ancho de celda
--candidates      ventanas heurísticas
--goal            objetivo para el modelo
--analyze         activa el LLM multimodal
--out             carpeta de salida vacía
```

## Handoff al creador Remotion

1. Elegir un candidato del informe `survey`.
2. Ejecutar `study` a 8-12 fps sobre ese rango.
3. Revisar sus hojas de contacto y las incertidumbres del modelo.
4. Invocar `create-remotion-animations` con `remotion-handoff.json`.
5. Convertir la mecánica elegida en un `animation-spec.json` respaldado por la
   fuente editorial del vídeo final.
6. Reutilizar Toolkit y Effects, implementar con `useCurrentFrame()` y easing
   explícito.
7. Validar stills al 0/15/45/75/95 %, ejecutar `npm run remotion:check` y
   revisar el render.

La licencia del código o de la herramienta de scouting no concede derechos
sobre vídeos, marcas, ilustraciones o animaciones de terceros.
