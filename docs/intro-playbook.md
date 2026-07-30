# Lenguaje de montaje — Introducciones a cámara

<!-- GENERADO por scripts/render-editing-playbook.js desde
     src/modules/intro-studio/rules/intro-rules.json.
     No editar a mano: los cambios se pierden en la siguiente generación. -->

Este contrato convierte cada corrección del montaje de intro en una regla ejecutable. El validador recibe `intro-build.json`, así que mide el montaje resuelto en frames y en píxeles, no las intenciones del plan. Los umbrales de ritmo y duración no están en la regla: salen del `budget` del perfil de estilo activo, de modo que un perfil sobrio y uno nervioso comparten validador. `docs/intro-playbook.md` se genera desde este fichero: nunca se edita a mano.

## Cómo leer este documento

| Severidad | Efecto |
| --- | --- |
| `error` | Bloquea `intro:build`. La intro no se compila. |
| `warning` | No bloquea, pero aparece en el informe del build y exige justificación. |
| `review` | Requiere mirada humana; no hay comprobación geométrica posible. |

| Ámbito | Significado |
| --- | --- |
| `catalog` | Regla universal: aplica a cualquier intro y, si no depende del formato, su validador vive en `src/modules/video-studio/checks/` y lo comparten las demás superficies de montaje. |
| `channel` | Regla de marca del canal para el que se monta la intro. |

Reglas: **12** · con validador automático: **12** · marcadas `manual`: **0** · sin implementar: **0**.

Una regla que se cumple igual en dos superficies asciende a `catalog` y su validador se mueve a `src/modules/video-studio/checks/`. Ya han ascendido `art-dark-on-alpha-needs-plate`, `art-solid-background-needs-blend` y `cue-not-silent`, que nacieron montando shorts. Las reglas de este set se registran con `npm run intro:feedback`, que crea regla, validador y fixture de una sola vez.

## 1. Capas y profundidad

- Sin máscara de persona, la profundidad la da el reparto: `depth: "back"` dibuja el arte antes del sujeto, reducido y desenfocado, y `front` después.
- Slots de fondo: `back-left`, `back-right`, `back-center`, `orbit-1..4`. Slots de primer plano: `fore-left`, `fore-right`, `corner-tl`, `corner-tr`, `banner-top`, `banner-bottom`, `center`, `strip`.
- Los layouts `hero-left`, `hero-right` y `frame` liberan superficie alrededor del sujeto: son los que hacen legible un logo que sale por detrás.

### IN-R-010 · `error` · `catalog`

Un cue con `depth: "back"` va reducido (escala ≤ 0,95) y desenfocado (≥ 1 px).

**Por qué:** Sin máscara de persona lo único que dice «esto está detrás» es la profundidad de campo. Un logo a escala 1 y nítido detrás del sujeto se lee como un logo pegado que compite con la cara, no como fondo. Los valores por defecto los pone el perfil, así que la regla solo salta cuando el plan los sobrescribe.

**Validador:** `intro-back-cue-reads-as-background`

### IN-R-011 · `error` · `catalog`

Ningún cue de primer plano, ni la banda del titular, tapa más del 12 % de la cara del sujeto.

**Por qué:** Es el fallo más caro de una intro y el más invisible en el JSON: se pide un logo en `center` con layout `hero` y aterriza sobre la boca. El build traduce el `faceBox` de la ingesta al rectángulo que ocupa la cara en la composición para poder medirlo antes de renderizar. El titular no es un cue pero ocupa una banda fija y grande, así que se mide igual contra las escenas que están en pantalla con él.

**Validador:** `intro-face-not-covered`

### IN-R-012 · `error` · `catalog`

Dos cues activos a la vez y a la misma profundidad no pueden tener rectángulos que se solapen.

**Por qué:** Los slots de la intro se pisan a propósito para poder elegir composición: `center` cae dentro de `banner-bottom` y `back-center` toca `back-left`. Ese solape solo es útil si no hay dos cosas dentro a la vez. Profundidades distintas sí pueden solaparse: es el efecto que se busca cuando un logo pasa por detrás mientras un rótulo entra por delante.

**Validador:** `intro-cue-rect-overlap`

## 2. Legibilidad de imágenes

- Presentaciones: `card` (tarjeta oscura, por defecto), `plate` (placa clara), `plain` (sin marco) y `blend` (suma con `screen`).
- El build mide el arte de cada asset de imagen una vez y deja el resultado en `cue.art`; las reglas de presentación leen esa medida, no el nombre del fichero.

### IN-R-020 · `error` · `catalog`

Un logo cuyo arte es oscuro sobre alfa necesita `presentation: "plate"`.

**Por qué:** Sobre la tarjeta oscura de `card` el trazo negro desaparece y queda un marco vacío. La regla nació montando shorts y se cumple igual en 16:9, así que su validador es de catálogo.

**Validador:** `art-dark-on-alpha-needs-plate`

### IN-R-021 · `error` · `catalog`

Un logo o un wordmark con fondo negro sólido necesita `presentation: "blend"`.

**Por qué:** Un wordmark exportado sin alfa arrastra su rectángulo negro: dentro de la tarjeta se ve el escalón y sobre el vídeo, un parche. `blend` suma con `screen` y el negro desaparece.

**Validador:** `art-solid-background-needs-blend`

### IN-R-022 · `warning` · `catalog`

Un cue con presentation "blend" necesita video o fondo detras de su rectangulo: sobre el fondo del tema, screen lo hace invisible.

**Por qué:** blend existe para que el rectangulo negro de un logo sin alfa desaparezca sobre el video. Si el cue cae donde no hay video ni backdrop, screen suma sobre el fondo del tema y lo que desaparece es el logo entero. Paso con el logo de Kimi en la escena de cierre, en layout frame.

**Validador:** `intro-blend-needs-something-behind`

## 3. Zona segura

- La geometría vive en `remotion-animations/src/intro/geometry.json` y la comparten el renderer y el validador.
- El límite lo pone el reproductor de YouTube, no el formato: barra de progreso y controles abajo, tarjetas de sugerencias arriba a la derecha.

### IN-R-030 · `error` · `catalog`

Nada informativo baja de y = 972 ni se sale de los 96 px laterales.

**Por qué:** El límite lo pone el reproductor, no el formato: YouTube dibuja ahí la barra de progreso y los controles. Un rótulo perfectamente legible en el MP4 queda tapado en el reproductor real, así que el render no delata el fallo.

**Validador:** `intro-safe-area`

## 4. Ritmo y golpes

- `atBeat` es un índice de la rejilla global de la pieza; `atWord`, un índice dentro de la transcripción de su clip. `atSeconds` solo se acepta cuando no hay ni música ni transcripción.
- Efectos fuertes (los que se cuentan como golpe): `flash`, `rgb-split`, `shake`, `zoom-punch`, `glitch`, `letterbox-snap`. Los demás son textura continua.

### IN-R-040 · `warning` · `catalog`

Todo efecto fuerte cae dentro de la tolerancia del perfil respecto a un beat, o declara `offBeatNote`.

**Por qué:** Es lo que separa una intro que engancha de una que solo tiene efectos. Un flash 80 ms antes del golpe de la música no se percibe como un adelanto sino como un montaje mal hecho, aunque nadie sepa decir por qué. Un golpe anticipado a propósito crea tensión, y para eso la excepción se declara en vez de tolerarse en silencio.

**Validador:** `intro-hit-on-beat`

### IN-R-041 · `error` · `catalog`

No hay más golpes por segundo que los que autoriza el perfil, medido en ventana deslizante de un segundo.

**Por qué:** Pasado ese techo la intro deja de tener ritmo y pasa a tener ruido: el ojo no distingue diez impactos en dos segundos, solo registra parpadeo, y en pantalla grande es incómoda de ver. Se mide en ventana deslizante porque por segundos enteros se cuelan cuatro golpes repartidos entre el final de uno y el principio del siguiente.

**Validador:** `intro-effect-density-max`

## 5. Sonido

- El sonido se pide por familia, nunca por fichero. Cada tipo de cue, cada efecto, cada transición y cada movimiento de cámara tienen familia por defecto.

### IN-R-050 · `warning` · `catalog`

Ningún cue entra en silencio. Silenciarlo con `"sound": false` exige un `soundNote` que lo justifique.

**Por qué:** Todo tipo de cue tiene familia por defecto, así que un cue mudo solo aparece si alguien lo pidió; sin explicación se lee como un fallo de montaje y no como una decisión. Ascendió a catálogo desde el set de shorts.

**Validador:** `cue-not-silent`

## 6. Duración

### IN-R-060 · `warning` · `catalog`

No hay ningún tramo más largo que el que autoriza el perfil sin un cambio visible: corte, cue, efecto o titular.

**Por qué:** El techo de densidad evita el ruido; esta regla evita el fallo contrario, que es el de la mayoría de intros caseras: cuatro segundos de alguien hablando a cámara sin que pase nada. Un movimiento de cámara continuo no cuenta como cambio porque no tiene instante.

**Validador:** `intro-visual-change-cadence`

### IN-R-061 · `warning` · `catalog`

La duración total cae dentro del intervalo que declara el perfil.

**Por qué:** Por debajo del mínimo no hay intro, hay un golpe; por encima del máximo la retención cae porque el espectador ya sabe de qué va el vídeo y todavía no ha empezado.

**Validador:** `intro-duration-budget`

## Ciclo de feedback

```bash
npm run intro:feedback -- --note "el logo tapa mi cara" --section layers --severity error --check intro-face-not-covered
```

El comando registra la corrección, crea la regla con id estable, genera el esqueleto del validador y el fixture que la incumple, y regenera este documento. Una corrección dada una vez queda aplicada para siempre y para cualquier agente.

