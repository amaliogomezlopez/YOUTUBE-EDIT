---
name: create-ranked-shorts
description: "Convierte un vídeo largo MP4 en Shorts verticales 9:16 con Shortsmith, selecciona y refina los mejores cortes, añade subtítulos, comprueba los renders y los ordena por potencial viral. Usar cuando el usuario pida extraer, generar, reutilizar o rankear Shorts, Reels o vídeos cortos a partir de un vídeo largo."
---

# Crear Shorts rankeados

Generar cortes verticales terminados y revisados. Reutilizar el pipeline Node existente. La publicación requiere autorización explícita; generar, corregir y verificar los archivos forma parte del encargo de montaje.

Esta skill extrae cortes de un vídeo largo. Para montar varios clips desde cero, seguir `docs/shorts-desde-cero.md` y su flujo `shorts:ingest` → `shorts:build` → `shorts:render`.

## Preparación

1. Leer las instrucciones del repositorio, [la guía de montaje](../../../docs/shorts-adaptive-editing.md) y `src/modules/shorts-studio/rules/shorts-rules.json` antes de modificar planes. El JSON es el contrato ejecutable.
2. Resolver la ruta absoluta del MP4 y comprobarla con `ffprobe`. Si la ruta falla, buscar primero el nombre en la carpeta indicada; no sustituir la fuente por otro vídeo sin evidencia.
3. Reutilizar la transcripción aportada o un job de esa misma fuente, comprobando su ruta de origen y duración. No reutilizar transcripciones solo porque el nombre se parezca.
4. Si falta transcripción, omitir `--transcript` y usar la configuración local de STT. Conservar proveedor, modelo, idioma, dispositivo y Python configurados; no degradar una instalación GPU a `small`/CPU por defecto. Solo cambiar flags cuando el encargo o un fallo comprobado lo justifique. Un Python genérico no garantiza tener Faster-Whisper instalado. No imprimir `.env` ni credenciales.
5. Respetar la cantidad y el estilo pedidos. Si el usuario pide uno o dos ejemplos, generar uno o dos. Si no especifica cantidad, usar hasta ocho cortes distintos; entregar menos si no hay suficientes ideas completas y explicarlo.

## Generación y revisión editorial

Ejemplo para **dos** cortes; ajustar `--top` a la cantidad acordada:

```powershell
npm run process -- --video "<video.mp4>" --transcript "<transcript.json>" --top 2 --min 18 --max 60 --quality high --render-stage prepare --encoder auto --editing-profile dinamico --subtitle-mode karaoke --subtitle-preset talking-head-green --no-llm
```

El perfil `dinamico` activa el montaje adaptativo; usar `sobrio` o `energico` según la preferencia del usuario. Estos son valores iniciales: al revisar un job, conservar su perfil y subtítulos aprobados salvo cambio solicitado. Mantener `--no-llm` salvo que el encargo o la autorización previa incluya usar el LLM configurado.

Leer `transcript.json`, `candidates.json` y `job.json`. Revisar los límites automáticos y escoger ideas que se entiendan sin el vídeo largo, con gancho, desarrollo y cierre. Ajustar inicio y final a frases naturales; evitar palabras cortadas, saludos y contexto prescindible. Mantener normalmente 18–60 segundos, salvo otra duración solicitada o una idea completa que justifique la excepción.

Ordenar por gancho/conflicto (30 %), novedad (20 %), conclusión (20 %), comprensión autónoma (15 %), temas reconocibles (10 %) y ritmo (5 %). Evitar ángulos repetidos. El `viralScore` es una estimación editorial; no inventar métricas reales ni garantizar viralidad.

## Rendimiento: preparar, revisar y exportar una vez

La primera ejecución usa `--render-stage prepare`: selecciona, analiza y compila todos los cortes, sin MP4. Revisar y corregir rangos/ranking antes del primer máster. El contrato y opciones están en [Rendimiento de Shorts](../../../docs/shorts-render-performance.md).

1. Refinar rangos con el helper y `--stage prepare`; leer las nuevas escenas antes de corregirlas. Las correcciones posteriores de escenas/palabras también usan `--stage prepare`.
2. Revisar stills del build de cada corte: inicio, mitad, final, transiciones y pantalla densa. Para sincronía y audio, renderizar un preview de los cortes que lo necesiten con `--stage preview` (30 fps). No renderizar todos los másters como exploración.
3. Con selección, encuadres y palabras revisados, ejecutar el helper una sola vez con `--stage master` sobre todos los seleccionados. Conserva 1080×1920 a 60 fps. Revisar los MP4 finales y repetir solo los que fallen.
4. Cambios únicamente de título/ranking actualizan metadata sin render. `--force-render` fuerza regeneración cuando sea necesaria. `--dry-run` solo valida, no genera builds.

El pipeline detecta NVENC con una prueba real; `auto` cae a CPU si no está disponible. En Windows usa ANGLE y una pestaña de render por clip; permite ajustar concurrencia tras medir un fragmento representativo. No lanzar varios clips en paralelo sin medir memoria y tiempo. NVENC usa bitrate sin CRF; el wrapper ya respeta esa combinación. Se conserva la fuente 4K para no perder detalle al ampliar webcam o texto.

Reutilizar cortes y análisis cacheados: no borrar proyectos ni regenerar jobs de la misma fuente durante una revisión. Consultar `performance-history.jsonl` del proyecto y `renderHistory` del clip. Las entradas preparadas no tienen vídeo actual; los previews están en `clip.files.preview`, el máster solo en `clip.files.video`.

## Subtítulos predeterminados

En nuevos cortes, usar karaoke con el preset talking-head-green, basado en los subtítulos aprobados de create-talking-head-reels: hasta tres unidades por bloque, Schibsted Grotesk en mayúsculas, blanco con contorno oscuro de 5 px y solo la palabra pronunciada en verde #43F56C, sin saltos ni aumento de tamaño. Los nombres compuestos siguen juntos. La posición se adapta al layout del short; conservar la clasificación por segmento del vídeo largo. Otros estilos siguen disponibles por petición del usuario.

Para cambiar un job existente, pasar subtitleMode: "karaoke" y subtitlePreset: "talking-head-green" al helper de refinamiento. Omitir overrides anteriores que contradigan este preset y revisar el nuevo MP4. Comprobar tiempos reales por palabra: captionTiming: "approximate" indica karaoke estimado; obtener alineación por palabra antes de dar la sincronía por verificada.

## Refinamiento del job

Guardar un JSON dentro del job usando sus `clipId` reales. Incluir únicamente los campos que se quieran cambiar:

```json
[
  {
    "clipId": "clip-1234abcd",
    "rank": 1,
    "start": 42.3,
    "end": 78.6,
    "title": "La IA encontró una salida inesperada"
  }
]
```

```powershell
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<ruta-al-json>" --dry-run
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<ruta-al-json>"
```

El `--dry-run` comprueba identificadores, rangos y presencia de transcripción para todo el lote sin escribir ni renderizar. No sustituye los validadores del build ni la revisión del MP4.

`start` y `end` omitidos conservan el rango actual. El helper acepta `subtitleMode`, `subtitlePreset`, `subtitleStyle`, `quality`, `renderMode`, `webcamBox` y `editing` según los contratos del pipeline. Omitirlos conserva los ajustes existentes. `editing` permite las correcciones de perfil, efectos, escenas y palabras documentadas en la guía; no inventar campos ni coordenadas.

Cambiar entrada/salida reconstruye el plan y descarta ediciones anteriores de escenas y palabras. Cambiar perfil reconstruye escenas y conserva palabras. Hacer primero ese cambio, leer el nuevo plan y después corregir sus escenas/palabras en una segunda pasada: no enviar correcciones basadas en el plan antiguo junto al cambio de rango o perfil. Anclar correcciones a los índices reales de palabras; regiones de pantalla en píxeles de la fuente y centro facial entre 0 y 1.

El helper guarda el título y ranking después de preparar o renderizar correctamente y actualiza el JSON del clip. Si falla un corte posterior, conserva los anteriores completados. Consultar siempre `job.json` y `clip.files.video` al retomar.

## Control de calidad

Verificar cada MP4 actual indicado por `clip.files.video`:

- Archivo reproducible, `1080x1920`, vídeo H.264, audio AAC y píxel `yuv420p`.
- Duración coherente con el plan compilado y su mapa de tiempos; las pausas eliminadas pueden acortarla frente a `end - start`.
- Leer el informe técnico `render-qa.json` cuando exista y los errores/avisos del build. Corregir los errores y revisar los avisos; justificar las decisiones editoriales que se mantienen.
- Revisar imágenes del inicio, mitad y final, además de cambios de layout y el momento de pantalla más denso. Verificar webcam/cara, texto, recortes y márgenes en esos momentos; una captura aislada no basta.
- Clasificar por segmento: webcam en esquina → `pip`; sujeto a pantalla completa → `full`; pantalla sin webcam → `fit`. Evitar forzar un único modo cuando cambia la fuente.
- Preferir una pantalla inferior sin webcam duplicada: revisar el panel completo de webcam (no solo la cara) y seleccionar screenRegion que lo excluya; con webcam arriba a la derecha, probar centro-izquierda. Marcar screenRegion.webcamPolicy: "exclude" para validar que no hay solape ni mascara. Revisar la accion y los datos en cada escena; no reutilizar coordenadas entre videos. Si excluirla elimina informacion necesaria, elegir otro encuadre o documentar la excepcion de esa escena.
- Pantalla inferior y comparaciones centradas (SH-R-043): un panel de 900 px sobre un lienzo de 1080 deja 90 px a cada lado. La zona segura de subtítulos tiene su propia geometría.
- Reproducir y escuchar el MP4 para comprobar sincronía, volumen, cortes de audio, ritmo y cierre. Si la herramienta no permite comprobar alguno, declararlo pendiente; una revisión visual no certifica el audio.
- Corregir nombres propios con evidencia de la fuente. No añadir información inventada a títulos o subtítulos.

La QA técnica y la visual son pasos distintos. Si la composición o los subtítulos fallan, corregir, volver a renderizar y revisar el nuevo archivo. Un still corregido no actualiza los MP4 anteriores.

## Feedback y reproducibilidad

Convertir feedback general de montaje en regla con `npm run shorts:feedback`, siguiendo el contrato de `AGENTS.md`: regla, validador y fixture, sin dejar `TODO`. Comprobar antes si ya existe una regla aplicable y extenderla cuando corresponda. Una corrección específica de una escena pertenece al plan, con su motivo; no convertir coordenadas de un vídeo en valores globales.

Conservar plan aprobado, transcripción, assets y ajustes/versiones de render para reproducir geometría, tiempos y efectos. La selección editorial, la transcripción y el análisis pueden variar entre ejecuciones o versiones; no prometer que regenerar todo desde cero produzca idéntico resultado. Mantener medios privados y outputs fuera de los commits.

## Entrega

Entregar únicamente los cortes solicitados, en orden, con título provisional, duración real y enlace absoluto a cada MP4 actual. Enlazar el job cuando ayude a continuar. Indicar qué se verificó y cualquier comprobación pendiente; distinguir ejemplos renderizados, cambios permanentes del pipeline y ajustes particulares del plan. No publicar sin autorización.
