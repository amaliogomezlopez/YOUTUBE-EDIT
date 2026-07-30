# Prompt — siguiente fase del generador de shorts

Prompt autocontenido para implementar lo que falta del componente de shorts desde
cero. Pensado para pegarse en una sesión nueva.

---

## Rol

Eres un agente de ingeniería en `D:\2-YOUTUBE-EDIT` (Shortsmith), una herramienta
local de producción de vídeo para YouTube/Shorts/Reels/TikTok. Trabajas con
autonomía responsable: lees el código antes de cambiarlo, respetas el estilo Node.js
existente, **no duplicas pipelines que ya existen**, ejecutas los tests y documentas.

Lee primero `AGENTS.md` y `docs/shorts-desde-cero.md`. Todo el trabajo va en español
en comentarios, documentación y mensajes de commit.

## Contexto

Existe un componente para montar Shorts verticales **desde cero**, a partir de
varios clips grabados a propósito más imágenes de apoyo. Es un pipeline distinto del
de vídeo largo → short (`src/lib/pipeline.js`, FFmpeg) y del motor editorial 16:9.
Se implementó en los commits `64356c3` y `a503823`.

Piezas actuales:

```text
src/modules/shorts-studio/          ingest.js, build.js, captions.js, sound.js,
                                    face-tracking.js, constants.js
scripts/shorts-ingest.js            npm run shorts:ingest
scripts/shorts-build.js             npm run shorts:build
remotion-animations/src/shorts/     ShortVideo, ClipStage, CueLayer, CaptionTrack,
                                    layout.ts, schemas.ts
remotion-animations/projects/shorts-<slug>/
  manifest.json                     derivado de la ingesta
  transcripts/NN.json               segments + words con tiempos
  short-plan.json                   plan editorial, escrito a mano
  short-build.json                  derivado; lo consume Remotion
remotion-animations/public/projects/shorts/<slug>/clips|assets   (ignorado por git)
tests/shorts-studio.test.js         22 tests
```

Flujo actual, ya funcionando:

```bash
npm run shorts:ingest -- --source "<carpeta con clips>" --slug <slug>
```

```bash
npm run shorts:build -- --slug <slug>
```

Hay un proyecto real de referencia, ya montado y renderizado, con el que puedes
probar todo: **`harness-vs-modelo`** (5 escenas, 33,7 s, 4 clips + 6 imágenes).

Reglas duras del flujo, ya implementadas y que debes respetar:

- El índice de palabra de la transcripción es el ancla temporal (`atWord`).
  `atSeconds` solo se acepta si el clip no tiene transcripción.
- El sonido se pide por familia, nunca por fichero.
- Dos cues no comparten slot a la vez; el build lo valida y falla.
- El texto en pantalla añade información; no repite la locución.
- Una captura de texto denso exige layout `stage`, no `split`.
- Nada informativo por debajo de `y = 1748`: ahí dibuja su interfaz Shorts.
- `trim` es opcional; sus extremos se deducen de la primera y última palabra
  dejando 0,5 s de aire. Un extremo declarado en el plan manda siempre.

## Lo que falta — tres tareas

### Tarea 1 — Metadata de publicación

El short se genera pero acaba como un MP4 en `data/output/`, sin metadata y sin
enganchar a los publishers que ya existen. Hoy hay que pedir los títulos y hashtags
a mano, y eso ya está automatizado en el repo.

Reutiliza `generatePublishingMetadata(captions, options)` de
`src/lib/publishing.js` (verifica su firma antes de usarla). Recibe captions con
`{start, end, text}`, que es exactamente la forma de `segments` en
`transcripts/NN.json`. Con LLM configurado devuelve 10 títulos por plataforma;
sin él usa fallback local y deja un warning.

Debe producir `publishing-metadata.json` con el contrato de `AGENTS.md`:
`summary.short`, `summary.medium`, `summary.youtube_description`, títulos por
plataforma, **exactamente 14 hashtags en una sola línea**, `timestamps` (primero
`00:00`) y `platform_posts` para `youtube`, `youtube_shorts`, `instagram`, `tiktok`
y `x`.

Consideraciones:

- La transcripción a usar es la del short **montado**, no la de los clips crudos:
  hay que concatenar los tramos según los `trim` de las escenas y rebasar los
  tiempos al tiempo global del short, o el resultado describirá audio que se
  recortó. `short-build.json` tiene `from`, `trimStartSeconds`, `trimEndSeconds` y
  `durationInFrames` por escena.
- No inventes datos que no estén en la transcripción y no uses clickbait falso.
- Mira `buildClipPublishing` y `postForPlatform` en el mismo módulo antes de
  escribir lógica nueva.

### Tarea 2 — Cerrar el ciclo de comandos

Dos fricciones:

1. **No hay `shorts:render`.** Hay que escribir el comando de `npx remotion render`
   a mano. Añade el script, siguiendo el patrón de los `render:*` de
   `remotion-animations/package.json` y de `scripts/render-safe.mjs`, que gestiona
   directorios de ejecución.
2. **Cada proyecto nuevo exige editar código.** Hay un `import` y una entrada en
   `shortBuilds` a mano en `remotion-animations/src/Root.tsx:98`. Debe registrarse
   automáticamente recorriendo `remotion-animations/projects/shorts-*/short-build.json`.

   **Restricción real:** el `Root.tsx` lo empaqueta el bundler, así que un glob en
   tiempo de ejecución no sirve. La vía limpia es que `shorts:build` genere un
   fichero de registro (por ejemplo `src/shorts/registry.generated.ts`) que el Root
   importe. Decide tú, pero verifica que `npx remotion compositions src/index.ts`
   sigue listando las composiciones.

Al terminar, el ciclo debe ser: `shorts:ingest` → editar `short-plan.json` →
`shorts:build` → `shorts:render`, sin tocar código.

**Importante:** tras añadir o quitar composiciones hay que regenerar el manifest o
`npm test` falla:

```bash
npm run remotion:capabilities
```

### Tarea 3 — Bucle de feedback → regla reutilizable (la que más importa)

El motor editorial convierte cada corrección del usuario en una regla ejecutable, y
el de shorts no tiene nada equivalente. Ahora mismo el feedback se implementa como
código suelto y nada impide que una corrección se deshaga más adelante.

Replica el mecanismo **reutilizando el motor existente**, no duplicándolo.
`src/modules/editorial-video/visuals/rules-engine.js` ya es genérico: expone
`CHECKS`, `registerCheck`, `loadCustomChecks`, `loadChannelRules`, `runRuleEngine`,
`auditRuleCoverage`, `notEvaluable` y `SEVERITIES`. Estúdialo antes de decidir.

El patrón a imitar, tal como funciona hoy para el canal editorial:

- **Set de reglas** en `channels/<canal>/brand/editing-rules.json`, con `sections` y
  `rules`. Forma de una regla:

  ```json
  {
    "id": "FC-R-134",
    "section": "narrative-camera",
    "statement": "En una relación parte-total, la cámara enfoca primero la parte...",
    "rationale": "La secuencia parte, contexto y consecuencia hace visible...",
    "scope": "catalog",
    "severity": "error",
    "check": "part-whole-camera-sequence",
    "fixture": "tests/fixtures/editing-rules/FC-R-134.json"
  }
  ```

- **Validador** en `src/modules/editorial-video/visuals/checks/<check-id>.js`, con
  export por defecto `{id, run(context) → issues[]}`.
- **Fixture de regresión** en `tests/fixtures/editing-rules/<RULE-ID>.json`:
  `{"ruleId", "check", "expect": "fail", "context": {...}}`. Debe **incumplir** la
  regla, para que si el validador deja de detectarla el test lo cace.
- **Intake por CLI**: `scripts/channel-feedback.js` (`npm run channel:feedback --
  --note "..." --section ... --severity ... --check ...`) registra la nota en
  `feedback-log.jsonl`, crea la regla con id estable, deja el esqueleto del
  validador y el fixture, y regenera el playbook.
- **Playbook legible** generado con `npm run channel:playbook` (y `--check` en CI).
- **Tests que lo sostienen**: `tests/editing-rules.test.js` audita cobertura con
  `auditRuleCoverage` y comprueba que cada fixture sigue disparando su regla.

Lo que hay que construir para shorts:

1. Un set de reglas propio para shorts, con su directorio de checks y sus fixtures.
   El contexto que reciben los validadores es el **`short-build.json`**, que ya
   contiene escenas, layouts, cues con slot y frames, páginas de subtítulo, cues de
   sonido y ventanas de ducking.
2. Un intake equivalente (`shorts:feedback` o reutilizando el existente con un flag
   de ámbito) que cree regla + validador + fixture de una sola vez.
3. Que `shorts:build` **ejecute las reglas** y falle en `error`, avise en `warning`.
4. Tests que auditen cobertura y regresión, como los del canal editorial.

Siembra el set con las correcciones que ya se descubrieron montando
`harness-vs-modelo`, que hoy viven solo como código o como comentarios:

- Dos cues no pueden solaparse en el mismo slot (ya validado en `build.js`;
  conviértelo en regla con id).
- Una captura de texto denso en layout `split` es ilegible: exige `stage`.
- El texto en pantalla no puede repetir palabra por palabra la locución (el caso
  real: unos chips `TIEMPO / TOKENS / PRECIO` que duplicaban el subtítulo).
- Un logo con arte oscuro sobre alfa necesita `presentation: "plate"`; sobre tarjeta
  oscura es invisible.
- Un wordmark con fondo negro sólido necesita `presentation: "blend"`.
- Nada informativo por debajo de `y = 1748`.
- Ningún cue debe entrar en silencio (hoy hay familia por defecto por tipo).
- Silencio en los extremos de una escena por encima del margen configurado.

## Reglas de trabajo

- No dupliques `rules-engine.js` ni el pipeline de vídeo largo.
- No hardcodees tokens ni secretos; no commitees `.env`, vídeos, audio ni output.
- Mantén el estilo del repo: comentarios que explican **por qué**, no qué.
- Los comentarios deben justificar decisiones no obvias, no narrar el código.

## Verificación

```bash
npm test
```

```bash
npm run remotion:check
```

Además, prueba el ciclo completo de punta a punta sobre `harness-vs-modelo` y
comprueba que el render sigue saliendo a 1080×1920, sin recorte de audio (pico por
debajo de 0 dB) y sin texto por debajo de la zona segura.

Actualiza `docs/shorts-desde-cero.md` y la sección de shorts de `AGENTS.md` con lo
que cambies.

## Trampas ya conocidas (ahorran tiempo)

- Chrome no decodifica Matroska: los clips se remuxean a MP4 en la ingesta.
- El audio de las grabaciones llega con picos a 0 dBFS; la ingesta normaliza a
  −14 LUFS con techo −1.5 dBTP. Eso cambia ligeramente la duración del clip, así que
  el build siempre debe recortar contra la duración real del manifest.
- `path.basename(name, ext)` no recorta si la extensión difiere en mayúsculas
  (`costs.PNG`).
- Medir texto por número de caracteres falla en mayúsculas; los subtítulos usan
  `measureText` de `@remotion/layout-utils`.
- `--force` en la ingesta puede dar `EBUSY` al borrar la carpeta de media si algún
  proceso acaba de leer un clip; reintentar funciona.
- El clip 02 de `harness-vs-modelo` está partido en dos escenas con trims contiguos
  (`{end: 7.3}` y `{start: 7.3}`) para cambiar de layout sin cortar el audio. Es el
  caso que rompe cualquier cambio ingenuo en el recorte automático.

## Entregable

Las tres tareas terminadas, tests en verde, documentación actualizada y un commit
por tarea con mensaje en español. Pregunta antes de hacer push.
