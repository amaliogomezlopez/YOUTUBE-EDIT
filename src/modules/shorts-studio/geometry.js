import {readFileSync} from 'node:fs';
import path from 'node:path';
import {REMOTION_ROOT} from './constants.js';

/**
 * Geometria del short leida desde el mismo JSON que dibuja Remotion
 * (`remotion-animations/src/shorts/geometry.json`). Los numeros no se copian: si
 * alguien baja el escenario o el bloque de subtitulos, el validador de zona segura
 * lo mide con el valor nuevo.
 *
 * El reparto de slots si esta replicado de `layout.ts`, porque es codigo de
 * presentacion que Node no puede importar. Solo la aritmetica, nunca las
 * constantes.
 */
export const SHORT_GEOMETRY = JSON.parse(
  readFileSync(path.join(REMOTION_ROOT, 'src', 'shorts', 'geometry.json'), 'utf8')
);

export const PODIUM_SLOTS = new Set(['podium-1', 'podium-2', 'podium-3', 'podium-3-verdict']);

function podiumIndex(slot) {
  if (slot === 'podium-2') return 1;
  if (slot === 'podium-3' || slot === 'podium-3-verdict') return 2;
  return 0;
}

/** Rectangulo de un slot dentro del escenario del layout activo. */
export function slotRect(slot, layout = 'split', geometry = SHORT_GEOMETRY) {
  const stage = geometry.stage[layout] ?? geometry.stage.split;
  const bodyTop = stage.top + geometry.headerHeight;
  const bodyHeight = stage.height - geometry.headerHeight - geometry.footerHeight;

  if (geometry.overlay[slot]) {
    const overlay = geometry.overlay[slot];
    return {left: stage.left, top: overlay.top, width: stage.width, height: overlay.height};
  }
  if (slot === 'stage-header') {
    return {left: stage.left, top: stage.top, width: stage.width, height: geometry.headerHeight};
  }
  if (slot === 'stage-footer') {
    return {
      left: stage.left,
      top: stage.top + stage.height - geometry.footerHeight,
      width: stage.width,
      height: geometry.footerHeight
    };
  }
  if (slot === 'stage-left' || slot === 'stage-right') {
    const width = (stage.width - geometry.podiumGap) / 2;
    const left = slot === 'stage-left'
      ? stage.left
      : stage.left + (stage.width + geometry.podiumGap) / 2;
    return {left, top: bodyTop, width, height: bodyHeight};
  }
  if (slot === 'stage-badge') {
    return {left: stage.left + stage.width - 168, top: bodyTop + 8, width: 160, height: 160};
  }
  if (PODIUM_SLOTS.has(slot)) {
    const columnWidth = (stage.width - geometry.podiumGap * 2) / 3;
    const left = stage.left + (columnWidth + geometry.podiumGap) * podiumIndex(slot);
    if (slot === 'podium-3-verdict') {
      return {left, top: bodyTop + bodyHeight - 70, width: columnWidth, height: 70};
    }
    return {left, top: bodyTop, width: columnWidth, height: bodyHeight};
  }
  return {left: stage.left, top: bodyTop, width: stage.width, height: bodyHeight};
}

/** Borde inferior del bloque de subtitulos de un layout. */
export function captionBottom(layout, geometry = SHORT_GEOMETRY) {
  return geometry.captionBottom[layout] ?? geometry.captionBottom.split;
}
