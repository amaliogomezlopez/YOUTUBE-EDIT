# Contrato de implementación Remotion

## Formato y estructura

- Usar `1920x1080` para vídeo largo horizontal y `1080x1920` solo si el destino confirmado es vertical.
- Igualar los fps de la fuente cuando la animación se monte sobre ella; usar 30 fps si es una pieza independiente y no hay otra indicación.
- Mantener normalmente 5-10 segundos.
- Nombrar composiciones de proyecto como `<SIGLAS>-<NN>-<Concepto>`, por ejemplo `AL-03-InputShare`.
- Agruparlas en un `<Folder>` de `src/Root.tsx`.
- Preferir un archivo por familia o proyecto y extraer componentes compartidos cuando exista repetición real.

## Props y datos

- Definir el esquema con `z.object()` y derivar el tipo con `z.infer`.
- Exponer al menos texto, datos, color de acento y elemento destacado cuando sean variables.
- Mantener `defaultProps` JSON-serializables y representativos.
- No obtener datos de red durante el render si pueden guardarse como props o assets locales.
- No inventar ejes, escalas o cifras. Etiquetar claramente porcentajes, unidades y rangos.

## Animación

- Obtener `frame` con `useCurrentFrame()` y `fps` con `useVideoConfig()`.
- Expresar tiempos en segundos y convertirlos a frames.
- Usar `interpolate()` con límites `clamp` y easing explícito. Reservar `spring()` para énfasis breve y controlado.
- Separar la temporización normalizada de las propiedades visuales derivadas.
- Usar `<Sequence>` para fases y añadir `premountFor`.
- Prohibir `transition`, `animation`, keyframes CSS y animaciones internas de librerías de gráficas.

Una estructura útil para 8 segundos:

- 0,0-1,2 s: entrada y contexto.
- 1,2-5,8 s: construcción o comparación.
- 5,8-7,2 s: énfasis principal.
- 7,2-8,0 s: hold o salida limpia.

Adaptar estos tiempos al contenido; no acelerar texto para llenar cada segundo.

## Gráficas y números

- Construir barras, líneas, nodos y conectores con HTML/SVG/React.
- Animar barras desde una base común y líneas mediante trazado SVG.
- Resaltar una sola conclusión principal mediante color, glow, escala o contorno.
- Mantener visible el número destacado el tiempo suficiente para leerlo.
- Si la fuente solo dice “más”, “menos” o “la mayoría”, usar tamaños relativos sin etiquetas numéricas ficticias.
- Evitar ejes truncados que exageren diferencias.

### Toolkit reutilizable de YouTube Edit

Usar primero `remotion-animations/src/motion/Toolkit.tsx`. Incluye:

- `MotionCanvas`: fondo, márgenes, titular e identidad editorial común.
- `KineticNumber`: contador con `Intl.NumberFormat("es-ES")`, cifras tabulares y un único pulso de zoom.
- `RisingHistogram`: barras con base y máximo comunes, altura `valor / máximo`, etiquetas directas y cifra animada.
- `LineChartZoom`: trazado SVG, puntos, foco y zoom de cámara alrededor de un dato.
- `SignalPath`: conector curvo con línea y pulso dirigido para procesos o diagramas.

Consultar las composiciones editables `Toolkit-LineChartZoom`,
`Toolkit-RisingHistogram` y `Toolkit-KineticNumber` de `src/Root.tsx` antes de
crear una variante. Extender estos componentes mediante props en vez de copiar
su geometría.

Reglas obligatorias:

- Separar la capa de números y etiquetas de cualquier grupo SVG que reciba zoom; el valor principal no debe desplazarse ni cruzarse con la línea.
- Añadir margen al `clipPath` para que puntos, strokes y glows no se recorten en los extremos.
- Calcular escalas con datos finitos y un máximo explícito o derivado; mantener una base común y no normalizar cada barra por separado.
- Usar `fontVariantNumeric: "tabular-nums"` en contadores y cifras que cambian.
- Mantener unidad, prefijo, sufijo, decimales, índice destacado, paleta y serie como props.
- Construir primero la gráfica, hacer el zoom después y mantener el foco estable al final.
- Usar un solo acento dominante por escena. Partir de `MOTION_COLORS` y reservar coral para advertencia o ruido.
- No usar los datos de demostración de `DataVizDemos.tsx` como evidencia factual.

## Texto y composición

- Mantener márgenes seguros aproximados de 96 px en horizontal y 72 px en vertical para 1920x1080.
- Limitar cada escena a una idea, un titular breve y el apoyo mínimo.
- Evitar párrafos; dividir procesos en etiquetas cortas.
- Verificar la carga de fuente antes de medir texto.
- Usar `@remotion/layout-utils` solo si el texto variable exige ajuste o detección de overflow.
- Reutilizar la identidad visual existente: fondos azul marino, azules luminosos, amarillo o verde como acentos, alto contraste y jerarquía editorial.

## Audio y fondos

- No añadir música ni voz por defecto: estas piezas acompañan una locución existente.
- Usar fondo opaco para inserciones a pantalla completa.
- Usar transparencia real para overlays; no simular alfa con negro o verde.
- Mantener sombras y glows moderados para que la compresión no destruya los bordes.

## Render

MP4 de alta calidad:

```powershell
npx remotion render src/index.ts <CompositionId> out\<archivo>.mp4 --codec=h264 --crf=17 --image-format=png --pixel-format=yuv420p
```

Overlay transparente para editor:

```powershell
npx remotion render src/index.ts <CompositionId> out\<archivo>.mov --codec=prores --prores-profile=4444 --image-format=png --pixel-format=yuva444p10le
```

Still de control:

```powershell
npx remotion still src/index.ts <CompositionId> out\previews\<archivo>.png --frame=<frame>
```

Usar `--props=<archivo.json>` cuando los datos deban quedar reproducibles fuera de `defaultProps`.

## Control de calidad

1. Ejecutar `npm run remotion:check`.
2. Revisar cinco momentos: entrada, desarrollo, transformación, foco y salida.
3. Comprobar que ningún texto se corta ni sale del margen seguro.
4. Confirmar que cada cifra coincide con la transcripción.
5. Renderizar el archivo final y examinar varios frames, no solo el primero.
6. Verificar con `ffprobe` codec, pixel format, resolución, fps y duración.
7. Ejecutar `npm test` si se tocó lógica compartida fuera de `remotion-animations/`.
