# Guía de montaje V2 · Ahorrar límites

Las ocho piezas son full-screen, 1920×1080, 60 fps, H.264 `yuv420p`, sin
audio. Los tiempos son relativos al inicio de cada clip original. La primera
versión se conserva intacta.

| Clip | Inserción sugerida | Duración | Composición | Archivo V2 |
| --- | ---: | ---: | --- | --- |
| `3.mkv` | `00:14.5` | 8 s | `ALV2-03-Input-90` | `03/03_tokens_entrada_90_v2.mp4` |
| `6.mkv` | `00:08.5` | 8 s | `ALV2-06-Harness` | `06/06_harness_flujo_v2.mp4` |
| `10.mkv` | `00:04.5` | 8 s | `ALV2-10-Carga` | `10/10_carga_contexto_v2.mp4` |
| `13.mkv` | `00:01.8` | 6 s | `ALV2-13-Contexto` | `13/13_contexto_acumulado_v2.mp4` |
| `17.mkv` | `00:05.5` | 8 s | `ALV2-17-Un-Prompt` | `17/17_una_lectura_varias_tareas_v2.mp4` |
| `22.mkv` | `00:12.0` | 8 s | `ALV2-22-Skills` | `22/22_rango_skills_10_30_v2.mp4` |
| `24.mkv` | `00:38.0` | 10 s | `ALV2-24-Chat-Nuevo` | `24/24_chat_nuevo_v2.mp4` |
| `27.mkv` | `00:26.0` | 10 s | `ALV2-27-Subagentes` | `27/27_orquestador_subagentes_v2.mp4` |

## Mejoras aplicadas

- Lienzo editorial limpio, sin paneles de dashboard ni metadatos del clip.
- Una idea, una transformación y un color de acento por pieza.
- `90/10` dibujado con alturas proporcionales y base común.
- Rango `10–30` legible y ruido posterior representado sin cifras inventadas.
- Números tabulares, formato español y pulso de zoom independiente.
- Diagramas animados mediante recorridos de señal, no apariciones arbitrarias.
- Movimiento activo durante el desarrollo y hold final suficiente para montaje.

## Toolkit para futuras piezas

Reutilizar `src/motion/Toolkit.tsx` y las demos del folder
`Toolkit-Reutilizable` en Remotion Studio. Las series, barras, unidades,
decimales, colores e índices de foco se editan mediante props. Los datos de las
demos no son evidencia factual.

Referencias renderizadas en `TOOLKIT/`:

- `toolkit-line-chart-zoom.mp4`
- `toolkit-rising-histogram.mp4`
- `toolkit-kinetic-number.mp4`

Render reproducible:

```powershell
npm run remotion:render:ahorrar-limites-v2
```

Previews y revisión temporal:

- `out/ahorrar-limites-v2/PREVIEWS/contact-sheet-v2.jpg`
- `out/ahorrar-limites-v2/QA/timeline-contact-sheet.jpg`
