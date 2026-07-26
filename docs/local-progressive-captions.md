# Subtítulos progresivos locales

Shortsmith genera subtítulos editoriales acumulativos sin enviar vídeo, audio o texto a la nube. Node mantiene la orquestación; Faster-Whisper se ejecuta como un proceso CLI aislado y FFmpeg/libass compone el resultado final.

## Instalación

```powershell
npm run stt:setup
```

El comando crea `.venv-whisper` e instala `faster-whisper`. El primer procesamiento descarga el modelo elegido dentro de `data/models/faster-whisper`.

Para descargar manualmente el modelo `small` desde el repositorio oficial:

```powershell
.\.venv-whisper\Scripts\hf.exe download Systran/faster-whisper-small --local-dir data\models\faster-whisper\small
```

Shortsmith detecta después `data/models/faster-whisper/small` automáticamente. `model.bin`, `config.json`, `tokenizer.json` y `vocabulary.txt` o `vocabulary.json` deben quedar directamente dentro de esa carpeta, no dentro de otra subcarpeta `faster-whisper-small`.

También reutiliza modelos ya presentes en la caché local de Hugging Face. Para aprovechar un entorno Python existente con Faster-Whisper, CUDA 12 y cuDNN 9, indica su ejecutable mediante `FASTER_WHISPER_PYTHON`; el adaptador detectará las DLL de los paquetes `nvidia-*` instalados en ese entorno.

Configuración opcional en `.env`:

```text
TRANSCRIPTION_PROVIDER=faster-whisper
TRANSCRIPTION_MODEL=large-v3-turbo
TRANSCRIPTION_LANGUAGE=auto
FASTER_WHISPER_DEVICE=cuda
FASTER_WHISPER_COMPUTE_TYPE=float16
FASTER_WHISPER_PYTHON=D:/ruta/al/entorno/Scripts/python.exe
FASTER_WHISPER_INITIAL_PROMPT=Kimi K3, GPT-5, OpenAI, Claude Opus
TRANSCRIPTION_TIMEOUT_MS=3600000
```

Para una RTX 4070 Super de 12 GB, `large-v3-turbo` ofrece un buen equilibrio entre precisión y velocidad. `small` sigue siendo útil para iteraciones rápidas, mientras que `large-v3` prioriza la precisión a costa de más tiempo. Todos usan word timestamps.

## Flujo

1. FFmpeg extrae audio mono a 16 kHz.
2. `scripts/faster-whisper-local.py` transcribe con `word_timestamps=True` y VAD.
3. `transcript.json` conserva segmentos y `words[]` con inicio, fin y confianza.
4. El planificador agrupa palabras por pausas, puntuación, duración y límite visual.
5. El renderer crea estados ASS acumulativos con posición y tamaños estables.
6. FFmpeg quema el ASS en el Short 1080 × 1920 usando las fuentes de `data/fonts`.

## Presets

- `progressive-reference`: bloque centrado inspirado en la referencia, primera línea en minúsculas, palabra protagonista en mayúsculas, cierre corto en mayúsculas y texto blanco sin reborde.
- `progressive-punchy`: máximo cinco palabras por bloque, líneas cortas, Bahnschrift y más cambios visuales.
- `progressive-editorial`: texto blanco y una palabra protagonista grande, como la referencia visual.
- `progressive-clean`: jerarquía más contenida y palabra activa con color de acento.
- `karaoke-highlight`: bloque centrado, tamaño más uniforme y seguimiento de la palabra actual.

El plan resultante se guarda en `caption-plan.json`. Contiene páginas, líneas, palabras, posiciones, tamaños y el origen de los tiempos (`word`, `mixed` o `approximate`). Esto permite editar o regenerar el estilo sin volver a transcribir.

## Fuentes

Copia archivos `.ttf` u `.otf` autorizados en:

```text
data/fonts/
```

Shortsmith lee la tabla interna de cada fuente y muestra su familia y estilo reales, aunque el nombre del archivo sea diferente. FFmpeg recibe esta carpeta mediante `fontsdir`, y la preview usa exactamente esa familia.

La interfaz sugiere las familias verificadas en el equipo, pero mantiene el campo abierto para otras fuentes instaladas. `Reborde` y `Sombra` aceptan `0`; con ambos valores en cero el texto se renderiza en un único color sin efectos negros.

## Controles del dashboard

El panel de producción permite configurar el flujo completo sin recurrir a la CLI:

- fuente de vídeo por ruta local o subida;
- transcript aportado o Faster-Whisper local, modelo, idioma y vocabulario contextual;
- cantidad, duración, selección por viralidad, composición, calidad y modo de subtítulos;
- preset, fuente, posición, tamaño, colores, reborde, sombra y jerarquía;
- alineación, capitalización, escalas, palabras por bloque, ritmo, márgenes y tracking;
- ajuste PIP de la webcam y rerender independiente de cada clip;
- descarga directa del MP4, edición de metadata, programación y distribución.

La previsualización 9:16 responde en tiempo real a los controles. `POST /api/captions/preview` ejecuta el mismo planner de páginas, jerarquía y saltos de línea que el render final. `GET /api/fonts` combina familias habituales del sistema con los archivos de `data/fonts`; estos archivos también se sirven localmente para que la muestra del navegador utilice la misma tipografía seleccionada para FFmpeg.

Los rerenders son transaccionales: el vídeo, ASS, plan y metadata nuevos se publican juntos únicamente cuando FFmpeg termina. Si falla, Shortsmith conserva el vídeo y los ajustes anteriores y elimina los artefactos parciales.

## Verificación

Pruebas de lógica:

```powershell
npm test
```

Smoke visual sintético:

```powershell
npm run smoke:captions
```

El smoke produce un MP4 y tres fotogramas dentro de `data/tmp/caption-smoke-*` usando `progressive-reference`. Verifica minúsculas en la primera línea, protagonista grande, cierre en mayúsculas y ausencia de reborde y sombra.

## Precisión

FFmpeg respeta los timestamps al fotograma. Los tiempos automáticos de Whisper siguen siendo estimaciones acústicas. El campo de vocabulario contextual mejora nombres propios, pero no sustituye una corrección editorial final de siglas o términos fonéticamente ambiguos. Si se aporta un SRT sin tiempos por palabra, Shortsmith mantiene un fallback proporcional y registra el origen como `approximate`.

## Diagnóstico

- `No se encontró faster-whisper`: ejecuta `npm run stt:setup`.
- Error CUDA/CTranslate2: prueba temporalmente `whisper-cli` o `FASTER_WHISPER_DEVICE=cpu`; después revisa las librerías CUDA/cuDNN disponibles en Windows.
- Primera ejecución lenta: incluye la descarga local y la carga inicial del modelo.
- Fuente incorrecta: confirma el nombre de familia y revisa que el archivo esté en `data/fonts`.
