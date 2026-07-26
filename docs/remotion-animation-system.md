# Sistema de animaciones editoriales de Shortsmith

## Objetivo

Convertir `remotion-animations/` en un sistema de motion graphics reutilizable
por agentes, no en una colección de vídeos aislados. El sistema debe permitir
que un agente:

1. inspeccione muchos clips, sus transcripciones y sus assets adyacentes;
2. decida dónde una animación mejora realmente la comprensión;
3. elija un patrón visual por su significado editorial;
4. genere un contrato reproducible antes de programar;
5. reutilice componentes existentes o implemente solo la extensión necesaria;
6. revise cinco momentos clave, puntúe la pieza y entregue renders con guía.

El norte creativo sigue siendo:

> Una idea, una transformación, una señal de color.

La animación debe demostrar el verbo principal de la locución. No debe ser una
diapositiva que aparece por partes.

## Diagnóstico del módulo actual

Ya existe una base valiosa:

- `KineticNumber`: cifra protagonista y contador;
- `RisingHistogram`: barras categóricas con base común;
- `LineChartZoom`: serie que se dibuja y termina en un dato focal;
- `SignalPath`: recorridos, procesos y relaciones causales;
- `FocusZoom`: zoom reutilizable hacia un número, logo o región;
- `ProgressiveText`: texto por palabras o letras sin saltos de layout;
- `ProgressiveReveal`: entrada común para nodos, imágenes y logos;
- `Soundtrack`: cues sincronizados y mezcla maestra;
- exportación opaca y ProRes 4444 con alfa;
- proyectos reales y una rúbrica de calidad visual.

El sistema añade cuatro capas para escalar:

1. **Catálogo semántico**: cuándo usar cada patrón y qué evidencia exige.
2. **Catálogo transversal**: cómo se revela, construye, enfoca y cierra.
3. **Contratos de entrada y decisión**: assets y `animation-spec.json`.
4. **Prompts especializados**: router, familias visuales, efectos, sonido y
   auditoría.

Como capa previa opcional, `Animation Scout` convierte vídeos de referencia en
hojas de contacto, perfil de movimiento e informes multimodales sin
transcripción. Su salida `remotion-handoff.json` aporta lenguaje visual y
mecánica observada al planner, pero no sustituye la evidencia editorial ni el
`animation-spec.json`. Consulta `docs/animation-scouting.md`.

También conviene corregir una ambigüedad: el componente
`RisingHistogram` actual representa barras categóricas. Un histograma real
representa una distribución mediante intervalos continuos. El catálogo usa
`data.bar-focus` para el componente actual y reserva
`data.histogram-distribution` para una implementación futura correcta.

## Modelo combinatorio: patrón más efectos

No hay que crear una plantilla distinta para cada combinación de zoom, color,
sonido y fondo. La composición final se define con seis ejes:

| Eje | Decide |
| --- | --- |
| Patrón | Qué relación comunica: dato, comparación, proceso, tiempo o concepto |
| Efectos | Cómo entra, se construye, se enfoca y sale cada elemento |
| Foco | Cómo se aísla la conclusión: gris, zoom, máscara o wipe |
| Assets | Si usa foto, logo, captura, icono o solo geometría |
| Fondo | Opaco editorial, imagen atenuada, vídeo desenfocado o alfa |
| Sonido | Cues semánticos sincronizados, siempre con variante silenciosa |

Ejemplo: `data.line-trend-zoom` + `reveal.path-draw` +
`focus.desaturate-peers` + `camera.focus-zoom` + `editorial-dark` +
`trend-focus`. El patrón sigue siendo una serie temporal; el trazado, el zoom
y el gris son efectos transversales, no nuevas familias.

## Efectos transversales

El registro legible por máquina vive en
`remotion-animations/catalog/animation-effects.json`. Cada efecto declara su
fase, objetivo, ventana temporal y parámetros. El agente no puede pedir
simplemente “hazlo dinámico”: debe expresar qué elemento recibe qué efecto y
por qué.

### Fases comunes

| Fase | Función |
| --- | --- |
| `entry` | Introducir contexto y jerarquía |
| `build` | Construir progresivamente la relación |
| `focus` | Aislar una única conclusión |
| `hold` | Mantener el resultado estable para lectura |
| `exit` | Salir de forma breve y limpia |

Secuencia recomendada para una pieza de ocho segundos:

1. 0,0-1,2 s: texto o contexto inicial;
2. 1,0-4,5 s: línea, barras, números o elementos aparecen progresivamente;
3. 4,5-6,2 s: secundarios pasan a gris y un zoom se dirige al dato o logo;
4. 6,2-7,5 s: hold limpio;
5. 7,5-8,0 s: salida.

### Dirección transversal de cámara

La cámara no tiene un único comportamiento. El agente elige uno por beat:

| Modo | Efecto | Cuándo usarlo |
| --- | --- | --- |
| Zoom final | `camera.focus-zoom` | El conjunto debe entenderse antes de destacar la conclusión |
| Seguimiento | `camera.path-track` | La zona relevante avanza por una línea, proceso o recorrido |
| Seguimiento textual | `camera.text-follow` | La narración salta entre frases situadas en zonas distintas |

En zoom final, mantener primero el plano abierto y acercarse después al dato,
logo o región concluyente. En seguimiento, sincronizar posición y escala con
el progreso de la línea. Los dos modos son válidos para gráficas y deben
alternarse entre piezas equivalentes para evitar una cadencia repetitiva.

`camera.text-follow` usa una lista ordenada de cues. Cada cue declara tiempo,
foco, escala y ancla normalizados. La cámara llega al bloque nuevo entre 0,2 y
0,5 segundos antes de su primera palabra o mientras esta empieza a aparecer.
Por ejemplo, si la primera frase está arriba a la izquierda y la segunda en el
centro, la cámara mantiene el primer foco, recorre una trayectoria suave y se
asienta en el centro durante el segundo revelado.

Reglas comunes:

- usar normalmente un modo dominante por beat;
- escala habitual entre 1,25 y 1,85; para texto, entre 1,08 y 1,4;
- declarar `focusX`, `focusY`, `anchorX` y `anchorY` normalizados;
- mantener fuera del grupo escalado logos, overlays o etiquetas persistentes;
- mantener al menos 1,2 segundos de hold después de la conclusión;
- no añadir zoom-in y zoom-out decorativos;
- sincronizar como máximo un whoosh o pulso semántico por desplazamiento
  importante.

### Construcción progresiva

- `reveal.path-draw`: línea o recorrido mediante `strokeDashoffset`;
- `reveal.bar-rise`: barras desde una base común;
- `reveal.number-count`: cifra que progresa hasta el dato factual;
- `reveal.element`: aparición de un nodo, imagen o logo;
- `reveal.element-stagger`: familia de tres a cinco elementos;
- `reveal.text-words`: frase breve palabra por palabra;
- `reveal.text-letters`: una a tres palabras letra por letra.

Los puntos de una gráfica de línea aparecen cuando el trazado llega a ellos.
Con `camera.focus-zoom`, el zoom empieza después de completar la estructura
necesaria para interpretarla. Con `camera.path-track`, cámara y trazado
progresan juntos y terminan sobre la misma conclusión.

### Texto progresivo

Modo `auto`:

- una a tres palabras: letra por letra, 10-18 caracteres por segundo;
- cuatro a doce palabras: palabra por palabra con fade y desplazamiento de
  unos 12-18 px desde abajo, 3-5 palabras por segundo;
- más de doce palabras: acortar o dividir; no acelerar un párrafo.

El componente reserva desde el principio el tamaño final del bloque para
evitar saltos de línea. Las letras usan slicing de texto, nunca opacidad
independiente por carácter; las palabras ocupan su posición final y reciben
un fade de 0,16-0,34 segundos combinado con el desplazamiento ascendente. El
revelado termina antes del hold y no sustituye a los
subtítulos ni duplica toda la locución.

## Taxonomía editorial

El registro completo y legible por máquina vive en
`remotion-animations/catalog/animation-patterns.json`.

### 1. Datos y gráficas

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Cifra protagonista | Un valor exacto es la conclusión | Contar, bloquear y dar un único pulso |
| Barras en foco | Comparar categorías sobre una base común | Construir todas y apagar las secundarias |
| Histograma real | Explicar una distribución por intervalos | Llenar bins y aislar rango/moda |
| Línea con zoom | Mostrar evolución temporal o tendencia | Dibujar trayectoria y acercarse al punto |
| Parte de un total | Mostrar una proporción respaldada | Completar anillo o barra 100 % |
| Delta antes/después | Comunicar cambio entre dos estados | Transformar una magnitud en otra |
| Waterfall | Descomponer qué suma y qué resta | Acumular contribuciones hasta el total |
| Ranking | Ordenar opciones con valores comparables | Reordenar y fijar el ganador |

Reglas:

- una conclusión por gráfica;
- números solo cuando existen en la fuente;
- base y escala comunes;
- etiqueta directa, sin leyenda si puede evitarse;
- el highlight ocurre después de entender el conjunto;
- el dato focal queda legible al menos 1,2 segundos.

### 2. Comparaciones y decisiones

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Carriles sobre base común | A frente a B con una métrica o carga compartida | Ambos recorren la misma escala |
| Balanza de ventajas y costes | Pros y contras de una decisión | Cada argumento altera un equilibrio |
| Producto/logo frente a frente | Comparar marcas, herramientas o enfoques | Assets entran sin deformarse y se comparan |
| Antes/después visual | Cambio verificable de estado o interfaz | Wipe o morph con punto de anclaje común |

Una lista de ventajas no debería convertirse por defecto en tarjetas. Es más
fuerte hacer que cada ventaja cambie el comportamiento del objeto comparado.
Si solo existen afirmaciones cualitativas, usar longitud, densidad o ritmo
relativos sin números inventados.

### 3. Procesos, sistemas y relaciones

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Flujo de señal | Cadena causa-efecto o pipeline | Un pulso atraviesa etapas |
| Embudo/filtro | Muchos elementos terminan en pocos | Filtrar y comprimir |
| Cola/cuello de botella | Saturación, espera o límite | Acumulación delante de una restricción |
| Jerarquía/delegación | Orquestación o responsabilidad | Dividir tareas y devolver resultados |
| Ramificación y convergencia | Una entrada produce varios trabajos | Separar, procesar y reunir |

### 4. Tiempo, evolución y secuencia

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Timeline de hitos | Fechas o etapas ordenadas | Cámara o playhead recorre los hitos |
| Ciclo recurrente | Proceso que vuelve al inicio | Flujo continuo con estado final distinto |

### 5. Metáforas cinéticas

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Acumulación | Contexto, deuda, presión o volumen creciente | Un objeto absorbe fragmentos |
| Compresión | Agrupar, resumir o reducir redundancia | Muchos objetos colapsan en uno |
| Escala/proporción | Hacer imaginable una diferencia | Objetos comparten referencia espacial |

Estas piezas son especialmente útiles cuando no hay suficientes cifras para
una gráfica. Deben representar una relación cualitativa sin disfrazarla de
medición.

### 6. Imágenes, logos, capturas y vídeo real

| Patrón | Uso | Movimiento central |
| --- | --- | --- |
| Spotlight de captura | Explicar una interfaz o documento | Zoom estable y máscara sobre la zona real |
| Foto con profundidad | Presentar persona, lugar u objeto | Pan/zoom leve y capas con paralaje |
| Ecosistema de logos | Mostrar integraciones o participantes | Logos se conectan a un núcleo |
| Callout sobre vídeo | Señalar una zona del clip fuente | Tracking, contorno o spotlight con alfa |

Reglas para assets:

- inspeccionar visualmente cada archivo antes de usarlo;
- usar `<Img>` y `staticFile()` para assets locales de Remotion;
- conservar proporción; logos con `objectFit: contain`, fotos con crop
  consciente y punto focal;
- no recolorear ni deformar logos;
- no usar más assets porque estén disponibles: normalmente bastan uno a tres;
- no inventar atribución ni asumir licencia de una imagen descargada;
- una captura necesita una región objetivo normalizada si habrá zoom;
- el asset debe participar en la transformación, no decorar el fondo.

### 7. Tipografía cinética

Úsala para una frase muy corta cuando el ritmo verbal es la idea. No debe
repetir subtítulos palabra por palabra. El texto puede reemplazar, tachar,
comprimir o reordenar conceptos; si solo entra y sale, no merece una pieza
independiente. Como tratamiento transversal, `ProgressiveText` sí puede
introducir titulares y etiquetas siguiendo la política automática anterior.

## Tratamientos de foco

El contrato admite tratamientos combinables pero debe existir un único foco
dominante:

- `accent-only`: solo el dato focal usa el acento;
- `desaturate-peers`: los demás elementos pasan a gris y bajan opacidad;
- `camera-zoom`: la cámara se acerca al punto sin mover su etiqueta;
- `spotlight-mask`: se oscurece todo salvo una región;
- `depth-isolation`: secundarios retroceden por escala y opacidad;
- `freeze-and-callout`: se congela el estado y aparece una anotación;
- `count-impact`: contador más pulso breve al cerrar;
- `path-follow`: un pulso recorre una relación;
- `before-after-wipe`: una frontera revela el segundo estado.

Estos nombres se conservan como hints de compatibilidad dentro del catálogo
de patrones. En contratos nuevos, `visual.effects[]` usa siempre el ID
canónico de `animation-effects.json`, por ejemplo `camera.focus-zoom`,
`focus.desaturate-peers` o `transition.before-after-wipe`.

Evitar desenfoque fuerte en texto y elementos informativos. El gris y la
opacidad suelen sobrevivir mejor a la compresión.

## Contrato de carpetas para clips y assets

El agente debe aceptar dos formas sin obligar al usuario a mover originales.

### Sidecars junto al vídeo

```text
clips/
├── 03.mkv
├── 03.srt
├── 03.assets/
│   ├── producto.png
│   ├── logo.svg
│   └── captura-dashboard.png
└── 03.animation.md
```

### Una carpeta por clip

```text
clips/
└── 03/
    ├── clip.mkv
    ├── transcript.srt
    ├── animation-input.json
    └── assets/
        ├── producto.png
        └── logo.svg
```

`animation-input.json` es opcional. Si no existe, el agente inventaría el
manifiesto técnico, no los datos editoriales: descubre archivos, inspecciona
dimensiones y propone roles. El esquema está en
`remotion-animations/schemas/clip-animation-input.schema.json`.

Orden de descubrimiento:

1. assets declarados en el manifiesto del clip;
2. carpeta `<stem>.assets/`;
3. subcarpeta `assets/` dentro del clip;
4. carpeta compartida `assets/common/`.

Los assets seleccionados se copian a un staging local:

```text
remotion-animations/public/projects/<proyecto>/<clip>/assets/
```

Se registra origen, destino y SHA-256. No se copia el vídeo fuente salvo que
la composición deba mostrarlo. Los originales no se modifican. El staging y
los renders deben quedar fuera de Git.

## Contrato de decisión: `animation-spec.json`

Antes de tocar React, cada propuesta debe ajustarse a
`remotion-animations/schemas/animation-spec.schema.json`. El contrato registra:

- evidencia exacta y timestamps;
- conclusión visual en una frase;
- patrón del catálogo;
- stack de efectos con fase, target, inicio, fin y parámetros;
- `cameraPlan` con modo, justificación y cues de foco, ancla y escala;
- tratamiento de foco, fondo y formato;
- datos y unidades;
- assets seleccionados;
- cinco beats del storyboard;
- perfil y cues de sonido;
- salida, props y criterios de QA.

Esto separa dos responsabilidades:

1. **Planner**: decide qué comunicar y demuestra que está respaldado.
2. **Builder**: convierte un contrato aprobado en una composición Remotion.

Un agente puede proponer una animación nueva, pero no puede saltarse el
contrato porque el patrón todavía no exista en código.

## Selección automática por agentes

Para cada momento candidato, puntuar:

| Criterio | Rango |
| --- | ---: |
| Ganancia de claridad | 0-5 |
| Fuerza de la evidencia | 0-5 |
| Potencial de transformación visual | 0-5 |
| Utilidad real de assets disponibles | 0-3 |
| Redundancia con otras piezas | 0 a -3 |
| Carga de lectura | 0 a -3 |

Normalmente implementar a partir de 10 puntos, siempre que evidencia sea 4 o
5. El umbral no sustituye criterio editorial. Una pieza decorativa con buena
puntuación técnica sigue siendo descartable.

Reglas de diversidad para un lote:

- no repetir el mismo patrón en clips consecutivos;
- no usar más de dos veces el mismo patrón salvo que el vídeo sea
  deliberadamente data-driven;
- alternar `final-punch` y `path-track` entre gráficas equivalentes;
- reservar `text-follow` para cambios reales de bloque o zona, no para
  subtítulos continuos;
- alternar fullscreen y overlay solo cuando el contenido lo justifique;
- reservar el tratamiento sonoro más fuerte para una conclusión importante;
- elegir calidad sobre cobertura: algunos clips no necesitan animación.

## Arquitectura propuesta

```text
remotion-animations/
├── catalog/
│   ├── animation-patterns.json
│   └── animation-effects.json
├── schemas/
│   ├── clip-animation-input.schema.json
│   └── animation-spec.schema.json
├── src/
│   └── motion/
│       ├── Effects.tsx      # zoom, texto y revelado transversal
│       ├── primitives/       # número, paths, cámara, máscara, asset frame
│       ├── patterns/
│       │   ├── data/
│       │   ├── comparison/
│       │   ├── process/
│       │   ├── time/
│       │   ├── concept/
│       │   └── asset/
│       ├── theme/
│       └── sound/
├── public/
│   ├── sfx/
│   └── projects/            # staging local, no versionado
└── projects/
    └── <proyecto>/
        ├── inputs/
        ├── plans/
        ├── props/
        ├── previews/
        └── guides/
```

No hace falta mover inmediatamente `Toolkit.tsx` ni los proyectos existentes.
La migración debe ser incremental: cualquier componente nuevo entra ya en la
estructura y los actuales se extraen cuando haya una razón funcional.

`Root.tsx` debería terminar siendo un registro fino de composiciones. Los
datos de cada proyecto deben vivir en props JSON, no en arrays grandes
hardcodeados dentro del root.

## Prompts y responsabilidades

`remotion-animations/PROMPT_PARA_AGENTES.md` contiene:

1. router de lote;
2. reglas transversales de zoom y revelado;
3. prompt de datos;
4. prompt de comparaciones;
5. prompt de procesos;
6. prompt de tiempo y metáforas;
7. prompt de imágenes, logos y capturas;
8. pasada de diseño sonoro;
9. auditoría visual y técnica.

El router solo selecciona y genera contratos. Los prompts de familia
implementan. La auditoría puede rechazar una pieza aunque compile.

## Diseño sonoro

El sonido refuerza transformaciones visibles:

| Perfil | Cues típicos |
| --- | --- |
| `metric-impact` | tick de datos, impacto suave, chime corto |
| `trend-focus` | whoosh de trazado, pulso al foco |
| `comparison-split` | dos entradas diferenciadas, impacto común |
| `process-flow` | pulsos espaciados por etapa, confirmación final |
| `filter-compress` | textura leve de flujo, cierre comprimido |
| `asset-reveal` | whoosh breve, impacto suave |
| `precision-callout` | click/pulso discreto |

No añadir música ni voz. Mantener silencios, `soundMix` entre 0,5 y 0,7 como
punto de partida y entregar siempre variante silenciosa. La mezcla debe
convivir con locución y pasar medición con FFmpeg.

## Fases de implantación

### Fase 0 — Contratos y prompts

- catálogos de patrones y efectos, esquemas y biblioteca de prompts;
- convención de assets por clip;
- diferenciar barras de histogramas reales.

### Fase 1 — Seis patrones de mayor retorno

- consolidar `hero-metric`, `bar-focus` y `line-trend-zoom`;
- implementar `part-to-whole`;
- implementar `comparison.common-baseline`;
- implementar `asset.screenshot-spotlight`;
- consolidar `FocusZoom`, `ProgressiveText` y `ProgressiveReveal`;
- extraer fondos, spotlight y staging de assets como primitivas.

### Fase 2 — Explicaciones y decisiones

- pros/contras con balanza;
- pipeline, embudo y cuello de botella;
- timeline;
- antes/después con foto, logo o captura.

### Fase 3 — Orquestación de lote

- comando local que descubre clips y sidecars;
- genera manifiestos y `animation-spec.json`;
- prepara props, stills 0/15/45/75/95 y hoja de contacto;
- ejecuta gates y produce guía de montaje.

### Fase 4 — Integración en la UI

- selector de proyecto/carpeta;
- revisión del patrón y assets elegidos;
- edición de texto, datos, foco y mezcla;
- preview antes del render;
- aprobación humana del lote.

## Gates de entrega

Cada pieza debe:

- superar 80/100;
- obtener 15/15 en integridad factual;
- tener un foco dominante y no más de tres grupos de texto;
- evolucionar narrativamente durante 60-75 % de la duración;
- incluir stills al 0, 15, 45, 75 y 95 %;
- entenderse en silencio;
- conservar un hold final de 1-2 segundos;
- pasar `npm run remotion:check`;
- verificar resolución, fps, codec, pixel format y audio con FFprobe;
- entregar MP4 opaco o MOV alfa según el plan, más variante silenciosa si hay
  SFX.
