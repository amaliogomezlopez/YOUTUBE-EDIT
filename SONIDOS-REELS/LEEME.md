# Tus sonidos para Reels

Copia aqui los efectos que quieras usar. Puedes conservar sus nombres.

- Formatos: WAV, MP3, M4A, AAC, FLAC, OGG y OPUS.
- Basta con dejarlos directamente en esta carpeta. No hay que puntuarlos.
- El **prefijo del nombre** dice para que sirve un efecto de montaje (lo lee `src/modules/talking-head/sound-usage.js`):

  | Prefijo | Uso | En la apertura suena en |
  |---|---|---|
  | `impacto-grave_` | impacto grave y seco | `zoom-punch`, logos (familias `boom`, `hit`) |
  | `remate_` | impacto con cuerpo | `shake` en el remate (`impact`) |
  | `whoosh-in_` | whoosh inverso | transicion `zoom-blur` (`rewind`); su pico cae en el corte |
  | `clic_` | clic de interfaz | `ui`: algo que se pulsa o aparece en una pantalla |
  | `ding-dato_` | ding de dato | cifra que no es dinero (`stat`, familias `tick`, `chime`) |
  | `glitch_` | glitch corto | transicion `glitch-cut` |
  | `tecleo_` | tecleo | titular con `titleCard.sound: "typing"` |
  | `bajada_` | bajada de bajo | sin uso todavia; no entra en ninguna rotacion |

  Estos efectos **no** entran en la rotacion de transiciones de los Reels. Subcarpetas
  equivalentes: `impactos` (= `impacto-grave_`) y `clicks` (= `clic_`); `entradas` y el
  resto de ficheros sin prefijo son transiciones.
- La subcarpeta `apertura/` guarda efectos solo para la apertura de los videos largos:
  no suenan en los Reels. Donde suena cada uno lo dice `preferencias.json` (por
  situacion, en orden de rotacion; repetir un sonido le da mas peso), que se edita a
  mano o con `ESCUCHA.html` (`npm run sonidos:escucha`).
- Se preparan automaticamente al montar el siguiente Reel. Para comprobarlos ahora: `npm run talking-head -- sounds`.
- El importador crea copias WAV a 48 kHz, iguala el pico y conserva el tono y prepara una copia sin silencios de entrada/salida. No modifica tus originales.
- Si hay sonidos aqui, los nuevos montajes usan solo estos y alternan entre ellos. Con un solo archivo se repetira ese archivo.
- Al sacar un sonido de esta carpeta deja de seleccionarse en futuros planes. Las copias de montajes anteriores se conservan para no romperlos.
- Los efectos de mas de 3 segundos generan un aviso para revisar la cola; el limite de importacion es 30 segundos.

Esta carpeta y sus copias de audio son privadas y se excluyen de Git. Los MP4 ya exportados no cambian al copiar nuevos sonidos.

Los usos concretos estan en CATALOGO.md. Money, riser y Message se reservan para sus contextos. Se recortan silencios de los extremos en copias de reproduccion para sincronizarlas; los originales no cambian.


### Sincronizacion de efectos y risers

Las copias de efectos se recortan hasta el inicio/final detectado del sonido (-45 dB), sin anadir margen de silencio y sin quitar pausas internas. Se generan copias nuevas versionadas; los originales y los renders anteriores se conservan. Los efectos normales comienzan en el frame del cambio visual, incluso si la palabra ancla llega unos milisegundos despues. El riser de apertura se coloca hacia atras desde el siguiente cambio de visual: su final coincide con ese corte, con precision de un frame, conservando su velocidad. Un corte de toma que mantiene la misma visual no es su destino. Si el riser no cabe, usar uno mas corto; si no hay cambio de visual, seleccionar soundUse transition.
