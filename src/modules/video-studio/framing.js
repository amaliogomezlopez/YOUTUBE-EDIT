import {clamp, round} from '../../lib/utils.js';

/** Una deteccion de cara no es una caja de webcam. */
export function validSourceBox(box, media) {
  return Boolean(box && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(box[key])) &&
    box.x >= 0 && box.y >= 0 && box.w >= 24 && box.h >= 24 &&
    box.x + box.w <= media.width + 1 && box.y + box.h <= media.height + 1);
}
export function classifyDetection(detection, media) {
  if (detection?.layout === 'crop' || detection?.method === 'talking-head-face') {
    return {mode: 'crop', faceBox: validSourceBox(detection.faceBox, media) ? detection.faceBox : null, webcamBox: null};
  }
  if (validSourceBox(detection, media)) return {mode: 'pip', webcamBox: detection, faceBox: detection};
  return {mode: media.height >= media.width ? 'crop' : 'fit', webcamBox: null, faceBox: null};
}
export function smoothFocusTrack(track, {deadZone = 0.018, maxSpeed = 0.12} = {}) {
  const result = [];
  for (const point of [...(track ?? [])].filter((p) => [p.t, p.x, p.y].every(Number.isFinite)).sort((a, b) => a.t - b.t)) {
    const previous = result.at(-1);
    if (previous && point.t <= previous.t) continue;
    const next = {t: point.t, x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1)};
    if (previous) {
      const limit = maxSpeed * (point.t - previous.t);
      for (const axis of ['x', 'y']) {
        const delta = next[axis] - previous[axis];
        next[axis] = round(previous[axis] + (Math.abs(delta) <= deadZone ? 0 : clamp(delta, -limit, limit)), 4);
      }
    }
    result.push(next);
  }
  return result;
}
/** Contain dentro de una region: conserva todo el texto seleccionado. */
export function regionTransform(region, source, slot) {
  if (!validSourceBox(region, source)) throw new Error('La region de pantalla queda fuera de la fuente.');
  const scale = Math.min(slot.width / region.w, slot.height / region.h);
  return {left: (slot.width - region.w * scale) / 2 - region.x * scale,
    top: (slot.height - region.h * scale) / 2 - region.y * scale,
    width: source.width * scale, height: source.height * scale, scale};
}
