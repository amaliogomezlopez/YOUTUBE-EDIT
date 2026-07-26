# Remotion Animations para Shortsmith

Módulo aislado para crear motion graphics de pocos segundos y exportarlos como
vídeo normal o como overlay transparente para el editor. No sustituye al
pipeline FFmpeg de Shortsmith: lo complementa con composiciones React
parametrizables.

## Toolkit reutilizable

El núcleo compartido vive en `src/motion/Toolkit.tsx`:

- `MotionCanvas`: lienzo editorial, márgenes e identidad.
- `KineticNumber`: contador numérico con formato español y zoom de énfasis.
- `RisingHistogram`: barras ascendentes con proporciones correctas.
- `LineChartZoom`: línea trazada y zoom de cámara sobre el dato elegido.
- `SignalPath`: recorridos animados para procesos y jerarquías.

Hay tres composiciones de laboratorio editables desde Props:

- `Toolkit-LineChartZoom`
- `Toolkit-RisingHistogram`
- `Toolkit-KineticNumber`

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
```

Para renderizar con datos enviados desde un JSON:

```powershell
npx remotion render src/index.ts ChartHighlight out\mi-grafica.mp4 --props=props\mi-grafica.json
```

La licencia estándar de Remotion es gratuita para particulares y equipos de
hasta tres personas. Si cambia el tamaño o el uso comercial del equipo, revisa
la licencia vigente antes de distribuir.
