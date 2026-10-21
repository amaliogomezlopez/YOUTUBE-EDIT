---
name: montaje-viral
description: Monta un Short 9:16 y/o un video largo 16:9 en estilo viral (visual nueva cada 1,5-3 s, zoom y movimiento constantes, golpe de sonido en cada cambio, cifras en pantalla, subtitulos grandes) a partir de una locucion (grabada o TTS) y una carpeta de imagenes y videos, sin camara. Usala cuando el encargo sea "monta un short/video viral con esta voz y estos recursos", noticias de Finance Cavaliers en formato viral, o al iterar ese montaje. NO es para el episodio editorial sobrio (episodio-animado), shorts desde clips de camara (shorts-desde-cero), intros (intro-a-camara) ni tomas numeradas de YouTube (montaje-youtube).
---

# Montaje viral con voz en off

> **Receta obligatoria de STUDIO.** Qué cuenta la pieza, su arranque y su cierre sigue la skill global `guion-video` (`D:\0000-STUDIO\skills\guion-video\SKILL.md`) con la receta `D:\0000-STUDIO\formats\youtube-largo\` (vídeo largo) o `D:\0000-STUDIO\formats\short\` (Short o Reel): promesa del canal, ficha y comprobación de su `rules.json` antes de dar el resultado por bueno. Si esta skill y la receta chocan, manda lo que fije el canal en su `AGENTS.md`; lo demás, la receta.

## Paso 0
Leer `docs/montage-desde-cero.md` y `src/modules/montage-studio/rules/montage-rules.json`
(las reglas que el build va a ejecutar).

## Paso 1: ingesta
```powershell
npm run montage -- ingest --slug SLUG --voiceover VOZ.wav --assets CARPETA [--transcript PALABRAS.json] [--music MUSICA.mp3]
```
- Los assets se nombran por lo que muestran (`powell.jpg`, `nvidia-resultados.png`):
  un nombre que la locucion dice hace que el asset entre justo ahi.
- Minimo recomendable: una visual cada 2,25 s de locucion (unas 25 para 1 min de short)
  sin repetir. Con menos, MO-R-024 avisa de repeticiones.

## Paso 2: plan
Editar `remotion-animations/projects/montage-SLUG/montage-plan.json` leyendo
`transcript.json` (indices de palabra):
- `cut` para quedarte con el tramo del short.
- `emphasis`: 3-6 palabras de golpe (giro, cifra clave, "pero", "sin embargo").
- `overrides`: solo cuando una palabra exige un asset concreto.
- `textPops`: 1-3 palabras gancho; las cifras dichas salen solas.
Nunca escribas segundos ni cantidades de ritmo: vienen del perfil.

## Paso 3: build, stills y render
```powershell
npm run montage -- build --slug SLUG
cd remotion-animations; node scripts/render-safe.mjs still montage-SLUG Montage-9x16-SLUG-TITULADO f.png --frame=N
npm run montage -- render --slug SLUG --format 9x16
```
- Un `error` de regla bloquea el build: corrige el plan, no la regla.
- Revisa stills de varias visuales antes del render completo: la validacion tecnica
  no sustituye la revision visual.
- Feedback del usuario sobre el montaje -> regla nueva con validador y fixture.

## Efectos de sonido (desde 2026-10-16)

Los efectos van calibrados por sonoridad frente a la voz (-14 LUFS), no por pico: cada uno a su distancia por situación (`SFX_LEVELS_LU` en `src/modules/video-studio/sound-loudness.js`), sin `soundMix` ni ducking encima. Es automático en el build: no escribir volúmenes de efectos a mano. Para efectos nuevos sin atribución, `npm run sonidos:openverse -- buscar|adoptar|demo` (solo CC0/dominio público, descargar exige permiso). Detalle y revisión de la mezcla: `docs/sonido-calibrado.md`.
