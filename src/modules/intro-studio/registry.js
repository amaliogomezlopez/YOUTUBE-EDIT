import path from 'node:path';
import {INTRO_PROJECTS_ROOT, INTRO_SURFACE, REMOTION_ROOT} from './constants.js';
import {
  compositionId,
  discoverProjects,
  renderRegistrySource as renderSource,
  writeRegistry
} from '../video-studio/composition-registry.js';

export const REGISTRY_FILE = path.join(REMOTION_ROOT, 'src', 'intro', 'registry.generated.ts');

const INTRO_REGISTRY = {
  surface: INTRO_SURFACE,
  buildFileName: 'intro-build.json',
  buildCommand: 'npm run intro:build',
  idPrefix: 'Intro',
  propsType: 'IntroVideoProps',
  propsModule: './schemas',
  exportName: 'introBuilds',
  entryTypeName: 'IntroBuildEntry',
  importSuffix: 'Intro',
  file: REGISTRY_FILE,
  root: INTRO_PROJECTS_ROOT
};

/** Id de composicion Remotion de un slug de intro. */
export function compositionIdForSlug(slug) {
  return compositionId(INTRO_REGISTRY.idPrefix, slug);
}

export async function discoverIntroProjects({root = INTRO_PROJECTS_ROOT} = {}) {
  return discoverProjects({...INTRO_REGISTRY, root});
}

export function renderRegistrySource(projects) {
  return renderSource(projects, INTRO_REGISTRY);
}

export async function writeIntroRegistry({file = REGISTRY_FILE, root = INTRO_PROJECTS_ROOT} = {}) {
  return writeRegistry({...INTRO_REGISTRY, file, root});
}
