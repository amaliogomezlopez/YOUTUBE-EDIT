# Catalogo de sonidos del usuario

Preferencias indicadas por el usuario: seis efectos intercambiables para cambios de visual; money para dinero, riser para inicio y Message sound para mensajes o tuits. Descripciones de uso editorial basadas en esas preferencias y los archivos aportados.

| Archivo original | Uso | Duracion preparada | Descripcion |
|---|---|---|---|
| Camera Shutter 1A - _Crunch_ Click (-15 db) - Submitted by Ivan Khan.mp3 | transition | 0.50 s | Obturador/camara: entrada de captura, titular o cambio de visual. |
| chunky camera .wav | transition | 0.70 s | Obturador/camara: entrada de captura, titular o cambio de visual. |
| DSGNWhsh_Short Whip, Short Whoosh 2_Ocular Sounds_Quick Whips_The Complete Whooshes Collection.wav | transition | 0.14 s | Whip/whoosh: corte o entrada de una nueva imagen o clip. |
| ES_Riser Metallic - SFX Producer.mp3 | intro | 1.71 s | Ascenso metalico para el arranque del video. Usar una vez al inicio, discretamente bajo la voz. |
| ES_Suction Pop 5 - SFX Producer.mp3 | transition | 0.37 s | Pop: entrada breve y ligera de una nueva visual. |
| Message sound.mp3 | message | 0.75 s | Notificacion cuando aparece un mensaje, chat, tuit o publicacion social. No basta con mencionar una red social. |
| money.mp3 | money | 2.31 s | Dinero: precios, ingresos, ahorro, pagos o cifras economicas. Nunca transicion generica. |
| Slice Ring.wav | transition | 1.19 s | Slice Ring: cambio de visual con cola; revisar que no se solape con el siguiente golpe. |
| Whip 2 Sound Effect ( By Ashish Editz )_01.mp3 | transition | 0.25 s | Whip/whoosh: corte o entrada de una nueva imagen o clip. |

## Como los pide el agente

En cada resource de asset-requests.json se puede usar soundUse: transition, intro, money o message. Vacio aplica riser en el primer recurso si existe, y transicion general en los demas. Money y message requieren soundNote con el motivo concreto. Por ejemplo: soundUse: message, soundNote: Aparece el tuit original que se esta comentando.

El riser solo se permite al inicio. Money y Message no forman parte de la rotacion generica. No introducirlos por una coincidencia aislada de palabras: el recurso o la locucion deben justificarlo. En el piloto sobre Codex no se han forzado money ni Message.

Las copias de reproduccion eliminan solo silencios de entrada y salida (-45 dB), conservando 30 ms antes y 80 ms despues del sonido detectado. Las pausas internas se mantienen. El tono no cambia. Esto evita que un archivo con 1,5 segundos de silencio entre tarde en el corte. Los originales siguen intactos.

El catalogo operativo con hashes, duraciones y recortes vive en data/talking-head/sound-catalog.json y se regenera al importar. Los nombres money/dinero, riser y message/mensaje mantienen sus usos especiales; los demas archivos son transiciones generales. No renombrar los especiales eliminando esa palabra sin actualizar su clasificacion.
