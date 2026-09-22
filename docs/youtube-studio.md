# YouTube Studio: montaje horizontal y memoria editorial

Estado 22-09-2026: ingesta, planificación, render horizontal, comparación y feedback por frame.
**Hay pilotos renderizados. No hay integración Recordly ni paridad editorial validada con CapCut.** El piloto usa clips compuestos 16:9 (pantalla con webcam incrustada,
o toma a cámara); webcam y pantalla en archivos separados requieren otro adaptador.

## Límites de componentes

| Componente | Responsabilidad | Fuera de su responsabilidad |
| --- | --- | --- |
| video-studio | Ingesta, voz, transcripción, geometría, curvas de cámara, sonido y mecanismos de reglas | Decidir qué historia contar |
| youtube-studio | Montaje largo horizontal: orden, selección por palabras, motivos de cámara y ejemplos comparables | Ranking de Shorts, metadata y publicación |
| shorts-studio | Montaje vertical y contrato de Shorts | Montaje horizontal largo |
| talking-head | Procedimiento/preset de Reels sobre shorts-studio | Nueva implementación de ingesta/render |
| intro-studio | Cabecera horizontal de un vídeo | Episodio completo |
| editorial-video | Escenas explicativas y gráficas de episodios | Editor genérico de grabaciones |
| pipeline + from-long-video | Extraer y rankear Shorts de un vídeo largo | Editar varios clips desde cero |
| publishing.js y publishers | Paquete editorial y publicación oficial | Decisiones de montaje |
| carousels / stories | Publicaciones estáticas | Timeline de vídeo |
| skills | Guiar al agente por estos contratos y comandos | Duplicar motores en scripts particulares |

Las dependencias de youtube-studio van hacia video-studio. No importar el build
de shorts/intro ni ramificar pipeline.js para montar YouTube. El perfil contiene
umbrales; el compilador consume el budget. Las reglas de otras superficies no
se aplican automáticamente a una pieza horizontal.

## Cámara del piloto

- `subject:webcam, intent:opinion`: acercarse a la cara durante una opinión.
- `subject:screen, intent:explanation`: destacar un número, dibujo o región.
- `subject:context, intent:context`: recuperar plano completo.
- No acercarse a la cara por ausencia de un asset de pantalla: justificarlo en
  `reason`. Una frase sin interés visual también puede mantener el plano quieto.
- `atWord` siempre pertenece al clip fuente, nunca al reloj del montaje.
- Regiones medidas en píxeles de la fuente, con hash, evidencia y ventana temporal
  que cubra toda la escena. Si la pantalla cambia, dividir la escena.
- El zoom debe conservar el target completo. Si amplía píxeles, se avisa:
  una webcam pequeña incrustada no recupera detalle por hacer zoom.
- Sonido por familia e intensidad, o `sound:false` y `soundNote`.
- El perfil `youtube-calm-v1` es provisional, **no un gusto aprobado del usuario**.
  Máximo 4x, transición 0.8 s y descanso mínimo 3 s son valores de prueba.
- Esta fase solo recorta extremos según palabras. Las pausas interiores,
  transiciones y selección automática de assets son etapas pendientes. El renderer de referencia admite capas y mezcla; el plan por palabras todavía no resuelve música ni sonidos de cues.

## Comandos

```powershell
npm run youtube:studio -- capabilities
npm run youtube:studio -- ingest --source "D:\clips" --slug piloto-youtube
```

La ingesta reutiliza ingestMediaProject y reserva un slug nuevo; no permite
sobrescribir un proyecto. No publicar ni generar metadata en esta fase.
El proyecto está en remotion-animations/projects/youtube-piloto-youtube/.
La media está en remotion-animations/public/projects/youtube/piloto-youtube/.

Leer manifest.json y transcripts/NN.json. Medir las regiones en los clips
normalizados (sus dimensiones y hashes, no los del original).
Para calcular el hash: Get-FileHash -Algorithm SHA256 RUTA; usar minúsculas.
Crear youtube-plan.json. Ejemplo ilustrativo; reemplazar palabras, cajas y hashes:

```json
{
  "version": 1,
  "profile": "youtube-calm-v1",
  "scenes": [{
    "id": "explicacion",
    "clipId": "01",
    "selection": {"fromWord": 0, "toWord": 80},
    "regions": {
      "dato": {
        "subject": "screen",
        "box": {"x": 600, "y": 200, "w": 500, "h": 350},
        "reviewed": true,
        "evidence": "La tabla y sus dos columnas permanecen visibles en toda la escena",
        "sourceHash": "REEMPLAZAR_POR_SHA256_DEL_CLIP_NORMALIZADO",
        "fromSeconds": 0,
        "toSeconds": 40
      }
    },
    "cues": [{
      "atWord": 20,
      "subject": "screen",
      "intent": "explanation",
      "targetId": "dato",
      "zoom": 1.5,
      "reason": "Aquí comparo los dos valores de la tabla",
      "sound": false,
      "soundNote": "Acercamiento discreto bajo la explicación"
    }]
  }]
}
```

```powershell
npm run youtube:studio -- prepare --project remotion-animations/projects/youtube-piloto-youtube --output data/editorial-memory/piloto/propuesta.json
# Corregir el plan; luego conservar otra versión.
npm run youtube:studio -- prepare --project remotion-animations/projects/youtube-piloto-youtube --output data/editorial-memory/piloto/correccion.json
npm run youtube:studio -- compare --before data/editorial-memory/piloto/propuesta.json --after data/editorial-memory/piloto/correccion.json --output data/editorial-memory/piloto/comparacion.json
```

prepare produce un snapshot con plan, palabras, hashes de los clips y cámara
compilada. **No copia los medios, no equivale a freeze y no produce MP4.**
Los outputs no se sobrescriben. compare rechaza fuentes/transcripciones distintas
y evidencia alterada; conserva arrays completos para no confundir reordenaciones
con modificaciones de otra escena. Es un diff estructural, no una explicación
automática del motivo. Cambios de perfil/budget también se comparan.

El agente lee propuesta, corrección y comparación; conserva aparte el feedback
real del usuario, contexto y referencias a reglas. Todos los estados de revisión
empiezan pendientes. No promover una corrección local a preferencia universal,
no inferir aprobación de un test y no marcar review basándose solo en geometría.
La automatización de recuperación de ejemplos y promoción a reglas queda pendiente.

## Procedimiento para el agente

1. Leer este documento y el perfil. Seleccionar clips/frases completos y revisar
   nombres/timestamps contra el audio. No inventar anclas.
2. Identificar tramos de opinión y explicación; revisar visualmente cada destino.
3. Preparar el plan y ejecutar prepare. Corregir errores antes de avanzar.
4. Conservar snapshot de cada propuesta. No reutilizar un output como destino.
5. Exportar con youtube:render y revisar entrada, salida y cada movimiento,
   además de escuchar empalmes. Guardar vídeo y feedback real con el snapshot.
6. Convertir preferencias repetidas en perfiles y reglas verificables con fixtures.
   El intake youtube:feedback conserva comentarios por frame; promoverlos a reglas sigue siendo una etapa explícita.
7. Entregar montaje y revisión. Metadata de YouTube es un encargo/etapa aparte.

## Cómo usar CapCut ahora

No hace falta cambiar tu flujo ni instalar nada dentro de CapCut para esta fase.
Elegir un fragmento representativo de 1–3 minutos ya editado; conservar:
clips originales, MP4 final, proyecto/draft y recursos utilizados, versión de
CapCut, resolución y fps de exportación. No mover los originales del proyecto.
Si un ajuste no queda claro en el MP4, documentar tipo y duración del efecto
con una captura de sus parámetros o una nota.

No asumimos exportación JSON oficial ni importación universal de sus proyectos.
Primero inspeccionar una copia de un draft real de esa versión. Nunca editar el
draft original. El MP4 permite comparar el resultado, pero no recuperar todas las
capas o parámetros.

Fuente oficial consultada: https://www.capcut.com/help/import-a-previous-project-into-the-current-project
explica que el vídeo exportado pierde la edición independiente de capas.

## Recordly: prueba delimitada

Fuentes consultadas el 22-09-2026:
- https://github.com/webadderallorg/Recordly
- https://github.com/webadderallorg/Recordly/blob/main/EXTENSIONS.md

Recordly ofrece zooms sobre capturas y proyectos persistentes. La API de
extensiones documenta consulta del estado de zoom, eventos y hooks de render;
eso no acredita una API pública para modificar una timeline completa.
Probar una versión fijada y un proyecto .recordly mínimo antes de crear el puente.

Prueba pendiente: mismo clip con una opinión y un dato de pantalla, guardar
proyecto antes/después de tres zooms y estudiar tiempos, focus, curva, retorno
y recorte. Comparar movimiento y exportación, no solo JSON.
Cualquier puente debe consumir/emitir decisiones de Shortsmith y declarar lo
incompatible (curvas, webcam, sonido, cortes); no sustituir la memoria canónica.
No copiar internamente código de Recordly sin revisar su licencia vigente.

## Próximos hitos y aceptación

1. **Ahora:** contrato horizontal, ingesta común, cámara compilada y snapshots.
2. **Render piloto:** conectar un adaptador horizontal al render existente;
   planos completos, zooms a cara/pantalla y cortes entre clips. Añadir freeze
   compatible con esta superficie. Validar 16:9, voz, A/V y encuadres.
3. **Referencia CapCut:** reproducir un fragmento elegido con los mismos clips.
   Medir correcciones y minutos de revisión; comparar ambos vídeos con el usuario.
4. **Recursos y montaje:** enlaces -> importador común -> procedencia y selección
   por palabra; cortes de silencios internos, transiciones y sonidos revisados.
5. **Memoria reutilizable:** extraer ejemplos del feedback real y recuperar solo
   los relevantes para el formato/contexto. Crear intake y reglas ejecutables.
6. **Generalización:** probar clips nuevos no usados como referencia; medir
   sílabas cortadas, foco erróneo, nitidez, pertinencia y tiempo de corrección.

No afirmar calidad equivalente a CapCut hasta pasar el piloto y clips nuevos.

## Referencias editadas en CapCut

El adaptador de evidencia vive separado en `src/modules/editorial-memory/capcut.js`.
No requiere abrir CapCut ni modificar un proyecto. Usar una copia privada del
`draft_content.json` legible; conservar original y hash. En proyectos compuestos
la timeline principal puede apuntar a un MP4 precompilado: revisar los subdrafts.

```powershell
node scripts/import-capcut-reference.js --input "COPIA/draft_content.json" --output "data/editorial-memory/ejemplo/capcut-edit-recipe.json"
```

El destino debe ser nuevo. Exporta timelines embebidas, relojes en microsegundos,
recortes, transformaciones, keyframes nativos, volumen, referencias y campos
seleccionados de materiales. Mantiene la relacion padre/compuesto sin aplanar.
`omittedFields` enumera campos no trasladados: **no es una copia sin perdida ni
un plan ejecutable**. Los originales contienen los detalles restantes. No exporta
la metadata de plataforma del documento. El resultado conserva rutas locales y
contenido editorial privado; no commitearlo. No descarga recursos ni los copia.

Antes de convertirlo en plan horizontal: resolver compuestos, verificar el reloj
de keyframes, mapear curvas y recortes, traducir sonidos a familias y anclar
intenciones a palabras transcritas. La presencia de un preset no demuestra que el
renderer pueda reproducirlo. No convierte un ejemplo en regla aprobada.

Referencia local GROK/0921: `data/editorial-memory/grok-reference/CAPCUT-REFERENCE.md`.
## Render horizontal implementado (pilotos GROK)

La composición parametrizada `YouTube-Timeline` vive en el Remotion existente.
`render-plan.js` traduce snapshots propios o una timeline CapCut seleccionada;
`render-package.js` copia medios, remultiplexa MKV sin recodificar imagen y conserva
hashes. `video-studio/timeline-curves.js` y `timeline-audio.js` son piezas comunes.
La mezcla final usa FFmpeg por muestras a 48 kHz, evitando padding AAC entre clips.

```powershell
npm run youtube:render -- prepare --project ejemplo --snapshot data/editorial-memory/ejemplo/propuesta.json
npm run youtube:render -- render --project ejemplo --package RUTA_DEVUELTA/render-package.json
npm run youtube:render -- still --project ejemplo --package RUTA_DEVUELTA/render-package.json --frame 100
```

Los snapshots por palabras soportan planos completos y cámara compilada. Si un cue
pide sonido, el render falla hasta que se resuelva su familia: no se omite en silencio.
El renderer permite también varias capas, imágenes, máscaras rectangulares, texto,
volúmenes y curvas lineales/Bézier; el plan editorial por palabras aún no expone
esos extras. No confundir capacidad de reproducción con planificación automática.

Para calibrar una referencia externa:

```powershell
npm run youtube:render -- prepare --project referencia --reference data/editorial-memory/ejemplo/capcut-edit-recipe.json --timeline ID --from 0 --to 27 --keyframe-clock source
```

Los stickers GIF de CapCut (`InfoSticker` con `config.json`) se resuelven solos desde
su caché y se renderizan como capa `gif` en bucle a su velocidad nativa. La escala base
(`CAPCUT_STICKER_BASE`) está calibrada con una sola referencia y deja aviso.

Un recurso ausente **siempre** detiene el empaquetado, también con `--allow-incomplete`:
dejaría un hueco con el fondo. Si el original no se puede recuperar, declarar el
sustituto; queda en `provenance.substitutions` del plan y del paquete:

```powershell
npm run youtube:render -- prepare ... --substitute "C:/ruta/original.png=data/editorial-memory/ejemplo/recuperado.png"
```

La selección de timeline y el reloj de keyframes son explícitos. No se aplana el
padre compuesto. La geometría importada usa centro normalizado, Y hacia arriba,
escala sobre contain y prioridad de pista. Curvas desconocidas, inverso y velocidad
variable se rechazan. Transición y recorte no soportados generan avisos.
Textos usan fuente/sombra aproximadas; la máscara rectangular conserva región con
acabado de borde aproximado. `--allow-incomplete` permite únicamente preparar una
calibración con esos avisos, que permanecen en el paquete y su QA.

Cada ejecución reserva un run nuevo. Los medios empaquetados se verifican antes
del render y otra vez tras copiarlos al public aislado. No se sobrescriben outputs.
El paquete congela props y medios **pero no el código del renderer**:
`rendererSourceFrozen:false`. Una exportación final exige archivar también la
versión de código. `--sound-disabled` produce variante con voz de los clips y sin
las pistas adicionales de música/SFX; no significa vídeo totalmente mudo.

```powershell
npm run youtube:qa -- --render PILOTO.mp4 --reference REFERENCIA.mp4 --package PAQUETE.json --output CARPETA_NUEVA
npm run youtube:feedback -- --package PAQUETE.json --frame 150 --category camera --quote "COMENTARIO REAL DEL USUARIO" --output data/editorial-memory/ejemplo/feedback-01.json
```

QA exporta pares de frames, metadata y diagnóstico de correlación/volumen de audio.
No acredita escucha, sincronía labial ni aprobación editorial. Feedback conserva
frame, reloj de fuentes activas, versión y palabras reales del usuario; su alcance
por defecto es `this-example`. `--scope candidate-preference` propone una preferencia,
sin convertirla automáticamente en regla universal ni marcarla aprobada.

Pilotos privados y limitaciones: `data/editorial-memory/grok-reference/PILOT-RESULTS.md`.
## Plan automático desde tomas en bruto

Primer montaje sin intervención: `planEdit` ordena las tomas numeradas (`1.mkv`,
`2.mkv`…; el resto son recursos), recorta cada una y decide punch-ins del gancho,
zooms, sonidos en cortes, sticker, música y cierre. **Todas las cantidades salen del
perfil medido** (`docs/editorial-memory.md`); cada decisión lleva en `reason` el campo
del perfil que la produjo.

```powershell
npm run youtube:studio -- ingest --source "D:\clips" --slug mi-video
npm run youtube:autoplan -- plan --project remotion-animations/projects/youtube-mi-video --output data/editorial-memory/autoplan/mi-video
npm run youtube:render -- prepare --project mi-video --render-plan data/editorial-memory/autoplan/mi-video/render-plan.json
npm run youtube:render -- render --project mi-video --package RUTA/render-package.json
```

- **Recortes por audio, no por palabras**: el transcriptor alarga la primera palabra
  sobre el silencio previo. Entrada y salida se ajustan al inicio/fin de voz de
  `silencedetect` más `speech.leadSeconds`/`tailSeconds`, medidos también con audio
  sobre las exportaciones.
- **Arranque fallido**: pocas palabras, un silencio de 1 s o más en el primer 40 % y la
  toma empieza de nuevo. Whisper suele fundir la frase repetida; el silencio es la prueba.
- **Kit**: sonidos por familia, música, cierre y sticker salen de lo que el corpus usó
  y sigue existiendo en disco (`editorial-memory/kit.js`).
- **Zoom anclado a la cara** (`focus` de la ingesta): la cara no se mueve y nunca
  aparece borde, porque el desplazamiento no supera `zoom - 1`.
- **Intenciones**: `--intents JSON` permite a cualquier agente elegir *dónde*
  (frases de énfasis, tomas que cambian de tema, cortes del gancho) sin tocar
  cantidades; `--llm` lo pide al LLM configurado y, si falla, sigue con reglas y lo
  deja en `warnings`. Formato: `{"emphasis":[{"clipId":"03","atWord":12}],
  "topicShiftTakes":[4],"hookPunchRefs":[{"clipId":"01","atWord":5}]}`.

### Evaluación dejando uno fuera

```powershell
npm run editorial:corpus -- profile --exclude 0921 --recent 6 --output data/editorial-memory/corpus/profile-holdout-0921.json
npm run youtube:autoplan -- plan --project ... --profile data/editorial-memory/corpus/profile-holdout-0921.json --output OUT
npm run youtube:autoplan -- evaluate --plan OUT/edit-plan.json --edit data/editorial-memory/corpus/edits/0921.json --output OUT/evaluation.json
```

Compara en el reloj de cada toma (nombre + segundo de fuente): recortes, punch-ins,
zooms, sonidos y marca. Un vídeo nunca aporta su propio perfil, kit ni ejemplos.
Medir es necesario pero no suficiente: el criterio final son los minutos de corrección
del autor sobre clips nuevos.

## Recursos automáticos

- **Clips no numerados** de la carpeta de tomas (`grok46.mkv`…) se colocan solos
  (`video-studio/asset-sourcing.js`): el nombre se lee como se dice (`grok46` →
  "grok 4.6") y el recurso entra en la frase que lo nombra y anuncia algo visible.
  Un anuncio fuerte ("os voy a mostrar") gana a un "aquí". Dos recursos nombrados
  juntos van en composición `compare`; uno, en `side`; una imagen, en `full`.
  Las geometrías están en `youtube-studio/layouts.json`, medidas de ediciones reales.
- **Posts de X y páginas web**:

```powershell
npm run youtube:autoplan -- capture --url https://x.com/USUARIO/status/ID --urls notas.txt --output data/editorial-memory/autoplan/mi-video/assets
npm run youtube:autoplan -- plan ... --assets data/editorial-memory/autoplan/mi-video/assets/assets.json
```

  Los posts salen del **oEmbed oficial** de X (sin login ni scraping) y se dibujan como
  tarjeta oscura con autor, texto y fecha. oEmbed no trae avatar ni imágenes, así que
  no se inventan. Las webs se capturan con el Chrome sin interfaz de Remotion. Cada
  archivo lleva `.provenance.json` con URL, hash, fecha y nota de licencia. Un post o
  una web se coloca donde se citan varias de sus palabras.
- **Cola de pendientes**: un recurso sin momento claro o una URL que no se puede
  capturar van a `pending-assets.json`. Nunca se renderiza un hueco (ver
  `--substitute`).

## QA sin referencia, comando único y salida editable

```powershell
npm run edit -- --source CARPETA --slug SLUG [--urls NOTAS.txt] [--intents JSON] [--no-render]
npm run youtube:autoplan -- qa --video MP4 --plan edit-plan.json --output DIR
npm run youtube:autoplan -- export --plan render-plan.json --output montaje.fcpxml
npm run youtube:autoplan -- corrections --plan render-plan.json --edited corregido.fcpxml --output correcciones.json
npm run mcp
```

- **QA** (`youtube-studio/qa.js`): **errores** si hay negros de 0,1 s o más,
  saturación (true peak > 0 dBTP), resolución, códec o duración distintos. **Avisos**
  si hay imagen congelada 3 s o más, picos por encima de −1 dBTP, volumen fuera de
  −20..−12 LUFS (tus exportaciones están en −17/−18) y cortes con voz sonando.
  `review-sheet.jpg` muestra un fotograma por decisión para revisarlo de un vistazo
  (persona o modelo de visión). No sustituye escucharlo.
- **`npm run edit`** encadena ingesta, capturas, plan, render y QA, y escribe
  `REVIEW.md` con decisiones, pendientes y avisos.
- **FCPXML 1.9** para DaVinci Resolve y Final Cut: narración en la línea principal,
  recursos y audio en carriles conectados, zoom como keyframes. El GIF del sticker
  no se repite en bucle en esos editores. `corrections` lee el FCPXML corregido
  (sea cual sea su anidamiento), lo compara con el plan y guarda lo movido, recortado,
  reescalado, quitado o añadido como corrección pendiente (`scope: this-example`).
- **MCP** (`scripts/shortsmith-mcp.js`, sin dependencias): `edit_video`,
  `plan_video`, `capture_assets`, `qa_render`, `style_profile` y `record_feedback`.
  Registrado en `.mcp.json`.
