# Reels a camara: procedimiento para cualquier agente

Este flujo monta un clip propio a partir de su ruta. Reutiliza `video-studio`, `shorts-studio` y Remotion, con el estilo del piloto v2 aprobado el 10 de septiembre de 2026. No depende del historial de una conversacion ni de un proveedor de IA. La extraccion y ranking de Shorts desde videos largos usa otro flujo.

## Encargo minimo

> Lee `.agents/skills/create-talking-head-reels/SKILL.md` en `D:\2-YOUTUBE-EDIT` y monta un Reel con el estilo aprobado a partir del video en «RUTA». Selecciona las tomas, quita silencios, busca recursos reales, monta y revisa el resultado. Usa los sonidos de `SONIDOS-REELS`.

El agente debe poder ejecutar comandos, leer/escribir archivos, buscar fuentes y revisar medios. La skill no da esas capacidades a un modelo que carece de herramientas. Las operaciones de montaje son deterministas; la pertinencia del material y la eleccion de tomas requieren criterio editorial. No afirmar que un modelo pequeno se ha probado si no se ha ejecutado con el.

## 1. Preparar un clip

Ejecutar desde la raiz del repositorio, con Node 20+, las dependencias del proyecto y de `remotion-animations`, FFmpeg y FFprobe disponibles. Usar la transcripcion configurada en `.env` sin imprimir sus secretos. El flujo no cambia esa configuracion. Puede usarse Faster Whisper local o el STT ya instalado.

```powershell
npm run talking-head -- start --video "C:\ruta\mi-video.mp4" --slug talking-head-mi-reel
```

La ingesta copia el original con un nombre estable, normaliza voz, detecta cara y genera palabras con tiempos. No mueve ni borra el archivo proporcionado. El slug lleva `talking-head-` y solo letras minusculas, numeros y guiones. Si se omite, se deriva del nombre y contenido. Repetir `start` con el mismo clip retoma el trabajo; usar ese slug con otro clip falla para evitar sobrescrituras.

Archivos generados en `data/talking-head/<slug>/`:

| Archivo | Uso del agente |
|---|---|
| `transcript-indexed.txt` | Leer indices, texto y tiempos originales. |
| `review-context.json` | Leer silencios detectados, problemas de transcripcion y rutas de video/hojas. |
| `source-review-01.jpg` | Ver encuadre en tres momentos del clip. |
| `selection.json` | Elegir tomas completas y documentar el criterio. |
| `asset-requests.json` | Se genera en el paso 3; completar recursos. |
| `latest-delivery.json` | Se genera al exportar; contiene MP4 y QA. |

El proyecto editable vive en `remotion-animations/projects/shorts-<slug>/`. Sus clips normalizados estan en `remotion-animations/public/projects/shorts/<slug>/`. Todo el material privado queda fuera de Git.

Si ya se dispone de una transcripcion fiable con tiempos por palabra:

```powershell
npm run talking-head -- start --video "C:\ruta\mi-video.mp4" --slug talking-head-mi-reel --transcript "C:\ruta\transcript.json"
```

El JSON requiere `words:[{"text":"Hola","start":0.2,"end":0.5,"timing":"word"}]`. SRT o tiempos repartidos aproximadamente no bastan para este karaoke. El comando admite `--no-face` para pruebas tecnicas con media sintetica; no usarlo por defecto en grabaciones del usuario.

## 2. Elegir y revisar las tomas

Leer la transcripcion completa y observar los tramos sospechosos. Conservar la mejor repeticion de una frase, un hook completo y una conclusion completa. No encadenar todos los intentos ni recortar una afirmacion de modo que cambie su sentido. Comprobar nombres propios contra el audio y la fuente; no convertir una opinion del presentador en una medicion objetiva.

Editar `selection.json` (ejemplo de contrato; **no copiar estos indices a otro clip**):

```json
{
  "reviewed": true,
  "reviewNotes": "Se usa el segundo hook completo y la toma fluida del desarrollo; el primer intento queda descartado.",
  "selections": [
    {"clipId":"01","fromWord":12,"toWord":35,"reason":"Hook completo."},
    {"clipId":"01","fromWord":46,"toWord":92,"reason":"Desarrollo y cierre sin el intento repetido."}
  ]
}
```

Los indices son inclusivos y pertenecen al clip original. El orden del array es el orden de montaje. `reviewed` acredita la revision editorial del agente y no exige volver a pedir permiso al usuario. El programa deja 120 ms de aire, evita recuperar palabras excluidas y quita solo pausas que coinciden en audio y transcripcion; no hay que calcular trims de silencio.

Si la deteccion facial falla, comprobar los frames de origen y fijar `focus:{"x":0.48,"y":0.31}` en la seleccion correspondiente, con coordenadas normalizadas 0..1 del centro de la cara. Verificar el resultado renderizado: un punto estimado no demuestra un encuadre correcto.

Para una alineacion dudosa, retranscribir una ventana corta que empiece y termine entre palabras:

```powershell
npm run talking-head -- repair-transcript --slug talking-head-mi-reel --clip 01 --start 12.0 --end 23.5
```

Los numeros son ejemplos. Se guarda una copia de la transcripcion, se rebasan los tiempos al clip y se desmarca la revision de selecciones. Repetir `start` con la misma ruta **sin `--transcript`** para refrescar el indice de lectura. Volver a revisar `selection.json`: los indices pueden haber cambiado. Una palabra de varios segundos, palabras fuera de orden o una repeticion alineada sobre el intento anterior requieren esta revision. No arreglar un nombre inventando sus tiempos.

## 3. Obtener el guion de recursos

```powershell
npm run talking-head -- prepare --slug talking-head-mi-reel
```

El programa reparte el reloj del montaje en ventanas de 3–5 s, con cortes anclados a palabras, incluidos los cambios de toma y los silencios eliminados. `asset-requests.json` entrega cada frase, su duracion, su id y un objeto `resource` vacio. El modelo completa ese objeto; no tiene que calcular frames ni tocar React.

Cambiar una seleccion, la transcripcion o el perfil invalida el guion anterior. Repetir `prepare` crea una copia `.bak` y genera ventanas nuevas. Si nada cambia, conserva las elecciones ya rellenadas. Una pieza demasiado corta o con tiempos incompatibles no puede cumplir 3–5 s: el error pide corregir la seleccion o alineacion, no inventar anclas.

## 4. Buscar e importar visuales reales

Para cada `spokenText`, identificar la entidad/accion mencionada y buscar el anuncio, demostracion, pagina o post concreto. Priorizar la fuente primaria y comparar su fecha con la noticia. Abrir y revisar la fuente; no usar una miniatura de busqueda como prueba ni inventar URL, autor o licencia. La fecha de publicacion y lo que muestra el recurso tienen que corresponder a la afirmacion del clip.

Recursos que funcionan en medio lienzo vertical:

- Titular original recortado con una imagen o elemento identificable.
- Captura de la interfaz, producto, publicacion o ejemplo mencionado.
- Fragmento corto de una demostracion real, silenciado, que muestre la accion descrita.

Alternar material conforme avanza la locucion. No volver a crear tarjetas como «mi valoracion» o una comparativa inventada. No sustituirlo por stock generico o imagenes generadas. Una captura de una pagina entera no sera legible: recortar el titular o la zona importante, conservando su contexto. Una captura de texto denso exige `stage` en el motor; en este estilo usar un recorte sencillo o elegir otro recurso que se entienda arriba, sin falsear su densidad.

Guardar las capturas/descargas en `data/talking-head/<slug>/downloads/` (crear la carpeta si hace falta). Usar las herramientas de busqueda, navegador/captura y descarga disponibles en el agente. Se admiten archivos de otra carpeta mediante ruta absoluta. Para videos, descargar un fragmento suficiente desde una URL de medio observada en la fuente; no pasar la URL de una pagina HTML a FFmpeg, no adivinar endpoints y no eludir acceso restringido. Si no hay clip accesible, usar una captura relevante de esa fuente.

Solo editar `resource` en cada entrada generada:

```json
{
  "localFile": "downloads/anuncio.png",
  "sourcePage": "https://sitio-de-la-fuente.example/anuncio",
  "kind": "web-capture",
  "label": "Nombre de la fuente",
  "author": "Autor si se conoce",
  "license": "Captura limitada para comentar esta fuente; licencia no indicada",
  "reason": "Muestra el titular original del producto que se menciona en esta frase.",
  "trimSeconds": 0,
  "fit": "contain"
}
```

La URL es ilustrativa: reemplazarla por una fuente realmente consultada. `kind` admite `web-capture`, `source-image` y `source-video`. `license` documenta la licencia conocida o el alcance y la incertidumbre del uso; nunca atribuir CC0 o permiso que no conste. `label` aparece de forma discreta en la visual. `author` puede quedar vacio si no se conoce.

`localFile` es una imagen o video real, con ruta absoluta o relativa a la carpeta de trabajo. `trimSeconds` selecciona el comienzo del fragmento de apoyo; el programa comprueba que hay video suficiente para toda su ventana. `fit:contain` conserva la informacion; `cover` solo cuando el recorte se entiende mejor y no corta contenido relevante. No alterar `id`, `frame`, `atWord`, `endFrame` o `fingerprint`.

El importador normaliza las imagenes con la biblioteca existente y los videos con la ingesta comun; mantiene procedencia y copias por hash. No es necesario editar el manifest ni registrar assets a mano. El build rechaza campos vacios, archivos inexistentes, tipos incompatibles y clips de apoyo demasiado cortos.

## 5. Compilar y exportar

```powershell
npm run talking-head -- build --slug talking-head-mi-reel
npm run talking-head -- render --slug talking-head-mi-reel
```

`build` permite una comprobacion rapida sin render. `render` ejecuta tambien el build: basta con ese comando cuando los recursos ya estan completos. Carga los sonidos actuales, importa recursos, compila subtitulos y tiempos, pasa las reglas y actualiza el registro/capacidades. Usa el wrapper de render seguro, H.264 CRF 17, yuv420p, BT.709, frames PNG, AAC a 48 kHz y finalizacion de mezcla a -14 LUFS. Cada exportacion reserva un run nuevo; no sobrescribe un MP4 entregado.

El resultado incluye MP4 1080x1920 a 60 fps, proyecto editable, procedencias, hoja de contacto y `review.json` con la comprobacion tecnica. `latest-delivery.json` apunta al ultimo resultado de este proyecto. `render` no publica el video en redes.

El preset esta en `src/modules/talking-head/profiles.json`; la aprobacion y referencia estan en `approved-style.json`. El estilo mantiene cara abajo, recursos arriba, zoom de 1 a 1.025, cortes limpios del panel y karaoke de hasta tres unidades (nombres compuestos juntos), Schibsted Grotesk 82 px blanca con contorno de 5 px y solo la palabra activa verde `#43F56C`. No volver a disenar esos elementos en cada encargo. Cualquier cambio de estilo solicitado se registra mediante `shorts:feedback`, con validador y fixture.

## 6. Revision y entrega

Abrir la hoja de contacto y el MP4. Revisar entrada, todos los cambios de visual/toma, y cierre. Verificar ojos/boca visibles, texto legible, palabra verde a tiempo, recursos pertinentes y sin paneles vacios. Escuchar los empalmes de voz y los efectos: sin silabas cortadas ni sonidos que tapen la locucion. Una hoja de contacto no comprueba toda la sincronizacion; revisar tambien la reproduccion o frames concretos de los empalmes.

El informe empieza con `visualReview` y `audioReview` pendientes. El agente registra su revision real en una nota junto al run, indicando medios/momentos comprobados y problemas encontrados. No cambiar esos estados a aprobado por el mero hecho de que pase FFprobe. Si el agente no puede oir o ver medios, decir cual de esas revisiones falta. Corregir los inputs y volver a exportar cuando se encuentre un fallo. No es necesario repetir tests del repositorio por editar solo un proyecto; si se modifica logica, ejecutar `npm test`, y `npm run smoke`/`npm run remotion:check` cuando se toque render.

Entregar primero el enlace absoluto al MP4 revisado y una nota breve de cortes/procedencia. Conservar los runs y el original. El piloto aprobado no se recompila para probar cambios de automatizacion: usar otro slug.

## Sonidos: copiar y usar

Carpeta del usuario: **`D:\2-YOUTUBE-EDIT\SONIDOS-REELS`**. Puede pegar ahi WAV, MP3, M4A, AAC, FLAC, OGG u OPUS con cualquier nombre. No necesita puntuaciones ni abrir una web.

```powershell
npm run talking-head -- sounds
```

El comando prepara copias PCM WAV de 48 kHz, ajusta el pico a -3 dB, conserva el tono y recorta silencios de los extremos, deduplica por contenido y muestra archivos invalidos. Se ejecuta automaticamente en cada montaje. Cuando hay archivos, solo se usan estos; al retirarlos dejan de elegirse para futuros planes. Los MP4 y copias de render anteriores se conservan.

No es necesario organizar subcarpetas. Opcionalmente `entradas`, `clicks` e `impactos` asignan familias; la raiz y otras carpetas son transiciones. Las variantes rotan de forma determinista. Un solo archivo necesariamente se repetira. Se avisa con efectos mayores de 3 s para revisar colas; el importador admite hasta 30 s. Un archivo roto produce un error concreto, sin sustituir silenciosamente los favoritos por otros.

Mientras la carpeta este vacia, se conserva una seleccion provisional (o la antigua seleccion manual si existiera), identificada como tal. La antigua herramienta de puntuacion sigue disponible por compatibilidad, pero no es el flujo principal ni un requisito para montar. El usuario puede copiar archivos despues; no cambian videos ya exportados.


### Casos de uso de los sonidos aportados

Leer [CATALOGO.md](../SONIDOS-REELS/CATALOGO.md) al elegir sonidos. El catalogo operativo es data/talking-head/sound-catalog.json. Los seis efectos generales rotan para cambios de visual. Los especiales quedan excluidos de esa rotacion: money solo para dinero, riser al principio y Message sound cuando aparece un mensaje/tuit.

En resource, soundUse puede ser transition, intro, money o message (vacio: automatico). Money y message necesitan soundNote con el contexto concreto. El programa aplica los efectos por familia, comprueba el uso y elimina silencios de los extremos en copias de reproduccion. No introducir un sonido de dinero o mensaje en una visual que no lo justifique. No elegir ficheros directamente en los cues.


### Canales de voz

La ingesta mide el nivel real de cada canal antes de normalizar. Si una grabacion estereo contiene voz solo a un lado y el otro esta practicamente mudo, duplica el canal de voz a izquierda y derecha. Conserva el estereo real de los efectos. La entrega mide ambos canales y rechaza un desequilibrio superior a 18 dB. No basta con que FFprobe indique dos canales.


### Sincronizacion de efectos y risers

Las copias de efectos se recortan hasta el inicio/final detectado del sonido (-45 dB), sin anadir margen de silencio y sin quitar pausas internas. Se generan copias nuevas versionadas; los originales y los renders anteriores se conservan. Los efectos normales comienzan en el frame del cambio visual, incluso si la palabra ancla llega unos milisegundos despues. El riser de apertura se coloca hacia atras desde el siguiente cambio de visual: su final coincide con ese corte, con precision de un frame, conservando su velocidad. Un corte de toma que mantiene la misma visual no es su destino. Si el riser no cabe, usar uno mas corto; si no hay cambio de visual, seleccionar soundUse transition.
