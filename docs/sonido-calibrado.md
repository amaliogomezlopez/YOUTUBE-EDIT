# Efectos de sonido: calibración y biblioteca

Aprobado por el usuario el 2026-10-16 tras escuchar la demo de Openverse y el short
`suscripcion-x-v3` re-renderizado. Se aplica a toda edición con efectos: aperturas
(`intro-viral`, `intro-a-camara`), shorts y Reels (`shorts-desde-cero`,
`short-desde-intro`, `create-talking-head-reels`, `create-ranked-shorts`), montaje
viral con voz en off (`montaje-viral`) y vídeos largos (`montaje-youtube`,
`montaje-escritorio`). El motor editorial sobrio (`episodio-animado`) conserva su
mezcla y sus reglas FC-R.

## Volumen: por sonoridad, no por pico

- La voz sale de la ingesta a **-14 LUFS** (`video-studio/media-ingest.js`).
- Cada efecto se mide una vez (EBU R128, sonoridad momentánea máxima) y queda a una
  distancia fija **por debajo de la voz** según la situación de montaje:
  `SFX_LEVELS_LU` en `src/modules/video-studio/sound-loudness.js`. Lo que remata
  (golpe, remate, dinero) va más cerca de la voz; whoosh y obturador, más lejos; clic
  y pop, lo más bajo.
- Un efecto calibrado lleva `calibrated: true` y su `volume` es el nivel final: el
  Soundtrack no le aplica `soundMix` ni ducking. La `intensity` del plan sigue
  funcionando como ajuste relativo.
- El agente **no escribe volúmenes de efectos a mano**. Si un efecto suena mal de
  nivel, se corrige `SFX_LEVELS_LU` (para toda una situación) o se cambia el sonido.

Dónde ocurre:

| Superficie | Cómo llega la medida |
|---|---|
| Aperturas (`intro-studio`) | el importador de SONIDOS-REELS mide al importar; la librería sintética se mide en el build |
| Shorts y Reels (`shorts-studio`) | `shorts:build` completa lo que falte (también la librería) desde `public/sfx/loudness-index.json` |
| Montaje viral (`montage-studio`) | `montage -- build` mide también la librería sintética |
| Vídeos largos (`youtube-studio`) | el kit de CapCut se mide al resolverlo; el volumen de CapCut queda en `capcutVolume` |

## Biblioteca: SONIDOS-REELS + Openverse

- Los sonidos del usuario siguen en `SONIDOS-REELS/` (por situación en
  `preferencias.json`; por familia en `shorts-studio/sound-palettes/viral-reels.json`).
- Efectos nuevos sin atribución: `npm run sonidos:openverse -- buscar --situacion <id>`
  busca solo CC0/dominio público, los descarga a `data/openverse-sounds/` y los ordena
  por medida. `adoptar --situacion <id> --id <id8>` los copia a
  `SONIDOS-REELS/apertura/openverse/` con `procedencia.json`. Descargar exige permiso
  del usuario.
- Los 13 adoptados el 2026-10-16 están al final de la rotación de su situación en
  `preferencias.json` y de su familia en `viral-reels.json`.
- Tras añadir sonidos: `npm run talking-head -- sounds` (importa y mide),
  `npm run shorts:sonidos` (regenera la paleta de shorts) y `npm run sonidos:escucha`.
- `npm run sonidos:openverse -- demo --video TOMA --broll a.png,b.png,c.mp4` monta una
  hoja de escucha de 20 s para oír los candidatos en contexto antes de adoptarlos.

## Revisión

Medir la mezcla final con `ffmpeg -af ebur128` y comparar la sonoridad momentánea en
los golpes con la de la voz sola: deben quedar en el mismo rango, ninguno por encima.
Una revisión visual no certifica el audio.
