---
name: create-ranked-shorts
description: "Convierte un vídeo largo MP4 en Shorts verticales 9:16 con Shortsmith, selecciona y refina los mejores cortes, añade subtítulos, comprueba los renders y los ordena por potencial viral. Usar cuando el usuario pida extraer, generar, reutilizar o rankear Shorts, Reels o vídeos cortos a partir de un vídeo largo."
---

# Crear Shorts rankeados

Generar cortes verticales terminados y revisados. Reutilizar el pipeline Node existente. La publicación requiere autorización explícita; generar, corregir y verificar los archivos forma parte del encargo de montaje.

Esta skill extrae cortes de un vídeo largo. Para montar varios clips desde cero, seguir `docs/shorts-desde-cero.md` y su flujo `shorts:ingest` → `shorts:build` → `shorts:render`.

## Preparación

1. Leer las instrucciones del repositorio, [la guía de montaje](../../../docs/shorts-adaptive-editing.md) y `src/modules/shorts-studio/rules/shorts-rules.json` antes de modificar planes. El JSON es el contrato ejecutable.
2. Resolver la ruta absoluta del MP4 y comprobarla con `ffprobe`. Si la ruta falla, buscar primero el nombre en la carpeta indicada; no sustituir la fuente por otro vídeo sin evidencia.
3. Reutilizar la transcripción aportada o un job de esa misma fuente, comprobando su ruta de origen y duración. No reutilizar transcripciones solo porque el nombre se parezca.
4. Si falta transcripción, omitir `--transcript` y usar la configuración local de STT. Conservar proveedor, modelo, idioma, dispositivo y Python configurados; no degradar una instalación GPU a `small`/CPU por defecto. Solo cambiar flags cuando el encargo o un fallo comprobado lo justifique. Un Python genérico no garantiza tener Faster-Whisper instalado. No imprimir `.env` ni credenciales.
5. Respetar la cantidad y el estilo pedidos. Si el usuario pide uno o dos ejemplos, generar uno o dos. Si no especifica cantidad, usar hasta ocho cortes distintos; entregar menos si no hay suficientes ideas completas y explicarlo.

## Generación y revisión editorial

Ejemplo para **dos** cortes; ajustar `--top` a la cantidad acordada:

```powershell
npm run process -- --video "<video.mp4>" --transcript "<transcript.json>" --top 2 --min 18 --max 60 --quality high --editing-profile dinamico --subtitle-mode progressive --subtitle-preset progressive-punchy --no-llm
```

El perfil `dinamico` activa el montaje adaptativo; usar `sobrio` o `energico` según la preferencia del usuario. Estos son valores iniciales: al revisar un job, conservar su perfil y subtítulos aprobados salvo cambio solicitado. Mantener `--no-llm` salvo que el encargo o la autorización previa incluya usar el LLM configurado.

Leer `transcript.json`, `candidates.json` y `job.json`. Revisar los límites automáticos y escoger ideas que se entiendan sin el vídeo largo, con gancho, desarrollo y cierre. Ajustar inicio y final a frases naturales; evitar palabras cortadas, saludos y contexto prescindible. Mantener normalmente 18–60 segundos, salvo otra duración solicitada o una idea completa que justifique la excepción.

Ordenar por gancho/conflicto (30 %), novedad (20 %), conclusión (20 %), comprensión autónoma (15 %), temas reconocibles (10 %) y ritmo (5 %). Evitar ángulos repetidos. El `viralScore` es una estimación editorial; no inventar métricas reales ni garantizar viralidad.

## Refinamiento del job

Guardar un JSON dentro del job usando sus `clipId` reales. Incluir únicamente los campos que se quieran cambiar:

```json
[
  {
    "clipId": "clip-1234abcd",
    "rank": 1,
    "start": 42.3,
    "end": 78.6,
    "title": "La IA encontró una salida inesperada"
  }
]
```

```powershell
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<ruta-al-json>" --dry-run
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<ruta-al-json>"
```

El `--dry-run` comprueba identificadores, rangos y presencia de transcripción para todo el lote sin escribir ni renderizar. No sustituye los validadores del build ni la revisión del MP4.

`start` y `end` omitidos conservan el rango actual. El helper acepta `subtitleMode`, `subtitlePreset`, `subtitleStyle`, `quality`, `renderMode`, `webcamBox` y `editing` según los contratos del pipeline. Omitirlos conserva los ajustes existentes. `editing` permite las correcciones de perfil, efectos, escenas y palabras documentadas en la guía; no inventar campos ni coordenadas.

Cambiar entrada/salida reconstruye el plan y descarta ediciones anteriores de escenas y palabras. Cambiar perfil reconstruye escenas y conserva palabras. Hacer primero ese cambio, leer el nuevo plan y después corregir sus escenas/palabras en una segunda pasada: no enviar correcciones basadas en el plan antiguo junto al cambio de rango o perfil. Anclar correcciones a los índices reales de palabras; regiones de pantalla en píxeles de la fuente y centro facial entre 0 y 1.

El helper guarda el título y ranking después de un render correcto y actualiza el JSON del clip. Si falla un corte posterior, conserva los anteriores completados. Consultar siempre `job.json` y `clip.files.video` al retomar.

## Control de calidad

Verificar cada MP4 actual indicado por `clip.files.video`:

- Archivo reproducible, `1080x1920`, vídeo H.264, audio AAC y píxel `yuv420p`.
- Duración coherente con el plan compilado y su mapa de tiempos; las pausas eliminadas pueden acortarla frente a `end - start`.
- Leer el informe técnico `render-qa.json` cuando exista y los errores/avisos del build. Corregir los errores y revisar los avisos; justificar las decisiones editoriales que se mantienen.
- Revisar imágenes del inicio, mitad y final, además de cambios de layout y el momento de pantalla más denso. Verificar webcam/cara, texto, recortes y márgenes en esos momentos; una captura aislada no basta.
- Clasificar por segmento: webcam en esquina → `pip`; sujeto a pantalla completa → `full`; pantalla sin webcam → `fit`. Evitar forzar un único modo cuando cambia la fuente.
- Pantalla inferior y comparaciones centradas (SH-R-043): un panel de 900 px sobre un lienzo de 1080 deja 90 px a cada lado. La zona segura de subtítulos tiene su propia geometría.
- Reproducir y escuchar el MP4 para comprobar sincronía, volumen, cortes de audio, ritmo y cierre. Si la herramienta no permite comprobar alguno, declararlo pendiente; una revisión visual no certifica el audio.
- Corregir nombres propios con evidencia de la fuente. No añadir información inventada a títulos o subtítulos.

La QA técnica y la visual son pasos distintos. Si la composición o los subtítulos fallan, corregir, volver a renderizar y revisar el nuevo archivo. Un still corregido no actualiza los MP4 anteriores.

## Feedback y reproducibilidad

Convertir feedback general de montaje en regla con `npm run shorts:feedback`, siguiendo el contrato de `AGENTS.md`: regla, validador y fixture, sin dejar `TODO`. Comprobar antes si ya existe una regla aplicable y extenderla cuando corresponda. Una corrección específica de una escena pertenece al plan, con su motivo; no convertir coordenadas de un vídeo en valores globales.

Conservar plan aprobado, transcripción, assets y ajustes/versiones de render para reproducir geometría, tiempos y efectos. La selección editorial, la transcripción y el análisis pueden variar entre ejecuciones o versiones; no prometer que regenerar todo desde cero produzca idéntico resultado. Mantener medios privados y outputs fuera de los commits.

## Entrega

Entregar únicamente los cortes solicitados, en orden, con título provisional, duración real y enlace absoluto a cada MP4 actual. Enlazar el job cuando ayude a continuar. Indicar qué se verificó y cualquier comprobación pendiente; distinguir ejemplos renderizados, cambios permanentes del pipeline y ajustes particulares del plan. No publicar sin autorización.
