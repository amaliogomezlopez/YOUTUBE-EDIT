---
name: create-screen-camera-shorts
description: Integra una toma de pantalla con webcam y zooms por palabras en el proyecto de Shorts, con motores FFmpeg o Remotion, recursos congelados y revisión de transiciones.
---

# Cámara dirigida dentro de Shorts

Leer [el contrato y comandos](../../../docs/shorts-screen-camera.md). El proyecto canónico es short-plan.json / short-build.json; no escribir un renderer por vídeo. No requiere Computer Use.

1. Para un piloto antiguo, adoptar con shorts:project adopt-camera. Para una fuente nueva, shorts:camera prepare prepara palabras y frames; revisar regiones y plan antes de adoptar. No enviar medios/transcripciones fuera salvo autorización del usuario.
2. Tras adoptar, editar exclusivamente las escenas de short-plan.json. Usar scenes[].screenCamera con plan por palabras y regions vinculadas al hash. Revisar zonas en los frames originales; no reutilizar coordenadas ni marcar reviewed sin evidencia. Pantalla que cambia requiere varias escenas.
3. Ejecutar shorts:build: comparte validadores, subtítulos y audio del montaje. Resolver errores sin desactivar reglas.
4. Consultar shorts:project capabilities. FFmpeg acepta una escena de cámara con preset verde; Remotion permite el montaje general. Pixi no está disponible. No sustituir un motor silenciosamente.
5. Congelar con shorts:project freeze y renderizar con shorts:render --slug nombre --engine ffmpeg|remotion --version HASH. Conservar el hash. Un cambio de entorno o recursos debe fallar, nunca alterar una versión anterior.
6. Revisar MP4, qa.json, transition-review.json y la hoja de contacto. La revisión técnica no aprueba automáticamente el contenido. Entregar el MP4 final y la versión usada.
7. Si el usuario pide comparar modelos y autoriza agy, ejecutar shorts:benchmark con modelos listados por agy models. Guardar errores, tokens, latencia y validación. No declarar un modelo mejor a partir de una muestra ni atribuir calidad semántica a checks geométricos.

La IA elige fragmento y focos; el código ejecuta el montaje. La congelación conserva recursos y archiva fuentes/código/locks; no incorpora todos los binarios del sistema. Ver los límites de portabilidad en la documentación.
