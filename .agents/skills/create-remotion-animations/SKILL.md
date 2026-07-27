---
name: create-remotion-animations
description: "Analiza vídeos y transcripciones, elige automáticamente el patrón y los efectos del catálogo que mejor explican cada momento, diseña e implementa animaciones cortas con efectos de sonido semánticos en Remotion, las audita, las entrega por clip y gestiona la limpieza explícita de sus renders y previews. Usar dentro de YouTube Edit cuando el usuario pida crear o mejorar motion graphics, gráficas animadas, porcentajes, comparativas, procesos, explicaciones visuales, sonorización sincronizada, overlays transparentes, un paquete de animaciones asociado a clips de YouTube o limpiar artefactos de animación."
---

# Crear animaciones con Remotion

Producir piezas breves, fieles a la fuente y listas para montar. Reutilizar el módulo `remotion-animations/`; no crear otro proyecto Remotion ni sustituir el pipeline FFmpeg de Shortsmith.

## Cargar el contexto necesario

1. Trabajar desde la raíz de `D:\2-YOUTUBE-EDIT` y leer `AGENTS.md`.
2. Leer `remotion-animations/package.json`, `remotion-animations/src/Root.tsx` y las composiciones relacionadas antes de editar.
3. Leer [project-workflow.md](references/project-workflow.md) para analizar clips, transcribir, seleccionar ideas y coordinar esta skill con las demás.
4. Leer [visual-quality.md](references/visual-quality.md) antes de diseñar, criticar o pulir una animación.
5. Leer [remotion-implementation.md](references/remotion-implementation.md) antes de cambiar código o renderizar.
6. Leer [catalog-selection.md](references/catalog-selection.md) antes de elegir patrón, efectos o composición.
7. Leer siempre [sound-design.md](references/sound-design.md) antes de implementar o renderizar; la decisión sonora forma parte obligatoria del diseño.
8. Leer [delivery-contract.md](references/delivery-contract.md) cuando haya que preparar un paquete para el editor.
9. Cargar también `remotion-best-practices` cuando esté disponible y consultar solo sus reglas pertinentes, especialmente animaciones, charts, compositions, parameters, sequencing, timing, measuring-text, audio, sfx y transparent-videos.
10. Leer `docs/animation-artifact-cleanup.md` antes de revisar o borrar
    renders, stills, previews o jobs de scouting.

## Flujo

### 1. Inventariar y reunir evidencia

- Resolver las rutas absolutas de todos los vídeos y transcripciones.
- Obtener con `ffprobe` duración, resolución, fps, codecs y audio sin modificar los originales.
- Reutilizar una transcripción coincidente. Si falta, usar Faster-Whisper local mediante Shortsmith con `--no-llm` por defecto.
- Leer la transcripción completa con tiempos. Tratarla como la única fuente factual autorizada salvo que el usuario aporte fuentes adicionales.

#### Scouting visual de animaciones de referencia

Cuando el usuario aporte un vídeo para estudiar su estilo, transición o
mecánica visual —no su contenido editorial— usar primero
`$scout-animations`.

- Dejar que esa skill ejecute `survey`, estudios densos, revisión visual y
  propuesta de catálogo.
- Leer su `remotion-handoff.json`, análisis visual, hojas del rango y
  `catalog-proposal.json` antes de diseñar.
- Tratar el scouting como evidencia de composición, capas, ritmo, trayectorias
  y easing, nunca como fuente factual.
- Conservar incertidumbres y verificar visualmente las inferencias elegidas.
- Reutilizar únicamente la mecánica con la identidad editorial del proyecto.
- Crear después un `animation-spec.json` respaldado por la fuente editorial de
  la pieza final.

### 2. Seleccionar momentos que merezcan animación

- Favorecer cifras, porcentajes, comparativas, jerarquías, procesos, acumulaciones, relaciones causa-efecto y conceptos abstractos difíciles de imaginar.
- Omitir adornos que no aclaren la explicación, afirmaciones dudosas y repeticiones de la misma metáfora visual.
- Leer `catalog/animations/patterns.json`, `catalog/animations/effects.json` y, cuando la escena necesite recursos visuales, `catalog/visuals/icons.json` y `catalog/visuals/drawings.json`. Elegir por significado y evidencia usando `selectWhen`, `rejectWhen`, `evidenceRequired` y [catalog-selection.md](references/catalog-selection.md), no por gusto estético.
- Preferir un patrón `ready` que comunique la afirmación exacta. Usar una entrada `planned` solo si ninguna composición lista resuelve el momento y la nueva implementación queda justificada.
- Preparar un plan antes de programar: clip, timestamp, afirmación, `patternId`, `effectIds`, `soundProfile`, eventos sonoros, composición, formato y prioridad.
- Mantener normalmente cada animación entre 5 y 10 segundos. Dejar tiempo real de lectura y un tramo estable para que el editor pueda cortar.

### 3. Diseñar e implementar

- Reutilizar componentes, paleta y lenguaje visual existentes cuando encajen; crear abstracciones solo si se repetirán.
- Registrar cada composición en `remotion-animations/src/Root.tsx`, agrupada en un `<Folder>` del proyecto.
- Parametrizar textos, datos, colores y selección destacada mediante props JSON-serializables y Zod.
- Hacer depender todo movimiento de `useCurrentFrame()` y `useVideoConfig()`. No usar animaciones o transiciones CSS.
- Mantener la pieza comprensible sin audio y evitar que el texto duplique palabra por palabra la locución.
- Diseñar efectos de sonido por defecto. Para cada transformación significativa, decidir explícitamente entre un cue sincronizado o silencio intencional; no dejar el sonido sin analizar.
- Derivar la familia sonora del `soundProfile` del patrón y ajustar cada cue al evento visual real. No añadir sonidos genéricos por rellenar ni un cue por cada elemento decorativo.
- Exponer `soundEnabled` y `soundMix` como props Zod. Implementar con `Soundtrack` y preferir los WAV `amaliometria-*` de procedencia propia.
- Entregar por defecto una variante sonorizada y otra silenciosa. La variante silenciosa debe seguir entendiendo la idea completa.
- No inventar valores para completar una gráfica. Si la fuente expresa una relación cualitativa, representarla de forma cualitativa.

### 4. Revisar antes del render final

- Ejecutar `npm run remotion:check`.
- Generar stills de entrada, momento principal y salida; revisar legibilidad, recortes, jerarquía, contraste y fidelidad.
- Corregir el código si la composición falla visualmente. No considerar suficiente que TypeScript compile.
- Para un conjunto de piezas, preparar una hoja de contacto o previews equivalentes que permitan compararlas de un vistazo.
- Puntuar cada pieza con la rúbrica de [visual-quality.md](references/visual-quality.md). No entregar como final una pieza por debajo de 80/100.
- Renderizar primero una pieza sonorizada piloto; revisar sincronía, silencios, picos, solapamientos y convivencia con locución antes de procesar el lote.

### 5. Renderizar y entregar

- Reservar una carpeta nueva por cada ejecución con
  `scripts/lib/output-run.mjs`. La estructura obligatoria es
  `out/<proyecto>/runs/<run-id>/`; no reutilizar una ejecución anterior ni
  escribir renders directamente en una ruta fija.
- Usar `scripts/render-safe.mjs` para renders individuales y los scripts de
  lote protegidos para paquetes completos. Toda ejecución debe crear
  `run-start.json` y, si termina correctamente, `run-result.json`.
- Rechazar cualquier colisión antes de invocar Remotion o FFmpeg. Usar
  `ffmpeg -n` para artefactos de entrega y no `-y`.
- Exportar MP4 H.264 para inserciones a pantalla completa.
- Exportar ProRes 4444 con alfa cuando la pieza deba superponerse al vídeo.
- Exportar la variante con efectos de sonido con sufijo `_audio` y conservar la variante silenciosa sin sobrescribirla.
- Verificar cada archivo final con `ffprobe`: duración, tamaño, fps, codec y pixel format.
- Verificar audio AAC 48 kHz estéreo y medir `mean_volume` y `max_volume` con `volumedetect`.
- Organizar los archivos por número de clip y acompañarlos con el plan y la guía de montaje definidos en [delivery-contract.md](references/delivery-contract.md).
- Conservar el código fuente en `remotion-animations/`; copiar renders a otra carpeta solo cuando forme parte de la petición.

### 6. Limpiar artefactos

- No borrar automáticamente después de entregar. Los previews sirven para QA
  y cada run es deliberadamente inmutable.
- Ejecutar primero `npm run cleanup:animations` con el alcance y la retención
  solicitados. La simulación no borra nada.
- Aplicar `--apply --confirm=DELETE_ANIMATION_ARTIFACTS` solo si el usuario
  pidió explícitamente eliminar esos candidatos y después de verificar las
  rutas mostradas.
- Mantener por defecto 30 días, los 3 últimos artefactos por proyecto, runs
  incompletos y salidas `legacy`. Ampliar el borrado solo si el usuario lo
  especifica.
- No tocar vídeos fuente, código, `public/sfx`, `.env`, `data/jobs/` ni
  `data/output/`. Estos dos últimos pertenecen a la limpieza general.
- Informar del número de artefactos, espacio liberado y carácter no
  recuperable del borrado.
- No presentar el borrado o archivado de un chat como limpieza de disco: son
  acciones independientes.

## Límites

- No modificar, recodificar, mover ni borrar los clips originales.
- No enviar vídeo, audio o transcripciones a servicios externos sin autorización.
- No publicar ni subir contenido a plataformas.
- No instalar otro Remotion si `remotion-animations/` está operativo; comprobar primero el entorno existente.
- Preservar cambios ajenos del worktree y limitar las ediciones a la animación y sus artefactos.

## Comandos base

```powershell
npm run remotion:studio
npm run remotion:check
npm run remotion:still
npm run remotion:render
npm run remotion:overlay
npm run cleanup:animations
```

Usar comandos directos dentro de `remotion-animations/` cuando la composición requiera props, frames o nombres de salida específicos. Documentar el comando reproducible en la guía de montaje.

No invocar `npx remotion render` o `npx remotion still` contra una ruta fija.
Para una composición personalizada usar:

```powershell
node scripts/render-safe.mjs render <proyecto> <CompositionId> <archivo.mp4> --props=<archivo.json>
node scripts/render-safe.mjs still <proyecto> <CompositionId> <preview.png> --frame=<frame>
```

## Invocaciones típicas

```text
Usa $create-remotion-animations. Revisa todos los clips de esta carpeta,
transcríbelos localmente y crea solo las animaciones que ayuden a entender
datos, comparativas o procesos. Elige el patrón del catálogo y los efectos de
sonido adecuados para cada transformación. Entrégalas por número de clip.
```

```text
Usa $create-remotion-animations con esta transcripción. Crea una gráfica de
ocho segundos que destaque el 90 %, sin inventar más datos, y expórtala como
MP4 y como overlay ProRes 4444.
```

```text
Usa $create-remotion-animations para proponer el plan visual de este vídeo,
pero no renderices todavía.
```

## Entrega en el chat

Indicar:

- qué clips recibieron animación y por qué;
- timestamp y duración recomendados;
- ID de cada composición y props editables;
- ID y carpeta única de la ejecución;
- enlaces absolutos a renders, previews, plan y guía;
- validaciones ejecutadas y cualquier limitación real.

Si el usuario solo pide propuestas, entregar el plan editorial y no renderizar. Si pide crear las piezas, completar también implementación, revisión y renders.
