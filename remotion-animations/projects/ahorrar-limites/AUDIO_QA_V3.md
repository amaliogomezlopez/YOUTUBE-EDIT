# QA de audio · Ahorrar límites V3

Medición realizada sobre los MP4 finales con `ffprobe` y
`ffmpeg -af volumedetect`.

| Clip | Duración | Audio | Media | Pico |
| --- | ---: | --- | ---: | ---: |
| 03 | 8,00 s | AAC · 48 kHz · estéreo | -36,1 dBFS | -17,0 dBFS |
| 06 | 8,00 s | AAC · 48 kHz · estéreo | -32,1 dBFS | -17,1 dBFS |
| 10 | 8,00 s | AAC · 48 kHz · estéreo | -35,3 dBFS | -18,8 dBFS |
| 13 | 6,00 s | AAC · 48 kHz · estéreo | -34,0 dBFS | -18,9 dBFS |
| 17 | 8,00 s | AAC · 48 kHz · estéreo | -33,8 dBFS | -17,8 dBFS |
| 22 | 8,00 s | AAC · 48 kHz · estéreo | -37,9 dBFS | -19,1 dBFS |
| 24 | 10,00 s | AAC · 48 kHz · estéreo | -35,4 dBFS | -18,2 dBFS |
| 27 | 10,00 s | AAC · 48 kHz · estéreo | -33,8 dBFS | -15,6 dBFS |

No hay clipping ni normalización agresiva. La diferencia de media responde a
los silencios y al número de eventos de cada escena; los picos permanecen en
un rango coherente para montaje bajo locución.
