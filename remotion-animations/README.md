# Remotion Animations para Shortsmith

Módulo aislado para crear motion graphics de pocos segundos y exportarlos como
vídeo normal o como overlay transparente para el editor. No sustituye al
pipeline FFmpeg de Shortsmith: lo complementa con composiciones React
parametrizables.

## Sistema editorial para agentes

El módulo incluye una capa de decisión reutilizable:

- `catalog/animations/patterns.json`: 28 patrones semánticos con estado real,
  evidencia requerida, assets compatibles, foco y sonido;
- `catalog/animations/effects.json`: zooms, revelados, trazados, contadores,
  texto progresivo, foco, salida y cues transversales;
- `catalog/visuals/icons.json`: 41 iconos SVG originales, clasificados por
  significado y preparados para selección semántica;
- `catalog/visuals/drawings.json`: 12 dibujos editoriales que combinan iconos
  para explicar procesos y relaciones;
- `catalog/visuals/images.json`: inventario de imágenes locales con procedencia,
  licencia, hash, dimensiones, etiquetas y punto focal;
- `catalog/design/brand-profiles.json`: temas, ritmos, formatos y defaults de
  marca separados de las composiciones;
- `catalog/preferences/channel-profile.json`: preferencias que ajustan el
  selector semántico sin ocultar su razonamiento;
- `catalog/capabilities.manifest.json`: índice generado de capacidades,
  composiciones, comandos, schemas y garantías factuales;
- `schemas/clip-animation-input.schema.json`: contrato opcional para clips y
  assets adyacentes;
- `schemas/animation-spec.schema.json`: contrato obligatorio entre el planner
  editorial y el builder de Remotion;
- `schemas/chart-ingestion-input.schema.json`: contrato para importar una
  gráfica, calibrarla y generar props con revisión de confianza;
- `PROMPT_PARA_AGENTES.md`: router de lotes y prompts especializados por
  familia;
- `docs/remotion-animation-system.md`: arquitectura, taxonomía y fases de
  implantación.

El catálogo distingue barras categóricas de histogramas estadísticos reales.
`RisingHistogram` conserva su nombre histórico en código, pero se registra
como `data.bar-focus`.

## Patrones extendidos y formatos

`src/motion/ExtendedPatterns.tsx` añade nueve patrones reutilizables:

- spotlight sobre captura;
- wipe antes/después;
- comparación con base común;
- timeline de hitos;
- ranking;
- acumulación;
- embudo/filtro;
- ramificación y convergencia;
- foto con parallax editorial.

Todos usan props Zod, sonido opcional y metadata dinámica para `landscape`
1920×1080, `vertical` 1080×1920, `square` 1080×1080 y `portrait` 1080×1350.
El sistema visual separa cuatro temas de cinco perfiles de movimiento en
`src/motion/DesignSystem.ts`.

## Review Studio

La revisión interactiva vive en:

```text
http://127.0.0.1:3000/remotion-review/
```

Preparación:

```powershell
npm run remotion:review:build
npm run server
```

El Player permite comparar A/B/C, cambiar formato, tema, ritmo, encabezado y
sonido, activar contexto de vídeo y safe zones, saltar a checkpoints y guardar
comentarios por frame. Las sesiones se conservan localmente en
`data/review/remotion/`. La aprobación exige superar QA y cualquier cambio de
props invalida ese resultado.

Para producir una evidencia reproducible:

```powershell
npm run remotion:review:package -- --session "<review-id>"
```

El paquete genera stills, índice, métricas, hoja de contacto etiquetada y un
manifest inmutable.

`src/motion/Effects.tsx` separa los efectos comunes de los patrones:

- `FocusZoom`: zoom parametrizable hacia número, logo o región;
- `TrackingZoom`: cámara que sigue una línea o recorrido mientras se construye;
- `NarrativeCamera`: cámara por cues que acompaña bloques de texto u otros
  focos situados en zonas distintas;
- `ProgressiveText`: 1-3 palabras por letras y frases breves con fade por
  palabras y desplazamiento ascendente configurable;
- `ProgressiveReveal`: entrada de nodos, imágenes o logos;
- `useStaggeredReveal`: aparición progresiva de una familia.

## Toolkit reutilizable

El núcleo compartido vive en `src/motion/Toolkit.tsx`:

- `MotionCanvas`: lienzo editorial sin marca fija, con titular centrado y
  encabezado opcional mediante `showHeader`.
- `KineticNumber`: contador numérico con formato español y zoom de énfasis.
- `RisingHistogram`: barras ascendentes con proporciones correctas.
- `LineChartZoom`: línea trazada y zoom de cámara sobre el dato elegido.
- `SignalPath`: recorridos animados para procesos y jerarquías.

Hay composiciones de laboratorio editables desde Props:

- `Toolkit-LineChartZoom`
- `Toolkit-RisingHistogram`
- `Toolkit-KineticNumber`
- `Toolkit-TransversalEffects`: seguimiento continuo de línea;
- `Toolkit-TransversalEffects-FinalZoom`: zoom únicamente al final;
- `Toolkit-TextFocusJourney`: cámara que viaja entre bloques de texto.

Sus datos son solo demostrativos. Para una pieza factual hay que sustituirlos
por cifras de la transcripción o de una fuente aportada por el usuario.

`ChartHighlight` y `ChartHighlightOverlay` se mantienen por compatibilidad; el
overlay está preparado para ProRes 4444 con canal alfa.

### Gráficas anotadas sobre imágenes

`src/charts/AnnotatedChartScene.tsx` permite calibrar una imagen mediante su
región de trazado y los límites de sus ejes. Con una serie JSON adicional,
Remotion puede marcar rangos, recorrer valores, calcular variaciones, añadir
eventos y hacer zoom manteniendo imagen y SVG perfectamente alineados.

Composiciones:

- `Chart-Annotated-Range`;
- `Chart-Annotated-Range-Audio`;
- `Chart-Annotated-Events`;
- `Chart-Annotated-Editorial`;
- `Chart-Annotated-Documentary`;
- `Chart-Annotated-Market`;
- `Chart-Annotated-Image-Only` (sin serie numérica ni encabezado).

El contrato de precisión y el flujo de calibración están documentados en
`docs/annotated-chart-workflow.md`.

La ingestión automática se ejecuta desde la raíz:

```powershell
npm run remotion:ingest:chart -- --input remotion-animations/projects/chart-ingestion-demo/chart-ingestion-input.json
```

Por defecto no usa servicios remotos. `--vision` propone región y ejes;
`--llm` selecciona anotaciones, y ambas salidas se validan antes de producir
props. Una calibración inferida permanece bloqueada hasta revisarla o aceptar
explícitamente `--allow-proposed`.

El selector semántico y el manifest se gestionan desde la raíz:

```powershell
npm run remotion:select:visual -- --query "memoria y repositorios"
npm run remotion:select:visual -- --query "flujo de agentes" --allow-fallback
npm run remotion:capabilities
```

El selector usa ontología bilingüe, fuzzy matching y preferencias del canal.
El fallback solo compone iconos auditados; no genera SVG libre. La tipografía
se carga localmente: Schibsted Grotesk para texto editorial y Fragment Mono
para datos.

Para incorporar imágenes, capturas o SVG:

```powershell
npm run remotion:asset:import -- --file "<ruta>" --id "<slug>" --type screenshot --alt "<texto>" --source "<origen>" --license "<licencia>" --tags "tag1,tag2"
```

La importación normaliza orientación y metadatos, rasteriza SVG, calcula hashes
y registra procedencia, licencia, tipo, tratamiento y punto focal.

## Catálogo visual

La API reutilizable vive en `src/visuals/`:

- `MotionIcon` representa un icono aislado;
- `IconGlyph` permite incrustarlo dentro de otro SVG;
- `EditorialDoodle` compone relaciones visuales animables;
- `ManagedImage` carga imágenes locales de `public/` con encuadre y punto
  focal controlados.

Los IDs son estables y se resuelven desde los JSON del catálogo. Las
composiciones `Catalog-Icons-01`, `Catalog-Icons-02` y `Catalog-Drawings`
permiten revisar el sistema completo desde Remotion Studio. La IA todavía no
genera SVG libre: `schemas/visual-selection.schema.json` fija por ahora la
política `catalog-only`.

## Diseño sonoro

La biblioteca completa se conserva en `assets/audio-effects/source-library/`
y está excluida de Git. Remotion usa una selección normalizada en `public/sfx/`
más cinco efectos `amaliometria-*` sintetizados localmente con FFmpeg.

`src/motion/SoundDesign.tsx` aporta `Soundtrack`, cues reutilizables y el mapa
sonoro de cada escena. Las composiciones `ALV3A-*` exponen:

- `soundEnabled`: activa o silencia todos los efectos;
- `soundMix`: volumen maestro entre `0` y `1`.

La V2 permanece sin sonido para montaje manual. La V3 añade audio AAC estéreo
sin modificar las imágenes.

## Uso desde `D:\2-YOUTUBE-EDIT`

```powershell
npm run remotion:studio
npm run remotion:check
npm run remotion:still
npm run remotion:render
npm run remotion:overlay
```

Para estudiar primero una animación de referencia:

```powershell
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode survey
npm run scout:animations -- --source "D:\videos\referencia.mp4" --mode study --start 42 --end 50 --fps 12 --analyze
```

El resultado `remotion-handoff.json` enlaza las hojas de contacto y las
recomendaciones visuales con este catálogo. No es todavía un
`animation-spec.json`: la pieza final debe aportar su evidencia editorial.

Los renders quedan en
`remotion-animations\out\<proyecto>\runs\<run-id>\` y no se versionan. Cada
comando reserva una carpeta nueva; nunca reutiliza ni limpia una ejecución
anterior. `run-start.json` identifica el intento y `run-result.json` aparece
solo cuando termina correctamente.

Las nuevas ejecuciones separan sus artefactos:

```text
<run-id>/
├── renders/     # MP4, MOV y entregables
├── previews/    # stills, frames, timelines y hojas de contacto
├── metadata/    # índices y manifests auxiliares
├── run-start.json
└── run-result.json
```

## Uso directo

```powershell
cd D:\2-YOUTUBE-EDIT\remotion-animations
npm run dev
npm run check
npm run still:chart
npm run render:chart
npm run render:overlay
npm run render:ahorrar-limites-v2
npm run render:ahorrar-limites-v3-audio
npm run render:toolkit
npm run stills:visual-catalog
npm run stills:annotated-chart
npm run build:review-studio
npm run review:package -- --session "<review-id>"
npm run prepare:sfx
npm run check:catalog
```

Para renderizar con datos enviados desde un JSON:

```powershell
node scripts/render-safe.mjs render mi-proyecto ChartHighlight mi-grafica.mp4 --props=props\mi-grafica.json
```

El wrapper rechaza rutas que salgan de la ejecución y archivos ya existentes.
Los scripts de lote aplican la misma política y usan `ffmpeg -n` para previews.

## Limpieza

Los vídeos, stills, frames y hojas de contacto se conservan por ejecución.
Cerrar o borrar un chat no los elimina. Desde la raíz del repositorio:

```powershell
npm run cleanup:animations
```

El comando solo simula por defecto. Consulta
`docs/animation-artifact-cleanup.md` antes de usar `--apply`; los originales y
el código nunca forman parte de esta limpieza.

La licencia estándar de Remotion es gratuita para particulares y equipos de
hasta tres personas. Si cambia el tamaño o el uso comercial del equipo, revisa
la licencia vigente antes de distribuir.
