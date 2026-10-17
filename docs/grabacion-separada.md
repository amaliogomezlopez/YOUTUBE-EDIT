# Grabacion separada: camara, pantalla y mezcla

Desde octubre de 2026 el autor graba con OBS tres salidas por toma en `VIDEOS_RECORDED`:

| Salida | Fichero | Audio | Que es |
|---|---|---|---|
| Mezcla | `<toma>.mkv` (raiz) | si (pistas 1 y 2 iguales) | pantalla con la webcam incrustada en una esquina |
| Camara | `CAMARA/CAMARA <toma>.mkv` | no | la cara a pantalla completa |
| Pantalla | `PANTALLA/PANTALLA <toma>.mkv` | no | la pantalla limpia, sin webcam |

`<toma>` es la fecha de OBS (`2026-10-16 21-04-09`). Camara y pantalla arrancan unas
decimas despues que la mezcla (0,167 s y 0,1 s medidos el 2026-10-16): por eso no se
copian a ciegas, se mide el desfase de cada toma.

## Directrices de montaje

1. **Orden: de la toma mas antigua a la mas nueva**, salvo que el autor diga otra cosa.
   Es el orden en que grabo. `npm run tomas` lo aplica (`--order newest` lo invierte).
2. **Preferir la camara.** El autor quiere verse a si mismo: la imagen de las tomas sale
   de `CAMARA/` y el audio de la mezcla. La mezcla (`--video mezcla`) solo cuando lo pida
   o cuando la toma ensena la pantalla todo el rato.
3. **La pantalla es un recurso, no la toma.** Lo que el autor ensena en `PANTALLA/` (posts,
   rankings, noticias) entra como recurso `local` recortado en el momento en que lo nombra:
   la columna del post o la pagina, sin barra de tareas ni pestanas, 16:9 (relleno negro
   para un post de X). En el montaje "escritorio" va en planos `corner`; en un short,
   arriba en el panel.
4. **Apertura + cuerpo.** Las primeras tomas (el gancho y, si lo hay, el aviso del
   newsletter) son la apertura viral (`intro-viral`); el resto es el cuerpo
   (`montaje-escritorio --variant camara` o `edit`). Se unen al final en un MP4 1080p30
   con la sonoridad normalizada a -14 LUFS y el pico por debajo de -1 dBTP.
5. **Recursos de cada noticia** que se nombra: video oficial (tramo de 6-12 s), captura del
   titular de la noticia, el post de X y la pantalla del propio autor. Lo que no cuadra
   con la frase no entra.

## Procedimiento

```powershell
# 1. Tomas numeradas, de la mas antigua a la mas nueva, camara + audio de la mezcla
npm run tomas -- --recordings "<VIDEOS_RECORDED>" --out data/youtube-src/<slug> --dry-run
npm run tomas -- --recordings "<VIDEOS_RECORDED>" --out data/youtube-src/<slug>
```

Deja `1.mkv`, `2.mkv`… y `tomas.json` (toma original, desfase medido y su fichero de
PANTALLA). Una toma con poco movimiento correlaciona mal y usa la mediana de las demas;
si ninguna es fiable, pasar `--offset 0.167`.

```powershell
# 2. Apertura con las primeras tomas (normalmente 1 y 2)
npm run intro:viral -- start --source data/youtube-src/<slug> --clips 1,2 --slug <slug> --music "<pista>"

# 3. Cuerpo: el resto, renumerado desde 1 con enlaces duros (no copia los ficheros)
#    p. ej. 3.mkv -> cuerpo/1.mkv, 4.mkv -> cuerpo/2.mkv ...
npm run youtube:escritorio -- start --source data/youtube-src/<slug>-cuerpo --slug <slug> --variant camara --wallpaper "<fondo>"
```

Los recortes de PANTALLA para recursos se sacan con ffmpeg desde la ruta de `tomas.json`,
en el reloj de la toma (el desfase pantalla↔camara es de unas centesimas y no se nota en
un recurso).

## Shorts de la misma grabacion

Mismo origen, otra herramienta: `create-ranked-shorts`, seccion "Grabacion separada"
(`camera-cuts.mjs`), que comparte la medida del desfase
(`src/modules/video-studio/recorded-takes.js`).
