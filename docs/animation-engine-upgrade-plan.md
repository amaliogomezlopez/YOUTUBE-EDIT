# Plan de mejora del motor de animación editorial

> **Estado: implementado en su mayor parte (2026-07-29).** La referencia de
> trabajo pasa a ser
> [`animation-engine-operating-manual.md`](animation-engine-operating-manual.md),
> que documenta qué existe y cómo proceder con un vídeo nuevo. Este documento se
> conserva como registro del diagnóstico y del alcance previsto.
>
> Pendiente explícito: `ANM-E03` (desmantelar los tres componentes por minuto),
> `ANM-E04` (implementar los 13 patrones `planned`) y `ANM-J03` (comparación de
> píxeles sobre frames renderizados; el plan de muestreo ya se genera).

Estado: auditoría + plan de implementación
Fecha: 2026-07-29
Ámbito: `remotion-animations/`, `scripts/build-finance-cavaliers-pilot.js`,
`channels/finance-cavaliers/brand/`, catálogo de animaciones y sonido.

Objetivo del documento: convertir el motor actual —que produce un episodio
concreto muy bien— en un **motor reutilizable** que, a partir de una
transcripción por palabras, genere vídeos con densidad de evento alta
(algo cambia en pantalla cada 1–2 segundos), sonido variado y sincronía
palabra-a-visual, sin que un agente nuevo tenga que reescribir escenas.

---

## Parte I — Diagnóstico

Cada hallazgo está anclado a código real. La severidad mide el impacto sobre
el objetivo declarado: reutilización + densidad + sincronía.

### D1. El motor editorial no es un motor: es el episodio 1 escrito a mano · Crítico

`editorialSceneKindSchema` es un enum cerrado de 35 valores en
[schemas.ts:10](remotion-animations/src/editorial/schemas.ts:10), con nombres
que son literalmente el guion del vídeo 1: `market-xray`, `dominance-facade`,
`history-rewind`, `sloos-chart`, `bubble-trigger`.

Los componentes que los implementan suman ~5.240 líneas:

| Fichero | Líneas |
| --- | --- |
| [SceneRegistry.tsx](remotion-animations/src/editorial/SceneRegistry.tsx) | 1.887 |
| [MarketNarrativeScene.tsx](remotion-animations/src/editorial/MarketNarrativeScene.tsx) | 1.627 |
| [SecondMinuteNarrativeScene.tsx](remotion-animations/src/editorial/SecondMinuteNarrativeScene.tsx) | 1.001 |
| [ThirdMinuteNarrativeScene.tsx](remotion-animations/src/editorial/ThirdMinuteNarrativeScene.tsx) | 725 |

Los tres últimos ficheros están organizados **por minuto de un vídeo
concreto**. Eso no es un catálogo: es una línea de montaje de un solo uso. El
episodio 2 obligará a añadir kinds nuevos al enum, componentes nuevos y ramas
nuevas en el registro.

Peor: existe un catálogo genérico y correcto —43 patrones en
[patterns.json](remotion-animations/catalog/animations/patterns.json) con IDs
como `data.line-trend-zoom`, `process.contagion-spread`,
`time.timeline-milestones`— **y el episodio no lo consume**. No hay puente
`patternId → componente`. El catálogo describe un sistema que el render no usa.

### D2. Los cues no derivan de la transcripción; la desincronía es silenciosa · Crítico

[`resolveSemanticCues`](scripts/build-finance-cavaliers-pilot.js:357) sí ancla
por palabra, pero tiene tres fallos:

1. **Fallback silencioso.** Si `anchorText` no se encuentra
   (`anchorIndex < 0`), devuelve el cue con el `atSeconds` escrito a mano y no
   avisa. Un cambio de locución, un acento distinto o una palabra reconocida
   con otro spelling produce un cue desincronizado que nadie detecta.
2. **Primera ocurrencia global.** Busca el primer match en todo el array de
   palabras de la escena, sin soporte para «la tercera vez que digo *mercado*»
   ni ventana de búsqueda. En escenas que enumeran entidades, esto es una
   bomba.
3. **Sin verificación de rango.** No comprueba que la palabra encontrada caiga
   dentro de `[startSeconds, endSeconds]` de la escena.

Y sobre todo: **no existe extracción automática de cues**. Cada `%`, cada
cifra, cada nombre de empresa del vídeo 1 fue escrito a mano en los
blueprints (líneas 120–330 del script). El vídeo 2 empieza desde cero. El
requisito «cuando digo un porcentaje, sale el porcentaje» hoy lo cumple el
autor, no el sistema.

### D3. La densidad de evento no se mide · Alto

El playbook exige «no mantener el mismo estado focal más de 1,5 segundos»
([editing-playbook.md:14](channels/finance-cavaliers/brand/editing-playbook.md:14))
y «cambio primario + secundarios si dura más de 4 s» (§3). No hay ni un solo
validador que compruebe esto. Es prosa aspiracional. Un episodio con un hueco
de 6 segundos sin nada pasa el `remotion:check` sin problema.

### D4. El sonido es repetitivo por diseño del código, no por descuido · Alto

Inventario real: **18 ficheros** en `remotion-animations/public/sfx/`
(10 propios `amaliometria-*`, 8 `library-*`). Sobre ellos, 18 alias. Y:

- **Colisión de alias.** En
  [SceneRegistry.tsx:1603](remotion-animations/src/editorial/SceneRegistry.tsx:1603),
  `"alert-sting"` mapea a `SOUND_FILES.softImpact` — el mismo fichero que
  `"soft-impact"`. Dos nombres semánticos, un sonido. El giro narrativo y el
  dato de cierre suenan igual.
- **Apilado automático masivo.** La rama `cameraDriven` añade
  `quickWhip` + `smoothWhoosh` a **todo** cue con acción
  `connect|focus|highlight|zoom|verify` — es decir, a la gran mayoría. El mismo
  par de whooshes se repite decenas de veces por episodio. Es exactamente lo
  que el propio playbook §18 prohíbe: «No se apila automáticamente el mismo
  whoosh en todos los zooms».
- **Sin memoria de repetición.** No hay cooldown por fichero, ni rotación
  dentro de una familia, ni variación de pitch/ganancia. El mismo WAV, al mismo
  volumen, decenas de veces.
- **Sin capa continua.** Solo hay cues puntuales: no hay lecho tonal por acto,
  ni risers antes de un giro, ni room tone. Los silencios son huecos, no
  decisiones.
- **Sin ducking.** `masterVolume` es constante; la locución no se separa
  dinámicamente de los impactos.

### D5. Las reglas de feedback del usuario no son ejecutables · Alto

[editing-playbook.md](channels/finance-cavaliers/brand/editing-playbook.md)
tiene 302 líneas y 20 secciones de reglas excelentes, todas nacidas de
correcciones reales (conectores que atraviesan tarjetas, contagio con caja
global, divergencia temporal, cronología pasado-izquierda…). Pero:

- ninguna tiene identificador estable;
- ninguna tiene un test que falle si se viola;
- ninguna distingue «regla del canal» de «regla universal del catálogo».

Un agente nuevo puede leerlas, olvidarlas a mitad de episodio, y nada se
rompe. Este es precisamente el problema que el usuario quiere resolver: que un
feedback dado una vez se aplique siempre y por cualquier agente.

### D6. El catálogo promete lo que no existe · Medio

De los 50 items en
[capabilities.manifest.json](remotion-animations/catalog/capabilities.manifest.json):
**37 `ready`, 13 `planned`**. Y los `planned` son justo los que aportan
variedad: `overlay.precision-callout`, `text.kinetic-phrase`, `data.waterfall`,
`time.cycle`, `comparison.image-logo-versus`, `concept.compression`,
`data.histogram-distribution`, `process.bottleneck-queue`,
`asset.logo-ecosystem`. Un selector que solo puede elegir `ready` está limitado
a la mitad del vocabulario declarado.

Además el manifest **no expone los 35 `sceneKind` editoriales**, así que el
selector semántico no puede razonar sobre lo que el episodio realmente usa.

### D7. La variedad no está forzada · Medio

Existe [`src/lib/animation-variety.js`](src/lib/animation-variety.js), pero el
único consumidor es `src/lib/chart-ingestion.js`. **El pipeline editorial no lo
usa.** La regla «no repetir el patrón dominante más de dos veces en seis
escenas» (playbook §3) no se aplica en ningún punto del build.

### D8. La seguridad de layout es correcta pero opcional · Medio

[layoutSafety.ts](remotion-animations/src/editorial/layoutSafety.ts) implementa
bien `resolveSafeOverlayRect` y `connectorEndpointAtRect`. El problema es que
solo actúa donde el autor se acordó de llamarlas, sobre cajas que el autor
declaró a mano, y no hay QA que verifique colisiones en los frames de entrada,
pico y salida —justo lo que el playbook §13 exige revisar.

### D9. Los targets de cámara no están validados · Medio

`semanticCue.target` es `z.string()` libre
([schemas.ts:76](remotion-animations/src/editorial/schemas.ts:76)). Nada
garantiza que `'divergence-gap'` exista en la escena que lo recibe. Un typo
produce un zoom a ninguna parte, y el schema lo acepta.

### D10. Las entidades y sus logos están hardcodeados · Medio

`COMPANY_LOGO_ASSETS` y `DOTCOM_LOGO_ASSETS` son constantes literales al inicio
del script de build (líneas 30–90). El flujo Brand Search API → Logo API →
importación al catálogo gestionado, descrito en el playbook §12, no está
automatizado como resolución por entidad. El vídeo 2, con otras empresas,
requiere edición de código.

### D11. Los tiempos viven en segundos, no en índices de palabra · Medio

Toda la cadena (`atSeconds`, `startSeconds`, `endSeconds`) es temporal
absoluta. El playbook §10 obliga a recalcular todo tras compactar pausas, pero
la estructura de datos no lo facilita: nada ata un cue a su palabra de origen
después del build. Cualquier reedición de audio invalida el episodio entero de
forma manual.

---

## Parte II — Arquitectura objetivo

Tres capas, con una regla de dependencia estricta.

```text
CAPA 3  Canal          reglas de marca ejecutables + assets + tono
   ↓
CAPA 2  Director       transcripción → cues → plan visual → props
   ↓
CAPA 1  Catálogo       patrones, efectos, cámara, sonido, layout
```

- La capa 1 **no sabe** que existe Finance Cavaliers.
- La capa 2 **no contiene** contenido: solo reglas de traducción.
- La capa 3 **no contiene** componentes React: solo configuración y datos.

Y una regla operativa: **una escena nueva se resuelve con el catálogo o el
catálogo crece**. Nunca con un componente de un solo uso.

### Modelo de escena objetivo

Sustituir `kind: enum` por composición declarativa:

```jsonc
{
  "id": "scene-014",
  "patternId": "data.line-trend-zoom",     // del catálogo, validado
  "wordRange": [412, 468],                  // fuente de verdad temporal
  "startSeconds": 128.44,                   // derivado, no autoritativo
  "endSeconds": 141.02,
  "artDirection": "market-data",
  "props": { /* validado por el schema Zod del patrón */ },
  "focusTargets": ["spy-line", "relative-line", "divergence-gap"],
  "cues": [ /* ver abajo */ ],
  "soundPlan": { "bed": "tension-low", "familyBudget": 4 }
}
```

Y el cue:

```jsonc
{
  "id": "twenty-percent",
  "anchorWordIndex": 431,                   // ← fuente de verdad
  "anchorText": "20",
  "anchorOccurrence": 1,
  "offsetSeconds": 0.08,
  "atSeconds": 133.91,                      // derivado
  "kind": "number",                         // number|entity|date|turn|verb|comparison
  "action": "zoom",
  "target": "divergence-gap",               // ∈ focusTargets, validado
  "tone": "negative",
  "sound": { "family": "metric-impact", "intensity": 0.7 }
}
```

Diferencias clave: el índice de palabra manda, el sonido se pide por
**familia** (no por fichero), y el target se valida contra lo que el patrón
declara.

---

## Parte III — Plan de implementación

Once bloques. Cada uno termina con tests y un commit propio. Los IDs `ANM-*`
son para trazar feedback futuro.

### Fase A — Contratos y validación (base de todo)

- [ ] `ANM-A01` Añadir `anchorWordIndex`, `anchorOccurrence` y `offsetSeconds`
      al `semanticCueSchema`; marcar `atSeconds` como campo derivado.
- [ ] `ANM-A02` Hacer que `resolveSemanticCues` **falle** (no degrade) cuando
      un `anchorText` no aparezca en el rango de palabras de la escena.
- [ ] `ANM-A03` Restringir la búsqueda de anclas a `wordRange` de la escena y
      soportar la ocurrencia N.
- [ ] `ANM-A04` Que cada patrón declare sus `focusTargets` y validar
      `cue.target ∈ focusTargets` en build time.
- [ ] `ANM-A05` Sustituir `sound: enum<alias>` por
      `sound: {family, intensity, variantHint?}`.
- [ ] `ANM-A06` Escribir `schemas/visual-plan.schema.json` como contrato
      público del director → Remotion.
- [ ] `ANM-A07` Comando `npm run episode:plan:validate` que verifique el plan
      completo antes de bundlear.

**Aceptación:** un plan con un ancla inexistente, un target inventado o un
patrón desconocido falla con un mensaje que nombra escena, cue y causa. Cero
degradaciones silenciosas.

### Fase B — Extracción automática de cues desde la transcripción

El corazón del requisito «cuando yo digo algo, pasa algo».

- [ ] `ANM-B01` `src/modules/editorial-video/visuals/cue-mining.js`: recorre las
      palabras y emite cues candidatos deterministas para:
      - **números y porcentajes** (`20 %`, `1,4 billones`, `−12 %`);
      - **monedas y magnitudes** (`$`, `€`, `millones`, `puntos básicos`);
      - **entidades** del dossier (empresas, personas, instituciones, países);
      - **fechas y periodos** (`2008`, `finales de los 90`, `últimos meses`);
      - **giros narrativos** (`sin embargo`, `pero`, `atención`, `el problema`);
      - **verbos visualizables** (`estalla`, `arrastra`, `rebobinar`,
        `se separan`, `cae`) → metáfora literal, playbook §17;
      - **comparaciones** (`frente a`, `mientras que`, `el doble`).
- [ ] `ANM-B02` Cada cue candidato nace con `anchorWordIndex`, tipo, confianza
      y prioridad; nunca con un segundo escrito a mano.
- [ ] `ANM-B03` Reglas de obligatoriedad configurables por canal: un número
      narrado **debe** tener cue visible; una entidad narrada **debe** activar
      su tarjeta o logo. Si no lo tiene, el plan no valida.
- [ ] `ANM-B04` Deduplicación y presupuesto: fusionar cues a menos de 0,25 s y
      limitar a N cues por ventana de 4 s para no saturar.
- [ ] `ANM-B05` Capa de override manual: el agente puede añadir, mover o
      suprimir cues, y el override queda registrado con motivo.
- [ ] `ANM-B06` Informe `cue-coverage.json`: qué menciones visualizables tienen
      cue y cuáles no.

**Aceptación:** dado un transcript por palabras y un dossier, el sistema
produce sin intervención humana ≥90 % de los cues que hoy están escritos a
mano en el blueprint del episodio 1, con desviación ≤120 ms.

### Fase C — Densidad de evento y ritmo

- [ ] `ANM-C01` Construir un **timeline de eventos** unificado: cues + entradas
      de escena + fases del patrón (`entry/build/focus/hold/exit`) +
      transiciones + activaciones de asset.
- [ ] `ANM-C02` Validador `event-density`:
      - hueco máximo sin evento visible: **2,0 s** (aviso a 1,6 s);
      - toda escena > 4 s exige ≥1 cambio secundario;
      - máximo 3 impactos sonoros perceptibles en 8 s (playbook §6);
      - silencio visual permitido solo si está **declarado** como
        `intent: "breath"`.
- [ ] `ANM-C03` Generador de **eventos de relleno** con función: micro-parallax
      con propósito, avance de cursor sobre serie, conteo incremental,
      revelado de eje, respiración de glow. Nunca movimiento decorativo puro.
- [ ] `ANM-C04` Perfiles de ritmo por acto (`hook`, `desarrollo`, `giro`,
      `cierre`) que ajusten la densidad objetivo en vez de aplicar una
      constante a todo el vídeo.
- [ ] `ANM-C05` Informe `rhythm-report.json` + visualización de la pista de
      eventos para revisión humana.

**Aceptación:** el informe de un episodio muestra el hueco máximo real y falla
el build si supera el umbral del canal.

### Fase D — Sistema de sonido: variedad real

- [ ] `ANM-D01` Crear `catalog/sound/sfx.json`: familias declaradas
      (`interface`, `data`, `camera`, `tension`, `impact`, `break`, `rewind`,
      `reveal`, `confirm`, `texture`), con **mínimo 4 variantes por familia**.
- [ ] `ANM-D02` Ampliar la librería de 18 a **≥60 archivos**, sintetizando
      variantes propias `amaliometria-*` (prioridad: es la vía limpia en
      licencias) y verificando licencia antes de publicar cualquier
      `library-*`.
- [ ] `ANM-D03` **Eliminar la colisión `alert-sting` → `softImpact`.** Cada
      alias semántico necesita material propio.
- [ ] `ANM-D04` **Suprimir el apilado automático `cameraDriven`.** El sonido de
      cámara se decide por familia y presupuesto, no por acción.
- [ ] `ANM-D05` Selector con memoria: cooldown por fichero (no repetir el mismo
      WAV en < 12 s), rotación round-robin dentro de la familia, y semilla
      determinista por episodio para que el render sea reproducible.
- [ ] `ANM-D06` Variación tímbrica determinista: jitter de pitch ±3 % y de
      ganancia ±1,5 dB por instancia.
- [ ] `ANM-D07` **Capa de lecho**: tono/textura continua por acto, con
      transiciones en fronteras narrativas. Nunca silencio total salvo pausa
      declarada.
- [ ] `ANM-D08` **Risers y resoluciones**: riser antes de un giro detectado por
      `ANM-B01`, resolución tras el clímax.
- [ ] `ANM-D09` **Ducking real** de la capa SFX contra la locución (−4 a −6 dB
      durante palabras, recuperación en 180 ms).
- [ ] `ANM-D10` Validador `sound-variety`: falla si un fichero supera el X % de
      las instancias del episodio, o si tres escenas consecutivas usan la misma
      secuencia de familias.
- [ ] `ANM-D11` Render de variante silenciosa obligatorio (ya exigido por
      `soundDesignPolicy`, hoy no verificado).

**Aceptación:** en un episodio de 10 minutos, ningún fichero supera el 12 % de
las instancias sonoras y se usan ≥8 familias distintas.

### Fase E — Puente catálogo → render (romper D1)

- [ ] `ANM-E01` Registro `patternId → componente` con props tipadas, sustituto
      de la resolución por `kind`.
- [ ] `ANM-E02` Migrar los 35 `sceneKind` a patrones del catálogo. La mayoría
      son casos particulares de patrones ya existentes: `market-xray` →
      `data.line-trend-zoom` + `focus.depth-isolation`; `history-rewind` →
      `time.timeline-milestones` + `camera.path-track`;
      `contagion-spread` → `process.contagion-spread` (ya declarado).
- [ ] `ANM-E03` Desmantelar `MarketNarrativeScene`, `SecondMinuteNarrativeScene`
      y `ThirdMinuteNarrativeScene`: extraer sus mecánicas útiles a efectos y
      patrones parametrizados; borrar lo que sea contenido del episodio 1.
- [ ] `ANM-E04` Implementar los 13 patrones `planned`, priorizando
      `overlay.precision-callout`, `text.kinetic-phrase`, `data.waterfall`,
      `asset.logo-ecosystem` y `comparison.image-logo-versus`.
- [ ] `ANM-E05` Registrar los patrones editoriales en
      `capabilities.manifest.json` para que el selector los vea.
- [ ] `ANM-E06` Demo + still de QA obligatorio por patrón; un patrón sin demo
      no puede ser `ready`.

**Aceptación:** el episodio 1 se re-renderiza **idéntico** consumiendo solo
patrones del catálogo, y el enum `editorialSceneKindSchema` desaparece.

### Fase F — Cámara, foco y anotación

- [ ] `ANM-F01` Contrato de cámara por escena: origen semántico declarado,
      rango de zoom `1.06–1.18` (máx `1.28`), retorno suave garantizado.
- [ ] `ANM-F02` Validar que un zoom no recorte títulos, ejes, fuentes ni
      etiquetas: comprobación geométrica, no visual.
- [ ] `ANM-F03` Rotación obligatoria de mecanismos de énfasis (zoom /
      aislamiento por color / subrayado / escala / desaturación de pares) para
      que el zoom no se vuelva un tic.
- [ ] `ANM-F04` `focus.divergence-range` aplicado a todo intervalo narrado
      (playbook §20), no solo al caso del episodio 1.
- [ ] `ANM-F05` Gestor de carriles (lane manager) que asigne tarjetas y
      etiquetas a slots reservados desde el diseño, con
      `resolveSafeOverlayRect` como resolución y no como parche.
- [ ] `ANM-F06` QA de colisión en tres frames por cue (antes / palabra /
      después) y en el frame de máximo desplazamiento.

**Aceptación:** cero solapes detectados sobre las cajas declaradas; cero
conectores que crucen el interior de su destino.

### Fase G — Entidades y assets automáticos

- [ ] `ANM-G01` Resolutor de entidad: nombre → dominio → logo, vía Brand Search
      API + Logo API, cacheado en el catálogo gestionado con autor, licencia,
      URL, dimensiones y hash.
- [ ] `ANM-G02` Eliminar `COMPANY_LOGO_ASSETS` / `DOTCOM_LOGO_ASSETS`
      hardcodeados del script de build.
- [ ] `ANM-G03` Selección de imagen de apoyo (Pexels/Pixabay intercalados)
      guiada por el concepto de la escena, con importación previa al render.
- [ ] `ANM-G04` Regla dura verificada: una foto de stock **nunca** lleva rótulo
      `FUENTE` (playbook §16).
- [ ] `ANM-G05` Precarga y verificación de existencia local de todo asset antes
      del bundle. Cero red durante el render.

**Aceptación:** un episodio nuevo con empresas distintas obtiene logos y
fotografías sin tocar código.

### Fase H — Variedad y anti-monotonía

- [ ] `ANM-H01` Conectar `src/lib/animation-variety.js` al planificador
      editorial (hoy solo lo usa `chart-ingestion.js`).
- [ ] `ANM-H02` Ventana deslizante de 6 escenas sobre cinco ejes: patrón,
      geometría dominante, dirección de cámara, paleta y familia sonora.
- [ ] `ANM-H03` Penalizar repetición en la selección, no prohibirla: si el
      contenido exige el mismo patrón, permitirlo pero exigir variación de
      encuadre o de mecanismo de énfasis.
- [ ] `ANM-H04` Informe `variety-report.json` con la matriz de uso.

**Aceptación:** ningún patrón domina más de 2 de 6 escenas consecutivas sin
justificación registrada.

### Fase I — Reglas de canal ejecutables (romper D5)

Esta fase es la que responde directamente a «quiero que mi feedback se aplique
siempre, por cualquier agente».

- [ ] `ANM-I01` Crear `channels/<canal>/brand/editing-rules.json`: cada regla
      con `id` (`FC-R-001`…), enunciado, ámbito (`channel` | `catalog`),
      severidad (`error` | `warning` | `review`), y `check` (id del validador
      automático o `manual`).
- [ ] `ANM-I02` Migrar las 20 secciones del playbook actual a reglas
      identificadas. Generar el `.md` legible **desde** el JSON, para que la
      prosa nunca se desincronice del contrato.
- [ ] `ANM-I03` Motor de reglas ejecutado en `episode:plan:validate` y en QA de
      frames.
- [ ] `ANM-I04` **Intake de feedback**: `npm run channel:feedback -- --note "…"`
      que registra la corrección, propone si es regla de canal o de catálogo,
      crea el esqueleto del validador y un fixture que la viole.
- [ ] `ANM-I05` Fixture de regresión por regla: un plan mínimo que la
      incumple; el test verifica que el motor la detecta.
- [ ] `ANM-I06` Promoción: una regla `channel` aplicada en dos canales asciende
      a `catalog` y se documenta en el manifest.

**Aceptación:** cada regla del playbook tiene id, validador (o marca explícita
`manual`) y test. Un agente que la viole recibe un error con el id de la regla.

### Fase J — QA de episodio

- [ ] `ANM-J01` Ampliar `remotion-visual-qa.js` con: densidad de evento, huecos
      de foco, contraste de texto sobre geometría, recortes, solapes, longitud
      de rótulo y presencia de `FUENTE` indebida.
- [ ] `ANM-J02` QA sonoro: histograma de ficheros, familias, impactos por
      ventana de 8 s, headroom de mezcla y verificación de ducking.
- [ ] `ANM-J03` QA de sincronía: para cada cue, muestrear el frame de la
      palabra ±0,2 s y verificar que hubo cambio de píxel significativo en la
      región del target.
- [ ] `ANM-J04` Contact sheet por bloque + pista de eventos superpuesta.
- [ ] `ANM-J05` Invalidación de QA ante cualquier cambio de plan, props, audio
      o assets.

**Aceptación:** el QA distingue «vídeo correcto» de «vídeo aprobable», y el
bloqueo del render final depende de él.

### Fase K — Documentación y handoff a agentes

- [ ] `ANM-K01` Actualizar `capabilities.manifest.json` con familias sonoras,
      validadores y reglas.
- [ ] `ANM-K02` Reescribir `PROMPT_PARA_AGENTES.md` alrededor del nuevo
      contrato: patrón + cues + reglas, no componentes a medida.
- [ ] `ANM-K03` Actualizar `AGENTS.md` y la skill de producción para que la
      primera acción de un agente sea leer `editing-rules.json`.
- [ ] `ANM-K04` Documentar el ciclo: feedback → regla → validador → test.

---

## Parte IV — Orden recomendado

El orden importa: las fases posteriores dependen de contratos anteriores.

| Orden | Fases | Por qué |
| --- | --- | --- |
| 1 | A, B | Sin anclaje estricto y minería de cues, todo lo demás sigue siendo artesanal. |
| 2 | D, C | Sonido y densidad son el salto de calidad percibida más grande por unidad de esfuerzo. |
| 3 | I | Congela el feedback acumulado antes de refactorizar y perderlo. |
| 4 | E, F | Refactor mayor; se hace con las reglas ya ejecutables como red de seguridad. |
| 5 | G, H, J, K | Escalado a episodios siguientes. |

**Primer encargo concreto sugerido:** fases A + B + D01–D06. Es autocontenido,
no rompe el episodio 1, y ataca los tres fallos críticos: desincronía
silenciosa, cues manuales y repetición sonora.

## Parte V — Métricas de éxito

Medibles por episodio, generadas automáticamente:

| Métrica | Objetivo |
| --- | --- |
| Menciones visualizables con cue | ≥ 95 % |
| Desviación cue ↔ palabra | ≤ 120 ms (p95) |
| Hueco máximo sin evento visible | ≤ 2,0 s |
| Ficheros SFX distintos por episodio | ≥ 24 |
| Uso máximo de un solo fichero SFX | ≤ 12 % de instancias |
| Familias sonoras usadas | ≥ 8 |
| Patrones distintos por episodio | ≥ 12 |
| Repetición de patrón en ventana de 6 | ≤ 2 |
| Solapes de layout detectados | 0 |
| Componentes específicos de episodio | 0 |
| Reglas del playbook con validador | 100 % (o `manual` explícito) |

## Parte VI — Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El refactor de la Fase E rompe el episodio 1 | Test de regresión visual: mismo props → mismos stills antes de borrar nada |
| Densidad forzada produce ruido visual | Los eventos de relleno exigen función semántica declarada; `breath` es un intent legítimo |
| Sintetizar 40+ SFX nuevos es costoso | Generar por familia con variaciones paramétricas; priorizar las 4 familias más usadas |
| Minería de cues genera falsos positivos | Presupuesto por ventana + override manual registrado + informe de cobertura revisable |
| Las reglas ejecutables se vuelven rígidas | Severidad `warning` y `review` además de `error`; el humano puede aprobar excepciones registradas |
