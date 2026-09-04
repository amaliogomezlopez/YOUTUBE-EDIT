# Montaje adaptativo de Shorts desde un vídeo largo

El pipeline existente selecciona candidatos y los convierte en proyectos de
shorts-studio. El perfil de montaje activa Remotion; el render clásico de FFmpeg
sigue disponible. No hay un segundo pipeline de ingesta o publicación.

## Uso

En la pantalla de creación, elegir Montaje: Sobrio, Dinámico o Enérgico.
La opción Conservar pausas desactiva el acortado de silencios.

Por CLI:

```powershell
npm run process -- --video "D:\videos\directo.mp4" --transcript "D:\videos\directo.srt" --top 2 --editing-profile dinamico --subtitle-mode progressive --quality high --no-llm
```

Opciones adicionales: `--keep-pauses`, `--no-effects` y
`--music "D:\audio\musica.mp3"`. La música es un archivo elegido por el usuario;
se importa al proyecto y baja bajo la voz. No se descarga música automáticamente.

## Decisiones de montaje

- El análisis muestrea la imagen cada 1,5 segundos. Distingue webcam en cualquiera
  de las cuatro esquinas, presentador a pantalla completa y pantalla sin webcam.
  Dos observaciones confirman un cambio de modo para evitar saltos por una
  detección facial perdida.
- Cara y panel original son dos regiones diferentes. El seguimiento facial se
  suaviza; el panel permite ocultar la webcam duplicada en la captura inferior.
- El OCR local de Windows relaciona texto visible y palabras habladas. El cambio
  visual aporta una segunda señal. Las ampliaciones conservan contexto alrededor
  de etiquetas y tooltips; no son una detección semántica completa de la pantalla.
- Los perfiles definen duración y densidad de cambios, zoom máximo, separación de
  efectos y mezcla. El plan elige planos de contexto, detalle y conclusión.
  Comparaciones con dos cabeceras reconocidas pueden mostrarse apiladas.
- Los cortes visuales se anclan a palabras, frases y cambios de pantalla. Solo se
  eliminan pausas interiores que coinciden con silencios detectados en el audio.
  Se guarda el mapa del tiempo de la fuente al del montaje. Los tramos de audio
  contiguos se unen aunque haya cortes visuales.
- Se reutilizan los movimientos de cámara y familias de sonido del catálogo.
  Los efectos pueden desactivarse globalmente o por escena.
- Los subtítulos admiten karaoke, progresivo, palabras y frases. Fuente, tamaño,
  color, contorno y alineación llegan al vídeo exportado. La geometría reserva
  espacio entre webcam y pantalla y respeta el límite inferior de 1748 píxeles.
- La selección textual corrige coincidencias por subcadenas y usa pesos
  normalizados. Una preselección acotada recibe evidencia visual. Si se usa LLM,
  recibe esa evidencia y evalúa gancho, desarrollo, cierre y dependencia de
  contexto. El score es una estimación editorial, nunca una predicción garantizada.

## Revisión

En cada resultado: Editar corte, encuadre y subtítulos → Revisar montaje por
escenas. Se pueden cambiar perfil, composición, centro del presentador, región de
pantalla, efectos y palabras. Los cambios se aplican al volver a renderizar.
Cambiar de perfil reconstruye las escenas y sus encuadres; conserva las palabras corregidas.
Las coordenadas de región son píxeles de la fuente; el centro facial usa 0–1.

Cambiar entrada o salida invalida las ediciones anteriores de escenas y palabras:
se reconstruye el plan y se muestra un aviso. Una región automática puede requerir
revisión, especialmente con gráficas, texto denso, juegos, varias caras o cambios
de pantalla muy rápidos. Los ejemplos revisados pueden conservar correcciones
editoriales; el plan JSON registra su motivo.

La validación de geometría bloquea cajas inválidas y solapamientos previstos. La
regla de ritmo avisa sobre planos demasiado largos; una explicación puede necesitar
ese tiempo de lectura. Los umbrales viven en editing-profiles.json, no en el
validador. Los planes antiguos sin presupuesto se declaran no evaluables.

## Exportación y métricas

El render de alta calidad usa H.264 CRF 17 con color BT.709, 1080×1920 a 60 fps y AAC. Tras mezclar
voz, efectos y música se normaliza a un objetivo de -14 LUFS y -1,5 dBTP sin
recodificar de nuevo la imagen. render-qa.json comprueba resolución, codecs,
duración y sonoridad. La revisión visual sigue siendo un paso distinto; el
informe no la da por aprobada automáticamente.

Las métricas permiten registrar porcentaje que decide ver, porcentaje medio
visto y retención a 3 y 10 segundos. metrics-history.json conserva cada medición
junto con perfil y versión de render. Los valores ausentes son null. Esta entrega
no incorpora una nueva API de analytics ni entrenamiento automático con métricas.

El OCR usa Windows.Media.Ocr mediante scripts/video-ocr.ps1. Si no está disponible
se usan cambios visuales y encuadres conservadores. Las transcripciones sin tiempos
por palabra siguen funcionando con tiempos aproximados declarados. El audio usa
un umbral fijo de silencio: una grabación muy ruidosa puede conservar más pausas.

## Verificación de desarrollo

`npm test` ejecuta los tests en serie porque varios builds de fixtures comparten
el registro global de composiciones. La escritura de ese registro es atómica.
`npm run remotion:check` valida catálogo, TypeScript, lint y composiciones;
`npm run smoke` prueba el render FFmpeg. Los ejemplos de vídeo real verifican
además el puente Remotion, el OCR, los subtítulos y la mezcla.

Después de añadir o quitar composiciones: `npm run remotion:capabilities`.
Los proyectos y medios privados de prueba son artefactos locales y no se incluyen
en los commits.
