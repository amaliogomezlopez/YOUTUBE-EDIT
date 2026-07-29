# Motor de animación editorial — qué se ha implementado y cómo trabajar con él

Fecha: 2026-07-29
Ámbito: `src/modules/editorial-video/visuals/`, `remotion-animations/catalog/`,
`channels/finance-cavaliers/brand/`, `scripts/`, `remotion-animations/src/editorial/`.

Este documento sustituye a `animation-engine-upgrade-plan.md` como referencia de
trabajo. El plan describía qué había que construir; esto describe qué existe,
cómo se usa y **cómo debe proceder un agente** ante un vídeo nuevo.

---

## 0. La idea en una frase

El índice de palabra de la transcripción es la única fuente de verdad temporal.
Todo lo demás —cues, sonido, densidad, cámara— se **deriva** de él, se **mide** y
se **valida** contra reglas con id estable. Nada se degrada en silencio.

```text
CAPA 3  Canal      reglas ejecutables + entidades + tono        channels/<id>/brand/
   ↓
CAPA 2  Director   transcripción → cues → plan → props          src/modules/editorial-video/visuals/
   ↓
CAPA 1  Catálogo   patrones, sonido, efectos, layout            remotion-animations/catalog/
```

Regla de dependencia: la capa 1 no sabe que existe Finance Cavaliers, la capa 2
no contiene contenido de ningún episodio y la capa 3 no contiene componentes
React.

---

## Parte I — Qué se ha implementado

### A. Contratos y anclaje estricto

| Antes | Ahora |
| --- | --- |
| `resolveSemanticCues` devolvía el `atSeconds` escrito a mano si no encontraba el ancla | [`resolveSceneCues`](src/modules/editorial-video/visuals/cue-anchoring.js) lanza `CueAnchorError` nombrando escena, cue y causa |
| Buscaba la primera ocurrencia global | Busca dentro del `wordRange` de la escena y soporta la ocurrencia N |
| No comprobaba que la palabra cayera en la escena | `anchor-outside-scene` con los segundos exactos |
| `atSeconds` era autoritativo | `anchorWordIndex` es la fuente de verdad; `reanchorCues` recalcula tras recortar audio |

`cue.target` dejó de ser `z.string()` libre: cada patrón declara sus
`focusTargets` en [`pattern-bindings.json`](remotion-animations/catalog/animations/pattern-bindings.json)
y un target inventado es error de build (`FC-R-132`). La sintaxis `inicio/fin`
sigue admitida para intervalos verificables, pero exige `focus.divergence-range`.

`cue.sound` pasó de enum de ficheros a `{family, intensity, variantHint?}`. Los
18 alias históricos siguen funcionando y se traducen a familia + variante.

### B. Minería automática de cues

[`cue-mining.js`](src/modules/editorial-video/visuals/cue-mining.js) recorre las
palabras y emite candidatos deterministas para: **números y porcentajes**,
**monedas y magnitudes**, **entidades del dossier**, **fechas y periodos**,
**giros narrativos**, **verbos visualizables** (con su metáfora) y
**comparaciones**. Cada candidato nace con `anchorWordIndex`, tipo, confianza,
prioridad y familia sonora; nunca con un segundo escrito a mano.

[`cue-budget.js`](src/modules/editorial-video/visuals/cue-budget.js) fusiona lo
que cae a menos de 0,25 s, aplica presupuesto de 3 cues por ventana de 4 s
—protegiendo siempre los obligatorios— y exige motivo en cada override manual.
[`buildCueCoverage`](src/modules/editorial-video/visuals/cue-mining.js) escribe
`cue-coverage.json`: qué menciones visualizables tienen cue y cuáles no.

**Resultado medido en el episodio 1:** de 75 cues escritos a mano se pasa a 116
cues, todos anclados a palabra, con **0 incidencias de anclaje**.

### C. Densidad de evento y ritmo

[`event-timeline.js`](src/modules/editorial-video/visuals/event-timeline.js)
construye un timeline unificado (cues + entradas de escena + fases del patrón +
activaciones de asset + rellenos) y lo valida:

- hueco máximo por acto: `hook` 1,4 s · `giro` 1,5 s · `desarrollo` 2,0 s · `cierre` 2,4 s;
- toda escena de más de 4 s exige ≥1 cambio secundario real —la entrada de
  escena no cuenta;
- el silencio visual solo es legítimo si la escena declara `intent: "breath"`.

Los rellenos son **funcionales**, nunca decorativos: `cursor-advance`,
`axis-reveal`, `incremental-count`, `glow-breath`, `purposeful-parallax`. Cada
uno declara función, objetivo y motivo.

**Medido en el episodio 1:** hueco máximo 1,88 s (antes 7,19 s), 72 eventos por
minuto, 0 huecos por encima del umbral.

### D. Sonido: variedad real

| Antes | Ahora |
| --- | --- |
| 18 ficheros | **78** (18 heredados + 60 sintetizados propios) |
| `alert-sting` y `soft-impact` compartían WAV | Familias disjuntas; `FC-R-054` lo impide |
| `cameraDriven` apilaba `quickWhip`+`smoothWhoosh` en casi todo cue | Eliminado. El sonido de cámara se decide por familia y presupuesto |
| Sin cooldown, rotación ni variación | Cooldown por fichero, rotación round-robin sembrada, jitter de tono ±3 % y ganancia ±1,5 dB |
| Sin lecho, sin risers, sin ducking | Lecho continuo por acto, riser antes de cada giro, resolución tras el clímax, ducking −5 dB con recuperación en 180 ms |

El catálogo vive en
[`catalog/sound/sfx.json`](remotion-animations/catalog/sound/sfx.json), generado
desde [`recipes.json`](remotion-animations/catalog/sound/recipes.json) por
`npm run sfx:synthesize` (síntesis local determinista con ffmpeg: sin problemas
de licencia). Diez familias × seis variantes: `interface`, `data`, `camera`,
`tension`, `impact`, `break`, `rewind`, `reveal`, `confirm`, `texture`.

**Medido en el episodio 1:** 179 instancias sonoras sobre **42 ficheros
distintos** y **10 familias**; el fichero más usado concentra el **6,15 %**
(objetivo ≤ 12 %); máximo 3 impactos perceptibles por 8 s; 22 segmentos de lecho
y 152 ventanas de ducking.

El render dejó de decidir sonido: el director entrega `scene.soundPlan` con
fichero, volumen y `playbackRate` ya resueltos, y
[`SceneRegistry`](remotion-animations/src/editorial/SceneRegistry.tsx) lo
reproduce tal cual. Eso hace la mezcla auditable y testeable sin renderizar.

### E. Puente catálogo → render

[`pattern-bindings.json`](remotion-animations/catalog/animations/pattern-bindings.json)
mapea las 34 claves editoriales a `patternId` del catálogo y declara para cada
una: `focusTargets`, `defaultTargets` por tipo de mención, `geometry`,
`emphasis`, `chronology` y efectos obligatorios.
[`pattern-registry.js`](src/modules/editorial-video/visuals/pattern-registry.js)
lo consume para dar destino a los cues minados y para validar los targets.

**Lo que queda pendiente y por qué:** el desmantelamiento de
`MarketNarrativeScene`, `SecondMinuteNarrativeScene` y
`ThirdMinuteNarrativeScene` (ANM-E03) y la implementación de los 13 patrones
`planned` (ANM-E04) **no** se han hecho en esta entrega. Son ~5.240 líneas de
React cuyo reemplazo exige test de regresión visual frame a frame antes de
borrar nada. El puente ya existe, así que ese refactor se puede abordar patrón a
patrón sin bloquear episodios nuevos.

### F. Cámara, foco y layout

Validadores geométricos, no visuales: rango de zoom `1.06–1.28` (`FC-R-030`),
rotación obligatoria de mecanismos de énfasis (`FC-R-131`), solape de cajas
declaradas (`FC-R-070`), conectores que apuntan al centro (`FC-R-071`) y
cronología pasado-izquierda (`FC-R-120`).

### G. Entidades sin hardcode

`COMPANY_LOGO_ASSETS` y `DOTCOM_LOGO_ASSETS` desaparecieron del script de build.
Las entidades viven en
[`entities.json`](channels/finance-cavaliers/brand/entities.json) con nombre,
alias, dominio, etiqueta y asset local.
[`entity-resolver.js`](src/modules/editorial-video/visuals/entity-resolver.js)
las resuelve, alimenta la minería de cues y verifica que **todo asset existe en
disco antes del bundle** (cero red durante el render, `FC-R-110`).

```bash
npm run channel:entities -- --channel finance-cavaliers --verify
```

Para una empresa nueva, `--resolve "Broadcom" --allow-remote` usa Brand Search
API + Logo API, descarga, importa al catálogo gestionado y escribe la entrada.
Sin `--allow-remote` el comando es local y solo informa de qué falta.

### H. Antimonotonía

[`variety-planner.js`](src/modules/editorial-video/visuals/variety-planner.js)
conecta por fin `src/lib/animation-variety.js` al pipeline editorial y aplica una
ventana deslizante de 6 escenas sobre cinco ejes: patrón, geometría, cámara,
paleta y familia sonora. La repetición no se prohíbe: se marca y exige
`varietyException` con motivo.

### I. Reglas ejecutables — el punto que más importa

Las 20 secciones del playbook son ahora **59 reglas** con id estable en
[`editing-rules.json`](channels/finance-cavaliers/brand/editing-rules.json):
**33 con validador automático, 26 marcadas `manual` explícitamente, 0 sin
implementar**.

- `editing-playbook.md` **se genera** desde el JSON (`npm run channel:playbook`).
  Un test falla si se desincronizan. La versión escrita a mano se conserva en
  `editing-playbook.legacy.md`.
- El motor ([`rules-engine.js`](src/modules/editorial-video/visuals/rules-engine.js))
  se ejecuta en cada build y en `npm run episode:plan:validate`.
- Cada regla automática tiene **fixture de regresión** en
  `tests/fixtures/editing-rules/`: un contexto mínimo que la incumple. Si alguien
  relaja un validador, el fixture deja de fallar y el test lo caza.
- Las excepciones aprobadas viven en
  [`rule-exceptions.json`](channels/finance-cavaliers/brand/rule-exceptions.json):
  rebajan una regla a `review` para un episodio o escena concretos, **siempre con
  motivo**. No silencian: la incidencia sigue apareciendo marcada.

### J. QA de episodio

[`episode-qa.js`](src/modules/editorial-video/visuals/episode-qa.js) genera
`episode-qa.json` con: los **tres frames exactos por cue** (antes / palabra /
después) que demuestran la sincronía, el contact sheet por bloque de un minuto,
el histograma sonoro, el veredicto de densidad y la lista de comprobaciones que
siguen siendo humanas.

La comparación de píxeles sobre la región del target (ANM-J03) queda declarada
pero no ejecutada: necesita los frames renderizados. El plan de muestreo ya está
resuelto, que era la parte difícil.

---

## Parte II — Comandos

```bash
npm run sfx:synthesize                # regenera la librería de efectos y su catálogo
npm run channel:playbook              # regenera editing-playbook.md desde el JSON
npm run channel:playbook:check        # falla si el .md está desincronizado
npm run channel:feedback -- --note "…"  # convierte una corrección en regla ejecutable
npm run channel:entities -- --verify  # comprueba que todo asset existe en local
npm run episode:plan:validate -- --plan <visual-plan.json> --words <words.json>
npm run episode:finance-cavaliers:pilot   # build completo con validación integrada
node --test tests/animation-director.test.js tests/editing-rules.test.js
```

Artefactos que deja el build en `<episodio>/visuals/`:

| Fichero | Para qué |
| --- | --- |
| `visual-plan.json` | Contrato director → Remotion |
| `render-props.json` / `render-props-silent.json` | Props de render y variante muda |
| `cue-coverage.json` | Menciones visualizables con y sin cue |
| `rhythm-report.json` | Densidad de evento, huecos, eventos por minuto |
| `sound-report.json` | Histograma de ficheros y familias |
| `variety-report.json` | Matriz de uso por eje |
| `plan-validation.json` | Incidencias con id de regla |
| `episode-qa.json` | Frames a muestrear y comprobaciones humanas |

---

## Parte III — Cómo proceder con un vídeo nuevo

Este es el procedimiento que debe seguir el agente cuando llega un vídeo largo
partido en clips.

### Paso 0 — Leer el contrato antes de tocar nada

**Primera acción, siempre:** leer
`channels/<canal>/brand/editing-rules.json`. No el markdown: el JSON. Es lo que
el motor va a ejecutar. Leer también `rule-exceptions.json` para saber qué está
temporalmente rebajado y por qué.

### Paso 1 — Audio y transcripción por palabras

1. Preparar la narración y compactar pausas (`episode:narration`,
   `episode:narration:tighten`).
2. Exportar la transcripción **por palabras** (`episode:transcript:export`).
3. Comprobar que ninguna pausa accidental supera 1 s (`FC-R-090`).

Si después de esto se vuelve a tocar el audio: **no se desplaza la pista**. Se
reexporta la transcripción y `reanchorCues` recoloca todo desde el índice de
palabra. Esa es la razón de ser del anclaje por índice.

### Paso 2 — Dossier y entidades

1. Registrar las entidades del episodio en `channels/<canal>/brand/entities.json`
   —nombre, alias, dominio, etiqueta— y traer sus logos con
   `npm run channel:entities -- --resolve "<nombre>" --allow-remote`.
2. `npm run channel:entities -- --verify` debe terminar en `ausentes: 0`.

Sin esto, la minería no reconoce las empresas y `FC-R-140` fallará.

### Paso 3 — Segmentación en escenas

Cada escena declara:

```jsonc
{
  "id": "scene-014",
  "componentKey": "sloos-chart",        // del pattern-bindings
  "wordRange": {"startIndex": 412, "endIndex": 468},
  "startSeconds": 128.44,               // derivado del wordRange
  "endSeconds": 141.02,
  "act": "giro",                        // hook | desarrollo | giro | cierre
  "intent": "inform"                    // "breath" solo si el silencio es una decisión
}
```

Las fronteras de escena caen en frontera semántica, no en un segundo redondo.

### Paso 4 — Cues: dejar que los mine el motor

**No escribir cues a mano por defecto.** Ejecutar la minería y revisar
`cue-coverage.json`. Escribir un cue manual solo cuando:

- la mención necesita un rótulo concreto que el motor no puede inventar;
- hace falta cambiar el destino porque el patrón tiene varios objetos válidos;
- el orden narrativo exige mover el cue respecto a su palabra.

En los tres casos, el cue autoral gana sobre el minado en la misma palabra y se
funden. Para suprimir o mover un cue, usar el mecanismo de override **con
motivo**: sin `reason` el build falla.

### Paso 5 — Elegir patrón, no escribir componente

La regla operativa: **una escena nueva se resuelve con el catálogo o el catálogo
crece**. Nunca con un componente de un solo uso.

1. Buscar el patrón en `catalog/animations/patterns.json` por significado.
2. Comprobar su binding en `pattern-bindings.json`: si el objeto que quieres
   enfocar no está en `focusTargets`, **añádelo al binding**; no inventes el
   target en el cue.
3. Si de verdad no hay patrón, se añade uno al catálogo con demo y still de QA.

### Paso 6 — Sonido: pedir familia, nunca fichero

Un cue pide `{family, intensity}`. El director elige la variante respetando
cooldown, uso acumulado y rotación. Si un movimiento no merece sonido, se queda
en silencio: el silencio también es una decisión.

Nunca añadir un whoosh «porque hay un zoom». Eso es exactamente lo que producía
la repetición del episodio 1.

### Paso 7 — Validar antes de renderizar

```bash
npm run episode:plan:validate -- --plan <visual-plan.json> --words <words.json> --qa episode-qa.json
```

Objetivo: **0 errores**. Los warnings se leen uno a uno; los que se aceptan se
registran como excepción con motivo, no se ignoran.

### Paso 8 — Render por bloques y aprobación

Bloques de aproximadamente un minuto, cada uno con render-props, manifiesto,
audio recortado, cinco stills de QA y MP4 independiente. No se empieza el
siguiente bloque sin aprobación. Un bloque aprobado nunca se sobrescribe.

### Paso 9 — Cuando llega feedback: convertirlo en regla

Este es el paso que hace que el sistema mejore en vez de repetir errores.

```bash
npm run channel:feedback -- \
  --note "el conector atraviesa la tarjeta en el diagrama radial" \
  --section spatial-safety --severity error --scope catalog \
  --check connector-crosses-card --rationale "El conector debe nacer en el borde del núcleo sólido"
```

El comando:

1. registra la corrección en `feedback-log.jsonl` con fecha;
2. crea la regla con id estable en `editing-rules.json`;
3. genera el esqueleto del validador en `visuals/checks/<id>.js`;
4. genera el fixture de regresión que la incumple;
5. regenera `editing-playbook.md`.

Después hay que **rellenar el validador y el fixture**. Mientras el validador
devuelva su incidencia `TODO`, la regla no se puede dar por cerrada. Ese es el
ciclo completo: feedback → regla → validador → test.

**Ámbito:** si la corrección vale para cualquier canal, `--scope catalog`. Si es
de marca, `channel`. Una regla `channel` aplicada en dos canales asciende a
`catalog`.

---

## Parte IV — Métricas por episodio

Se generan solas. Estado real del episodio 1 tras esta entrega:

| Métrica | Objetivo | Episodio 1 |
| --- | --- | --- |
| Incidencias de anclaje | 0 | **0** |
| Cues anclados a palabra | 100 % | **100 %** (116/116) |
| Menciones obligatorias con cue | ≥ 95 % | 84,3 % ⚠ |
| Hueco máximo sin evento visible | ≤ 2,0 s | **1,88 s** |
| Eventos por minuto | ≥ 30 | **72,4** |
| Ficheros SFX distintos | ≥ 24 | **42** |
| Uso máximo de un solo fichero | ≤ 12 % | **6,15 %** |
| Familias sonoras usadas | ≥ 8 | **10** |
| Impactos perceptibles por 8 s | ≤ 3 | **3** |
| Reglas con validador o marca `manual` | 100 % | **100 %** (59/59) |
| Errores de validación | 0 | **0** |
| Componentes específicos de episodio | 0 | 3 ⚠ (ANM-E03 pendiente) |

Las dos métricas con ⚠ son deuda conocida y están explicadas arriba: la
cobertura de menciones la limita el presupuesto de 3 cues por ventana de 4 s
—subirlo satura la pantalla—, y los tres componentes por minuto siguen ahí a la
espera del test de regresión visual.

---

## Parte V — Qué NO hacer

- No escribir `atSeconds` a mano. Si aparece un cue sin `anchorWordIndex` ni
  `anchorText`, el build lo rechaza.
- No añadir `kind` nuevos al enum editorial. Se elige patrón del catálogo.
- No pedir un fichero de sonido concreto. Se pide familia.
- No apilar whooshes en los zooms.
- No editar `editing-playbook.md`: se regenera y se pierde el cambio.
- No silenciar una regla borrándola. Se registra excepción con motivo, o se
  cambia la regla explícitamente.
- No imprimir `FUENTE` junto a una foto de stock ni sobre geometría que no sea
  una visualización de datos reales.
- No resolver assets por red durante el render.
