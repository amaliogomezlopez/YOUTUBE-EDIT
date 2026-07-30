import {access, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {REMOTION_ROOT, SHORTS_PROJECTS_ROOT} from './constants.js';

export const REGISTRY_FILE = path.join(REMOTION_ROOT, 'src', 'shorts', 'registry.generated.ts');

/**
 * Conectores que no se capitalizan al construir el id de la composicion. Con
 * ellos «harness-vs-modelo» sigue siendo `Short-Harness-vs-Modelo`, que es el id
 * publicado en el manifiesto de capacidades y en la documentacion.
 */
const LOWERCASE_SEGMENTS = new Set([
  'vs', 'y', 'o', 'de', 'del', 'la', 'el', 'los', 'las', 'en', 'a', 'al',
  'con', 'sin', 'para', 'por', 'que'
]);

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

/** Id de composicion Remotion de un slug de short. */
export function compositionIdForSlug(slug) {
  const segments = String(slug).split('-').filter(Boolean);
  const title = segments
    .map((segment, index) =>
      index > 0 && LOWERCASE_SEGMENTS.has(segment) ? segment : capitalize(segment))
    .join('-');
  return `Short-${title}`;
}

/** Nombre de la constante importada; el slug no es un identificador valido. */
function importName(slug) {
  const camel = String(slug)
    .split('-')
    .filter(Boolean)
    .map((segment, index) => (index === 0 ? segment : capitalize(segment)))
    .join('');
  return `${camel}Build`;
}

/** Proyectos con `short-build.json` ya compilado, en orden estable por slug. */
export async function discoverShortProjects({root = SHORTS_PROJECTS_ROOT} = {}) {
  const entries = await readdir(root, {withFileTypes: true}).catch(() => []);
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('shorts-'))
    .map((entry) => entry.name.slice('shorts-'.length))
    .filter(Boolean)
    .sort();
  const projects = [];
  for (const slug of slugs) {
    const buildFile = path.join(root, `shorts-${slug}`, 'short-build.json');
    // Un proyecto ingerido pero sin compilar todavia no tiene composicion; el
    // registro solo lista lo que Remotion puede renderizar hoy.
    const compiled = await access(buildFile).then(() => true, () => false);
    if (!compiled) continue;
    projects.push({slug, id: compositionIdForSlug(slug), buildFile});
  }
  return projects;
}

/**
 * Fuente del registro que importa `Root.tsx`.
 *
 * El Root lo empaqueta el bundler, asi que un glob en tiempo de ejecucion no
 * serviria: los `short-build.json` tienen que estar importados estaticamente. Este
 * fichero se genera en cada `shorts:build`, de modo que un proyecto nuevo aparece
 * en el estudio sin tocar codigo a mano.
 */
export function renderRegistrySource(projects) {
  const lines = [
    '// GENERADO por `npm run shorts:build` desde',
    '// remotion-animations/projects/shorts-*/short-build.json.',
    '// No editar a mano: los cambios se pierden en la siguiente compilacion.',
    'import type {ShortVideoProps} from "./schemas";'
  ];
  for (const project of projects) {
    lines.push(
      `import ${importName(project.slug)} from "../../projects/shorts-${project.slug}/short-build.json";`
    );
  }
  lines.push('');
  lines.push('export type ShortBuildEntry = {');
  lines.push('  id: string;');
  lines.push('  slug: string;');
  lines.push('  build: ShortVideoProps;');
  lines.push('};');
  lines.push('');
  lines.push('export const shortBuilds: ShortBuildEntry[] = [');
  for (const project of projects) {
    lines.push('  {');
    lines.push(`    id: ${JSON.stringify(project.id)},`);
    lines.push(`    slug: ${JSON.stringify(project.slug)},`);
    lines.push(`    build: ${importName(project.slug)} as ShortVideoProps,`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

/** Regenera el registro y devuelve los proyectos listados. */
export async function writeShortsRegistry({file = REGISTRY_FILE, root = SHORTS_PROJECTS_ROOT} = {}) {
  const projects = await discoverShortProjects({root});
  await writeFile(file, renderRegistrySource(projects), 'utf8');
  return projects;
}
