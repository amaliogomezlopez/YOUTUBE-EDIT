# Flujo operativo de scouting

## Objetivo

Conseguir cobertura completa y, después, evidencia temporal suficiente para
reconstruir únicamente las mecánicas visuales elegidas.

## Preflight

1. Confirmar la raíz `D:\2-YOUTUBE-EDIT`.
2. Leer `docs/animation-scouting.md`.
3. Comprobar `node`, `npm`, `ffmpeg`, `ffprobe` y `yt-dlp`.
4. Si `yt-dlp` vive en `.tools/`, anteponer esa carpeta a `PATH` solo para el
   comando actual.
5. Comprobar que la carpeta `--out` no existe o está completamente vacía.
6. No mostrar valores de `.env`. Para el LLM visual solo interesa saber:
   configuración completa, capacidad multimodal y si el endpoint acepta data
   URLs.

No instalar ni descargar herramientas sin autorización. Preferir el ejecutable
oficial autocontenido de `yt-dlp` y mantener `.tools/` fuera de Git.

## Nombres de jobs

Usar nombres reproducibles:

```text
data/review/animation-scout/<source-id>-survey/
data/review/animation-scout/<source-id>-01-<mecanica>/
data/review/animation-scout/<source-id>-02-<mecanica>/
```

Mantener el MP4 descargado dentro del job survey. En los estudios pasar su ruta
local a `--source` para no volver a descargar.

## Survey

Ejecutar:

```powershell
npm run scout:animations -- --source "<fuente>" --mode survey --out "<job-survey>" --goal "<pregunta visual>"
```

El valor predeterminado solicita 2 fps y limita a 240 frames. Para vídeos de
más de dos minutos el fps efectivo bajará. Esto es válido para localizar
zonas, pero debe quedar documentado.

Si se necesita mejor cobertura y el presupuesto lo permite:

```text
maxFrames = min(5000, ceil(durationSeconds * targetSurveyFps))
```

No superar 2 fps en survey salvo que el vídeo sea corto. El objetivo es
cobertura; el detalle pertenece a `study`.

## Selección de rangos

Revisar todas las hojas en orden cronológico y crear una lista inicial con:

- inicio y fin;
- transformación visible;
- objeto que conserva continuidad;
- posible patrón o efecto;
- duda principal;
- prioridad.

Favorecer:

- un objeto que cambia de estado;
- movimiento sostenido durante varios frames;
- trayectorias y máscaras legibles;
- cambios de jerarquía;
- transiciones que conservan posición o identidad;
- mecanismos aplicables al menos a dos casos futuros.

Penalizar:

- hard cuts;
- movimiento de cámara sin diseño adicional;
- créditos, logos y end cards;
- ruido de compresión;
- una escena estática con más texto;
- animaciones que dependen de assets imposibles de sustituir.

Los `motionWindows` ayudan a orientar, pero no sustituyen la revisión visual.

## Study

Elegir normalmente entre cinco y diez rangos. Mantenerlos tan cortos como sea
posible sin cortar la entrada, transformación, hold y salida.

```powershell
npm run scout:animations -- --source "<mp4-local>" --mode study --start 03:44 --end 04:08 --fps 10 --max-frames 240 --out "<job-study>"
```

Calcular:

```text
requiredFrames = ceil((endSeconds - startSeconds) * requestedFps)
```

Establecer `--max-frames` al menos en ese valor. Usar:

- 8 fps para secuencias largas o movimiento sencillo;
- 10-12 fps para la mayoría de motion graphics;
- 24-30 fps para transiciones de hasta unos tres segundos;
- crop solo si la animación ocupa una región claramente aislada.

No deduplicar frames en study.

## Revisión visual

Leer el manifest, el handoff y todas las hojas. Revisar fotogramas originales
cuando el overview no permita distinguir:

- dirección del recorrido;
- orden del stagger;
- origen de escala;
- frontera de una máscara;
- continuidad entre dos estados;
- posición del objeto persistente.

Para cada candidato registrar:

1. Estado inicial.
2. Primer cambio significativo.
3. Transformación principal.
4. Estado de conclusión.
5. Hold y salida.

## Análisis automático o manual

Usar análisis automático solo cuando el modelo documente visión en Chat
Completions y acepte `image_url` con data URLs.

Si no hay visión:

1. Inspeccionar hojas con una herramienta visual local.
2. Crear `manual-visual-analysis.json`.
3. Mantener `model: null` y `analysisMode: manual-agent-review`.
4. Registrar que ninguna imagen salió del equipo.
5. Seguir el contrato de [analysis-contract.md](analysis-contract.md).

No probar a ciegas un modelo de texto con todas las hojas.

## Validación mínima

- El manifest debe registrar el fps solicitado y efectivo.
- Cada estudio debe contener frames, hojas, `motion-profile.json` y
  `remotion-handoff.json`.
- El análisis JSON debe parsear.
- Todo candidato debe estar dentro del rango inspeccionado.
- Cada inferencia debe incluir al menos una incertidumbre cuando no sea
  directamente visible.
