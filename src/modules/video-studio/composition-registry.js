import {access, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PROJECTS_ROOT} from './paths.js';

/**
 * Registro de composiciones que importa `Root.tsx`.
 *
 * El Root lo empaqueta el bundler, asi que un glob en tiempo de ejecucion no
 * serviria: los JSON compilados tienen que estar importados estaticamente. El
 * fichero se genera en cada build, de modo que un proyecto nuevo aparece en el
 * estudio sin tocar codigo a mano.
 *
 * Es comun a las superficies porque la restriccion es del bundler, no del formato.
 * Cada superficie aporta su prefijo de directorio, el nombre del JSON compilado, el
 * prefijo del id de composicion y el tipo TypeScript de sus props.
 */

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

/** Id de composicion Remotion de un slug, con el prefijo de su superficie. */
export function compositionId(prefix, slug) {
  const segments = String(slug).split('-').filter(Boolean);
  const title = segments
    .map((segment, index) =>
      index > 0 && LOWERCASE_SEGMENTS.has(segment) ? segment : capitalize(segment))
    .join('-');
  return `${prefix}-${title}`;
}

/** Nombre de la constante importada; el slug no es un identificador valido. */
function importName(slug, suffix) {
  const camel = String(slug)
    .split('-')
    .filter(Boolean)
    .map((segment, index) => (index === 0 ? segment : capitalize(segment)))
    .join('');
  return `${camel}${suffix}`;
}

/** Proyectos de una superficie con su JSON ya compilado, en orden estable por slug. */
export async function discoverProjects({
  surface,
  buildFileName,
  idPrefix,
  root = PROJECTS_ROOT
}) {
  const directoryPrefix = `${surface}-`;
  const entries = await readdir(root, {withFileTypes: true}).catch(() => []);
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(directoryPrefix))
    .map((entry) => entry.name.slice(directoryPrefix.length))
    .filter(Boolean)
    .sort();
  const projects = [];
  for (const slug of slugs) {
    const buildFile = path.join(root, `${directoryPrefix}${slug}`, buildFileName);
    // Un proyecto ingerido pero sin compilar todavia no tiene composicion; el
    // registro solo lista lo que Remotion puede renderizar hoy.
    const compiled = await access(buildFile).then(() => true, () => false);
    if (!compiled) continue;
    projects.push({slug, id: compositionId(idPrefix, slug), buildFile});
  }
  return projects;
}

/** Fuente TypeScript del registro. */
export function renderRegistrySource(projects, {
  surface,
  buildFileName,
  buildCommand,
  propsType,
  propsModule,
  exportName,
  entryTypeName,
  importSuffix
}) {
  const lines = [
    `// GENERADO por \`${buildCommand}\` desde`,
    `// remotion-animations/projects/${surface}-*/${buildFileName}.`,
    '// No editar a mano: los cambios se pierden en la siguiente compilacion.',
    `import type {${propsType}} from "${propsModule}";`
  ];
  for (const project of projects) {
    lines.push(
      `import ${importName(project.slug, importSuffix)} from ` +
      `"../../projects/${surface}-${project.slug}/${buildFileName}";`
    );
  }
  lines.push('');
  lines.push(`export type ${entryTypeName} = {`);
  lines.push('  id: string;');
  lines.push('  slug: string;');
  lines.push(`  build: ${propsType};`);
  lines.push('};');
  lines.push('');
  lines.push(`export const ${exportName}: ${entryTypeName}[] = [`);
  for (const project of projects) {
    lines.push('  {');
    lines.push(`    id: ${JSON.stringify(project.id)},`);
    lines.push(`    slug: ${JSON.stringify(project.slug)},`);
    lines.push(`    build: ${importName(project.slug, importSuffix)} as ${propsType},`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

/** Regenera el registro de una superficie y devuelve los proyectos listados. */
export async function writeRegistry(options) {
  const projects = await discoverProjects(options);
  await writeFile(options.file, renderRegistrySource(projects, options), 'utf8');
  return projects;
}
