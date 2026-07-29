/**
 * Qué se ha entregado de verdad en cada bloque de revisión.
 *
 * FC-R-101 exige cinco artefactos por bloque (render-props, manifiesto, audio
 * recortado, cinco stills de QA y MP4 independiente). El validador
 * `delivery-completeness` ya sabía comprobarlo, pero nadie le pasaba la lista:
 * devolvía `notEvaluable` desde que se escribió. Aquí se lee del disco, que es
 * la única fuente honesta —un manifiesto puede prometer un MP4 que no existe.
 */
import {readdir, stat} from 'node:fs/promises';
import path from 'node:path';

/**
 * @returns {Promise<Array<{id: string, directory: string, files: string[]}>>}
 *   Un elemento por subdirectorio de `review-blocks/`, con los nombres de
 *   fichero presentes. Sin directorio, lista vacía: el validador dirá que no es
 *   evaluable, que es lo correcto cuando aún no se ha empaquetado nada.
 */
export async function collectReviewBlockArtifacts({visualsDirectory}) {
  const root = path.join(visualsDirectory, 'review-blocks');
  let entries;
  try {
    entries = await readdir(root, {withFileTypes: true});
  } catch {
    return [];
  }
  const blocks = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const directory = path.join(root, entry.name);
    const files = [];
    for (const file of await readdir(directory)) {
      // Un fichero de tamaño cero es un render abortado, no una entrega.
      const info = await stat(path.join(directory, file)).catch(() => null);
      if (info?.isFile() && info.size > 0) files.push(file);
    }
    blocks.push({id: entry.name, directory, files: files.sort()});
  }
  return blocks.sort((left, right) => left.id.localeCompare(right.id));
}
