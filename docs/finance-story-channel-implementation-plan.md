# Plan de implementación: canal automatizado de historias de economía y finanzas

Estado: propuesta lista para implementación  
Fecha: 2026-07-28  
Repositorio: `D:\2-YOUTUBE-EDIT`  
Nombre provisional del canal: `economia-historias`

## 1. Resumen ejecutivo

El nuevo canal debe vivir dentro de YouTube Edit como una capa independiente,
pero no como un segundo producto duplicado. La solución propuesta separa:

1. un motor compartido para episodios editoriales investigados;
2. una configuración versionada específica del canal;
3. datos locales y artefactos de cada episodio;
4. extensiones Remotion exclusivas solo cuando el catálogo común no resuelva
   una necesidad.

El sistema debe ser capaz de:

1. recuperar noticias de fuentes autorizadas;
2. normalizarlas, agruparlas y seleccionar una historia;
3. construir un dossier verificable de fuentes, afirmaciones y datos;
4. generar un guion editorial;
5. esperar la narración grabada por el usuario;
6. transcribir y alinear esa narración;
7. crear un plan visual sincronizado con el audio;
8. seleccionar patrones, gráficas, imágenes, iconos y dibujos;
9. componer un vídeo completo con Remotion;
10. presentar una preview revisable;
11. renderizar el máster final y preparar su paquete de publicación.

La implementación no debe crear otro proyecto Remotion, otro adaptador LLM,
otro sistema STT ni otra cola. Debe reutilizar los módulos existentes:

- `src/lib/llm.js`;
- `src/lib/stt.js`;
- `src/lib/transcript.js`;
- `src/lib/job-queue.js`;
- `src/lib/network.js`;
- `src/lib/remotion-assets.js`;
- `src/lib/visual-selection.js`;
- `src/lib/animation-variety.js`;
- `src/lib/remotion-review.js`;
- `src/lib/remotion-visual-qa.js`;
- `remotion-animations/`;
- los publicadores y generadores de metadata existentes.

## 2. Contexto actual

YouTube Edit ya dispone de:

- pipeline local Node.js;
- FFmpeg y `ffprobe`;
- transcripción local con Faster-Whisper y timestamps por palabra;
- LLM OpenAI-compatible/MiniMax con JSON estructurado;
- jobs y colas persistentes con cancelación, reintentos y recuperación;
- generación de metadata de publicación;
- publicación mediante APIs oficiales;
- Storysmith y Carouselsmith como precedentes editoriales;
- catálogo de animaciones, efectos, sonido, iconos, dibujos e imágenes;
- selector visual semántico con preferencias;
- ingestión y calibración de gráficas;
- temas, formatos y perfiles de movimiento;
- Review Studio, variantes A/B/C y comentarios por frame;
- QA estático y sobre frames renderizados;
- runs Remotion inmutables y protegidas contra sobrescrituras.

El hueco no está en los motores técnicos. Falta un dominio que represente un
episodio investigado de principio a fin y mantenga unidos:

- las noticias originales;
- las afirmaciones verificadas;
- las series de datos;
- el guion;
- la narración;
- la transcripción;
- las escenas;
- los assets;
- las decisiones visuales;
- las revisiones;
- los renders;
- la metadata final.

## 3. Problema que se quiere resolver

La automatización completa de un vídeo narrativo de economía plantea problemas
que no resuelve una simple secuencia `noticia -> prompt -> vídeo`:

### 3.1 Integridad factual

Las cifras, fechas, entidades y relaciones causales no pueden proceder de la
imaginación del modelo. Cada afirmación debe apuntar a evidencia concreta.

### 3.2 Noticias contradictorias o incompletas

Dos fuentes pueden dar explicaciones diferentes para un mismo movimiento de
mercado. El sistema debe conservar contradicciones e incertidumbre, no
fusionarlas en una conclusión falsa.

### 3.3 Datos de mercado

Una gráfica precisa necesita una serie real, su zona horaria, frecuencia,
unidad, rango temporal y procedencia. La transcripción no basta para
reconstruirla.

### 3.4 Copyright, atribución y licencias

No se deben copiar artículos completos ni descargar imágenes sin registrar
procedencia y licencia. El render nunca debe depender de una URL remota.

### 3.5 Guion frente a narración real

El usuario puede cambiar frases al grabar. La escena debe sincronizarse con lo
que realmente se dijo, pero cualquier afirmación nueva debe volver a pasar por
el ledger factual.

### 3.6 Automatización visual

No toda frase necesita texto o animación. El sistema debe alternar:

- gráficas;
- documentos y capturas;
- fotografías;
- diagramas;
- cifras;
- mapas o timelines;
- escenas ambientales;
- silencios visuales.

### 3.7 Consistencia sin monotonía

El canal necesita identidad propia, pero no puede repetir la misma plantilla,
geometría, transición o metáfora durante todo el vídeo.

### 3.8 Duración dinámica

El máster debe adaptar su duración al audio y al timeline de escenas, no asumir
composiciones fijas de ocho segundos.

### 3.9 Reanudación y reproducibilidad

Buscar fuentes, llamar al LLM, transcribir y renderizar son operaciones
costosas. Un reinicio no debe obligar a repetir etapas completadas ni producir
duplicados.

## 4. Objetivos

### 4.1 Objetivos funcionales

- Crear y administrar perfiles de canal sin duplicar motores.
- Descubrir historias desde fuentes permitidas.
- Generar un dossier factual auditable.
- Crear un guion narrativo trazable a las fuentes.
- Ingerir una narración y obtener timestamps por palabra.
- Detectar desviaciones entre guion aprobado y narración.
- Generar un plan visual completo sincronizado con el audio.
- Renderizar una composición maestra 16:9.
- Revisar escenas y vídeo completo antes del render final.
- Preparar metadata de YouTube a partir del episodio aprobado.

### 4.2 Objetivos de calidad

- Cero cifras publicadas sin `sourceRef` o `dataRef`.
- Cero IDs de patrón, asset o fuente inventados por el LLM.
- Cero descargas de red durante un render.
- Todos los cambios importantes dejan un manifest o reporte.
- Cada episodio puede reabrirse y continuar después de reiniciar el servidor.
- Cada render final apunta al dossier, guion, audio, visual plan y revisión que
  lo produjeron.

### 4.3 Objetivos de producto

- Reducir el trabajo manual a:
  1. elegir o aprobar una historia;
  2. revisar el guion;
  3. grabar la voz;
  4. aprobar la preview;
  5. confirmar la publicación.
- Permitir evolucionar posteriormente a varios canales sin cambiar el motor.

## 5. No objetivos iniciales

El primer alcance no debe:

- publicar automáticamente sin confirmación humana;
- emitir recomendaciones personalizadas de inversión;
- hacer trading ni conectarse a cuentas financieras;
- scrapear sitios que lo prohíban;
- saltarse paywalls;
- clonar la voz del usuario;
- generar cifras o series sintéticas presentadas como reales;
- producir noticias en tiempo real de baja latencia;
- sustituir completamente la revisión editorial;
- crear otro servidor, proyecto Remotion o pipeline Python;
- convertir el canal en un servicio multiusuario remoto.

## 6. Decisión arquitectónica

### 6.1 Motor genérico y canal configurable

Crear un módulo compartido:

```text
src/modules/editorial-video/
```

Este módulo debe ser neutral respecto al canal. Economía será la primera
configuración:

```text
channels/economia-historias/
```

Las composiciones comunes seguirán en:

```text
remotion-animations/src/
```

Las extensiones que solo tengan sentido para este canal podrán vivir en:

```text
remotion-animations/src/channels/economia-historias/
```

Una mecánica demostrada como reutilizable deberá ascender al catálogo común.

### 6.2 Flujo de alto nivel

```mermaid
flowchart LR
    A["Fuentes autorizadas"] --> B["Ingestión y normalización"]
    B --> C["Clustering y ranking"]
    C --> D["Dossier factual"]
    D --> E["Guion y arco narrativo"]
    E --> F["Aprobación y grabación"]
    F --> G["STT y alineación"]
    G --> H["Plan de escenas"]
    H --> I["Assets y datos"]
    I --> J["Composición maestra Remotion"]
    J --> K["Review Studio y QA"]
    K --> L["Render final"]
    L --> M["Metadata y publicación confirmada"]
```

### 6.3 Regla de dependencia

El flujo permitido es:

```text
canal -> motor editorial -> motores compartidos
canal -> extensiones visuales -> librería Remotion común
```

No se permite:

```text
motor compartido -> configuración concreta del canal
canal -> copia modificada de STT/LLM/FFmpeg/Remotion
```

## 7. Estructura de carpetas objetivo

```text
YOUTUBE-EDIT/
├── channels/
│   └── economia-historias/
│       ├── README.md
│       ├── channel.config.json
│       ├── brand/
│       │   ├── visual-profile.json
│       │   ├── editorial-rules.md
│       │   └── disclaimers.md
│       ├── research/
│       │   ├── source-policy.json
│       │   ├── topic-policy.json
│       │   └── narrative-templates.json
│       ├── prompts/
│       │   ├── research-synthesis.md
│       │   ├── story-planner.md
│       │   └── visual-director.md
│       └── assets/
│           └── catalog.json
├── schemas/
│   └── editorial-video/
│       ├── channel-config.schema.json
│       ├── source-record.schema.json
│       ├── research-dossier.schema.json
│       ├── story-package.schema.json
│       ├── episode-manifest.schema.json
│       └── visual-plan.schema.json
├── src/
│   └── modules/
│       └── editorial-video/
│           ├── channel-registry.js
│           ├── repository.js
│           ├── validator.js
│           ├── orchestrator.js
│           ├── research/
│           ├── story/
│           ├── narration/
│           ├── visuals/
│           └── api.js
├── scripts/
│   └── editorial-video.js
├── data/
│   └── channels/
│       └── economia-historias/
│           └── episodes/
│               └── <episode-id>/
├── remotion-animations/
│   ├── src/
│   │   ├── editorial/
│   │   └── channels/economia-historias/
│   ├── public/assets/library/economia-historias/
│   └── out/economia-historias/runs/<run-id>/
└── public/
    └── editorial-video/
```

### 7.1 Qué se versiona

- configuración del canal;
- políticas editoriales;
- schemas;
- prompts;
- catálogos;
- código;
- pequeños assets propios y licenciados;
- fixtures sintéticos de test;
- documentación.

### 7.2 Qué no se versiona

- artículos o snapshots recuperados;
- audios del usuario;
- transcripciones de episodios;
- datasets de trabajo;
- imágenes episódicas;
- jobs;
- previews;
- renders;
- archivos de revisión;
- tokens, claves o `.env`.

Actualizar `.gitignore` antes de crear el primer episodio.

## 8. Configuración del canal

Crear `channels/economia-historias/channel.config.json` validado mediante
schema. No hardcodear sus valores en el motor.

Ejemplo orientativo:

```json
{
  "version": 1,
  "id": "economia-historias",
  "label": "Economía e historias",
  "language": "es",
  "formats": ["landscape"],
  "episode": {
    "targetMinutes": {"min": 6, "max": 10},
    "sourceCount": {"min": 3, "max": 6}
  },
  "research": {
    "lookbackHours": 72,
    "minimumIndependentSources": 2,
    "connectors": ["manual", "rss"]
  },
  "editorial": {
    "defaultTemplate": "causal-explainer",
    "requireClaimEvidence": true,
    "requireNumericDataRef": true
  },
  "visual": {
    "brandProfileId": "economia-historias",
    "themeAllowlist": [
      "editorial-ivory",
      "signal-cobalt",
      "oxide-documentary"
    ],
    "motionProfileAllowlist": [
      "restrained",
      "editorial",
      "technical",
      "cinematic"
    ],
    "headerPolicy": "optional-centered",
    "watermark": false
  },
  "workflow": {
    "humanGates": [
      "story-approved",
      "preview-approved",
      "publish-confirmed"
    ]
  }
}
```

Los valores anteriores son defaults provisionales y configurables. No deben
convertirse en constantes del código.

## 9. Modelo de dominio

### 9.1 Source record

Representa una fuente normalizada:

```text
id
connectorId
url
canonicalUrl
publisher
title
author
publishedAt
retrievedAt
language
contentType
summary
shortExcerpts[]
entities[]
topics[]
sourceHash
usagePolicy
status
```

Reglas:

- `canonicalUrl` se usa para deduplicar.
- `publishedAt` y `retrievedAt` nunca se confunden.
- Los extractos deben ser breves y solo los necesarios para respaldar claims.
- El contenido bruto permanece local y sujeto a retención.
- Una fuente sin fecha o procedencia se marca como incompleta.

### 9.2 Research dossier

Debe incluir:

```text
episodeId
topic
selectedCluster
sources[]
claims[]
dataAssets[]
entities[]
timeline[]
contradictions[]
unknowns[]
editorialWarnings[]
generatedAt
```

Cada claim:

```text
id
statement
type
sourceRefs[]
dataRefs[]
effectiveAt
confidence
status
notes
```

Estados recomendados:

- `supported`;
- `disputed`;
- `context-only`;
- `unsupported`;
- `stale`.

Un claim `unsupported` no puede entrar en el guion final.

### 9.3 Data asset

Para cifras o series:

```text
id
kind
sourceUrl
provider
retrievedAt
timezone
frequency
unit
currency
columns
range
localFile
sha256
license
```

Nunca tratar una captura de una gráfica como si fuera la serie original. Si
solo existe la imagen, usar el flujo de calibración y mantener el estado
`proposed` hasta su confirmación.

### 9.4 Story package

Representa la historia antes de grabar:

```text
title
thesis
audiencePromise
narrativeTemplate
hook
beats[]
scriptSections[]
claimRefs[]
sourceRefs[]
estimatedDurationSeconds
disclaimerRefs[]
approval
```

Cada beat debe declarar:

- función narrativa;
- afirmaciones utilizadas;
- emoción o tensión;
- objetivo visual provisional;
- duración estimada.

Plantillas iniciales:

- `causal-explainer`;
- `market-move`;
- `macro-chain`;
- `policy-impact`;
- `company-event`;
- `myth-vs-data`.

### 9.5 Episode manifest

Es el documento raíz del episodio:

```text
version
id
channelId
title
status
revision
createdAt
updatedAt
research
story
narration
transcript
visualPlan
review
renders
publishing
warnings
```

Debe contener referencias a archivos, hashes y estados, no duplicar todos los
contenidos.

### 9.6 Visual plan

Cada escena debe tener:

```text
id
order
startSeconds
endSeconds
narrationText
wordRange
claimRefs[]
sourceRefs[]
dataRefs[]
visualIntent
patternId
compositionId
effectIds[]
assetRefs[]
themeId
motionProfile
soundProfile
soundDecision
header
props
fallback
```

Validaciones obligatorias:

- tiempos ordenados y dentro del audio;
- duración positiva;
- IDs existentes en manifest o catálogo;
- claims compatibles con la escena;
- cifras respaldadas;
- assets registrados;
- props válidas según Zod;
- sin solapes involuntarios;
- sin huecos no declarados;
- límites de lectura y safe zones.

## 10. Estados del episodio

Usar estados persistidos y explícitos:

```text
draft
discovering
researching
research-ready
planning-story
awaiting-story-approval
awaiting-narration
transcribing
aligning
planning-visuals
rendering-preview
preview-ready
changes-requested
approved
rendering-final
completed
failed
cancelled
```

No sobrecargar el estado con el progreso interno. Mantener además:

```text
stage
completedUnits
totalUnits
message
attempt
retryable
```

Cada transición debe validarse. Por ejemplo:

- no pasar a `awaiting-narration` sin story aprobado;
- no renderizar sin audio, transcript y visual plan válidos;
- no generar el máster final sin preview aprobada;
- no publicar sin confirmación.

## 11. Flujo funcional detallado

### 11.1 Descubrimiento

1. Ejecutar conectores habilitados.
2. Normalizar URLs, fechas, autores y contenido.
3. Aplicar allowlist, límites, timeouts y política de retención.
4. Deduplicar por URL canónica y similitud.
5. Extraer entidades, tickers y temas.
6. Agrupar noticias que describan el mismo acontecimiento.
7. Puntuar clusters por:
   - actualidad;
   - diversidad de fuentes;
   - relevancia para el canal;
   - densidad factual;
   - potencial narrativo;
   - potencial visual;
   - riesgo editorial.
8. Proponer varias historias y conservar las razones del ranking.

### 11.2 Investigación

1. Crear un dossier para el cluster seleccionado.
2. Separar hechos, interpretaciones y opiniones.
3. Identificar contradicciones.
4. Resolver entidades y fechas.
5. Buscar datasets necesarios mediante conectores autorizados.
6. Crear el ledger de claims.
7. Bloquear claims insuficientes.
8. Registrar información que falta.

El LLM puede sintetizar únicamente los registros normalizados que recibe. No
puede crear fuentes, URLs, IDs o valores nuevos.

### 11.3 Historia y guion

1. Elegir una plantilla narrativa compatible.
2. Formular tesis y promesa al espectador.
3. Ordenar beats.
4. Crear el guion citando `claimRefs`.
5. Estimar duración.
6. Ejecutar validación factual.
7. Mostrar guion y dossier para aprobación.
8. Congelar una revisión del story package.

La grabación del usuario funciona como aprobación práctica del guion, pero el
estado formal debe guardarse antes de aceptar el audio.

### 11.4 Narración

1. Aceptar WAV, MP3, M4A o FLAC dentro de límites configurados.
2. Copiar el original al episodio sin modificarlo.
3. Calcular hash y hacer `ffprobe`.
4. Extraer una copia de trabajo si el STT lo necesita.
5. Transcribir mediante el adaptador existente.
6. Conservar palabras, segmentos, confianza e idioma.
7. Alinear transcript y guion.
8. Generar un informe:
   - coincidencias;
   - omisiones;
   - añadidos;
   - nombres dudosos;
   - claims pronunciados que no estaban en el guion.
9. Volver a validar cualquier claim añadido.

No corregir automáticamente el audio. El transcript operativo debe reflejar
lo pronunciado.

### 11.5 Plan visual

1. Segmentar el audio por:
   - pausas;
   - límites de frase;
   - beats;
   - cambios de claim;
   - densidad de cifras.
2. Determinar qué fragmentos requieren animación.
3. Elegir patrón y efecto desde el manifest.
4. Asignar assets y datos.
5. Generar props.
6. Aplicar variedad contra las seis escenas anteriores.
7. Decidir sonido o silencio para cada transformación.
8. Crear fallback determinista.
9. Validar cobertura temporal.

No llenar todos los segundos con movimiento. Deben existir descansos,
composición estable y escenas donde la imagen sea suficiente.

### 11.6 Render

1. Crear una composición maestra de duración dinámica.
2. Incluir la narración como pista principal.
3. Crear una `<Sequence>` por escena.
4. Resolver cada `patternId` mediante un registro de componentes.
5. Aplicar transiciones solo cuando haya cambio narrativo.
6. Permitir subtítulos opcionales y no redundantes.
7. Usar assets locales ya preparados.
8. Generar preview y stills.
9. Ejecutar Review Studio y QA.
10. Renderizar el máster final en un run inmutable.

## 12. Plan de implementación por fases

Cada fase debe terminar con tests y un commit independiente. No comenzar una
fase dependiente si la anterior no cumple sus criterios de aceptación.

### Fase 0. Fundaciones y límites

Tareas:

- [ ] `FIN-000` Confirmar el slug provisional `economia-historias`.
- [ ] `FIN-001` Crear la estructura `channels/` y su README.
- [ ] `FIN-002` Crear `channel.config.json` y su schema.
- [ ] `FIN-003` Añadir exclusiones de datos, audios, datasets y renders.
- [ ] `FIN-004` Documentar qué es compartido y qué puede ser específico.
- [ ] `FIN-005` Añadir feature flag para ocultar la UI hasta el piloto.
- [ ] `FIN-006` Crear fixtures sintéticos sin noticias ni datos reales.

Criterios de aceptación:

- el canal carga desde configuración;
- una configuración inválida falla con errores accionables;
- no hay cambios en los flujos actuales;
- ningún archivo privado aparece en `git status`;
- los tests existentes siguen pasando.

### Fase 1. Dominio editorial y repositorio

Tareas:

- [ ] `FIN-100` Crear `src/modules/editorial-video/`.
- [ ] `FIN-101` Implementar `channel-registry.js`.
- [ ] `FIN-102` Implementar el repositorio local de episodios.
- [ ] `FIN-103` Usar escritura atómica y control de revisión.
- [ ] `FIN-104` Implementar schemas de episode, source, dossier y story.
- [ ] `FIN-105` Implementar la máquina de estados.
- [ ] `FIN-106` Crear DTOs públicos que oculten rutas privadas.
- [ ] `FIN-107` Crear CLI:

```text
npm run editorial-video -- create --channel economia-historias
npm run editorial-video -- show --episode <id>
npm run editorial-video -- list --channel economia-historias
```

- [ ] `FIN-108` Reutilizar `PersistentJobQueue` para etapas costosas.

Criterios de aceptación:

- se crea, guarda, lista y reabre un episodio;
- una revisión obsoleta no sobrescribe otra;
- un reinicio recupera jobs interrumpidos;
- cancelación y retry funcionan;
- los DTOs no exponen paths, errores internos ni payloads sensibles.

### Fase 2. Conectores y descubrimiento de noticias

Implementar primero conectores conservadores:

```text
src/modules/editorial-video/research/sources/
├── manual.js
├── rss.js
└── json-feed.js
```

No implementar scraping HTML general en esta fase.

Tareas:

- [ ] `FIN-200` Definir la interfaz común del conector.
- [ ] `FIN-201` Reutilizar `fetchWithTimeout`, AbortSignal y retries.
- [ ] `FIN-202` Aplicar tamaño máximo de respuestas.
- [ ] `FIN-203` Permitir allowlist de hosts y protocolos HTTPS.
- [ ] `FIN-204` Implementar caché condicional con ETag/Last-Modified.
- [ ] `FIN-205` Normalizar feeds a `source-record`.
- [ ] `FIN-206` Canonicalizar y deduplicar URLs.
- [ ] `FIN-207` Detectar idioma, entidades, tickers y temas.
- [ ] `FIN-208` Agrupar acontecimientos similares.
- [ ] `FIN-209` Puntuar clusters con razones auditables.
- [ ] `FIN-210` Registrar errores por fuente sin abortar todo el lote.
- [ ] `FIN-211` Crear política de retención de contenido bruto.
- [ ] `FIN-212` Añadir modo offline para tests.

Criterios de aceptación:

- los fixtures RSS/JSON producen registros idénticos en ejecuciones repetidas;
- no se siguen redirects a hosts fuera de política;
- respuestas excesivas se rechazan;
- una fuente caída no elimina los resultados válidos;
- el ranking conserva explicación y procedencia;
- ningún test depende de Internet.

### Fase 3. Dossier factual y datos

Tareas:

- [ ] `FIN-300` Implementar el ledger de claims.
- [ ] `FIN-301` Clasificar hechos, interpretaciones y opiniones.
- [ ] `FIN-302` Exigir fuente a todos los claims.
- [ ] `FIN-303` Exigir `dataRef` para claims numéricos configurados.
- [ ] `FIN-304` Detectar contradicciones sin resolverlas artificialmente.
- [ ] `FIN-305` Añadir estados `supported`, `disputed`, `unsupported`, `stale`.
- [ ] `FIN-306` Validar fechas efectivas y fecha de recuperación.
- [ ] `FIN-307` Crear un registro de datasets.
- [ ] `FIN-308` Normalizar CSV/JSON aportados por el usuario.
- [ ] `FIN-309` Integrar la ingestión existente de gráficas.
- [ ] `FIN-310` Añadir un adaptador LLM que solo pueda devolver IDs conocidos.
- [ ] `FIN-311` Implementar fallback local sin LLM.
- [ ] `FIN-312` Generar `research-dossier.json` y un resumen legible.

Criterios de aceptación:

- todo claim válido tiene evidencia;
- toda cifra que la política marque como estricta tiene dato asociado;
- URLs, valores o IDs inventados invalidan la respuesta completa del LLM;
- las contradicciones aparecen en el dossier;
- el dossier puede regenerarse sin alterar las fuentes originales.

### Fase 4. Story planner y aprobación

Tareas:

- [ ] `FIN-400` Implementar las plantillas narrativas.
- [ ] `FIN-401` Crear tesis, hook, beats y conclusión.
- [ ] `FIN-402` Vincular cada sección con claims.
- [ ] `FIN-403` Calcular duración estimada.
- [ ] `FIN-404` Aplicar tono, audiencia y disclaimers del canal.
- [ ] `FIN-405` Validar que el guion no incluya claims bloqueados.
- [ ] `FIN-406` Validar que las cifras conserven unidad y periodo.
- [ ] `FIN-407` Crear fallback determinista.
- [ ] `FIN-408` Persistir revisiones del guion.
- [ ] `FIN-409` Implementar aprobación o petición de cambios.
- [ ] `FIN-410` Exportar `script.md` para grabación.

Criterios de aceptación:

- cada párrafo puede rastrearse al dossier;
- no se puede aprobar un guion con claims `unsupported`;
- modificar el dossier invalida la aprobación del guion;
- el fallback funciona sin credenciales LLM;
- el script exportado no contiene IDs internos innecesarios.

### Fase 5. Ingestión y alineación de la narración

Tareas:

- [ ] `FIN-500` Añadir importación segura de audio.
- [ ] `FIN-501` Calcular hash, duración, codec, canales y sample rate.
- [ ] `FIN-502` Conservar el original como solo lectura operativa.
- [ ] `FIN-503` Reutilizar Faster-Whisper local.
- [ ] `FIN-504` Exigir timestamps por palabra para el modo automático.
- [ ] `FIN-505` Implementar alineación transcript-guion.
- [ ] `FIN-506` Detectar omisiones, añadidos y sustituciones.
- [ ] `FIN-507` Resolver nombres mediante vocabulario del dossier.
- [ ] `FIN-508` Detectar claims nuevos pronunciados.
- [ ] `FIN-509` Bloquear claims nuevos no respaldados.
- [ ] `FIN-510` Crear `alignment-report.json`.
- [ ] `FIN-511` Permitir aprobar correcciones de transcripción sin alterar audio.

Criterios de aceptación:

- la duración operativa procede del audio real;
- palabras y segmentos permanecen ordenados;
- el informe distingue cambios editoriales de errores STT;
- un claim nuevo sin evidencia bloquea el plan visual;
- reintentar STT no modifica el original.

### Fase 6. Planificador visual

Tareas:

- [ ] `FIN-600` Segmentar el transcript en escenas.
- [ ] `FIN-601` Vincular escenas con beats y claims.
- [ ] `FIN-602` Clasificar intención visual.
- [ ] `FIN-603` Leer el manifest Remotion v2.
- [ ] `FIN-604` Seleccionar únicamente patrones `ready`.
- [ ] `FIN-605` Reutilizar el selector semántico de assets.
- [ ] `FIN-606` Reutilizar el historial de variedad.
- [ ] `FIN-607` Preparar specs de gráfica desde datasets.
- [ ] `FIN-608` Registrar capturas, fotografías y SVG con el importador.
- [ ] `FIN-609` Generar props Zod válidas.
- [ ] `FIN-610` Decidir cues sonoros y silencios.
- [ ] `FIN-611` Permitir escenas estáticas o ambientales.
- [ ] `FIN-612` Generar fallback por escena.
- [ ] `FIN-613` Validar cobertura completa del audio.
- [ ] `FIN-614` Crear `visual-plan.json` y storyboard.

Criterios de aceptación:

- ningún ID visual es libre;
- ninguna gráfica contiene muestras inventadas;
- el plan declara qué ocurre durante toda la narración;
- las escenas no repiten de forma abusiva patrón, geometría o cámara;
- una escena puede omitir título y texto;
- el plan se puede revisar antes de renderizar.

### Fase 7. Composición maestra Remotion

Crear:

```text
remotion-animations/src/editorial/
├── EditorialEpisode.tsx
├── SceneRegistry.ts
├── SceneBoundary.tsx
├── EpisodeAudio.tsx
└── schemas.ts
```

Tareas:

- [ ] `FIN-700` Registrar una composición maestra.
- [ ] `FIN-701` Calcular metadata desde audio y visual plan.
- [ ] `FIN-702` Resolver escenas mediante `SceneRegistry`.
- [ ] `FIN-703` Crear `<Sequence>` con frames exactos.
- [ ] `FIN-704` Evitar drift por redondeo entre segundos y frames.
- [ ] `FIN-705` Aplicar la identidad del canal por props.
- [ ] `FIN-706` Implementar transiciones narrativamente justificadas.
- [ ] `FIN-707` Integrar narración, SFX y silencios.
- [ ] `FIN-708` Añadir subtítulos opcionales.
- [ ] `FIN-709` Prohibir red durante el bundle y render.
- [ ] `FIN-710` Verificar que todos los assets sean locales.
- [ ] `FIN-711` Renderizar con `render-safe.mjs`.

Extensiones financieras candidatas, solo si el piloto las necesita:

- cadena causal macroeconómica;
- curva o spread comparativo;
- gráfico de mercado con eventos;
- timeline de decisiones de bancos centrales;
- mapa de transmisión de una política;
- tabla/ranking financiero editorial.

No crear todas por adelantado. Primero intentar resolver cada escena con el
catálogo común.

Criterios de aceptación:

- la duración coincide con el audio dentro de un frame;
- no existen huecos negros involuntarios;
- todas las escenas respetan safe zones;
- render repetido con los mismos inputs produce el mismo timeline;
- el render no realiza solicitudes HTTP;
- la composición figura en el manifest de capacidades.

### Fase 8. Review Studio y QA de episodios

El Review Studio actual está orientado a patrones cortos. Debe ampliarse sin
romper ese modo.

Tareas:

- [ ] `FIN-800` Soportar duración variable.
- [ ] `FIN-801` Navegar por escenas y beats.
- [ ] `FIN-802` Mostrar claim y fuentes de la escena seleccionada.
- [ ] `FIN-803` Permitir comentarios por frame y `sceneId`.
- [ ] `FIN-804` Permitir variantes por escena cuando aporten valor.
- [ ] `FIN-805` Mostrar audio y contexto.
- [ ] `FIN-806` Generar checkpoints en límites de escena.
- [ ] `FIN-807` Extender QA a:
  - huecos;
  - solapes;
  - densidad;
  - contraste;
  - recortes;
  - títulos;
  - assets;
  - trazabilidad factual;
  - audio;
  - duración.
- [ ] `FIN-808` Invalidar QA al cambiar story, transcript, plan o props.
- [ ] `FIN-809` Crear contact sheet del episodio.
- [ ] `FIN-810` Bloquear render final sin aprobación.

Criterios de aceptación:

- se puede saltar a cualquier escena;
- un comentario conserva frame y escena;
- la UI no mezcla el estado de sesión y episodio;
- modificar una escena invalida el QA;
- la aprobación requiere QA técnico y factual.

### Fase 9. Orquestador, API y UI

Endpoints propuestos:

```text
GET    /api/editorial-video/channels
GET    /api/editorial-video/episodes
POST   /api/editorial-video/episodes
GET    /api/editorial-video/episodes/:id
POST   /api/editorial-video/episodes/:id/discover
POST   /api/editorial-video/episodes/:id/research
POST   /api/editorial-video/episodes/:id/story
PATCH  /api/editorial-video/episodes/:id/story
POST   /api/editorial-video/episodes/:id/story/approve
POST   /api/editorial-video/episodes/:id/narration
POST   /api/editorial-video/episodes/:id/transcribe
POST   /api/editorial-video/episodes/:id/visual-plan
POST   /api/editorial-video/episodes/:id/render-preview
POST   /api/editorial-video/episodes/:id/approve
POST   /api/editorial-video/episodes/:id/render-final
POST   /api/editorial-video/episodes/:id/cancel
POST   /api/editorial-video/episodes/:id/retry
```

Tareas:

- [ ] `FIN-900` Implementar el orquestador por etapas.
- [ ] `FIN-901` Hacer etapas idempotentes mediante hashes de inputs.
- [ ] `FIN-902` Persistir resultados antes de iniciar el siguiente side effect.
- [ ] `FIN-903` Propagar AbortSignal.
- [ ] `FIN-904` Reutilizar seguridad, CSRF, autenticación y límites actuales.
- [ ] `FIN-905` Validar rutas de media.
- [ ] `FIN-906` Implementar polling inicial; SSE queda opcional.
- [ ] `FIN-907` Crear UI `public/editorial-video/`.
- [ ] `FIN-908` Mostrar pipeline, errores, warnings y gates.
- [ ] `FIN-909` Permitir editar story y escenas sin editar JSON manual.
- [ ] `FIN-910` Enlazar Review Studio.
- [ ] `FIN-911` Mantener la feature flag hasta completar el piloto.

Criterios de aceptación:

- el servidor nunca espera a que termine un render para responder;
- cancelar detiene etapas cancelables;
- retry reanuda desde la última etapa segura;
- un doble clic no crea dos renders;
- las rutas privadas no salen en la API;
- la UI sigue siendo local-first.

### Fase 10. Entrega, metadata y publicación

Tareas:

- [ ] `FIN-1000` Crear paquete final con:
  - vídeo;
  - thumbnail pendiente o seleccionada;
  - título;
  - descripción;
  - capítulos;
  - fuentes;
  - disclaimer;
  - hashes;
  - manifest.
- [ ] `FIN-1001` Reutilizar `prepare-youtube-upload`.
- [ ] `FIN-1002` Generar metadata solo desde story y transcript aprobados.
- [ ] `FIN-1003` Incluir fuentes de forma legible cuando la política lo exija.
- [ ] `FIN-1004` Mantener publicación en confirmación manual.
- [ ] `FIN-1005` Reutilizar el publisher oficial de YouTube.
- [ ] `FIN-1006` Persistir idempotency key y sesión de subida.
- [ ] `FIN-1007` No publicar desde tests.

Criterios de aceptación:

- el paquete es autosuficiente;
- la metadata no añade claims nuevos;
- la publicación requiere confirmación;
- un timeout ambiguo no provoca subida duplicada.

### Fase 11. Skills, manifest y documentación

Crear una skill orquestadora:

```text
.agents/skills/produce-finance-story-video/
```

Responsabilidades:

- leer el perfil del canal;
- crear/reabrir un episodio;
- ejecutar investigación y story planner;
- esperar narración cuando corresponda;
- llamar a STT;
- generar visual plan;
- delegar las animaciones en `create-remotion-animations`;
- abrir Review Studio;
- producir el paquete final;
- no publicar sin confirmación.

Tareas:

- [ ] `FIN-1100` Crear y validar la skill.
- [ ] `FIN-1101` Actualizar `AGENTS.md`.
- [ ] `FIN-1102` Actualizar README y arquitectura.
- [ ] `FIN-1103` Añadir handoff en `create-remotion-animations`.
- [ ] `FIN-1104` Actualizar el manifest de capacidades.
- [ ] `FIN-1105` Documentar comandos y recuperación de errores.
- [ ] `FIN-1106` Documentar limpieza y retención.

Criterios de aceptación:

- un agente nuevo identifica la skill por una petición natural;
- la skill no duplica instrucciones técnicas de Remotion;
- los comandos documentados existen;
- la validación de skills pasa.

## 13. Estrategia de tests

### 13.1 Unitarios

- validación de configuración;
- canonicalización de URLs;
- deduplicación;
- normalización RSS/JSON;
- allowlist y redirects;
- clustering;
- ranking;
- ledger de claims;
- claims numéricos;
- contradicciones;
- rechazo de IDs inventados;
- story templates;
- máquina de estados;
- alineación guion-transcript;
- segmentación por palabras;
- cobertura temporal;
- selector de patrones;
- diversidad;
- validación de props;
- duración frame/segundo;
- DTOs sanitizados.

### 13.2 Integración

- fixture de fuentes -> dossier;
- dossier -> story;
- story + transcript sintético -> visual plan;
- visual plan -> props Remotion;
- persistencia y recuperación;
- cancelación y retry;
- endpoints HTTP, CSRF y autenticación;
- invalidación de revisiones;
- package final.

### 13.3 Remotion y QA visual

- `npm run remotion:check`;
- listado de composiciones;
- stills en entrada, punto principal y salida;
- escena con gráfica;
- escena con foto;
- escena estática;
- escena sin encabezado;
- escena con texto largo;
- contact sheet;
- comprobación de frame vacío;
- verificación de duración;
- prueba sin red.

### 13.4 E2E offline

Crear un episodio sintético de 60-90 segundos con:

- tres fuentes fixture;
- un CSV sintético claramente marcado;
- guion fixture;
- audio generado para test;
- transcript fixture con palabras;
- cinco escenas;
- preview;
- QA;
- render final.

El smoke no debe llamar a Internet ni publicar.

### 13.5 Tests opcionales de conectores

Los conectores reales deben tener contract tests desactivados por defecto y
habilitados solo con variables explícitas. No guardar respuestas privadas en
el repositorio.

## 14. Seguridad, privacidad y cumplimiento

- Reutilizar `fetchWithTimeout`.
- Permitir únicamente HTTPS salvo fixtures locales.
- Bloquear hosts y redirects fuera de política.
- Limitar bytes, tiempo, redirects y concurrencia.
- No registrar tokens, audio, artículos completos ni paths privados.
- Sanitizar mensajes de proveedores.
- No enviar fuentes, guiones o audio a un LLM remoto sin configuración
  consciente del canal.
- Mantener STT local como opción preferente.
- Validar todos los JSON externos mediante schemas.
- No usar `eval`, HTML remoto ni SVG remoto en render.
- Rasterizar SVG importados.
- Aplicar la seguridad HTTP ya existente.
- Conservar atribución y licencia de assets.
- Configurar disclaimers editoriales, sin tratarlos como sustituto de la
  verificación factual.

## 15. Observabilidad

Cada etapa debe registrar datos seguros:

```text
episodeId
stage
startedAt
completedAt
durationMs
inputRevision
outputRevision
fallbackUsed
warningCount
errorCode
```

Métricas útiles:

- fuentes recuperadas y válidas;
- duplicados eliminados;
- clusters;
- claims soportados/disputados/bloqueados;
- porcentaje de guion respaldado;
- desviación guion-audio;
- escenas generadas;
- escenas con fallback;
- cobertura temporal;
- tiempo de STT;
- tiempo de bundle/render;
- puntuación QA;
- número de revisiones.

No convertir logs en una segunda base de datos. El episode manifest sigue
siendo la fuente de estado.

## 16. Idempotencia e invalidación

Calcular una firma por etapa con los hashes relevantes:

```text
research = hash(channelConfig + sourceRecords)
story = hash(researchDossier + editorialConfig + promptVersion)
transcript = hash(audio + sttConfig)
alignment = hash(story + transcript)
visualPlan = hash(story + transcript + capabilities + visualProfile)
preview = hash(visualPlan + assets + Remotion revision)
final = hash(preview approval + audio + render config)
```

Si la firma no cambia, reutilizar el resultado.

Invalidaciones:

- nuevas fuentes -> dossier, story, visual plan, preview y final;
- story editado -> alineación, visual plan, preview y final;
- nuevo audio -> transcript, alineación, visual plan, preview y final;
- asset o props editados -> preview y final;
- cambio de identidad visual -> visual plan, preview y final;
- comentario sin cambio de contenido -> no invalida;
- aprobación -> no cambia contenido, solo habilita la etapa siguiente.

## 17. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Alucinación factual | Muy alto | Ledger, IDs cerrados, schemas y bloqueo |
| Datos financieros sin licencia | Alto | Proveedores configurables y provenance |
| Noticias contradictorias | Alto | Estado `disputed` y sección de incertidumbre |
| Audio diferente al guion | Alto | Alineación y revalidación de claims |
| Repetición visual | Medio | Historial de seis escenas y perfiles variables |
| Sobrecarga de texto | Medio | Encabezado opcional, límites y QA |
| Render demasiado lento | Medio | Caché por firmas y escenas reutilizables |
| Fallos de red | Medio | Caché, retry, aislamiento por conector |
| Reinicio durante render | Medio | Cola persistente y runs inmutables |
| Assets remotos rotos | Medio | Importación previa y render offline |
| Duplicación de código | Alto | Límites de dependencia y revisión por fase |
| Automatización editorial excesiva | Alto | Gates configurables |
| Publicación duplicada | Alto | Idempotency key y reconciliación |

## 18. Estrategia de lanzamiento

### Piloto asistido

- Tema introducido manualmente.
- Fuentes manuales o RSS controlados.
- Dossier automático.
- Story aprobado antes de grabar.
- Audio aportado por el usuario.
- Visual plan automático.
- Preview aprobada.
- Publicación manual.

### Piloto semiautomático

- Descubrimiento automático.
- El sistema propone tres historias.
- El usuario selecciona una.
- Resto del flujo igual.

### Operación programada

- Research diario programado.
- Story draft automático.
- Notificación de episodio listo para revisar.
- Sigue esperando narración y aprobación final.

### Automatización avanzada futura

- Priorización basada en rendimiento histórico.
- Versiones largas y Shorts derivados.
- Reutilización de scenes para carruseles.
- Varios perfiles de canal.
- Calendario editorial.

No comenzar por la automatización programada. Primero validar un episodio
completo y medir dónde se concentra la corrección humana.

## 19. Decisiones de producto pendientes

Estas decisiones no bloquean las fundaciones porque deben vivir en config:

- nombre y slug definitivo;
- handle;
- duración objetivo;
- frecuencia de publicación;
- lista de fuentes autorizadas;
- proveedores de datos financieros y licencias;
- tono: explicativo, documental, crítico o más dinámico;
- nivel de disclaimers;
- presencia de subtítulos;
- música de fondo;
- identidad visual definitiva;
- necesidad de Shorts derivados;
- política de publicación automática.

Defaults provisionales recomendados:

- español;
- 1920x1080;
- seis a diez minutos;
- tres a seis fuentes;
- tono explicativo-documental;
- sin watermark;
- encabezados opcionales;
- dos gates humanos: story y preview;
- confirmación adicional para publicar.

## 20. Definition of Done del MVP

El MVP estará terminado cuando:

- [ ] existe un canal versionado y validado;
- [ ] se puede crear y reabrir un episodio;
- [ ] se ingieren fuentes mediante fixtures, manual y RSS;
- [ ] se genera un dossier con claims trazables;
- [ ] se genera y aprueba un guion;
- [ ] se importa y transcribe una narración;
- [ ] se crea un informe de alineación;
- [ ] se genera un visual plan completo;
- [ ] todos los patrones y assets existen;
- [ ] se renderiza una preview de duración dinámica;
- [ ] Review Studio permite navegar y comentar escenas;
- [ ] QA técnico y factual pasan;
- [ ] se renderiza un máster final;
- [ ] se genera metadata sin claims nuevos;
- [ ] no se realiza ninguna publicación sin confirmación;
- [ ] el flujo se recupera tras reiniciar;
- [ ] `npm test`, `npm run smoke` y `npm run remotion:check` pasan;
- [ ] la skill y documentación están actualizadas;
- [ ] no hay datos privados ni outputs staged.

## 21. Instrucciones para el agente implementador

1. Leer `AGENTS.md`.
2. Leer este documento completo.
3. Leer las skills:
   - `create-remotion-animations`;
   - `remotion-best-practices`;
   - `skill-creator` cuando llegue la fase 11.
4. Auditar los archivos reales antes de crear módulos.
5. No duplicar LLM, STT, FFmpeg, queue, publishers ni Remotion.
6. Empezar por schemas y persistencia, no por la UI.
7. Implementar cada fase en un commit separado.
8. Añadir tests junto con cada contrato.
9. Usar fixtures offline.
10. No activar fuentes reales ni enviar contenido a proveedores durante tests.
11. No crear todas las animaciones financieras candidatas de antemano.
12. Mantener compatibilidad con Shorts, Stories, Carouselsmith y Remotion
    existente.
13. No tocar datos o cambios ajenos del worktree.
14. No commitear audio, artículos, datasets de trabajo, jobs o renders.
15. No publicar contenido.
16. Al final de cada fase informar:
    - archivos;
    - contratos;
    - tests;
    - limitaciones;
    - siguiente dependencia.

## 22. Primer hito recomendado

El primer encargo de implementación debe limitarse a las fases 0 y 1:

1. estructura del canal;
2. schemas;
3. registro de canales;
4. repositorio de episodios;
5. máquina de estados;
6. CLI mínima;
7. tests;
8. documentación.

Ese hito proporciona una base verificable sin conectarse todavía a noticias,
LLMs, STT o Remotion. Una vez aprobado, continuar con investigación y dossier.
