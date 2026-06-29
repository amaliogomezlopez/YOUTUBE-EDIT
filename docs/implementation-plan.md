# Plan de Implementación

## Objetivo

Crear un MVP similar a Opus Clip/Vidyo/Vizard: recibe un video largo, encuentra momentos candidatos, los puntúa, los convierte a formato vertical con subtítulos y permite revisarlos/exportarlos.

## Subproblemas y soluciones

### 1. Ingesta de video

Problema: los videos largos son pesados, lentos y fallan si se procesan en una petición HTTP bloqueante.

Solución MVP:
- Guardar uploads en `data/uploads`.
- Permitir rutas locales para videos largos, evitando cargar directos completos en memoria.
- Crear un job persistido en `data/jobs/<job-id>/job.json`.
- Procesar en background desde el servidor.
- Exponer estado por `/api/jobs/:id`.

Riesgo:
- El servidor actual procesa jobs en el mismo proceso Node. Para producción se debe mover a BullMQ/Celery/Temporal.
- El parser multipart del MVP no es streaming. Para archivos grandes, usar ruta local o CLI.

### 2. Transcripción

Problema: sin timestamps no hay cortes confiables.

Solución MVP:
- Preferir SRT/VTT/JSON con timestamps.
- Aceptar texto plano solo como fallback aproximado.
- Soportar STT opcional con OpenAI.

Riesgo:
- OpenCode suele cubrir LLM, no necesariamente STT. Por eso STT está separado.

### 3. Detección de clips

Problema: un video largo puede tener muchas frases buenas pero pocos clips autosuficientes.

Solución MVP:
- Construir ventanas de 18-60 segundos sobre captions.
- Puntuar ventanas por hook, densidad, emoción, payoff y duración.
- Eliminar duplicados por solape temporal.

Riesgo:
- Las ventanas pueden cortar una idea antes o después del punto perfecto. UI de ajuste de rango queda para V2.

### 4. Scoring viral

Problema: "viralidad" no es una métrica única; depende de nicho y audiencia.

Solución MVP:
- Heurística transparente y criticable.
- Enriquecimiento LLM opcional para títulos, hooks, críticas y ajuste de score.
- Penalizar clips que dependan demasiado de contexto externo.

Riesgo:
- Un LLM puede sobrevalorar clips con palabras llamativas pero poco contenido. Por eso se conserva el score por componentes.

### 5. Edición vertical

Problema: convertir horizontal a vertical sin perder sujeto.

Solución MVP:
- Crop centrado `1080x1920`.
- Subtítulos ASS quemados.
- Audio reencode AAC y video H.264.

Riesgo:
- Crop centrado falla si la persona está en un lateral. V2: face tracking y composición split-screen.

### 6. Panel de revisión

Problema: el usuario necesita inspeccionar resultados, no solo recibir archivos.

Solución MVP:
- Panel web sin dependencias.
- Upload de video/transcript.
- Polling del job.
- Cards por clip con score, motivos y video reproducible.

Riesgo:
- No hay timeline ni edición manual todavía.

## To-do List

- [x] Crear estructura profesional del proyecto.
- [x] Implementar CLI.
- [x] Implementar API local.
- [x] Implementar panel web.
- [x] Parsear SRT/VTT/JSON/texto.
- [x] Extraer audio con FFmpeg.
- [x] Soportar STT opcional.
- [x] Detectar candidatos.
- [x] Puntuar candidatos.
- [x] Integrar LLM OpenAI-compatible/OpenCode.
- [x] Renderizar clips verticales.
- [x] Quemar subtítulos.
- [x] Persistir metadata por job/clip.
- [x] Añadir tests unitarios.
- [x] Añadir smoke test end-to-end.
- [ ] V2: face tracking.
- [ ] V2: subtítulos palabra por palabra.
- [ ] V2: plantillas Remotion.
- [ ] V2: editor de cortes.
- [ ] V2: cola de jobs persistente.
