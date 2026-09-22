# Cámara integrada en Shorts y motores de render

El proyecto canónico es ahora el de shorts-studio: manifest.json, short-plan.json y short-build.json. La pista vive en scenes[].screenCamera. El compilador habitual resuelve palabras, cámara, páginas, audio y reglas. Remotion y FFmpeg consumen ese build. El evaluador de cámara es compartido; no se duplican las curvas.

## Flujo de uso

Para migrar el piloto ya revisado:

```powershell
npm run shorts:project -- adopt-camera --project data/tmp/camera-integration/pilot --slug mi-short
npm run shorts:build -- --slug mi-short
npm run shorts:project -- capabilities
npm run shorts:project -- freeze --slug mi-short
npm run shorts:render -- --slug mi-short --engine ffmpeg --version HASH
npm run shorts:render -- --slug mi-short --engine remotion --version HASH
```

Sin --version, render congela el build actual antes de ejecutarlo. Si el plan cambió desde build, se rechaza: volver a compilar. Usar la misma versión para comparar motores. No se permite cambiar props, frames o formato desde los flags de un render versionado.

Para una fuente nueva, shorts:camera prepare sigue preparando transcripción local, índices y frames. Completar regions.json después de inspeccionar las imágenes y plan.json con selección y cues; después adopt-camera. Los antiguos shorts:camera build/render indican cómo migrar, para evitar seguir editando dos proyectos. Tras adoptar, editar solo short-plan.json. Adopt reserva un proyecto nuevo y normaliza la fuente a MP4 H.264/AAC (recodifica a CRF 17); conserva su hash. No sobrescribe proyectos.

## Contrato de escena

Usar layout pip y camera static. screenCamera contiene:

- plan: version 1, profile screen-smooth o screen-dynamic, selection {fromWord,toWord}, sound boolean y cues [{atWord,targetId,sound,soundNote}]. Los índices pertenecen al transcript completo del clip.
- regions: sourceHash, screen, webcam y targets. Las cajas son {x,y,w,h} en píxeles originales enteros, reviewed true y evidence real. Cada target lleva id. context es reservado para recuperar el conjunto.

La selección determina trim; un trim contradictorio se rechaza. La pantalla debe ser 3:2 y estar separada de webcam. Un target debe caber en el encuadre. No inventar coordenadas ni interpretar una etiqueta OCR como los límites de una gráfica. Las capturas iniciales están reducidas: convertir las coordenadas a la resolución del manifest. Si el contenido cambia, dividirlo en escenas y revisar cada una.

El nuevo campo permite escenas de cámara junto a otras escenas en el montaje Remotion. La salida permanece vertical 1080x1920 @60: no generalizar este adaptador a las intros horizontales.

## Adaptadores y límites explícitos

| Motor | Operativo | Capacidades y límites |
| --- | --- | --- |
| FFmpeg | Sí | Una escena screenCamera, preset verde, voz y sonidos. Rechaza overlays, música, rótulos, transiciones, otros formatos o estilos incompatibles. |
| Remotion | Sí | Montaje de Shorts existente con varias escenas, cámara dirigida, overlays, música y transiciones. |
| Pixi/WebGL | No | Reservado como candidato; pedirlo produce error. Cursor y efectos GPU no están implementados. |

Ambos usan el mismo reloj, focos y páginas de subtítulos del build. Rasterización, tipografía y mezcla de efectos no son idénticas entre motores. Cada exportación pasa por normalización de audio y QA técnico; la igualdad exigida es del plan y la trayectoria, no de los bytes del MP4.

## Versiones y recursos congelados

freeze crea versions/HASH con lock.json, short-build.json y environment. El hash cubre el build, decisiones, transcripciones, manifiesto, recursos y dependencias registradas. Los medios y sonidos usados se copian a public/projects/_locked por su hash; los renders no vuelven a consultar SONIDOS-REELS ni la paleta mutable. Se archivan fuentes, código, catálogos y package-lock de ambos paquetes. Se registran Node, plataforma y versión de FFmpeg.

Render con --version verifica hashes y rechaza cambios de código, fuentes, manifiestos de dependencias o recursos congelados. Restaurar el entorno archivado y sus versiones, o crear una versión nueva; nunca actualizar silenciosamente un lock. Los planes antiguos conservan sus sonidos aunque se sustituya el archivo original. Se rechazan snapshots incompletos y congelaciones simultáneas del mismo proyecto.

Esto no es una máquina virtual: los binarios de Node, FFmpeg y Chromium y node_modules no se incluyen. package-lock permite reinstalar dependencias con npm ci; no garantiza igualdad binaria entre equipos. Para trasladar el proyecto también hay que copiar los recursos referidos de _locked. Una interrupción abrupta puede dejar .freeze.lock: comprobar que no hay una congelación activa antes de retirarlo. Las versiones generadas y el piloto privado están ignorados por Git.

## Revisión alrededor de transiciones

Cada render captura el fotograma anterior al inicio, el inicio, el punto medio, el final y el siguiente, además de límites de escena y de pieza. Emite transition-review.json y transition-contact-sheet.jpg en orden temporal. Comprueba geometría, resolución y posibles imágenes vacías. La etiqueta semanticReview permanece pending: estas mediciones no acreditan legibilidad, pertinencia del foco ni ausencia de todos los defectos visuales.

## Comparación de modelos

```powershell
agy models
npm run shorts:benchmark -- --project data/tmp/camera-integration/pilot --models gemini-3.8-flash-low,gemini-3.1-pro-high --output data/tmp/benchmark-nuevo
npm run shorts:project -- compare --input data/tmp/benchmark-nuevo/candidates.json --output data/tmp/comparison.json
```

El benchmark usa agy con sesión ya iniciada y salida estructurada. Envía la misma transcripción y regiones revisadas, conserva el prompt, respuesta, estado, tokens y latencia y valida cada plan con el compilador. Se solicita no usar herramientas. No evalúa visión: los targets ya están identificados. El coste monetario queda desconocido si el proveedor no lo comunica. Nunca se inventa un ganador editorial. Las comparaciones rechazan evidencias con hashes diferentes.

Prueba del 22-09-2026: Flash 3.8 Low entregó un plan válido de 23.84 s, seis cues, en 41.96 s. Pro 3.1 High devolvió un plan válido estructuralmente en 69.93 s, pero agy marcó ERROR de formato. En el reintento, agy marcó SUCCESS en 62.22 s, pero el plan inventó targetId screen y el compilador lo rechazó. Se conservaron ambos intentos. Una sola muestra no demuestra superioridad general ni coste menor. El corte de Flash empieza a mitad de argumento (Porque si...) y usa más focos que el piloto humano: pasar validación no equivale a aprobar el montaje.

Evidencia local: data/tmp/studio-upgrade/{benchmark-prompt.txt,candidates.json,comparison.json,gemini-*.json}. No mezclar el error de transporte con un fallo editorial. El primer intento Pro además incluyó el token final VIP de baja confianza; esto aconseja una revisión de transcripción antes de publicar.
