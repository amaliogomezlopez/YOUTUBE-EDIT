---
name: create-talking-head-reels
description: Monta Reels y TikToks desde la ruta de un clip propio a camara con el estilo aprobado, cortes de silencios, recursos reales arriba, cara abajo y karaoke verde. Automatiza ingesta, tiempos, importacion, sonidos de carpeta y exportacion. La extraccion de Shorts desde videos largos corresponde a create-ranked-shorts.
---

# Reels a camara con el estilo aprobado

Usar desde la raiz de YouTube Edit. Esta skill es texto y comandos Node: sirve a cualquier agente con acceso al proyecto, terminal, busqueda web y revision de imagen/video/audio. No necesita herramientas exclusivas de Codex, un modelo concreto ni DaVinci MCP.

Leer [el procedimiento completo](../../../docs/talking-head-reels.md) antes del primer montaje. Las reglas ejecutables son [shorts-rules.json](../../../src/modules/shorts-studio/rules/shorts-rules.json). La referencia aprobada esta en [approved-style.json](../../../src/modules/talking-head/approved-style.json).

## Secuencia que debe ejecutar el agente

1. `npm run talking-head -- start --video "<ruta del usuario>" --slug talking-head-<nombre>`. Copia y normaliza el clip, detecta cara, transcribe y entrega una carpeta de trabajo con indices y diagnostico. El original se conserva.
2. Leer `transcript-indexed.txt`, `review-context.json` y la hoja `source-review-01.jpg`. Revisar la grabacion en los tramos dudosos. Elegir las mejores tomas completas en `selection.json`: indices inclusivos, motivo por toma, `reviewed:true` y `reviewNotes`. Esto lo hace el agente; no es una nueva solicitud de aprobacion al usuario. No eliminar una frase solo porque Whisper la haya alineado mal.
3. `npm run talking-head -- prepare --slug <slug>`. El programa quita pausas confirmadas y genera `asset-requests.json` con ventanas de 3–5 s y las palabras dichas en cada ventana. No calcular segundos ni escribir cues a mano.
4. Buscar la noticia, producto o ejemplo concreto. Descargar imagenes/clips o capturar la parte relevante de la pagina/post. Completar **solo `resource`** en cada entrada del archivo generado: ruta local, URL de la fuente, tipo, etiqueta, licencia/procedencia real y motivo. El procedimiento incluye el contrato y criterios de seleccion. No pedir al usuario que busque los recursos cuando el agente dispone de esas herramientas.
5. `npm run talking-head -- render --slug <slug>`. Importa recursos, carga automaticamente `SONIDOS-REELS`, compila, valida reglas, registra Remotion, renderiza en un run nuevo, finaliza audio y genera MP4, hoja de contacto e informe de revision.
6. Revisar el MP4 y cada empalme: cara, pertinencia de visuales, palabra verde sincronizada, cortes de voz y mezcla. Corregir los JSON de trabajo y repetir. Entregar la ruta absoluta del MP4 revisado, sin cambiar el piloto aprobado.

## Decisiones que ya estan resueltas

El perfil `talking-head-approved-v2` fija 1080x1920 a 60 fps, dos mitades iguales, presentador centrado abajo, visuales reales arriba, zoom 1→1.025, cortes limpios entre visuales y subtitulos Schibsted Grotesk de hasta tres unidades. Solo la palabra pronunciada tiene relleno verde `#43F56C`; el resto es blanco con contorno oscuro. No sustituirlo por tarjetas genericas, comparativas inventadas o imagenes generadas.

El codigo reutiliza `shorts-studio` y `video-studio`. No crear un componente React por video ni otra pipeline. Las tomas, la busqueda semantica y la comprobacion perceptiva siguen siendo trabajo del agente; las operaciones mecanicas ya estan automatizadas. Si falta una herramienta de busqueda o revision, identificar esa limitacion concreta sin inventar fuentes ni una revision realizada.

## Sonidos del usuario

La entrada principal es `SONIDOS-REELS/`: el usuario copia ahi sus WAV/MP3/M4A/AAC/FLAC/OGG/OPUS y el siguiente montaje los importa solo. `npm run talking-head -- sounds` permite comprobarlos sin render. No hace falta escucharlos y puntuarlos en una web. Con archivos en esa carpeta se rota exclusivamente entre ellos, conservando el tono y recortando silencios de los extremos. Sin archivos, la seleccion queda marcada como provisional. No llamar aprobados a los sonidos provisionales.

## Cambios y recuperacion

Los errores indican el archivo y el campo a corregir. Una transcripcion reparada exige revisar indices y volver a ejecutar `prepare`; las visuales antiguas se guardan en una copia, no se reutilizan con tiempos obsoletos. Nunca sortear un error eliminando su regla o inventando `atSeconds`. El usuario puede pedir otro estilo; registrar ese feedback y ajustar el perfil de forma explicita. No publicar en redes salvo encargo de publicacion.


### Casos de uso de los sonidos aportados

Leer [CATALOGO.md](../../../SONIDOS-REELS/CATALOGO.md) al elegir sonidos. El catalogo operativo es data/talking-head/sound-catalog.json. Los seis efectos generales rotan para cambios de visual. Los especiales quedan excluidos de esa rotacion: money solo para dinero, riser al principio y Message sound cuando aparece un mensaje/tuit.

En resource, soundUse puede ser transition, intro, money o message (vacio: automatico). Money y message necesitan soundNote con el contexto concreto. El programa aplica los efectos por familia, comprueba el uso y elimina silencios de los extremos en copias de reproduccion. No introducir un sonido de dinero o mensaje en una visual que no lo justifique. No elegir ficheros directamente en los cues.


### Canales de voz

La ingesta mide el nivel real de cada canal antes de normalizar. Si una grabacion estereo contiene voz solo a un lado y el otro esta practicamente mudo, duplica el canal de voz a izquierda y derecha. Conserva el estereo real de los efectos. La entrega mide ambos canales y rechaza un desequilibrio superior a 18 dB. No basta con que FFprobe indique dos canales.
