/**
 * Reexporta la geometria compartida con el filtergraph de FFmpeg
 * (`src/lib/pip-layout.js`). Remotion y el pipeline de video largo tienen que
 * dibujar la misma tarjeta y la misma pantalla.
 */
export {fitLayout, pipLayout, PIP_CANVAS, PIP_CARD} from '../../lib/pip-layout.js';
