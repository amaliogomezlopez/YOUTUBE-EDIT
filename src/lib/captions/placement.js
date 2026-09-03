import {PIP_CANVAS} from '../pip-layout.js';
import {clamp} from '../utils.js';

/** Último y útil antes de la interfaz de Shorts (SH-R-040 usa 1748). */
export const CAPTION_SAFE_BOTTOM = 1680;
export const CAPTION_SAFE_TOP = 220;

/**
 * Punto vertical del bloque de subtítulos (centro del bloque) según el layout
 * 9:16. En primer plano la cara ocupa el centro: el texto baja al pecho. En
 * PIP la cara vive en la tarjeta de arriba y el escritorio abajo: el texto
 * se ancla en el hueco entre ambas.
 */
export function captionPlacement({layout = 'crop', pip = null, faceInCanvas = null, blockHeight = 150} = {}) {
  const half = blockHeight / 2;
  const minCenter = CAPTION_SAFE_TOP + half;
  const maxCenter = CAPTION_SAFE_BOTTOM - half;

  if (layout === 'pip' && pip) {
    const camBottom = pip.camCard ? pip.camCard.top + pip.camCard.height : (pip.captionBand?.top ?? 0);
    const screenTop = pip.screen?.top ?? pip.captionBand?.bottom ?? camBottom;
    const gapCenter = pip.captionBand
      ? pip.captionBand.top + pip.captionBand.height / 2
      : (camBottom + screenTop) / 2;
    return {
      position: 'safe-lower',
      anchorY: Math.round(clamp(gapCenter, minCenter, maxCenter)),
      region: 'gap'
    };
  }

  if (faceInCanvas && Number.isFinite(faceInCanvas.top) && Number.isFinite(faceInCanvas.height)) {
    const faceBottom = faceInCanvas.top + faceInCanvas.height;
    const belowFace = faceBottom + 72 + half;
    if (belowFace <= maxCenter) {
      return {
        position: 'safe-lower',
        anchorY: Math.round(clamp(Math.max(belowFace, 1500), minCenter, maxCenter)),
        region: 'below-face'
      };
    }
    const aboveFace = faceInCanvas.top - 48 - half;
    if (aboveFace >= minCenter) {
      return {
        position: 'upper-middle',
        anchorY: Math.round(clamp(aboveFace, minCenter, maxCenter)),
        region: 'above-face'
      };
    }
  }

  // crop / talking-head / fit: pecho, no boca. 1608 deja el bloque sobre
  // 1520-1680, por encima de la UI de Shorts y por debajo de un primer plano.
  return {
    position: 'safe-lower',
    anchorY: Math.round(clamp(1608, minCenter, maxCenter)),
    region: layout === 'fit' ? 'letterbox' : 'chest'
  };
}

export function projectFaceToCanvas(faceBox, media, layout, pip = null) {
  if (!faceBox || !media?.width || !media?.height) return null;
  if (layout === 'pip' && pip?.camCard) {
    return {
      left: pip.camCard.left,
      top: pip.camCard.top,
      width: pip.camCard.width,
      height: pip.camCard.height
    };
  }
  if (layout === 'fit') {
    const scale = PIP_CANVAS.width / media.width;
    const height = (PIP_CANVAS.width * media.height) / media.width;
    const top = (PIP_CANVAS.height - height) / 2;
    return {
      left: faceBox.x * scale,
      top: top + faceBox.y * scale,
      width: faceBox.w * scale,
      height: faceBox.h * scale
    };
  }
  const scale = Math.max(PIP_CANVAS.width / media.width, PIP_CANVAS.height / media.height);
  const cropX = (media.width * scale - PIP_CANVAS.width) / 2;
  const cropY = (media.height * scale - PIP_CANVAS.height) / 2;
  return {
    left: faceBox.x * scale - cropX,
    top: faceBox.y * scale - cropY,
    width: faceBox.w * scale,
    height: faceBox.h * scale
  };
}
