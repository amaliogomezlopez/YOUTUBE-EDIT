# Diseño sonoro para animaciones Remotion

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
