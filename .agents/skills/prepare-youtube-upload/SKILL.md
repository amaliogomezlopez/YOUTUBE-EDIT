---
name: prepare-youtube-upload
description: "Analiza un vídeo largo MP4 con Shortsmith y prepara su paquete editorial para YouTube: un párrafo resumen, títulos alternativos, capítulos con timestamps y exactamente 14 hashtags en una línea. Usar cuando el usuario quiera preparar, posicionar o completar los metadatos de un vídeo largo antes de subirlo a YouTube, especialmente si solo aporta la ruta del vídeo o una transcripción."
---

# Preparar publicación de YouTube

Generar un paquete editorial verificable a partir de la transcripción real del vídeo. Mantener el contenido en español salvo petición contraria y no subir ni publicar nada sin autorización explícita.

## Flujo

1. Resolver la ruta absoluta del MP4 y comprobar que existe.
2. Buscar una transcripción SRT, VTT, JSON o TXT proporcionada por el usuario.
3. Si no existe, reutilizar `data/jobs/<job-id>/transcript.json` de un job terminado que coincida con el nombre del vídeo y su duración.
4. Si tampoco existe, ejecutar Shortsmith desde la raíz del proyecto con `--top 0` para transcribir sin renderizar clips:

```powershell
npm run process -- --video "<video.mp4>" --top 0 --stt-provider faster-whisper --stt-model small --stt-language es --stt-device cpu --stt-compute-type int8 --stt-python "<python-con-faster-whisper>" --no-llm
```

Usar el Python devuelto por `load_workspace_dependencies` cuando esté disponible. Si el usuario proporciona una transcripción, añadir `--transcript "<transcript>"` y omitir las opciones STT. Mantener `--no-llm` por defecto para no enviar la transcripción a terceros; quitarlo solo si el usuario autoriza el LLM configurado.

5. Leer la transcripción completa, incluidos los tiempos. Corregir únicamente errores evidentes de nombres propios y términos técnicos. Verificar nombres dudosos en fuentes autorizadas sin introducir hechos que no aparezcan en el vídeo.
6. Identificar tema central, noticias o bloques, opinión del creador, pruebas y conclusión.
7. Crear el paquete final y revisar todas las restricciones antes de entregarlo.

## Contrato editorial

Entregar siempre en este orden:

1. **Título recomendado** y 12 alternativas ordenadas por potencial de clic.
2. **Resumen** en un único párrafo de 70 a 120 palabras.
3. **Timeline** en un bloque copiable con este formato:

```text
Timeline:
00:00 Introducción
01:25 Primer tema
03:10 Segundo tema
```

4. **Hashtags**: exactamente 14 hashtags únicos, seguidos, separados por un espacio y en una sola línea.

Aplicar estas reglas:

- Basar cada afirmación en la transcripción; no inventar resultados.
- Favorecer títulos cortos y compactos, con curiosidad o conflicto real y sin clickbait falso.
- Mezclar alternativas informativas, contundentes y de estilo noticia cuando el contenido lo permita.
- Mantener pocas secciones: normalmente entre 4 y 8 según la duración.
- Iniciar siempre en `00:00`, ordenar los capítulos y dejar al menos 25 segundos entre timestamps.
- Limitar el texto de cada capítulo a unas 2-6 palabras.
- Usar hashtags específicos del tema antes que etiquetas genéricas.
- No incluir saltos de línea dentro de la línea de hashtags.

## Artefactos

Además de responder en el chat, guardar junto al job:

- `youtube-upload-pack.md`, con el contenido listo para copiar.
- `youtube-upload-pack.json`, con `sourceVideo`, `recommendedTitle`, `alternativeTitles`, `summary`, `timestamps`, `hashtags` y `hashtagsLine`.

No sobrescribir `publishing-metadata.json`; conservar el resultado revisado como artefacto separado. En la respuesta final enlazar ambos archivos y la transcripción utilizada.

## Validación

Antes de terminar, comprobar:

- El resumen es un solo párrafo.
- Hay 12 alternativas además del título recomendado.
- El primer timestamp es `00:00`.
- Todos los saltos entre capítulos son de 25 segundos o más.
- Cada capítulo corresponde al tema que comienza en ese punto.
- `hashtagsLine` contiene exactamente 14 hashtags únicos.
- No se ha realizado ninguna subida externa.
