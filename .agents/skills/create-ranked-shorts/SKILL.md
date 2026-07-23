---
name: create-ranked-shorts
description: "Convierte un vídeo largo MP4 en Shorts verticales 9:16 con Shortsmith, selecciona y refina los mejores cortes, añade subtítulos, comprueba los renders y los ordena por potencial viral. Usar cuando el usuario pida extraer, generar, reutilizar o rankear Shorts, Reels o vídeos cortos a partir de un vídeo largo."
---

# Crear Shorts rankeados

Generar cortes verticales terminados y revisados, no solo sugerencias de tiempos. Reutilizar el pipeline Node existente y no publicar en ninguna plataforma sin autorización explícita.

## Flujo

1. Resolver la ruta absoluta del MP4 y comprobarla con `ffprobe`.
2. Reutilizar una transcripción aportada por el usuario o el `transcript.json` de un job anterior del mismo vídeo. Verificar coincidencia mediante nombre y duración.
3. Si no existe transcripción, dejar que Shortsmith use Faster-Whisper local.
4. Ejecutar desde la raíz del proyecto:

```powershell
npm run process -- --video "<video.mp4>" --transcript "<transcript.json>" --top 8 --min 18 --max 60 --quality high --subtitle-mode progressive --subtitle-preset progressive-punchy --no-llm
```

Omitir `--transcript` si no existe. En ese caso añadir `--stt-provider faster-whisper --stt-model small --stt-language es --stt-device cpu --stt-compute-type int8 --stt-python "<python-con-faster-whisper>"`. Obtener el Python mediante `load_workspace_dependencies` cuando esté disponible. Mantener `--no-llm` por defecto; quitarlo solo si el usuario autoriza el LLM configurado.

5. Leer `transcript.json`, `candidates.json` y `job.json`. No aceptar ciegamente los límites automáticos.
6. Seleccionar entre 6 y 8 ideas distintas. Favorecer cortes que se entiendan sin el vídeo largo y que incluyan gancho, desarrollo y cierre.
7. Ajustar cada inicio y final a límites naturales de frase. Evitar saludos, contexto prescindible, silencios y finales cortados.
8. Asignar un título provisional breve y un ranking editorial.
9. Crear un JSON de refinamiento dentro del job y ejecutar:

```powershell
node .agents/skills/create-ranked-shorts/scripts/refine-clips.mjs --job <job-id> --spec "<ruta-al-json>"
```

Validar primero sin renderizar con `--dry-run` cuando los cambios sean amplios.

## Especificación de refinamiento

Usar un array JSON. Reutilizar un `clipId` seleccionado por el job para cada corte:

```json
[
  {
    "clipId": "clip-1234abcd",
    "rank": 1,
    "start": 42.3,
    "end": 78.6,
    "title": "La IA encontró una salida inesperada",
    "subtitlePreset": "progressive-punchy"
  }
]
```

Mantener normalmente cada corte entre 18 y 60 segundos. Permitir una excepción ligeramente más corta solo si contiene una idea completa y mejora claramente el ritmo.

## Ranking editorial

Ordenar manualmente por:

- Fuerza del gancho o conflicto: 30 %.
- Novedad y capacidad de provocar curiosidad: 20 %.
- Payoff o conclusión clara: 20 %.
- Comprensión sin contexto: 15 %.
- Entidades o temas reconocibles: 10 %.
- Duración y ritmo: 5 %.

Evitar que varios Shorts repitan el mismo ángulo. El `viralScore` automático es una señal, no la decisión final.

## Control de calidad

Comprobar cada vídeo actual indicado por `clip.files.video`:

- Archivo existente y reproducible.
- Resolución `1080x1920`, vídeo H.264, audio AAC y píxel `yuv420p`.
- Duración coherente con el rango elegido.
- Webcam o sujeto visible arriba y pantalla legible debajo en fuentes horizontales; usar `fit` si no hay webcam estable.
- Subtítulos legibles, sincronizados y dentro de márgenes seguros.
- Inicio con frase completa o gancho deliberado y final con cierre real.
- Nombres propios corregidos en la transcripción antes del render final.

Generar y revisar al menos una captura representativa de cada Short. Si la composición o los subtítulos fallan, corregir y rerenderizar.

## Entrega

Responder con una tabla ordenada que incluya ranking, título provisional, duración y enlace absoluto a cada MP4. Enlazar también la carpeta completa del job, indicar cuáles revisar primero y confirmar que no se ha subido nada.
