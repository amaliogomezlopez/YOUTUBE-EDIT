# Lenguaje de montaje — Shorts desde cero

<!-- GENERADO por scripts/render-editing-playbook.js desde
     src/modules/shorts-studio/rules/shorts-rules.json.
     No editar a mano: los cambios se pierden en la siguiente generación. -->

Este contrato convierte cada corrección del montaje vertical en una regla ejecutable. El validador recibe `short-build.json`, así que mide el montaje resuelto en frames, no las intenciones del plan. `docs/shorts-playbook.md` se genera desde este fichero: nunca se edita a mano.

## Cómo leer este documento

| Severidad | Efecto |
| --- | --- |
| `error` | Bloquea `shorts:build`. El short no se compila. |
| `warning` | No bloquea, pero aparece en el informe del build y exige justificación. |
| `review` | Requiere mirada humana; no hay comprobación geométrica posible. |

| Ámbito | Significado |
| --- | --- |
| `catalog` | Regla universal del formato vertical: aplica a cualquier short. |
| `channel` | Regla de marca del canal que publica los shorts. |

Reglas: **9** · con validador automático: **9** · marcadas `manual`: **0** · sin implementar: **0**.

Una regla nacida de un short concreto que se aplica en dos proyectos asciende a `catalog`. Las reglas de este set se registran con `npm run shorts:feedback`, que crea regla, validador y fixture de una sola vez.

## 1. Slots y ocupación

- Slots disponibles: `stage-full`, `stage-left`, `stage-right`, `stage-header`, `stage-footer`, `stage-badge`, `podium-1..3`, `podium-3-verdict`, `overlay-top`, `overlay-center`.

### SH-R-010 · `error` · `catalog`

Dos cues no pueden ocupar el mismo slot a la vez. Los chips son la excepción: `stage-footer` los maqueta en fila a propósito.

**Por qué:** Dos cues solapados se dibujan uno encima del otro y no se ve en el JSON: solo aparece al renderizar. Es el fallo más fácil de introducir al alargar un holdSeconds.

**Validador:** `shorts-slot-overlap`

### SH-R-011 · `error` · `catalog`

Dos cues activos a la vez no pueden tener rectangulos que se solapen, aunque esten en slots distintos. Los chips son la excepcion: stage-footer los maqueta en fila a proposito.

**Por qué:** SH-R-010 solo caza dos cues en el mismo slot; el solape del podio con su veredicto era geometrico y solo se veia al renderizar (frame 1780 de harness-vs-modelo).

**Validador:** `shorts-cue-rect-overlap`

## 2. Legibilidad de imágenes

- Presentaciones: `card` (tarjeta oscura, por defecto), `plate` (placa clara), `plain` (sin marco) y `blend` (suma con `screen`).
- El build mide el arte de cada asset una vez y deja el resultado en `cue.art`; las reglas de presentación leen esa medida, no el nombre del fichero.

### SH-R-020 · `error` · `catalog`

Una captura de pantalla con texto exige layout `stage`. En `split` el escenario mide 540 px de alto y el texto no se lee; una captura sin texto se declara con `"dense": false`.

**Por qué:** En `stage` la captura ocupa 952x760 px y el tuit se lee; en `split` entra a la mitad de escala y solo se ve que hay un tuit. Si la escena empieza con la cara, se parte en dos con trims contiguos y el audio sigue continuo.

**Validador:** `shorts-dense-capture-needs-stage`

### SH-R-021 · `error` · `catalog`

Un logo cuyo arte es oscuro sobre alfa necesita `presentation: "plate"`.

**Por qué:** Sobre la tarjeta oscura de `card` el trazo negro desaparece y queda un marco vacío. Pasó con el logo de Hermes en harness-vs-modelo.

**Validador:** `shorts-dark-art-needs-plate`

### SH-R-022 · `error` · `catalog`

Un logo o un wordmark con fondo negro sólido necesita `presentation: "blend"`.

**Por qué:** Un wordmark exportado sin alfa arrastra su rectángulo negro: dentro de la tarjeta se ve el escalón y sobre el vídeo, un parche. `blend` suma con `screen` y el negro desaparece. Pasó con el wordmark de Claude Code y con el logo de Kimi.

**Validador:** `shorts-solid-background-needs-blend`

## 3. Información en pantalla

### SH-R-030 · `warning` · `catalog`

El texto en pantalla añade información. Un chip o una cifra cuyas palabras ya están todas en la locución de su propia ventana sobra.

**Por qué:** En la escena de resultados había tres chips TIEMPO / TOKENS / PRECIO mientras la locución decía «en cuanto a tiempo, tokens y precio»: ocupaban el sitio del dato sin añadir nada que el subtítulo no dijera. Un rótulo que fija una entidad sobre la imagen sí aporta, y por eso la regla no mide `label` ni `logo`.

**Validador:** `shorts-onscreen-text-adds-information`

## 4. Zona segura

- La geometría vive en `remotion-animations/src/shorts/geometry.json` y la comparten el renderer y el validador.

### SH-R-040 · `error` · `catalog`

Nada informativo baja de y = 1748: ni el rectángulo de un slot ni el ancla del bloque de subtítulos.

**Por qué:** La interfaz de Shorts y Reels dibuja ahí título, avatar y botones. El texto queda tapado en el reproductor real aunque en el MP4 se lea perfectamente, así que el render no delata el fallo.

**Validador:** `shorts-safe-area-bottom`

## 5. Sonido

- El sonido se pide por familia, nunca por fichero. Cada tipo de cue, cada transición y cada movimiento de cámara tienen familia por defecto.

### SH-R-050 · `warning` · `catalog`

Ningún cue entra en silencio. Silenciarlo con `"sound": false` exige un `soundNote` que lo justifique.

**Por qué:** Todo tipo de cue tiene familia por defecto, así que un cue mudo solo aparece si alguien lo pidió; sin explicación se lee como un fallo de montaje y no como una decisión.

**Validador:** `shorts-cue-not-silent`

## 6. Ritmo y silencios

### SH-R-060 · `warning` · `catalog`

Una escena no deja más silencio en sus extremos que el margen configurado (`silencePaddingSeconds`) más un cuarto de segundo.

**Por qué:** El recorte automático ya deja ese aire; el exceso solo aparece cuando el plan declara un extremo a mano. En un short de 30 s, dos segundos mirando a alguien que no habla son el 7 % del tiempo.

**Validador:** `shorts-scene-edge-silence`

## Ciclo de feedback

```bash
npm run shorts:feedback -- --note "la captura no se lee en split" --section legibility --severity error --check shorts-dense-capture-needs-stage
```

El comando registra la corrección, crea la regla con id estable, genera el esqueleto del validador y el fixture que la incumple, y regenera este documento. Una corrección dada una vez queda aplicada para siempre y para cualquier agente.

