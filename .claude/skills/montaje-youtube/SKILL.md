---
name: montaje-youtube
description: Monta automaticamente un video largo horizontal de YouTube a partir de una carpeta de tomas numeradas (1.mkv, 2.mkv...) con el estilo medido del autor (recortes, gancho, zooms, sonidos, musica, sticker, cierre, recursos y capturas de X/web), lo renderiza, pasa QA y deja REVIEW.md. Usala cuando el encargo sea "monta este video", "edita las tomas de esta carpeta", "haz el primer montaje", o al iterar/corregir ese montaje. NO es para Shorts verticales (shorts-desde-cero), intros (intro-a-camara) ni animaciones editoriales (episodio-animado).
---

# Montaje automatico de YouTube

## Paso 0
1. Leer `docs/youtube-studio.md` (secciones "Plan automatico" y "Recursos automaticos").
2. Leer `data/editorial-memory/corpus/ESTILO.md`. Si no existe o el autor ha editado
   videos nuevos en CapCut: `npm run editorial:corpus -- scan` y `-- profile`.

## Paso 1: montaje
```powershell
npm run edit -- --source "CARPETA_DE_TOMAS" --slug nombre-del-video [--urls notas.txt]
```
- Tomas = archivos numerados; lo demas son recursos que se colocan solos cuando se
  anuncian ("os voy a mostrar...").
- `--urls` acepta un archivo de notas: captura posts de X (oEmbed oficial) y webs.
- Si puedes leer el guion, escribe un `intents.json` (enfasis, `topicShiftTakes`,
  `hookPunchRefs`, con referencias `clip:palabra` que existan) y pasalo con `--intents`.
  Solo decides *donde*; las cantidades vienen del perfil.

## Paso 2: revisar antes de entregar
- Abrir `REVIEW.md` y `qa/review-sheet.jpg`. Errores de QA (negros, saturacion) se
  corrigen antes de entregar. Avisos de "corte con voz": comprobar ese segundo.
- `pending-assets.json`: preguntar al autor por lo que falte; nunca sustituir en silencio.

## Paso 3: correcciones del autor
- Comentarios: `npm run youtube:feedback` con sus palabras exactas.
- Si prefiere corregir en DaVinci/Final Cut: `npm run youtube:autoplan -- export`,
  y al devolverlo `-- corrections --edited EDITADO.fcpxml`. Quedan pendientes; no
  se convierten en regla sin que el autor lo confirme.

## Prohibido
- Escribir cantidades (zoom, volumen, duraciones) a mano en el plan.
- Afirmar que "esta aprobado" o "igual que CapCut" por pasar tests o QA.
- Publicar o subir el video: es otra etapa (`prepare-youtube-upload`).
