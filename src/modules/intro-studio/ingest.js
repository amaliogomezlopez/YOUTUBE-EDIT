import {INTRO_FORMAT} from './constants.js';
import {ingestMediaProject} from '../video-studio/media-ingest.js';

export {flattenWords} from '../video-studio/media-ingest.js';

/**
 * Ingesta de un proyecto de intro.
 *
 * Reutiliza `video-studio/media-ingest.js` completo: remux, normalizacion de audio,
 * deteccion de cara, transcripcion, assets de imagen y de video, y analisis de la
 * rejilla de beats de la pista de musica.
 */
export async function ingestIntroProject(options) {
  return ingestMediaProject({...options, surface: 'intro', format: INTRO_FORMAT});
}
