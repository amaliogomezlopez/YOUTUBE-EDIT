# Catalogo de sonidos del usuario

Preferencias indicadas por el usuario: seis efectos intercambiables para cambios de visual; money para dinero, riser para inicio y Message sound para mensajes o tuits. Descripciones de uso editorial basadas en esas preferencias y los archivos aportados.

| Archivo original | Uso | Duracion preparada | Descripcion |
|---|---|---|---|
| Camera Shutter 1A - _Crunch_ Click (-15 db) - Submitted by Ivan Khan.mp3 | transition | 0.39 s | Obturador/camara: entrada de captura, titular o cambio de visual. |
| chunky camera .wav | transition | 0.59 s | Obturador/camara: entrada de captura, titular o cambio de visual. |
| DSGNWhsh_Short Whip, Short Whoosh 2_Ocular Sounds_Quick Whips_The Complete Whooshes Collection.wav | transition | 0.14 s | Whip/whoosh: corte o entrada de una nueva imagen o clip. |
| ES_Riser Metallic - SFX Producer.mp3 | intro | 1.71 s | Ascenso metalico para el arranque del video. Usar una vez al inicio, discretamente bajo la voz. |
| ES_Suction Pop 5 - SFX Producer.mp3 | transition | 0.26 s | Pop: entrada breve y ligera de una nueva visual. |
| Message sound.mp3 | message | 0.64 s | Notificacion cuando aparece un mensaje, chat, tuit o publicacion social. No basta con mencionar una red social. |
| money.mp3 | money | 2.27 s | Dinero: precios, ingresos, ahorro, pagos o cifras economicas. Nunca transicion generica. |
| Slice Ring.wav | transition | 1.08 s | Slice Ring: cambio de visual con cola; revisar que no se solape con el siguiente golpe. |
| Whip 2 Sound Effect ( By Ashish Editz )_01.mp3 | transition | 0.14 s | Whip/whoosh: corte o entrada de una nueva imagen o clip. |

## Efectos de montaje (anadidos el 2026-09-24)

Elegidos por ranking con criterios medidos (duracion util a -30 dB, ataque, cola tras
300 ms) sobre Mixkit y Pixabay. El prefijo del nombre fija el uso (ver LEEME.md). La
duracion preparada es la de reproduccion en la apertura: impactos, dings, clics y glitch
se cortan con fundido en su tope (`USER_EDIT_USES` de `intro-studio/sound.js`).

| Archivo | Uso | Preparada | Fuente y licencia | Descripcion |
|---|---|---|---|---|
| impacto-grave_short-bass-hit_mixkit-2299.wav | impact-low | 0.84 s | Mixkit 2299 "Short bass hit", Mixkit Free License | Grave seco sin reverb larga. Sustituye al impacto sintetico de la libreria. |
| impacto-grave_bass-switch_mixkit-2301.wav | impact-low | 0.90 s | Mixkit 2301 "Quick bass switch", Mixkit Free License | Grave corto con algo de caracter electronico. |
| impacto-grave_impact-thud_pixabay-291047.mp3 | impact-low | 0.39 s | Pixabay 291047 "Impact Thud" (Universfield), Pixabay Content License | Golpe sordo y corto: el mas discreto. |
| impacto-grave_low-thumpy-kick_pixabay-494833.mp3 | impact-low | 0.85 s | Pixabay 494833 "Low Thumpy Kick Reverb Hit" (Black_Kumizhi), Pixabay Content License | Bombo grave con algo de sala. |
| remate_drum-deep-impact_mixkit-563.wav | impact-finisher | 1.40 s | Mixkit 563 "Drum deep impact", Mixkit Free License | Bombo cinematografico para el remate (`shake`). Cola cortada a 1,4 s. |
| whoosh-in_fast-whoosh_mixkit-1490.wav | whoosh-in | 0.72 s (pico 0.67) | Mixkit 1490 "Fast whoosh transition", Mixkit Free License | Crece hasta el corte. |
| whoosh-in_short-sweep_mixkit-175.wav | whoosh-in | 0.36 s (pico 0.29) | Mixkit 175 "Short transition sweep", Mixkit Free License | Barrido inverso corto. |
| whoosh-in_phantom-signal-reverse_pixabay-534703.mp3 | whoosh-in | 0.74 s (pico 0.60) | Pixabay 534703 "Phantom Signal (Reverse)" (BRVHRTZ), Pixabay Content License | Inverso con textura electronica; 0,14 s de caida tras el pico. |
| clic_interface-tone_mixkit-2568.wav | click | 0.05 s | Mixkit 2568 "Cool interface click tone", Mixkit Free License | Clic de UI limpio. |
| clic_interface_mixkit-1126.wav | click | 0.22 s | Mixkit 1126 "Interface click", Mixkit Free License | Clic de UI con algo mas de cuerpo. |
| ding-dato_dry-popup_mixkit-2356.wav | data | 0.30 s | Mixkit 2356 "Dry pop up notification alert", Mixkit Free License | Ding seco y moderno para una cifra. |
| ding-dato_attention-bell_mixkit-586.wav | data | 0.80 s | Mixkit 586 "Attention bell ding", Mixkit Free License | Ding brillante; algo de campana de mostrador. |
| glitch_scifi_mixkit-1022.wav | glitch | 0.66 s | Mixkit 1022 "Cinematic sci fi glitch", Mixkit Free License | Glitch de ataque rapido y cola corta. |
| tecleo_single-key_mixkit-2533.wav | typing | 0.21 s | Mixkit 2533 "Single key type", Mixkit Free License | Tecla suelta. |
| tecleo_key-presses_mixkit-2534.wav | typing | 0.61 s | Mixkit 2534 "Keyboard key presses", Mixkit Free License | Rafaga de teclas; encaja con un titular de 0,6-0,7 s. |

Licencias: Mixkit Free License (uso comercial en YouTube, sin atribucion, sin registro;
https://mixkit.co/license/) y Pixabay Content License (uso comercial sin atribucion; no
redistribuir el efecto suelto; https://pixabay.com/service/license-summary/).

Descartados tras medirlos: "Hard Heavy Impact" (Pixabay 515256; 1,68 s utiles y 51 % de
cola), "Sub drop short" (232033) y "Sub Bass Boom 1" (302682), ambos de mas de 2,5 s.
La familia `bajada` sigue vacia.

## Como los pide el agente

En cada resource de asset-requests.json se puede usar soundUse: transition, intro, money o message. Vacio aplica riser en el primer recurso si existe, y transicion general en los demas. Money y message requieren soundNote con el motivo concreto. Por ejemplo: soundUse: message, soundNote: Aparece el tuit original que se esta comentando.

El riser solo se permite al inicio. Money y Message no forman parte de la rotacion generica. No introducirlos por una coincidencia aislada de palabras: el recurso o la locucion deben justificarlo. En el piloto sobre Codex no se han forzado money ni Message.

Las copias de reproduccion eliminan solo silencios de entrada y salida (-45 dB), sin margen adicional antes o despues del sonido detectado. Las pausas internas se mantienen. El tono no cambia. Esto evita que un archivo con 1,5 segundos de silencio entre tarde en el corte. Los originales siguen intactos.

El catalogo operativo con hashes, duraciones y recortes vive en data/talking-head/sound-catalog.json y se regenera al importar. Los nombres money/dinero, riser y message/mensaje mantienen sus usos especiales; los demas archivos son transiciones generales. No renombrar los especiales eliminando esa palabra sin actualizar su clasificacion.


### Sincronizacion de efectos y risers

Las copias de efectos se recortan hasta el inicio/final detectado del sonido (-45 dB), sin anadir margen de silencio y sin quitar pausas internas. Se generan copias nuevas versionadas; los originales y los renders anteriores se conservan. Los efectos normales comienzan en el frame del cambio visual, incluso si la palabra ancla llega unos milisegundos despues. El riser de apertura se coloca hacia atras desde el siguiente cambio de visual: su final coincide con ese corte, con precision de un frame, conservando su velocidad. Un corte de toma que mantiene la misma visual no es su destino. Si el riser no cabe, usar uno mas corto; si no hay cambio de visual, seleccionar soundUse transition.

## Seleccion de la biblioteca del usuario para la apertura (2026-09-25)

38 efectos de `EFECTOS_VIDEO/AUDIO_EFECTOS` (carpetas 07-CAMARA, 36-WHOOSH, 32-SWOSH,
35-TRANSICION, 05-BOOM, 29-POP, 10-CLICK, 28-PAPEL, 22-GLITCH, 14-DING, 13-DINERO y
SFX), elegidos entre 533 medidos (duracion util a -30 dB, ataque, cola y, en los
inversos, pico al final). Viven en `apertura/`: esa subcarpeta **no entra en la
rotacion de los Reels**; solo suena donde la pone `preferencias.json` o por su prefijo
de uso (`impacto-grave_`, `remate_`, `whoosh-in_`, `glitch_`, `ding-dato_`, `clic_`).
Se quitaron dos duplicados exactos de la biblioteca (Whoosh Fast 01 = Whoosh Digital
06; Click (2) = Mouse Click 1). Los de dinero y arranque se llaman `caja_` y
`arranque_` para que los Reels sigan usando `money.mp3` y el riser metalico.

`preferencias.json` reparte todo por situacion (zoom, toma nueva, entrar y salir de un
b-roll, zoom inverso, papel, captura, golpe, remate, cifra, dinero, arranque, clic,
mensaje, titular). Chunky camera y Camera Shutter se repiten en zooms y transiciones
porque el usuario pidio abusar de ellos. `ESCUCHA.html` (`npm run sonidos:escucha`)
permite escucharlos y reordenarlos.
