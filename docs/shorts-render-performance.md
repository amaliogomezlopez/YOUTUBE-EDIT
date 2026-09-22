# Rendimiento al extraer Shorts

## Flujo recomendado

```powershell
npm run process -- --video "<video.mp4>" --transcript "<transcript.json>" --top 8 --editing-profile dinamico --subtitle-mode karaoke --subtitle-preset talking-head-green --render-stage prepare --encoder auto --no-llm
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<refinamientos.json>" --stage prepare
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<seleccion.json>" --stage preview
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<seleccion.json>" --stage master
```

El JSON de selección puede contener únicamente `[{"clipId":"clip-id-real"}]`.
Usar preview en los cortes que necesiten revisión de audio, ritmo o sincronía.
Revisar encuadres y palabras con stills antes del máster; corregir solo los cortes
que fallen. Cambiar el rango reconstruye escenas y palabras: preparar ese cambio
antes de aplicar correcciones basadas en los índices nuevos.

- `prepare`: corta, analiza y compila; no produce MP4. `clip.files.build` identifica el plan compilado.
- `preview`: recompila a 30 fps, 1080×1920, calidad draft. `clip.files.preview` contiene el vídeo de revisión.
- `master`: 60 fps, 1080×1920. Solo aquí se rellena `clip.files.video` y el estado pasa a `ready`.

Preparar o previsualizar una revisión conserva el máster anterior en
`clip.previousVideo`; no lo presenta como resultado del montaje nuevo.
Los títulos y rankings por sí solos no generan otro vídeo. `--force-render`
fuerza una regeneración, y `--dry-run` valida todo el lote sin escribir.
La CLI conserva `master` por defecto para mantener compatibilidad; la skill
empieza explícitamente por `prepare`.

## GPU y calidad

El puente Remotion usa `encoder: auto`: prueba un fotograma H.264 con NVENC a
256×256 (64×64 no cumple el mínimo de esta GPU). Si no funciona usa CPU antes
del render; `nvenc` explícito falla con un error claro. No reintenta un render
completo fallido con otro encoder.

- NVENC: máster high 24 Mb/s; standard 16 Mb/s; draft/preview 8 Mb/s. Sin CRF.
- CPU: CRF 17/19/23 según calidad. Los cortes intermedios usan CRF 16 y preset fast.
- Cortes intermedios: CPU H.264 CRF 16, preset fast, audio AAC 48 kHz; resolución y fps originales. Los intermedios NVENC bloquearon la extracción WebCodecs en dos ensayos de esta fuente, incluso sin B-frames; no se activan en producción. La salida final sí usa NVENC.
- Chromium: ANGLE en Windows, concurrencia 1 por defecto. `--render-concurrency 1..16` permite medir otras configuraciones. No se paralelizan clips.
- Las opciones del helper incluyen `renderPerformance: {encoder, concurrency, gl}`; `gl: null` usa el backend predeterminado. La CLI ofrece `--encoder auto|cpu|nvenc`.

Remotion prohíbe combinar CRF explícito con aceleración por hardware. El wrapper
`render-safe.mjs` ya no añade CRF cuando recibe bitrate o hardware acceleration.
Referencia: [documentación de Remotion](https://www.remotion.dev/docs/hardware-acceleration).

No se reduce automáticamente el 4K a 1080p: una webcam pequeña o una ampliación
de texto puede necesitar esos píxeles. La decodificación de la fuente sigue siendo
por CPU y el layout PIP mantiene sus capas; NVENC acelera la codificación y ANGLE
la composición. No se equipara «GPU disponible» con «todo el trabajo en GPU».

## Cachés y medición

El corte se reutiliza solo si coinciden ruta, tamaño y fecha de la fuente,
rango, encoder y versión del procedimiento; también se comprueba tamaño/fecha
del intermedio. Se escribe un temporal antes de sustituirlo. Cambiar palabras
no repite el corte. El análisis local se reutiliza si coinciden intermedio,
rango y palabras; las correcciones de palabras invalidan el análisis semántico.

Cada ejecución correcta añade `performance-history.jsonl` al proyecto, con etapa,
configuración efectiva, tiempo total y fases de corte, análisis, build, render y
finalización cuando proceda. `clip.performance` guarda la última; `renderHistory`
conserva los refinamientos. `elapsedSeconds` del job sigue describiendo su primera
pasada. El manifest de cada render-safe guarda sus argumentos y tiempo real.

## Medición local, 15 de septiembre de 2026

Misma composición PIP, fuente 4K, fotogramas 0–119, salida 1080×1920 a 60 fps,
RTX 4070 SUPER. Incluye inicio de Chromium y empaquetado:

| Configuración | Tiempo |
| --- | ---: |
| Original, CRF 17, backend y concurrencia predeterminados | 46,09 s |
| NVENC 24 Mb/s, ANGLE, concurrencia 1 | 13,41 s |

Reducción observada del 71 %, aproximadamente 3,4×. SSIM entre los dos vídeos:
0,9933; se revisó también un fotograma coincidente de cara, texto y pantalla.
SSIM mide similitud, no certifica por sí solo la calidad editorial.
Son dos segundos de un corte, no un benchmark completo del lote. El ensayo
optimizado incluye log verbose; los dos conservan dimensiones y reloj.

El ahorro mayor del flujo es evitar los dos másters provisionales de cada corte:
el diagnóstico anterior acumuló 24 renders para entregar 8 Shorts. No se promete
un tiempo de lote hasta medirlo con selección y encuadres ya revisados.

## Verificación del cambio

- Suite completa: 471 tests aprobados; smoke FFmpeg correcto.
- Skill: frontmatter y referencias comprobados con js-yaml local (el validador Python requiere PyYAML, ausente en el runtime).
- Ciclo real de 3 segundos: prepare 1,84 s; preview 11,16 s; master 17,30 s, incluidos build y QA. Reutilizar el corte: 0,001 s.
- Ambos MP4 superan QA técnica de codecs, duración, sonoridad y canales. ffprobe confirma preview 30 fps y máster 60 fps, 1080×1920, H.264 y BT.709 en el máster.
- La revisión de imagen del benchmark cubre un fotograma coincidente. No se ha vuelto a revisar editorialmente ni a exportar el lote completo de ocho Shorts.
