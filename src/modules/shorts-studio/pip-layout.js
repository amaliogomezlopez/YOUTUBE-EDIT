import {round} from '../../lib/utils.js';

/**
 * Geometria de los layouts `pip` y `fit` del short, en coordenadas del canvas
 * 1080x1920. Replica los numeros del filtergraph de FFmpeg
 * (`src/lib/ffmpeg.js`, `pipLayoutForWebcamBox` y `buildVerticalFilter`), para
 * que el PIP compuesto en Remotion quede como el que ya produce el pipeline de
 * video largo. Modulo puro: nada de Remotion, todo se puede testear en Node.
 *
 * `pip` (webcam incrustada en una grabacion de pantalla):
 *   - `camCard`: tarjeta de la cara arriba, centrada. Incluye el borde negro de
 *     6 px (el `pad=iw+12:ih+12:6:6:black` de FFmpeg): el video va dentro, con
 *     `camCrop`, y el borde es fondo de la tarjeta.
 *   - `camCrop`: como colocar el video fuente dentro de la tarjeta para que solo
 *     se vea el webcamBox, escalado a `camWidth`.
 *   - `screen`: la pantalla escalada a 1600 px de ancho, desbordando el canvas
 *     por la izquierda (x = -130) para que el recorte visible sea el centro.
 *   - `mask`: rectangulo negro que tapa la webcam incrustada original, ya
 *     proyectado sobre la pantalla escalada (coordenadas absolutas del canvas).
 *
 * `fit` (sin webcam): el video entero a 1080 de ancho, centrado en vertical.
 */

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const SCREEN_WIDTH = 1600;
const SCREEN_LEFT = -130;
const CAM_MAX_WIDTH = 650;
const CAM_MIN_WIDTH = 360;
const CAM_MAX_UPSCALE = 2.5;
const CAM_TOP = 42;
const CAM_PAD = 6;
const SCREEN_MIN_TOP = 520;
const SCREEN_GAP = 42;
// Margenes de la mascara sobre la webcam incrustada (pixeles fuente).
const MASK_LEFT = 24;
const MASK_TOP = 18;
const MASK_EXTRA_WIDTH = 54;
const MASK_EXTRA_HEIGHT = 42;

// Igual que en ffmpeg.js: los filtros de escala exigen dimensiones pares.
function even(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * @param {{x: number, y: number, w: number, h: number}} webcamBox caja de la
 *   webcam en pixeles del video fuente.
 * @param {{sourceWidth: number, sourceHeight: number}} source dimensiones del clip.
 */
export function pipLayout(webcamBox, {sourceWidth, sourceHeight}) {
  if (!webcamBox) throw new Error('pipLayout necesita webcamBox');
  const boxX = Math.max(0, Math.round(webcamBox.x));
  const boxY = Math.max(0, Math.round(webcamBox.y));
  const boxW = Math.max(24, Math.round(webcamBox.w));
  const boxH = Math.max(24, Math.round(webcamBox.h));

  const camWidth = even(Math.min(CAM_MAX_WIDTH, Math.max(CAM_MIN_WIDTH, boxW * CAM_MAX_UPSCALE)));
  const camVideoHeight = even((camWidth * boxH) / boxW);
  const camCard = {
    left: round((CANVAS_WIDTH - (camWidth + CAM_PAD * 2)) / 2, 2),
    top: CAM_TOP,
    width: camWidth + CAM_PAD * 2,
    height: camVideoHeight + CAM_PAD * 2
  };
  const screenTop = Math.max(SCREEN_MIN_TOP, Math.round(CAM_TOP + camCard.height + SCREEN_GAP));

  const cropScale = camWidth / boxW;
  const camCrop = {
    scale: round(cropScale, 6),
    offsetX: round(-boxX * cropScale, 2),
    offsetY: round(-boxY * cropScale, 2),
    videoWidth: round(sourceWidth * cropScale, 2),
    videoHeight: round(sourceHeight * cropScale, 2)
  };

  const screen = {
    left: SCREEN_LEFT,
    top: screenTop,
    width: SCREEN_WIDTH,
    height: even((SCREEN_WIDTH * sourceHeight) / sourceWidth)
  };

  // La mascara se dibuja sobre la fuente y luego se escala con la pantalla;
  // aqui se proyecta directamente a coordenadas del canvas.
  const screenScale = SCREEN_WIDTH / sourceWidth;
  const mask = {
    left: round(SCREEN_LEFT + Math.max(0, boxX - MASK_LEFT) * screenScale, 2),
    top: round(screenTop + Math.max(0, boxY - MASK_TOP) * screenScale, 2),
    width: round((boxW + MASK_EXTRA_WIDTH) * screenScale, 2),
    height: round((boxH + MASK_EXTRA_HEIGHT) * screenScale, 2)
  };

  return {camCard, camCrop, screen, mask};
}

/**
 * Layout `fit`: el video entero a 1080 de ancho manteniendo proporcion,
 * centrado en vertical sobre el fondo desenfocado.
 */
export function fitLayout({sourceWidth, sourceHeight}) {
  const height = even((CANVAS_WIDTH * sourceHeight) / sourceWidth);
  return {
    screen: {
      left: 0,
      top: round((CANVAS_HEIGHT - height) / 2, 2),
      width: CANVAS_WIDTH,
      height
    }
  };
}
