import {round} from './utils.js';
import {validSourceBox} from '../modules/video-studio/framing.js';

/**
 * Geometria 9:16 del layout webcam + pantalla. Una sola fuente de verdad para
 * FFmpeg y Remotion: tarjeta de cara 4:5 arriba, pantalla en cover debajo.
 */

export const PIP_CANVAS = Object.freeze({width: 1080, height: 1920});

export const PIP_CARD = Object.freeze({
  top: 80,
  minWidth: 400,
  maxWidth: 540,
  maxUpscale: 2.5,
  radius: 28,
  stroke: 3,
  shadowBlur: 16,
  shadowOffsetY: 10,
  // Hueco entre la tarjeta de cara y la pantalla: cabe un bloque karaoke
  // de dos lineas (72px) con aire, sin tapar ni la cara ni el escritorio.
  screenGap: 208
});

function even(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function coverTransform(sourceWidth, sourceHeight, destWidth, destHeight) {
  const scale = Math.max(destWidth / sourceWidth, destHeight / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  return {
    scale,
    cropX: (scaledWidth - destWidth) / 2,
    cropY: (scaledHeight - destHeight) / 2,
    scaledWidth,
    scaledHeight
  };
}

export function projectSourceBox(box, transform, slot) {
  return {
    left: slot.left + box.x * transform.scale - transform.cropX,
    top: slot.top + box.y * transform.scale - transform.cropY,
    width: box.w * transform.scale,
    height: box.h * transform.scale
  };
}

function clampRect(rect, width, height) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(width, rect.left + rect.width);
  const bottom = Math.min(height, rect.top + rect.height);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

/**
 * @param {{x: number, y: number, w: number, h: number}} webcamBox caja en pixeles de la fuente
 * @param {{sourceWidth: number, sourceHeight: number}} source
 */
export function pipLayout(webcamBox, {sourceWidth, sourceHeight}) {
  if (!webcamBox) throw new Error('pipLayout necesita webcamBox');
  if (!validSourceBox(webcamBox, {width: sourceWidth, height: sourceHeight})) throw new Error('webcamBox invalido o fuera de la fuente');
  const boxX = Math.max(0, Math.round(webcamBox.x));
  const boxY = Math.max(0, Math.round(webcamBox.y));
  const boxW = Math.max(24, Math.round(webcamBox.w));
  const boxH = Math.max(24, Math.round(webcamBox.h));

  const camWidth = even(Math.min(PIP_CARD.maxWidth, Math.max(PIP_CARD.minWidth, boxW * PIP_CARD.maxUpscale)));
  const camHeight = even((camWidth * boxH) / boxW);
  const stroke = PIP_CARD.stroke;
  const camCard = {
    left: round((PIP_CANVAS.width - (camWidth + stroke * 2)) / 2, 2),
    top: PIP_CARD.top,
    width: camWidth + stroke * 2,
    height: camHeight + stroke * 2,
    radius: PIP_CARD.radius,
    stroke
  };

  const captionBandTop = camCard.top + camCard.height;
  const screenTop = Math.round(captionBandTop + PIP_CARD.screenGap);
  const screen = {
    left: 0,
    top: screenTop,
    width: PIP_CANVAS.width,
    height: even(PIP_CANVAS.height - screenTop)
  };
  const captionBand = {
    top: round(captionBandTop, 2),
    height: PIP_CARD.screenGap,
    bottom: screenTop
  };

  const cropScale = camWidth / boxW;
  const camCrop = {
    scale: round(cropScale, 6),
    offsetX: round(-boxX * cropScale, 2),
    offsetY: round(-boxY * cropScale, 2),
    videoWidth: round(sourceWidth * cropScale, 2),
    videoHeight: round(sourceHeight * cropScale, 2)
  };

  const cover = coverTransform(sourceWidth, sourceHeight, screen.width, screen.height);
  const pad = 16;
  const projected = projectSourceBox(
    webcamBox.sourceBox ?? {x: boxX - pad, y: boxY - pad, w: boxW + pad * 2, h: boxH + pad * 2},
    cover,
    {left: 0, top: 0, width: screen.width, height: screen.height}
  );
  const local = clampRect(projected, screen.width, screen.height);
  const mask = {
    left: round(screen.left + local.left, 2),
    top: round(screen.top + local.top, 2),
    width: round(local.width, 2),
    height: round(local.height, 2),
    localLeft: round(local.left, 2),
    localTop: round(local.top, 2),
    visible: local.width >= 8 && local.height >= 8
  };

  const camSharpness = camWidth / boxW > 3 ? '0.35:3:3:0.15' : '0.45:3:3:0.18';

  return {
    camCard,
    camCrop,
    camWidth,
    camHeight,
    camSharpness,
    screen,
    captionBand,
    mask,
    cover: {
      scale: round(cover.scale, 6),
      cropX: round(cover.cropX, 2),
      cropY: round(cover.cropY, 2)
    }
  };
}

export function fitLayout({sourceWidth, sourceHeight}) {
  const height = even((PIP_CANVAS.width * sourceHeight) / sourceWidth);
  return {
    screen: {
      left: 0,
      top: round((PIP_CANVAS.height - height) / 2, 2),
      width: PIP_CANVAS.width,
      height
    }
  };
}
