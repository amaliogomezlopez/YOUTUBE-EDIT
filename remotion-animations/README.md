# Remotion Animations para Shortsmith

Módulo aislado para crear motion graphics de pocos segundos y exportarlos como
vídeo normal o como overlay transparente para el editor. No sustituye al
pipeline FFmpeg de Shortsmith: lo complementa con composiciones React
parametrizables.

## Sistema editorial para agentes

El módulo incluye una capa de decisión reutilizable:

- `catalog/animation-patterns.json`: 27 patrones semánticos con estado real,
  evidencia requerida, assets compatibles, foco y sonido;
- `catalog/animation-effects.json`: zooms, revelados, trazados, contadores,
  texto progresivo, foco, salida y cues transversales;
- `schemas/clip-animation-input.schema.json`: contrato opcional para clips y
  assets adyacentes;
- `schemas/animation-spec.schema.json`: contrato obligatorio entre el planner
  editorial y el builder de Remotion;
- `PROMPT_PARA_AGENTES.md`: router de lotes y prompts especializados por
  familia;
- `docs/remotion-animation-system.md`: arquitectura, taxonomía y fases de
  implantación.

El catálogo distingue barras categóricas de histogramas estadísticos reales.
`RisingHistogram` conserva su nombre histórico en código, pero se registra
como `data.bar-focus`.

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

- `MotionCanvas`: lienzo editorial, márgenes e identidad.
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

Los renders quedan en `remotion-animations\out\` y no se versionan.

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
npm run prepare:sfx
npm run check:catalog
```

Para renderizar con datos enviados desde un JSON:

```powershell
npx remotion render src/index.ts ChartHighlight out\mi-grafica.mp4 --props=props\mi-grafica.json
```

La licencia estándar de Remotion es gratuita para particulares y equipos de
hasta tres personas. Si cambia el tamaño o el uso comercial del equipo, revisa
la licencia vigente antes de distribuir.
