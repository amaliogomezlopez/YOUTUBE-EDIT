---
name: episodio-animado
description: Convierte una carpeta de clips (vídeo o audio) en animaciones editoriales Remotion ancladas a la locución. Úsala siempre que el encargo sea "en esta carpeta están los clips del episodio N, haz las animaciones", o al continuar/rehacer bloques de un episodio ya empezado del canal finance-cavaliers. También al montar escenas, elegir patrones, asignar sonido o validar un plan visual.
---

# Producir un episodio animado desde una carpeta de clips

El motor está construido para que los errores no se repitan: las reglas del
canal son ejecutables y el build las corre. Tu trabajo no es acordarte de las
reglas, es **no puentear el motor que las comprueba**.

## Paso 0 — Obligatorio, antes de tocar nada

Lee, en este orden:

1. `channels/finance-cavaliers/brand/editing-rules.json` — **el JSON, no el
   markdown**. Son las 59 reglas que el build va a ejecutar.
2. `channels/finance-cavaliers/brand/rule-exceptions.json` — qué está rebajado,
   para qué episodio y por qué.
3. `docs/animation-engine-operating-manual.md` — Parte III es el procedimiento
   completo. Esta skill es el índice; el manual es la referencia.

El `.md` del playbook se **genera** desde el JSON. Nunca lo edites a mano:
`npm run channel:playbook:check` te va a pillar.

## Antes de empezar: identifica el episodio

Todo cuelga de `data/channels/finance-cavaliers/episodes/<N>/`. El número del
directorio **es** la identidad del episodio: de ahí sale el `episodeId` con el
que el motor filtra las excepciones registradas. Si el directorio no termina en
número, el build falla a propósito.

Consecuencia práctica: las excepciones del episodio 1 no se aplican al 2. Si al
construir el episodio 2 ves incidencias que creías resueltas, **son reales** —
no las heredes, resuélvelas o regístralas de nuevo con su motivo.

## El flujo

```bash
# 1. Clips → audio normalizado. Acepta .mp4 .mov .mkv .m4a .mp3 .wav .flac .aac
#    Extrae el audio, ordena, compacta silencios y normaliza a -16 LUFS.
#    Los clips originales NUNCA se modifican; cada ejecución crea un run nuevo.
npm run episode:narration -- --input "<carpeta-de-clips>"
```

El orden de los clips sale del **nombre del fichero**: primero los que se llaman
`1`, `2`, `3`…; el resto por orden natural. Si el orden narrativo importa y los
nombres no son numéricos, renómbralos antes. Un orden mal inferido no da error,
da un episodio incoherente.

```bash
npm run episode:transcript:export     # transcripción POR PALABRAS
npm run channel:entities -- --verify  # debe terminar en "ausentes: 0"
npm run episode:finance-cavaliers:pilot -- --episode "data/channels/finance-cavaliers/episodes/<N>"
```

El build ya valida por dentro. Objetivo: **0 errores**. Los warnings se leen uno
a uno.

Artefactos en `<episodio>/visuals/`: `visual-plan.json` (contrato),
`render-props.json`, `cue-coverage.json`, `rhythm-report.json`,
`sound-report.json`, `variety-report.json`, `plan-validation.json`,
`episode-qa.json`.

## Las cinco reglas duras

1. **El índice de palabra es la única verdad temporal.** `atSeconds` es un
   derivado. Escribirlo a mano hace fallar el build. Si retocas el audio, no
   desplaces la pista: reexporta la transcripción y `reanchorCues` recoloca todo.
2. **Los cues los mina el motor.** Revisa `cue-coverage.json`. Un cue manual solo
   se justifica por rótulo, destino u orden narrativo — y con `reason`.
3. **El sonido se pide por familia**, `{family, intensity}`, nunca por fichero.
   El director elige variante respetando cooldown y reparto. Si un movimiento no
   merece sonido, va en silencio. No añadas un whoosh porque haya un zoom: eso
   es justo lo que produjo la monotonía del episodio 1.
4. **Una escena nueva se resuelve con el catálogo, o el catálogo crece.** Nunca
   con un componente de un solo uso. Si el objeto a enfocar no está en
   `focusTargets`, amplía el binding; no inventes el target en el cue.
5. **Render por bloques de ~1 min**, en frontera semántica. No empieces el
   siguiente sin aprobación explícita. **Un bloque aprobado no se sobrescribe.**

## Cuando el usuario corrige algo

Este es el paso que hace que el sistema mejore en vez de repetir el error:

```bash
npm run channel:feedback -- --note "…"
```

La corrección se convierte en regla con id, validador y fixture. Una corrección
que solo se anota en prosa se volverá a cometer. Si la regla no puede tener
validador, dilo explícitamente en vez de fingir cobertura.

Si una incidencia es aceptable para este episodio, regístrala en
`rule-exceptions.json` **con motivo, fecha y `episodeId`** — nunca rebajes la
regla. Una excepción sin `episodeId` es global y silenciosa para siempre: no las
escribas.

## Antes de dar algo por terminado

```bash
npm test
npm run remotion:check
npm run channel:playbook:check
```

## Qué NO hacer

- No edites `editing-playbook.md` (se genera).
- No escribas `atSeconds` ni segundos a mano.
- No pidas un fichero de sonido concreto.
- No crees un componente de un solo uso.
- No silencies un warning sin excepción registrada.
- No reportes una regla como cumplida si el contexto no permitía evaluarla: el
  motor tiene `notEvaluable(reason)` justo para eso.
