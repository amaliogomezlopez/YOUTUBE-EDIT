---
name: montaje-escritorio
description: Monta un video largo de YouTube entero con estilo "escritorio" y cubre los dos tipos de grabacion. (1) Grabacion de pantalla con la webcam en una esquina - fondo de pantalla (wallpaper) detras, la pantalla como tarjeta con esquinas redondeadas, la webcam en burbuja y zooms con aceleracion cuando se menciona algo visible (un numero, una tabla). (2) Solo la cara a camara con la habitacion detras - se buscan noticias, imagenes y videos y se alterna la cara a pantalla completa, la cara en una esquina con el recurso en tarjeta sobre el fondo, y el recurso tapandolo todo mientras sigue la voz. Reutiliza el primer corte automatico (recortes, sonidos, musica). Usala cuando el encargo sea "edita el video con el fondo de pantalla", "pantalla con bordes redondeados y la webcam en una esquina", "solo tengo mi cara hablando, busca recursos y montalo", o al iterar ese montaje. NO es para la apertura viral (intro-viral), el montaje a camara estilo CapCut sin fondo (montaje-youtube) ni Shorts.
---

# Montaje "escritorio" de un video largo

Leer antes: `docs/youtube-escritorio.md`. Todo se hace con
`npm run youtube:escritorio -- <comando>`; no se escribe codigo por video.

Dos variantes, que pueden mezclarse en un mismo video (se decide por toma):

| Toma | Lo que se ve | El agente escribe |
|---|---|---|
| Pantalla + webcam incrustada | tarjeta sobre el fondo, burbuja, zooms | `zooms.json` |
| Solo cara (habitacion) | cara a pantalla completa por defecto; planos `corner` y `cover`; zooms a la cara | `asset-requests.json`, `planos.json` y `zooms.json` (sin `box`: la cara) |

## Paso 0: grabacion separada (CAMARA/ y PANTALLA/)

Si la grabacion trae `CAMARA/` y `PANTALLA/` (las tomas de la raiz llevan fecha de OBS y
son las unicas con audio), no se monta la mezcla: se preparan tomas numeradas, **de la
mas antigua a la mas nueva** salvo que el autor diga otra cosa, con la imagen de la
camara y el audio de la mezcla, y se monta con `--variant camara`:

```powershell
npm run tomas -- --recordings "CARPETA" --out data/youtube-src/nombre
```

- Las primeras tomas (gancho, newsletter) son la apertura con la skill `intro-viral`;
  el cuerpo es el resto, renumerado desde 1 con enlaces duros en
  `data/youtube-src/nombre-cuerpo/`. Al final se unen en un MP4 1080p30 a -14 LUFS.
- Lo que el autor ensena en PANTALLA (`screen` de cada toma en `tomas.json`) entra como
  recurso `local` recortado (la columna del post, sin barra de tareas) en un plano
  `corner` cuando lo nombra. El autor prefiere verse: la mezcla solo si la pide.
- Detalle: `docs/grabacion-separada.md`.

## Paso 1: start
```powershell
npm run youtube:escritorio -- start --source "CARPETA_DE_TOMAS" --slug nombre [--wallpaper "RUTA\FONDO.png"] [--variant auto|pantalla|camara]
```
- `--variant camara` cuando todas las tomas son la cara; `auto` lo decide por toma.
- Fondo por defecto (peticion del autor, 2026-10-18): `WALLPAPER\OPENAIFONDO.png`
  (`wallpaper.default` del perfil). Solo pasar `--wallpaper` si el autor pide otro.
- Musica por defecto: `BACKGROUND_MUSIC\bensound-allthat.mp3` (`music.file` del perfil),
  a la sonoridad de la cama del corpus. No elegir otra pista salvo peticion del autor.
- Deja en `data/youtube-escritorio/<slug>/`: `takes.json` (tipo de toma y panel de
  webcam), `candidates.json` (numeros y palabras que senalan algo), `frames/`.

## Paso 2: revisar webcam
Abrir `frames/take-*.jpg`: el rectangulo rojo discontinuo debe cubrir exactamente el
panel de la webcam. Si no, corregir `webcam {x,y,w,h}` en `takes.json` y poner
`"reviewed": true` (start no lo vuelve a tocar).

## Paso 3: escribir zooms.json (el agente decide DONDE, nunca CUANTO)
Mirar los `frames/cand-*.jpg` de `candidates.json`. La rejilla cian esta en pixeles
de la toma: la caja se lee directamente. Elegir pocos momentos (el perfil limita a
3 por minuto y 6 s entre zooms): cifras, precios, filas de tabla, barras de una
grafica, frases resaltadas. No hacer zoom a texto que no se lee mejor ampliado.
```json
{"version": 1, "zooms": [
  {"clipId": "10", "atWord": 111, "box": {"x": 370, "y": 510, "w": 830, "h": 270},
   "reason": "Fila de gpt-6-luna con los 0,10 $ que estoy diciendo"}
]}
```
`untilWord` opcional (por defecto el fin de frase, ~3,5 s). `sound: false` para un
zoom sin whoosh. Prohibido escribir zoom, duraciones o curvas: salen de
`framed-profiles.json`.

## Paso 3b (tomas a camara): recursos y planos
1. Leer `TRANSCRIPCION.md` y apuntar **cada cosa que se nombra y se puede ensenar**
   (noticia, producto, demo, post de X, cifra con fuente).
2. Pedir cada recurso en `asset-requests.json` (mismo contrato y tabla R que la skill
   `intro-viral`: `web` con `"captura": "titular"` para noticias, `image`, `youtube`
   con `start`/`duration` de 4-8 s, `x`, `local`). Una idea, un recurso; anotar la
   frase en `reason`. Nunca inventar URLs: buscarlas y comprobarlas.
   Para automatizar el paso 4, cada recurso dice donde va: `"at": "01:3"`, opcional
   `"until": "01:16"` (`toma:palabra` de `TRANSCRIPCION.md`) y `"layout"`.
3. `npm run youtube:escritorio -- assets --slug nombre` y mirar `assets-sheet.jpg`:
   cada recurso debe ensenar lo que se nombra (una foto de stock generica no vale,
   una pagina de error tampoco). Un fallo (403, Cloudflare, sin titular) no se salta:
   otra fuente que cuente lo mismo, o fichero a mano `assets/<id>.png`.
4. Con `at` en los recursos, `assets` ya ha escrito `planos.json` (video -> `cover`,
   imagen/pagina/post -> `corner`). Si no, escribirlo a mano:
```json
{"version": 1, "planos": [
  {"clipId": "03", "atWord": 12, "untilWord": 30, "layout": "corner", "asset": "noticia-opus", "reason": "Se cita la noticia del lanzamiento"},
  {"clipId": "04", "atWord": 5, "layout": "cover", "asset": "demo-trailer", "reason": "Describo la demo: que se vea entera"}
]}
```
- `corner`: el recurso en tarjeta sobre el fondo y la cara se encoge a la burbuja;
  para capturas con texto, noticias, posts. `cover`: el recurso tapa todo y sigue la
  voz; para video o imagen que se explica sola. Por defecto, cara a pantalla completa.
- Alternar: no mas de ~20 s seguidos solo con la cara (el plan avisa) y que los
  `cover` no pasen del 45 % del video. Sin `untilWord` dura ~6 s o hasta fin de frase.

## Paso 4: plan y revision visual
```powershell
npm run youtube:escritorio -- plan --slug nombre
```
- Si falla, el mensaje dice que regla (palabra recortada, ritmo, caja). Corregir zooms.json.
- Abrir `targets-sheet.jpg`: verde = caja elegida, amarillo = lo que llenara la
  pantalla. Debe contener entero lo que se nombra.
- Revisar un zoom en movimiento sin renderizar todo:
  `npm run youtube:escritorio -- render --slug nombre --from 244 --to 256`.

## Paso 5: render completo
```powershell
npm run youtube:escritorio -- render --slug nombre
```
Entregar el MP4 y `REVIEW.md`. Errores de QA se corrigen antes de entregar. Los
avisos de "parche" significan que el zoom deja ver el hueco donde estaba la webcam
incrustada: mirar ese segundo.

## Prohibido
- Cantidades a mano, otro renderer o ramificar `pipeline.js`.
- Afirmar que esta aprobado por pasar QA; el perfil es una referencia medida,
  pendiente del gusto del autor. Sus comentarios: `npm run youtube:feedback`.
- Publicar o subir: es otra etapa (`prepare-youtube-upload`).

## Efectos de sonido (desde 2026-10-16)

Los efectos van calibrados por sonoridad frente a la voz (-14 LUFS), no por pico: cada uno a su distancia por situación (`SFX_LEVELS_LU` en `src/modules/video-studio/sound-loudness.js`), sin `soundMix` ni ducking encima. Es automático en el build: no escribir volúmenes de efectos a mano. Para efectos nuevos sin atribución, `npm run sonidos:openverse -- buscar|adoptar|demo` (solo CC0/dominio público, descargar exige permiso). Detalle y revisión de la mezcla: `docs/sonido-calibrado.md`.
