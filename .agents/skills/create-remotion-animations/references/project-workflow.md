# Flujo editorial dentro de YouTube Edit

## Mapa del proyecto

- `src/` y `scripts/`: pipeline Node de Shortsmith, transcripción y FFmpeg.
- `data/jobs/`: jobs y transcripciones reutilizables.
- `data/transcriptions/`: lotes de transcripciones conservados localmente.
- `remotion-animations/src/`: componentes y composiciones.
- `remotion-animations/out/`: renders temporales o de trabajo, no versionados.
- `remotion-animations/projects/`: guías y contexto específicos de cada vídeo.

No crear un segundo pipeline de transcripción ni otro proyecto Remotion.

## Inventario

Buscar de forma recursiva `*.mp4`, `*.mkv`, `*.mov`, `*.webm`, `*.srt`, `*.vtt`, `*.json` y `*.txt`. Ordenar clips numerados por su prefijo numérico, no por orden lexicográfico. Comprobar cada vídeo con `ffprobe` y registrar:

- ruta y nombre;
- duración;
- resolución y relación de aspecto;
- fps;
- codecs de vídeo y audio.

Mantener los originales en modo solo lectura durante todo el trabajo.

## Transcripción

Priorizar, por este orden:

1. Transcripción proporcionada por el usuario.
2. `transcript.json` de un job previo que coincida en vídeo y duración.
3. Faster-Whisper local de Shortsmith.

Para transcribir sin producir Shorts:

```powershell
npm run process -- --video "<clip>" --top 0 --stt-provider faster-whisper --stt-model small --stt-language es --stt-device cpu --stt-compute-type int8 --stt-python "<python-con-faster-whisper>" --no-llm
```

Detectar primero el Python local o ejecutar `npm run stt:setup` si Faster-Whisper aún no está instalado. Intentar GPU solo cuando el entorno esté verificado; si faltan librerías CUDA, repetir en CPU `int8` sin bloquear el encargo. No imprimir `.env`, tokens ni rutas de claves.

Conservar segmentos y palabras con tiempos cuando estén disponibles. Corregir solo errores evidentes de nombres o términos técnicos; no reescribir lo dicho.

## Criterio para proponer una pieza

Asignar prioridad alta cuando la locución contiene:

- un dato o rango que necesita énfasis;
- dos o más opciones que se comparan;
- una secuencia o sistema con varias etapas;
- una relación entre componentes;
- una acumulación, cuello de botella o cambio temporal;
- una metáfora visual útil para un concepto abstracto.

Asignar prioridad baja o descartar cuando:

- la imagen repetiría literalmente el discurso;
- el dato no tiene respaldo suficiente;
- el clip ya contiene una visual clara;
- no existe tiempo de lectura;
- otra animación del paquete comunica la misma idea.

## Plan mínimo

Preparar una fila por propuesta con:

| Campo | Contenido |
| --- | --- |
| `clipNumber` | Prefijo o identificador exacto del vídeo |
| `sourceFile` | Ruta absoluta del clip |
| `sourceIn` / `sourceOut` | Tramo de locución relevante |
| `durationSeconds` | Duración de la animación |
| `concept` | Idea visual en una frase |
| `evidence` | Cita breve o paráfrasis fiel de la transcripción |
| `compositionId` | ID Remotion estable |
| `format` | `fullscreen` u `overlay-alpha` |
| `priority` | Alta, media o baja |

No programar todas las ideas posibles. Elegir las que mejoran materialmente la comprensión y aportan variedad visual.

## Coordinación con otras skills

- Usar `create-ranked-shorts` para seleccionar y renderizar Shorts 9:16; usar esta skill solo para sus motion graphics.
- Usar `prepare-youtube-upload` para títulos, resumen, capítulos y hashtags del vídeo largo.
- Usar `carouselsmith` para carruseles estáticos o secuencias editoriales 4:5/9:16.
- Reutilizar una misma transcripción validada entre skills cuando el vídeo y la duración coincidan.
