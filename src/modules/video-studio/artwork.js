import path from 'node:path';
import {round} from '../../lib/utils.js';
import {REMOTION_ROOT} from './paths.js';

/**
 * Medidas del arte de una imagen, para decidir si su `presentation` la deja
 * legible.
 *
 * Vive en la capa comun porque el problema no es del formato: un logo negro sobre
 * alfa desaparece igual dentro de una tarjeta oscura en un short vertical que en
 * una intro 16:9. Las reglas que lo miden estan en `video-studio/checks/`.
 *
 * Los dos fallos reales que motivan esto no se ven en el JSON del plan, solo al
 * renderizar: un logo negro sobre alfa desaparece dentro de una tarjeta oscura, y
 * un wordmark exportado sin alfa arrastra un rectangulo negro sobre el video. Los
 * dos se distinguen mirando los pixeles, asi que se miran una vez en el build y el
 * resultado viaja en el JSON compilado.
 */
export async function analyzeArtwork(staticFile, {root = path.join(REMOTION_ROOT, 'public')} = {}) {
  const {default: sharp} = await import('sharp');
  const file = path.join(root, ...String(staticFile).split('/'));
  const {data, info} = await sharp(file)
    // Reducir antes de medir: la decision es de tono global, no de detalle, y un
    // muestreo pequeno mantiene el build por debajo de la decima de segundo.
    .resize(96, 96, {fit: 'inside'})
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});

  const {width, height, channels} = info;
  let opaque = 0;
  let lumaSum = 0;
  let darkOpaque = 0;
  let edgePixels = 0;
  let edgeOpaqueDark = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const alpha = data[offset + 3] / 255;
      const luma = (
        0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]
      ) / 255;
      const onEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (onEdge) {
        edgePixels += 1;
        if (alpha > 0.9 && luma < 0.12) edgeOpaqueDark += 1;
      }
      if (alpha <= 0.6) continue;
      opaque += 1;
      lumaSum += luma;
      if (luma < 0.35) darkOpaque += 1;
    }
  }

  if (!opaque) return null;
  return {
    /** Cuanta imagen es visible: un logo sobre alfa cubre solo su trazo. */
    opaqueCoverage: round(opaque / (width * height), 3),
    meanLuma: round(lumaSum / opaque, 3),
    darkRatio: round(darkOpaque / opaque, 3),
    /** Borde opaco y casi negro = el arte trae su propio fondo solido. */
    edgeDarkRatio: round(edgeOpaqueDark / edgePixels, 3)
  };
}

/** El arte es un trazo oscuro sobre transparencia: invisible en tarjeta oscura. */
export function isDarkArtOnAlpha(art) {
  if (!art) return false;
  return art.edgeDarkRatio < 0.5 && art.opaqueCoverage < 0.9 && art.meanLuma < 0.2;
}

/** El arte trae fondo negro solido: sobre tarjeta oscura se ve el rectangulo. */
export function hasSolidDarkBackground(art) {
  if (!art) return false;
  return art.edgeDarkRatio > 0.9 && art.opaqueCoverage > 0.9 && art.darkRatio > 0.6;
}
