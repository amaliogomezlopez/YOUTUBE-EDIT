# Demos del catálogo Animation Scout

Estas tres piezas son composiciones parametrizables para evaluar las mecánicas
descubiertas durante el scouting. No contienen afirmaciones editoriales del
vídeo de referencia y no deben montarse como datos reales sin crear antes un
`animation-spec.json` respaldado por la fuente del vídeo final.

## Scout-RadialOrbitSummary

- Patrón: `data.part-to-whole`.
- Efecto nuevo: `focus.radial-orbit`.
- Mecánica: el anillo completa una proporción, una señal recorre el perímetro,
  las etiquetas aparecen alrededor del núcleo y dos salidas responden.
- Props editables: `value`, `suffix`, `centerLabel`, `orbitItems`,
  `sideCards`, `accentColor`.
- Uso recomendado: porcentajes exactos, ciclos o ecosistemas con un núcleo.

## Scout-ConnectedCardChain

- Patrón: `process.signal-flow`.
- Mecánica: un nodo estable inicia la cadena, los conectores se dibujan, un
  pulso viaja y los estados intermedios cambian sin perder continuidad.
- Props editables: `nodes[].states[]`, `accentColor`.
- Uso recomendado: procesos de dos a cuatro etapas, transformaciones y
  pipelines con un resultado claro.

## Scout-CapacityMatrix

- Patrón: `concept.scale-proportion`.
- Mecánica: la matriz se construye en cinco oleadas, distingue densidad activa
  y termina aislando un único elemento.
- Props editables: `rows`, `columns`, `activeCount`, `selectedIndex`,
  `accentColor`.
- Uso recomendado: relaciones cualitativas de escala. No imprimir porcentajes
  si la fuente no los aporta.

## Diferencias respecto a la referencia

- Paleta, tipografía, marca, textos, iconografía y geometría son de
  Shortsmith/Amaliometría.
- Se conserva únicamente el principio de movimiento observado.
- Los valores visibles de la demo radial están identificados como
  ilustrativos.
- No se extrajo audio, no se transcribió y no se enviaron imágenes a un modelo
  externo.

## Comandos reproducibles

Desde `remotion-animations/`:

```powershell
npm run check
npm run stills:scout-catalog
npm run render:scout-catalog
```

Los renders se generan en `out/scout-catalog/`. Son MP4 H.264 silenciosos a
1920x1080, 60 fps y `yuv420p`.

## QA final

| Composición | Puntuación | Resultado |
| --- | ---: | --- |
| `Scout-RadialOrbitSummary` | 94/100 | Parte-total y recorrido orbital legibles; hold final limpio. |
| `Scout-ConnectedCardChain` | 93/100 | Causalidad, continuidad del ancla y cambio de estados claros. |
| `Scout-CapacityMatrix` | 92/100 | Escala cualitativa y foco final comprensibles sin cifras inventadas. |

Las tres piezas obtienen 15/15 en integridad factual porque están identificadas
como demos y no presentan sus textos o cantidades como hechos del vídeo de
referencia. Se revisaron los stills de 0/15/45/75/95 % y secuencias extraídas de
los MP4 finales.

`ffprobe` verificó en los tres archivos: H.264, 1920x1080, 60 fps, `yuv420p` y
8,04 segundos. La pista AAC es silencio digital (`mean_volume` y `max_volume`
de -91 dB).
