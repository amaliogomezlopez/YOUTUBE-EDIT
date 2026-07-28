# Fundaciones del canal editorial de economía

Este hito implementa las fases 0 y 1 del canal editorial de economía. No
recupera noticias, no llama a un LLM, no transcribe, no renderiza y no
publica.

## Arquitectura

La configuración versionada vive en:

```text
channels/finance-cavaliers/
```

El motor neutral vive en:

```text
src/modules/editorial-video/
```

Los episodios locales se crean bajo:

```text
data/channels/<channel-id>/episodes/<episode-id>/
```

Finance Cavaliers dispone además de un inbox local para material todavía no
asignado:

```text
data/channels/finance-cavaliers/inbox/
```

`data/channels/` está ignorado por Git. Cada episodio contiene
`episode-manifest.json` y directorios separados para fuentes, investigación,
story, narración, transcript, visuales, assets, miniaturas, revisión, renders
y publicación.

## CLI

```powershell
npm run editorial-video -- channels
npm run editorial-video -- create --channel finance-cavaliers
npm run editorial-video -- create --channel finance-cavaliers --title "Título provisional"
npm run editorial-video -- list --channel finance-cavaliers
npm run editorial-video -- show --episode <episode-id>
```

`show` acepta `--channel` cuando un ID pudiera existir en más de un canal. La
salida es JSON sanitizado: no incluye rutas locales, nombres de archivos,
payloads de cola, stacks ni errores internos.

## Contratos

Los schemas JSON 2020-12 están en `schemas/editorial-video/`:

- `channel-config.schema.json`;
- `source-record.schema.json`;
- `research-dossier.schema.json`;
- `story-package.schema.json`;
- `episode-manifest.schema.json`;
- `visual-plan.schema.json`.

Además del schema, el validador comprueba rangos de configuración, IDs
duplicados, referencias desconocidas, claims bloqueados, revisiones,
progreso y orden temporal básico.

El manifest es la raíz de estado. Conserva referencias relativas, hashes,
revisiones y aprobaciones; no duplica artículos, audio, datasets ni planes
completos.

## Persistencia y recuperación

La escritura del manifest usa un temporal en el mismo directorio y un rename
atómico. Toda actualización exige `expectedRevision`; una revisión obsoleta
devuelve `EDITORIAL_REVISION_CONFLICT` y no sobrescribe el episodio actual.

Las etapas costosas reutilizan `PersistentJobQueue` mediante
`createEditorialJobQueue`. El payload se limita a:

```text
channelId
episodeId
stage
inputRevision
```

La cola conserva reintentos, cancelación con `AbortSignal` y recuperación de
jobs interrumpidos después de reiniciar. No deben guardarse paths, tokens,
fuentes completas ni audio dentro del payload.

## Estados y gates

La máquina de estados implementa los estados definidos por el plan, desde
`draft` hasta `completed`, además de `failed` y `cancelled`.

Gates iniciales:

- `awaiting-narration` exige story aprobado;
- `rendering-preview` exige narración, transcript y plan visual listos;
- `approved` y `rendering-final` exigen QA y preview aprobados;
- `completed` exige un render final terminado.

El progreso se conserva de forma separada en `progress`, con etapa, unidades,
mensaje, intento y capacidad de retry.

## Feature flag

La futura UI permanece oculta por defecto:

```text
SHORTSMITH_EDITORIAL_VIDEO_UI_ENABLED=false
```

La CLI y los contratos siguen disponibles para desarrollo y tests. Activar la
UI no habilitará publicación automática; esa acción seguirá requiriendo
confirmación independiente.

## Fixtures

`tests/fixtures/editorial-video/` contiene únicamente un canal, fuentes, un
dossier y un story completamente sintéticos. Usan `fixture://`, están marcados
como no publicables y no dependen de Internet.

## Siguiente dependencia

La fase 2 puede añadir conectores manual, RSS y JSON Feed sobre
`source-record.schema.json`, reutilizando `fetchWithTimeout` y la cola aquí
definida. No debe iniciarse scraping HTML general ni guardar contenido bruto
en el manifest.
