import path from 'node:path';
import {REMOTION_ROOT, SHORTS_PROJECTS_ROOT, SHORT_SURFACE} from './constants.js';
import {
  compositionId,
  discoverProjects,
  renderRegistrySource as renderSource,
  writeRegistry
} from '../video-studio/composition-registry.js';

export const REGISTRY_FILE = path.join(REMOTION_ROOT, 'src', 'shorts', 'registry.generated.ts');

/**
 * Descriptor del registro de shorts. La mecanica (descubrir proyectos compilados y
 * emitir imports estaticos) es comun a las superficies y vive en
 * `video-studio/composition-registry.js`; aqui solo estan los nombres.
 */
const SHORTS_REGISTRY = {
  surface: SHORT_SURFACE,
  buildFileName: 'short-build.json',
  buildCommand: 'npm run shorts:build',
  idPrefix: 'Short',
  propsType: 'ShortVideoProps',
  propsModule: './schemas',
  exportName: 'shortBuilds',
  entryTypeName: 'ShortBuildEntry',
  importSuffix: 'Build',
  file: REGISTRY_FILE,
  root: SHORTS_PROJECTS_ROOT
};

/** Id de composicion Remotion de un slug de short. */
export function compositionIdForSlug(slug) {
  return compositionId(SHORTS_REGISTRY.idPrefix, slug);
}

/** Proyectos con `short-build.json` ya compilado, en orden estable por slug. */
export async function discoverShortProjects({root = SHORTS_PROJECTS_ROOT} = {}) {
  return discoverProjects({...SHORTS_REGISTRY, root});
}

export function renderRegistrySource(projects) {
  return renderSource(projects, SHORTS_REGISTRY);
}

/** Regenera el registro y devuelve los proyectos listados. */
export async function writeShortsRegistry({file = REGISTRY_FILE, root = SHORTS_PROJECTS_ROOT} = {}) {
  return writeRegistry({...SHORTS_REGISTRY, file, root});
}
