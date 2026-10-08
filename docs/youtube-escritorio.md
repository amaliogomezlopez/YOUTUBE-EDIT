# Montaje "escritorio" de un video largo

Estilo de la skill `montaje-escritorio`: fondo de pantalla, la grabacion como tarjeta
redondeada y centrada, la webcam en burbuja y zooms ocasionales con aceleracion.
Superficie: youtube-studio (16:9 @30). No es otro motor: reutiliza el primer corte
automatico (`planEdit`: recortes por silencio, arranques fallidos, sonidos en cortes,
musica, sticker, cierre, recursos) y el render `YouTube-Timeline`.

## Piezas

| Pieza | Fichero |
| --- | --- |
| Perfil medido (cantidades) | `src/modules/youtube-studio/framed-profiles.json` |
| Geometria, reglas y compilacion | `src/modules/youtube-studio/framed.js` |
| Curva `glide` y punto fijo del zoom | `src/modules/video-studio/camera-track.js` |
| Panel de la webcam incrustada | `src/modules/video-studio/webcam-panel.js` |
| Tramo de un render-plan | `excerptRenderPlan` en `render-plan.js` |
| Renderer (escenario, capas `rect`) | `remotion-animations/src/youtube/YouTubeTimeline.tsx` |
| CLI | `scripts/youtube-escritorio.js` (`npm run youtube:escritorio`) |

## Referencia medida

OpenAI, "ChatGPT for Word is now available" (youtube lxVMdEpe0RQ), medido fotograma a
fotograma el 2026-10-07:

- La pantalla ocupa el 77,6 % del lienzo, centrada, sobre un degradado.
- El zoom mueve todo el escenario (fondo incluido) alrededor de un punto fijo: 1x a
  3,46x en ~1,1 s, salida suave y aterrizaje lento: `cubic-bezier(0.1, 0, 0.6, 1)`
  sobre el valor de zoom. Es la curva `glide`.
- Mientras se mantiene hay una deriva lenta; las salidas de la referencia son cortes,
  aqui se animan (`zoom.outSeconds`).

Radio, sombra, ritmo (3/min, 6 s entre zooms) y zoom maximo (2,8x) son valores de
partida: **no son un gusto aprobado del autor**.

## Contrato de zooms.json

`{clipId, atWord, box:{x,y,w,h}, reason, untilWord?, sound?}`. `atWord` es indice de la
transcripcion de la toma; `box` en pixeles de la toma normalizada. El build falla si:
la palabra cae en un trozo recortado, la caja sale de la toma o cubre casi toda la
pantalla, el zoom no puede mantenerse `minHoldSeconds`, coincide con un recurso, o se
rompe `minGapSeconds`/`maxPerMinute`. Avisa si amplia demasiado los pixeles o si deja
ver el parche de la webcam.

## Webcam

Las grabaciones de pantalla traen la webcam incrustada (escena de OBS, panel pegado a
los bordes). `webcam-panel.js` busca los bordes interiores del panel que se repiten en
varios fotogramas, toma los lados exteriores como el borde del cuadro salvo borde
casi perfecto, y usa la mediana de todas las tomas para corregir lecturas raras (nunca
encoge el panel por debajo de la mediana). Dentro de la tarjeta, ese hueco se tapa con
un parche del color de alrededor; la burbuja (`placement: embedded`) se dibuja encima,
fuera del escenario, y se encoge hacia su esquina mientras hay zoom.

Tomas a camara (cara grande, sin panel) van en la tarjeta sin burbuja.

## Variante a camara (solo la cara)

Cuando el unico input es la cara con la habitacion detras (`--variant camara`, o
`auto` con la cara grande y sin panel), la toma se ve a pantalla completa y el agente
la alterna con planos (`planos.json`) sobre recursos que pide en
`asset-requests.json`. La descarga reutiliza `src/modules/intro-viral/assets.js`
(webs, titulares de noticias, imagenes, tramos de YouTube con yt-dlp, posts de X por
oEmbed, ficheros locales), siempre con `.provenance.json`; `assets.json` es el
catalogo con medidas y duracion.

| Layout | Cara | Recurso | Voz |
|---|---|---|---|
| (ninguno) | pantalla completa | - | si |
| `corner` | burbuja en la esquina (`camera.bubble`), entra encogiendose con `glide` y vuelve a crecer | tarjeta redondeada sobre el fondo, entra con fundido | si |
| `cover` | oculta | a pantalla completa (cover), fundido corto | si |

La cara nunca se quita del timeline: debajo de un `cover` sigue sonando. El recorte de
la burbuja sale del `faceBox` de la ingesta (cara al 42 % de la altura). Reglas: el
recurso debe existir, el plano dura entre 2 y 14 s, no se solapa con otro ni con un
recurso del primer corte, y en una toma a camara no hay zooms. Avisos: mas de 20 s
seguidos solo con la cara y `cover` por encima del 45 % del video. Todo en
`framed-profiles.json` (`camera`), valores de partida.

`TRANSCRIPCION.md` lista lo que queda tras los recortes por frases, con el minuto del
montaje y el rango `toma:palabra` para anclar planos y zooms.

## Capas `rect` del renderer

Una capa con `rect` se coloca en pixeles del lienzo: `fit` cover/contain, `crop` en
pixeles de la fuente, `frame` (radio, sombra, borde), `patches` y `stageShrink`. Las
capas con `stage: true` se mueven juntas con `props.stage.camera`. Las capas antiguas
(transform estilo CapCut) no cambian.
