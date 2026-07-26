# Diseño sonoro para animaciones Remotion

## Decisión obligatoria

Analizar el sonido en toda animación que vaya a implementarse o renderizarse,
aunque el usuario no lo mencione. Para cada transformación significativa,
elegir un cue sincronizado o registrar silencio intencional. Entregar por
defecto versión sonorizada y versión silenciosa.

La IA debe decidir los cues a partir del `soundProfile` del patrón, el verbo de
movimiento y los frames exactos. El sonido confirma una causa visual; no crea
una importancia que la imagen no tiene.

## Recursos del proyecto

- Biblioteca maestra local: `assets/audio-effects/source-library/`.
- Selección lista para Remotion: `remotion-animations/public/sfx/`.
- Manifiesto y procedencia: `remotion-animations/public/sfx/manifest.json`.
- Preparación reproducible: `remotion-animations/scripts/prepare-sfx.mjs`.
- Componentes y cues: `remotion-animations/src/motion/SoundDesign.tsx`.

Ejecutar `npm --prefix remotion-animations run prepare:sfx` para reconstruir
los WAV normalizados y los efectos propios.

## Selección y procedencia

- Tratar los efectos `library-*` como material de licencia desconocida hasta
  verificar su fuente. No redistribuir la biblioteca completa ni publicar un
  efecto aislado como propio.
- Preferir los efectos `amaliometria-*` cuando baste un pulso, tick, impacto,
  chime o whoosh. Se sintetizan localmente con FFmpeg y no dependen de terceros.
- Copiar al `public/sfx/` solo la selección activa. Mantener la biblioteca
  completa fuera de Git.
- Normalizar activos de render a WAV PCM, 48 kHz, estéreo y nombres simples.

## Implementación

- Usar `<Audio>` de `@remotion/media` con `staticFile()`.
- Representar cada evento como `SoundCue`: archivo, inicio, duración, volumen,
  ataque y release.
- Reutilizar `Soundtrack` para secuenciar cues y aplicar un volumen maestro.
- Exponer `soundEnabled` y `soundMix` como props Zod.
- Ligarlos a momentos visuales concretos: inicio de recorrido, absorción,
  aparición de un nodo, foco numérico o confirmación.
- Mantener silencios entre eventos. No añadir una cama continua ni un efecto
  por cada elemento decorativo.
- En Remotion 4.0.499 del proyecto, `Sequence` no expone `premountFor`; no
  introducir esa prop hasta actualizar y verificar la versión.

## Mapa de eventos a sonidos propios

Preferir estos archivos de procedencia propia:

| Evento visual | Archivo inicial recomendado |
| --- | --- |
| Inicio de recorrido, ascenso o wipe | `amaliometria-rise-whoosh.wav` |
| Aparición de nodo o activación breve | `amaliometria-ui-pulse.wav` |
| Tick de dato o checkpoint | `amaliometria-data-tick.wav` |
| Bloqueo, selección o conclusión con peso | `amaliometria-soft-impact.wav` |
| Resultado positivo o cierre resuelto | `amaliometria-success-chime.wav` |

Adaptar por patrón:

- `metric-impact`: tick durante hitos relevantes; un impacto al fijar la cifra;
  chime solo si existe una resolución positiva.
- `trend-focus`: whoosh suave durante el trazado; pulso en el punto focal;
  impacto discreto al concluir el zoom.
- `comparison-split`: un pulso por lado o estado, separados en el tiempo; un
  único impacto al revelar la diferencia.
- `process-flow`: whoosh durante el viaje, pulsos al activar nodos y chime al
  llegar al resultado. No sonorizar cada frame del recorrido.
- `filter-compress`: whoosh de entrada y un impacto al consolidar la salida.
- `asset-reveal`: whoosh breve de revelado y pulso solo en el foco.
- `precision-callout`: tick o pulso al anclar la anotación; evitar impacto
  fuerte sobre una simple etiqueta.

Casos Scout:

- `RadialOrbitSummary`: whoosh ligero al iniciar el anillo, ticks en un máximo
  de dos hitos y chime o impacto cuando las salidas quedan conectadas.
- `ConnectedCardChain`: pulso al entrar cada nodo significativo, whoosh durante
  el conector y confirmación al llegar al resultado.
- `CapacityMatrix`: un tick por oleada, no por icono; impacto suave en la
  selección final.

## Mezcla

- Diseñar para convivir con locución. Como referencia, entregar efectos con
  picos aproximados entre `-22` y `-14 dBFS`, nunca cerca de 0 dBFS.
- Usar un único `soundMix` para permitir que el editor baje toda la capa sin
  alterar cada cue. Mantener normalmente `0.5-0.7`.
- Aplicar ataque y release breves para evitar clics digitales.
- Evitar varios impactos fuertes simultáneos. Reservar el chime o impacto
  principal para la conclusión.
- Mantener la versión anterior sin audio. Crear una variante con sufijo
  `_audio` o versión nueva; no sobrescribir el render silencioso.

## Efectos propios

Generar efectos de interfaz reproducibles mediante fuentes `sine` y
`anoisesrc` de FFmpeg, filtros de frecuencia, fades, mezcla y limitador. Guardar
el comando en `prepare-sfx.mjs`; no crear binarios sin documentar su síntesis.

## Control de calidad

1. Ejecutar `npm run remotion:check`.
2. Renderizar una pieza piloto y medirla antes de procesar el lote.
3. Verificar con `ffprobe` que exista audio AAC, 48 kHz y estéreo.
4. Medir `mean_volume` y `max_volume` con `ffmpeg -af volumedetect`.
5. Generar waveforms para comprobar presencia, silencios y sincronía.
6. Ajustar escenas claramente más fuertes o débiles que el resto.
7. Confirmar que la pieza sigue entendiéndose con `soundEnabled=false`.
8. Confirmar que cada cue aparece en el plan con evento visual, tiempo, archivo
   y razón; eliminar cualquier sonido sin causa visible.
