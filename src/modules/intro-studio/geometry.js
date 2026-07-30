import {readFileSync} from 'node:fs';
import path from 'node:path';
import {round} from '../../lib/utils.js';
import {REMOTION_ROOT} from './constants.js';

/**
 * Geometria de la intro leida desde el mismo JSON que dibuja Remotion
 * (`remotion-animations/src/intro/geometry.json`). Los numeros no se copian: si
 * alguien sube la banda de titulo o mueve un slot, el validador lo mide con el
 * valor nuevo.
 *
 * Aqui, a diferencia del short, no hay aritmetica de slots replicada: los slots son
 * rectangulos declarados y las dos implementaciones los leen tal cual.
 */
export const INTRO_GEOMETRY = JSON.parse(
  readFileSync(path.join(REMOTION_ROOT, 'src', 'intro', 'geometry.json'), 'utf8')
);

export const BACK_SLOTS = new Set(INTRO_GEOMETRY.backSlots);

export function slotRect(slot, geometry = INTRO_GEOMETRY) {
  return geometry.slots[slot] ?? null;
}

export function subjectRect(layout, geometry = INTRO_GEOMETRY) {
  return geometry.subject[layout] ?? geometry.subject.hero;
}

export const slotIds = (geometry = INTRO_GEOMETRY) => Object.keys(geometry.slots);

/** Rectangulo escalado alrededor de su centro, como lo dibuja el renderer. */
export function scaledRect(rect, scale) {
  const width = rect.width * scale;
  const height = rect.height * scale;
  return {
    left: round(rect.left + (rect.width - width) / 2, 2),
    top: round(rect.top + (rect.height - height) / 2, 2),
    width: round(width, 2),
    height: round(height, 2)
  };
}

export function rectsOverlap(a, b) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

/**
 * Donde cae la cara del sujeto dentro de la composicion.
 *
 * Es la traduccion del `faceBox` que detecto YuNet sobre el clip original a la
 * ventana del layout, replicando el encuadre `cover` con punto focal de
 * `motion/Framing.ts`. Con esto la regla de oclusion puede medir de verdad si un
 * logo cae encima de mi cara, que es el fallo mas caro de una intro: se ve raro y
 * no hay forma de darse cuenta leyendo el JSON.
 *
 * El zoom de camara se ignora a proposito: crece desde el punto focal, asi que solo
 * puede agrandar la cara. Medir sobre el encuadre base es el caso conservador.
 */
export function faceRectOnScreen({faceBox, clipWidth, clipHeight, focus, layout, geometry = INTRO_GEOMETRY}) {
  if (!faceBox || !clipWidth || !clipHeight) return null;
  const window = subjectRect(layout, geometry);
  const scale = Math.max(window.width / clipWidth, window.height / clipHeight);
  const scaledWidth = clipWidth * scale;
  const scaledHeight = clipHeight * scale;
  const offsetLeft = Math.min(0, Math.max(window.width - scaledWidth, window.width / 2 - focus.x * scaledWidth));
  const offsetTop = Math.min(0, Math.max(window.height - scaledHeight, window.height / 2 - focus.y * scaledHeight));

  const left = window.left + offsetLeft + faceBox.x * scale;
  const top = window.top + offsetTop + faceBox.y * scale;
  const width = faceBox.w * scale;
  const height = faceBox.h * scale;

  // Recortado a la ventana del sujeto: lo que cae fuera no se ve, y un rectangulo
  // que sobresale haria saltar la regla de oclusion por una zona invisible.
  const clippedLeft = Math.max(window.left, left);
  const clippedTop = Math.max(window.top, top);
  const clippedRight = Math.min(window.left + window.width, left + width);
  const clippedBottom = Math.min(window.top + window.height, top + height);
  if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) return null;

  return {
    left: round(clippedLeft, 2),
    top: round(clippedTop, 2),
    width: round(clippedRight - clippedLeft, 2),
    height: round(clippedBottom - clippedTop, 2)
  };
}

/** Rectangulo de la zona segura: lo informativo no sale de aqui. */
export function safeRect(geometry = INTRO_GEOMETRY) {
  return {
    left: geometry.safeX,
    top: geometry.safeTop,
    width: geometry.width - geometry.safeX * 2,
    height: geometry.safeBottom - geometry.safeTop
  };
}

export function insideSafeArea(rect, geometry = INTRO_GEOMETRY) {
  const safe = safeRect(geometry);
  return (
    rect.left >= safe.left - 0.5 &&
    rect.top >= safe.top - 0.5 &&
    rect.left + rect.width <= safe.left + safe.width + 0.5 &&
    rect.top + rect.height <= safe.top + safe.height + 0.5
  );
}
