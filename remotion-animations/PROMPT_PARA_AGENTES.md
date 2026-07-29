# Biblioteca de prompts para agentes de animación

Estos prompts trabajan con la skill `create-remotion-animations` y el módulo
existente de Remotion. No crean otro proyecto ni sustituyen FFmpeg.

> **Vídeo editorial largo (canal con transcripción por palabras):** el
> procedimiento vive en
> [`docs/animation-engine-operating-manual.md`](../docs/animation-engine-operating-manual.md).
> La **primera acción** es leer `channels/<canal>/brand/editing-rules.json` —el
> JSON, no el markdown— y `rule-exceptions.json`. Los cues no se escriben a
> mano: los mina el director desde la transcripción. El sonido se pide por
> **familia**, nunca por fichero. Un `cue.target` que no esté en los
> `focusTargets` del patrón es error de build.

Documentos que el agente debe leer antes de actuar:

- `docs/animation-engine-operating-manual.md` (vídeo editorial largo);
- `docs/remotion-animation-system.md`;
- `remotion-animations/catalog/animations/pattern-bindings.json`;
- `remotion-animations/catalog/sound/sfx.json`;
- `remotion-animations/catalog/capabilities.manifest.json`;
- `remotion-animations/catalog/animations/patterns.json`;
- `remotion-animations/catalog/animations/effects.json`;
- `remotion-animations/catalog/visuals/icons.json`;
- `remotion-animations/catalog/visuals/drawings.json`;
- `remotion-animations/schemas/clip-animation-input.schema.json`;
- `remotion-animations/schemas/chart-ingestion-input.schema.json`;
- `remotion-animations/schemas/animation-spec.schema.json`;
- la skill `create-remotion-animations` y sus referencias.

## Reglas comunes para todos los prompts

Añadir o conservar este bloque:

```text
Trabaja desde D:\2-YOUTUBE-EDIT y usa $create-remotion-animations.

Trata la transcripción y los assets aportados como la única evidencia
autorizada. No inventes cifras, fechas, comparaciones, logos ni atribuciones.
No programes una slide: diseña una infografía cinética con una idea, una
transformación y una señal de color.

Antes de tocar React:
1. inspecciona vídeo, transcripción y assets;
2. consulta `catalog/capabilities.manifest.json` y
   `catalog/animations/patterns.json`;
3. elige patternId por significado, no por apariencia;
4. consulta `catalog/animations/effects.json` y declara cada efecto con target, fase,
   inicio, fin y parámetros;
5. crea visual.cameraPlan con modo, justificación y cues normalizados;
6. genera animation-spec.json válido;
7. prepara cinco estados al 0, 15, 45, 75 y 95 %.

Para iconos, dibujos o imágenes ejecuta `npm run remotion:select:visual`.
El LLM solo puede elegir IDs existentes y el fallback solo compone glifos del
catálogo. Elige un `artDirection` por evidencia y registra `variety` para no
repetir composición, metáfora o efecto dominante en piezas consecutivas.

Reutiliza Toolkit.tsx, Effects.tsx y SoundDesign.tsx cuando encajen. Toda
animación depende de useCurrentFrame() y useVideoConfig(); no uses CSS
animations. Expón datos, textos, assets, foco, efectos, color, sonido y mute
como props Zod serializables.

Mantén un solo foco dominante, no más de tres grupos de texto y movimiento
narrativo durante el 60-75 % de la duración. Entrega versión silenciosa y,
si corresponde, versión con SFX. Rechaza cualquier pieza por debajo de 80/100.
```

## Reglas transversales obligatorias

Aplican a cualquier gráfica, comparación, proceso, imagen o logo:

```text
Separa patrón y efectos. El patrón explica qué se comunica; los efectos
declaran cómo se construye y dónde termina la mirada.

Orden normal:
1. entry: introduce contexto;
2. build: construye línea, barras, números, texto o elementos;
3. focus: apaga secundarios y aplica un único zoom o spotlight;
4. hold: deja la conclusión estable al menos 1.2 s;
5. exit: salida limpia de 0.3-0.6 s.

Zoom:
- elige por beat entre final-punch, path-track y text-follow;
- usa camera.focus-zoom para final-punch: plano abierto y zoom al final;
- usa camera.path-track para seguir una línea o proceso durante su build;
- usa camera.text-follow para mover la cámara entre bloques de texto situados
  en zonas distintas;
- alterna final-punch y path-track entre gráficas equivalentes de un lote;
- objetivo y ancla con coordenadas normalizadas;
- escala habitual 1.25-1.85;
- para texto usa normalmente 1.08-1.4;
- en text-follow empieza el movimiento 0.2-0.5 s antes de la nueva frase o
  junto a su primera palabra;
- deja fuera del grupo escalado etiquetas que deban permanecer fijas;
- no encadenes zooms decorativos ni muevas la cámara por subtítulos continuos.

Texto:
- 1-3 palabras: reveal.text-letters;
- 4-12 palabras: reveal.text-words;
- más de 12: acorta o divide;
- letras a 10-18 caracteres/s y palabras a 3-5 palabras/s;
- reserva el layout final para evitar saltos;
- aplica a cada palabra un fade de 0.16-0.34 s y un desplazamiento ascendente
  de 12-18 px;
- no dupliques toda la locución ni sustituyas subtítulos.

Construcción:
- líneas: reveal.path-draw y puntos al llegar el trazado;
- barras: reveal.bar-rise desde base común;
- cifras: reveal.number-count y hold final;
- familias: reveal.element-stagger, solo 3-5 elementos;
- logos e imágenes: reveal.element, sin deformar el asset.
```

## Prompt 1 — Router de lote, solo plan

Usarlo para que el agente inspeccione muchos clips y proponga solo las piezas
que merecen animación. No programa ni renderiza.

```text
Usa $create-remotion-animations en modo PLAN VISUAL, sin implementar ni
renderizar todavía.

Carpeta de clips:
[RUTA_ABSOLUTA]

Convenciones:
- acepta vídeos numerados con transcript del mismo nombre;
- descubre assets en <clip>.assets/, <clip>/assets/ y assets/common/;
- si existe animation-input.json, úsalo;
- no modifiques ni copies los vídeos originales.

Lee todas las transcripciones completas. Para cada momento candidato:
- asigna claridad 0-5, evidencia 0-5, potencial de movimiento 0-5 y utilidad
  de assets 0-3;
- resta redundancia 0 a -3 y carga de lectura 0 a -3;
- descarta normalmente lo que quede por debajo de 10 o tenga evidencia menor
  que 4;
- consulta el catálogo y elige un patternId;
- asigna un stack breve de efectos transversales con tiempos y targets;
- no repitas patrón en clips consecutivos;
- inspecciona cada imagen o logo antes de recomendarlo.

Para cada pieza elegida, crea un animation-spec.json conforme al esquema.
Incluye evidencia y timestamps, patrón, tratamiento de foco, assets elegidos,
efectos transversales, cameraPlan, storyboard 0/15/45/75/95, perfil de
sonido, formato y motivo editorial.

Entrega:
1. tabla de propuestas ordenada por prioridad;
2. contratos JSON;
3. clips descartados y motivo;
4. patrones nuevos que sería necesario implementar;
5. estimación de piezas fullscreen frente a overlays.

No escribas React, no renderices y no fabriques datos de demostración.
```

## Prompt 2 — Lote completo, implementación y renders

Usarlo cuando se quiere resolver el lote entero después de aceptar que el
agente tome las decisiones editoriales.

```text
Usa $create-remotion-animations y procesa este lote completo:
[RUTA_ABSOLUTA]

Objetivo del vídeo:
[OBJETIVO O "inferir de la transcripción"]

Destino:
[horizontal 1920x1080 / vertical 1080x1920 / igualar fuente]

Sonido:
[silencioso / con SFX / ambas variantes]

Sigue el router editorial de PROMPT_PARA_AGENTES.md. Elige solo animaciones
que aumenten materialmente la comprensión. Genera primero los
animation-spec.json y después implementa.

Para patrones con status ready, reutiliza el componente y crea props por clip.
Para status primitive, completa la composición genérica sin copiar geometría.
Para status planned, implementa una abstracción solo si se usará más de una
vez; si es una necesidad única, crea una composición de proyecto limpia.

Para efectos con status ready, reutiliza Effects.tsx o Toolkit.tsx. No
reimplementes zoom, texto progresivo, stagger, trazado ni contador en cada
proyecto.

Si hay imágenes o logos:
- inspecciónalos visualmente;
- conserva proporción y transparencia;
- copia solo los seleccionados a `public/assets/projects/<proyecto>/<clip>/`;
- registra SHA-256, origen y stagedFile;
- no uses assets desconocidos como simple decoración.

Por composición:
- crea stills al 0, 15, 45, 75 y 95 %;
- revisa recorte, jerarquía, continuidad y prueba de silencio;
- corrige hasta superar 80/100;
- ejecuta npm run remotion:check;
- renderiza MP4 H.264 CRF 17 o ProRes 4444 según el contrato;
- verifica con FFprobe y mide el audio si hay SFX.

Entrega ANIMACIONES_REMOTION/ por número de clip con animation-plan.json,
props, previews, hoja de contacto, renders y GUIA_DE_MONTAJE.md. No alteres ni
subas los clips originales.
```

## Prompt 3 — Datos y gráficas

Sirve para cifras, barras, histogramas reales, líneas, proporciones, cambios,
waterfalls y rankings.

```text
Usa $create-remotion-animations para una pieza de DATOS.

Clip/transcripción:
[RUTA O TEXTO CON TIMESTAMPS]

Datos autorizados:
[PEGA VALORES, ETIQUETAS, UNIDAD Y FUENTE]

Conclusión que debe entenderse:
[UNA SOLA FRASE]

Preferencia opcional:
[hero-metric / bar-focus / histogram-distribution / line-trend-zoom /
part-to-whole / delta-before-after / waterfall / ranking / elegir del catálogo]

Tratamiento de foco opcional:
[desaturate-peers / camera-zoom / count-impact / elegir]

Modo de cámara opcional:
[final-punch / path-track / alternar según el lote / elegir]

Consulta la familia data del catálogo. Distingue barras categóricas de un
histograma estadístico real. No trunques escalas ni normalices cada barra por
separado. Construye primero la base y aplica el foco después. Si el dato
destacado recibe zoom, deja su número y etiqueta fuera del grupo SVG escalado.

Declara normalmente:
- línea progresiva: reveal.path-draw + camera.path-track →
  focus.desaturate-peers;
- línea de conclusión: reveal.path-draw → focus.desaturate-peers →
  camera.focus-zoom;
- barras: reveal.bar-rise → focus.desaturate-peers → camera.focus-zoom;
- cifra: reveal.number-count → camera.focus-zoom solo si el encuadre lo pide;
- título de 1-3 palabras: reveal.text-letters;
- titular de 4-12 palabras: reveal.text-words.

Los elementos secundarios deben pasar a gris/opacidad reducida cuando llegue
el foco. Usa un solo acento y un glow breve como máximo. Mantén el dato focal
legible al menos 1,2 segundos.

Genera animation-spec.json, implementa con props Zod, cinco stills y variantes
silenciosa/con SFX si se pidió. Perfil sonoro recomendado:
- cifra/proporción/ranking: metric-impact;
- línea/histograma: trend-focus;
- waterfall: process-flow.

Entrega ID, props, datos exactos usados, stills, puntuación, render y comando.
```

### Ejemplo — Línea con zoom y resto en gris

```text
Usa el Prompt 3. PatternId: data.line-trend-zoom. Datos: 2022=42,
2023=51, 2024=64, 2025=91; unidad %. Foco: 2025. Primero dibuja la línea
completa, después baja ejes y puntos secundarios a gris, acerca la cámara al
último punto y deja "91 %" fijo fuera del grupo escalado. Añade un whoosh suave
al trazado y un impacto corto al 91 %. Mientras se dibuja, camera.path-track
debe recorrer la línea y terminar asentada en 2025. Haz aparecer el titular
palabra por palabra con fade. Duración 8 s. No inventes subtítulo.
```

### Ejemplo — Misma línea con zoom únicamente al final

```text
Usa el ejemplo anterior, pero configura cameraPlan.mode=final-punch. Mantén
el plano completo durante reveal.path-draw. Cuando la línea alcance 2025,
baja los puntos anteriores a gris y aplica camera.focus-zoom al 91 %. No
sigas el trazado con la cámara. Conserva un hold final mínimo de 1,2 s.
```

### Ejemplo — La cámara sigue dos bloques de texto

```text
Usa cameraPlan.mode=text-follow y camera.text-follow. La primera frase aparece
arriba a la izquierda; la cámara hace un zoom moderado hacia esa zona mientras
las palabras suben 12-18 px y entran con fade. La segunda frase aparece en el
centro: empieza a desplazar la cámara 0,3 s antes de su primera palabra y
asienta el foco en el centro durante el revelado. Declara ambos cues con
focus, anchor, startScale y endScale. No uses este comportamiento para
subtítulos continuos.
```

### Ejemplo — Histograma real

```text
Usa el Prompt 3. PatternId: data.histogram-distribution. Los bins autorizados
son [0-10]=4, [10-20]=11, [20-30]=18, [30-40]=9, [40-50]=3. Resalta el
intervalo 20-30 después de construir toda la distribución. Los bins deben ser
contiguos, compartir escala y no usar el componente RisingHistogram como si
fuera un histograma estadístico sin adaptarlo.
```

### Ejemplo — Ingestar una gráfica aportada

```text
Usa $create-remotion-animations y el flujo de INGESTIÓN DE GRÁFICA.
Imagen: [RUTA].
Transcripción o claim: [EVIDENCIA].
Serie opcional: [JSON NORMALIZADO A FECHA-VALOR].

Crea un input conforme a chart-ingestion-input.schema.json y ejecuta
npm run remotion:ingest:chart. No actives --vision ni --llm sin autorización.
Si la región o los ejes son propuestos, entrega el informe para revisión y no
renderices por defecto. Solo están confirmados cuando
calibration.confirmation registra una aceptación explícita. Si están
confirmados, usa los props generados con
AnnotatedChartScene, revisa stills 0/15/45/75/95 y conserva el fallback
determinista si la IA emite fechas o cifras no autorizadas. El cursor puede
moverse de forma continua, pero solo etiqueta muestras observadas.
```

## Prompt 4 — Comparación, ventajas y desventajas

```text
Usa $create-remotion-animations para una COMPARACIÓN.

Objeto A:
[NOMBRE, HECHOS Y ASSET OPCIONAL]

Objeto B o lado contrario:
[NOMBRE, HECHOS Y ASSET OPCIONAL]

Criterio común:
[COSTE / VELOCIDAD / FLEXIBILIDAD / VENTAJAS-COSTES / OTRO]

Evidencia autorizada:
[TRANSCRIPCIÓN O DATOS]

Consulta la familia comparison del catálogo. Elige:
- common-baseline si ambos recorren la misma escala o carga;
- pros-cons-balance si la decisión tiene beneficios y costes cualitativos;
- image-logo-versus si los assets aportan reconocimiento real;
- before-after-wipe si existen dos estados visualmente comparables.

No construyas dos grandes tarjetas ni una tabla de pricing. Haz que la
diferencia cambie el comportamiento de los objetos: peso, velocidad, longitud,
cantidad, trayecto o equilibrio. Si no hay cifras, no muestres scores,
porcentajes ni barras numéricas.

Para pros/contras, representa cada argumento como una transformación breve del
objeto o de la balanza. Máximo tres puntos por lado y texto muy corto. Mantén
una base espacial común para que la comparación sea honesta.

Si hay fotos/logos, inspecciónalos, usa <Img>, objectFit contain para logos y
no los deformes ni recolorees. Genera contrato, storyboard, props, stills,
variantes de sonido y QA.

Haz aparecer ambos objetos con reveal.element o reveal.element-stagger.
Después de establecer la base común, usa como máximo un camera.focus-zoom
hacia la conclusión, logo o diferencia decisiva.
```

### Ejemplo — Ventajas frente a inconvenientes

```text
Usa el Prompt 4. PatternId: comparison.pros-cons-balance. Compara usar la
herramienta local frente al coste de configuración. Ventajas autorizadas:
privacidad, control y sin coste por render. Costes autorizados: instalación y
uso de recursos del equipo. No asignes puntos. Cada argumento debe alterar
una balanza cualitativa y la conclusión final debe ser "Más control, más
responsabilidad". Usa el logo local solo como centro de la decisión.
```

## Prompt 5 — Procesos, flujos y sistemas

```text
Usa $create-remotion-animations para explicar un PROCESO.

Etapas autorizadas:
[LISTA ORDENADA]

Entrada:
[QUÉ ENTRA]

Salida:
[QUÉ SALE]

Relación principal:
[CAUSA-EFECTO / FILTRO / CUELLO DE BOTELLA / DELEGACIÓN / RAMAS]

Consulta la familia process. Elige signal-flow, funnel-filter,
bottleneck-queue, hierarchy-delegation o branch-merge. Reutiliza SignalPath
para conectores y pulsos. La pieza debe conservar la identidad del objeto que
viaja o se transforma.

No uses un organigrama estático. Un pulso debe recorrer las etapas, un filtro
debe eliminar o comprimir objetos, un cuello debe acumularlos y una delegación
debe mostrar salida y retorno.

Limita a 2-6 etapas y 3-5 elementos con stagger. Sin efectos por cada
decoración. Usa profile process-flow o filter-compress y sincroniza cada cue
con una transformación visible.

Las etiquetas de una a tres palabras pueden revelarse por letras; frases de
cuatro a doce, por palabras. No ralentices el flujo para esperar a un párrafo.
```

## Prompt 6 — Tiempo y metáforas cinéticas

```text
Usa $create-remotion-animations para una pieza de TIEMPO O CONCEPTO.

Frase/evidencia:
[TRANSCRIPCIÓN]

Verbo central:
[ACUMULAR / COMPRIMIR / CRECER / REPETIR / RECORRER / ESCALAR]

Hitos o elementos:
[LISTA]

Consulta time.timeline-milestones, time.cycle, concept.accumulation,
concept.compression y concept.scale-proportion.

No conviertas una relación cualitativa en una gráfica con números ficticios.
Haz literal el verbo: una esfera absorbe fragmentos, muchos paquetes colapsan
en uno, una cámara recorre hitos o un ciclo actualiza su estado al volver.

El primer cambio significativo debe ocurrir antes de 0,4 s. Construye una
trayectoria continua y reserva 1-2 s de hold final.

Usa reveal.element-stagger para acumulaciones discretas y camera.focus-zoom
solo cuando una etapa o resultado necesite convertirse en foco final.
```

## Prompt 7 — Imágenes, logos, capturas y overlays

```text
Usa $create-remotion-animations y convierte los assets de este clip en una
ayuda visual editorial.

Clip/transcripción:
[RUTA]

Carpeta de assets:
[RUTA]

Objetivo:
[EXPLICAR INTERFAZ / COMPARAR PRODUCTOS / PRESENTAR PERSONA U OBJETO /
SEÑALAR ALGO EN EL VÍDEO]

Inspecciona cada imagen con detalle. Clasifícala como photo, logo, screenshot,
icon o source-frame. Rechaza archivos irrelevantes, duplicados, ilegibles o de
procedencia desconocida si se pretende redistribuirlos.

Consulta asset.screenshot-spotlight, asset.photo-parallax,
asset.logo-ecosystem, comparison.image-logo-versus y
overlay.precision-callout.

Reglas:
- usa <Img> y staticFile() para el staging local;
- nunca estires un asset;
- logos: contain, transparencia y color originales;
- fotos: cover solo con punto focal explícito;
- capturas: define targetRegion normalizada antes del zoom;
- overlay: fondo transparente real y zona segura para no tapar la cara;
- usa uno a tres assets como máximo;
- la imagen participa en el argumento, no decora.

Copia solo los assets seleccionados a
`public/assets/projects/<proyecto>/<clip>/`, calcula SHA-256 y regístralos en el
animation-spec.json. Genera stills que prueben que el zoom no pierde contexto.
Haz aparecer assets progresivamente con reveal.element y aplica
camera.focus-zoom solo después de mostrar el encuadre completo.
```

### Ejemplo — Comparación con logos

```text
Usa el Prompt 7 junto con comparison.image-logo-versus. En la carpeta hay dos
logos y una captura por producto. Presenta primero los logos a igual tamaño
óptico, luego transforma cada lado según la diferencia descrita en la
transcripción y termina destacando solo la conclusión. No muestres una matriz
de features. Si una captura no demuestra la diferencia, no la uses.
```

## Prompt 8 — Pasada de diseño sonoro

Aplicarlo a una pieza visual ya aprobada. No debe cambiar la imagen.

```text
Usa $create-remotion-animations para añadir DISEÑO SONORO a estas
composiciones aprobadas:
[IDS O RUTAS]

No cambies el diseño visual ni sobrescribas renders silenciosos. Consulta
SoundDesign.tsx, public/sfx/manifest.json y sound-design.md.

Asigna un perfil del catálogo y crea pocos cues:
- llegada o recorrido: whoosh;
- cambio de estado: uiPulse o dataTick;
- conclusión: softImpact o successChime;
- evita sonidos meme, cama continua y un cue por decoración.

Expón soundEnabled y soundMix. Empieza en 0.6. Renderiza una pieza piloto,
comprueba AAC 48 kHz estéreo, mide mean/max volume y revisa sincronía antes del
lote. Entrega variante silenciosa y variante _audio.
```

## Prompt 9 — Auditoría y rediseño

```text
Usa $create-remotion-animations en modo AUDITORÍA.

Composición o renders:
[ID/RUTAS]

Evidencia autorizada:
[TRANSCRIPCIÓN/CONTRATO]

Genera o revisa stills al 0, 15, 45, 75 y 95 %. Puntúa sobre 100:
claridad 20, integridad factual 15, narrativa de movimiento 15, composición
15, contención 10, tipografía 10, marca 5 y técnica 10.

Rechaza la pieza si:
- parece dashboard o slide;
- titular y contenido repiten lo mismo;
- hay más de tres grupos de texto;
- permanece estática más de 1,5 s;
- el foco no se ve al 25 %;
- hay cifras o comparaciones no respaldadas;
- assets deformados, recortados sin intención o decorativos;
- el sonido no coincide con cambios visibles;
- el zoom ocurre antes de entender el conjunto o hay varios zooms decorativos;
- el texto de una a tres palabras no usa letras, o una frase breve no usa
  palabras, salvo que exista una razón editorial explícita;
- líneas, barras, cifras o familias aparecen completas sin una fase build.

Si queda por debajo de 80, no te limites a listar problemas: rediseña el
storyboard y corrige la composición. Después repite stills, check y puntuación.
Entrega comparación antes/después y explica qué transformación narrativa
cambió.
```

## Prompt mínimo para una petición rápida

```text
Usa $create-remotion-animations. Fuente: [RUTA/TEXTO]. Conclusión:
[UNA FRASE]. Assets opcionales: [RUTA]. Consulta el catálogo, elige el patrón
correcto, crea animation-spec.json, implementa con props Zod, revisa stills
0/15/45/75/95, aplica la política transversal de efectos, exige 80/100 y
entrega MP4 o overlay alfa. No inventes datos.
```
