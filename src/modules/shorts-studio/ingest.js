import {SHORT_FORMAT} from './constants.js';
import {ingestMediaProject} from '../video-studio/media-ingest.js';

export {flattenWords} from '../video-studio/media-ingest.js';

/**
 * Ingesta de un proyecto de short "desde cero".
 *
 * El trabajo lo hace `video-studio/media-ingest.js`, comun a todas las superficies:
 * remux a MP4, normalizacion a -14 LUFS, deteccion de cara y transcripcion. Aqui
 * solo se fija lo propio del formato vertical.
 */
export async function ingestShortProject(options) {
  return ingestMediaProject({...options, surface: 'shorts', format: SHORT_FORMAT});
}
