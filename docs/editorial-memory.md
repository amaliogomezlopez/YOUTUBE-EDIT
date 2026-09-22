# Memoria editorial: gusto medido desde CapCut

Estado 22-09-2026: corpus, perfil medido y banco de ejemplos. **El perfil describe lo
que se hizo; no es un gusto aprobado.** Nada de aqui se convierte en regla sin revision.

## Comandos

```powershell
npm run editorial:corpus -- scan       # lee todos los drafts de CapCut (solo lectura)
npm run editorial:corpus -- profile    # agrega habitos por formato
npm run editorial:corpus -- examples --project 0921 --export "D:/.../GROK.mp4"
```

Salida privada (gitignored) en `data/editorial-memory/corpus/`:

- `edits/<proyecto>.json`: timeline normalizada con el vocabulario de Shortsmith:
  `takes`, `cameraMoves`, `inserts` (`insert` o `screen`), `sounds` (con familia,
  evento visual y `lead`), `music`, `stickers`, `texts`, `effects`, `transitions`.
- `style-profile.json`: cuantiles con `n` por formato. Un habito con `n` bajo es una
  anecdota, no una preferencia.
- `transcripts/` y `examples/`: decisiones ligadas a las palabras dichas alrededor, mas
  tramos sin decision como ejemplos negativos.

## Donde vive la edicion en CapCut

La timeline principal de un proyecto suele ser un clip compuesto. La edicion real esta
en `subdraft/<id>/draft_content.json`, a veces anidada otra vez. `loadEditTimeline`
elige la timeline con mas segmentos; no aplana compuestos.

## Reloj de las palabras: usar la exportacion

Las grabaciones se reutilizan: `VIDEOS_RECORDED/2.mkv` aparece en 14 proyectos y hoy
solo contiene la toma del ultimo video. Transcribir las tomas daria frases de otro
video. `examples` transcribe el MP4 exportado, que comparte reloj con la timeline, y
rechaza una exportacion cuya duracion no coincide con la edicion (tolerancia 0,5 s).

## Sonidos

Los nombres de libreria se traducen a familias de `video-studio/sound-families.js`
(`soundFamilyOf`). `lead` es cuanto antes del evento empieza el sonido: los whooshes
arrancan antes del corte para que el golpe caiga en el. Lo que no encaja queda como
`unmapped` y aparece en `unmappedNames` para ampliar el mapa.
