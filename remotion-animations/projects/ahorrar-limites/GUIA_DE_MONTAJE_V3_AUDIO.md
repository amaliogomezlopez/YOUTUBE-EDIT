# Guía de montaje V3 con audio · Ahorrar límites

Esta variante conserva exactamente el diseño visual V2 y añade efectos
sincronizados. Los MP4 son 1920×1080, 60 fps, H.264 `yuv420p` y audio AAC,
48 kHz, estéreo. Las V2 silenciosas se conservan.

| Clip | Entrada | Duración | Composición | Diseño sonoro | Archivo |
| --- | ---: | ---: | --- | --- | --- |
| `3.mkv` | `00:14.5` | 8 s | `ALV3A-03-Input-90` | whoosh, contador y confirmación del 90 % | `03/03_tokens_entrada_90_v3_audio.mp4` |
| `6.mkv` | `00:08.5` | 8 s | `ALV3A-06-Harness` | pulsos por etapa y confirmación de resultado | `06/06_harness_flujo_v3_audio.mp4` |
| `10.mkv` | `00:04.5` | 8 s | `ALV3A-10-Carga` | dos entradas, pulsos de recorrido e impacto común | `10/10_carga_contexto_v3_audio.mp4` |
| `13.mkv` | `00:01.8` | 6 s | `ALV3A-13-Contexto` | desplazamiento e impactos crecientes al absorber contexto | `13/13_contexto_acumulado_v3_audio.mp4` |
| `17.mkv` | `00:05.5` | 8 s | `ALV3A-17-Un-Prompt` | colapso, cuatro pulsos de ramificación y cierre | `17/17_una_lectura_varias_tareas_v3_audio.mp4` |
| `22.mkv` | `00:12.0` | 8 s | `ALV3A-22-Skills` | conteo, confirmación del rango y textura de ruido | `22/22_rango_skills_10_30_v3_audio.mp4` |
| `24.mkv` | `00:38.0` | 10 s | `ALV3A-24-Chat-Nuevo` | escritura, compresión, transición y chat limpio | `24/24_chat_nuevo_v3_audio.mp4` |
| `27.mkv` | `00:26.0` | 10 s | `ALV3A-27-Subagentes` | salida a tres agentes, retorno y consolidación | `27/27_orquestador_subagentes_v3_audio.mp4` |

## Mezcla

- `soundMix=0.65` en los renders entregados.
- Picos medidos entre aproximadamente `-19` y `-15 dBFS`.
- No se ha añadido música ni voz.
- Si la locución ya está muy comprimida, bajar la pista del clip entre 3 y
  6 dB en el editor o renderizar con un `soundMix` inferior.
- Usar `soundEnabled=false` o la V2 cuando se prefiera sonorizar manualmente.

## Procedencia

Los archivos `library-*` provienen de la biblioteca local del usuario y no
incluían metadatos de licencia. Los archivos `amaliometria-*` se sintetizan
localmente con FFmpeg mediante `scripts/prepare-sfx.mjs`.

## Reproducir

```powershell
npm run remotion:render:ahorrar-limites-v3-audio
```

Código:

- `src/motion/SoundDesign.tsx`
- `src/AhorrarLimitesV3.tsx`
- `public/sfx/manifest.json`

Control:

- `QA/audio-waveforms-contact-sheet.png`
- `QA/visual-timeline-reviewed.jpg`
