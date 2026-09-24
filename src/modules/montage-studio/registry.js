import path from 'node:path';
import {MONTAGE_FORMATS, MONTAGE_SURFACE, PROJECTS_ROOT, REMOTION_ROOT} from './constants.js';
import {compositionId, discoverProjects, writeRegistry} from '../video-studio/composition-registry.js';

/**
 * Un registro por formato. Cada build tiene un formato fijo, asi que cada uno es
 * su propia composicion: `Montage-9x16-<slug>` y `Montage-16x9-<slug>`.
 */
function registryFor(formatId, root = PROJECTS_ROOT) {
  if (!MONTAGE_FORMATS[formatId]) throw new Error(`Formato de montaje desconocido: ${formatId}`);
  return {
    surface: MONTAGE_SURFACE,
    buildFileName: `montage-build.${formatId}.json`,
    buildCommand: 'npm run montage -- build',
    idPrefix: `Montage-${formatId}`,
    propsType: 'MontageVideoProps',
    propsModule: './schemas',
    exportName: `montageBuilds${formatId}`,
    entryTypeName: 'MontageBuildEntry',
    importSuffix: `Montage${formatId.replace(/[^0-9]/g, '')}`,
    file: path.join(REMOTION_ROOT, 'src', 'montage', `registry-${formatId}.generated.ts`),
    root
  };
}

export function compositionIdForSlug(slug, formatId) {
  return compositionId(registryFor(formatId).idPrefix, slug);
}

export async function discoverMontageProjects(formatId, {root = PROJECTS_ROOT} = {}) {
  return discoverProjects(registryFor(formatId, root));
}

export async function writeMontageRegistries({root = PROJECTS_ROOT} = {}) {
  const registered = [];
  for (const formatId of Object.keys(MONTAGE_FORMATS)) {
    registered.push(...await writeRegistry(registryFor(formatId, root)));
  }
  return registered;
}
