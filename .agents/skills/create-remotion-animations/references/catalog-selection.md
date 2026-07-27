# Selección semántica del catálogo

## Regla central

Elegir la animación por lo que la locución necesita demostrar. Separar:

1. la afirmación respaldada;
2. la relación semántica;
3. el patrón que comunica esa relación;
4. los efectos que construyen y enfocan;
5. los sonidos que confirman eventos visuales reales.

Leer antes:

- `remotion-animations/catalog/animations/patterns.json`;
- `remotion-animations/catalog/animations/effects.json`;
- `remotion-animations/catalog/visuals/icons.json`;
- `remotion-animations/catalog/visuals/drawings.json`;
- la transcripción y el tramo exacto del clip.

## Ruta rápida para patrones `ready`

| La explicación contiene | Patrón | Componente |
| --- | --- | --- |
| Una cifra exacta protagonista | `data.hero-metric` | `KineticNumber` |
| Categorías con valores comparables | `data.bar-focus` | `RisingHistogram` |
| Evolución temporal o punto de inflexión | `data.line-trend-zoom` | `LineChartZoom` |
| Porcentaje o parte-total verificable | `data.part-to-whole` | `RadialOrbitSummary` |
| Etapas conectadas por causa y efecto | `process.signal-flow` | `ConnectedCardChain` |
| “Más”, “menos” o diferencia de escala sin cifras | `concept.scale-proportion` | `CapacityMatrix` |

No usar `data.part-to-whole` para una mayoría no cuantificada. No usar
`concept.scale-proportion` si existen cifras suficientes para una gráfica
cuantitativa.

## Patrones incorporados por Animation Scout

### `RadialOrbitSummary`

Usar cuando exista un núcleo o proporción exacta y entre tres y cinco
relaciones periféricas. Añadir `focus.radial-orbit` cuando el recorrido del
anillo ayude a leer esas relaciones. Evitar la órbita si solo se necesita
mostrar un porcentaje aislado; en ese caso usar `data.hero-metric`.

### `ConnectedCardChain`

Usar cuando una explicación tenga orden, dependencia y resultado: entrada →
transformación → salida. Mantener un nodo estable si cambian estados
intermedios. Combinar normalmente `reveal.path-draw` y `focus.path-follow`.
No usar para listas sin causalidad.

### `CapacityMatrix`

Usar para magnitud cualitativa, capacidad, saturación o densidad cuando la
fuente no aporta porcentajes. Construir la familia en tres a cinco oleadas y
aislar una conclusión con `focus.accent-only`. No imprimir una cifra inferida.

## Elegir efectos

- Entrada con jerarquía: `reveal.element` o `reveal.element-stagger`.
- Camino o conector significativo: `reveal.path-draw`.
- Pulso causal: `focus.path-follow`.
- Parte-total con relaciones periféricas: `focus.radial-orbit`.
- Conclusión numérica: `focus.count-impact`.
- Comparación ya construida: `focus.desaturate-peers` o `focus.accent-only`.
- Acercamiento final a una región: `camera.focus-zoom`.
- Recorrido espacial durante la construcción: `camera.path-track`.
- Salida fullscreen: `exit.clean-fade`.

Usar un patrón dominante y solo los efectos que ejecuten su verbo. No mezclar
órbita, zoom, spotlight y múltiples glows en el mismo beat.

## Decisión y handoff

Registrar por momento:

```text
claim:
patternId:
selectionRationale:
rejectedAlternatives:
effectIds:
soundProfile:
soundEvents:
compositionId:
```

Si ninguna entrada encaja, documentar el hueco y proponer una extensión del
catálogo. No forzar un patrón solo porque esté `ready`.
