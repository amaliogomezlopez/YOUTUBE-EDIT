/**
 * Carpeta `public` minima para un render de Remotion.
 *
 * El bundler copia la carpeta publica entera al temporal del sistema en cada render o
 * still. Con la media de todos los proyectos eso son mas de 10 GB en C:, y el render
 * muere con ENOSPC. Aqui se monta una carpeta con solo lo que la composicion usa: las
 * carpetas comunes (fuentes, texturas, efectos) y los ficheros que el build nombra.
 * Se enlazan en duro, asi que en el mismo disco no ocupa nada; si el disco no lo
 * permite, se copian.
 */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {copyFile, link, mkdir, readdir, rm} from 'node:fs/promises';

export const SHARED_PUBLIC_DIRS = ['fonts', 'assets', 'sfx'];
const MEDIA = /\.(mp4|mov|webm|m4v|mkv|png|jpe?g|webp|gif|svg|avif|wav|mp3|m4a|aac|flac|ogg|opus|woff2?|ttf|otf)$/i;

/** Rutas relativas a `public` que aparecen como texto en cualquier parte del build. */
export function publicFilesIn(value, publicRoot, found = new Set()) {
  if (typeof value === 'string') {
    const relative = value.replace(/\\/g, '/').replace(/^\/+/, '');
    if (MEDIA.test(relative) && !relative.includes('..') && existsSync(path.join(publicRoot, relative))) found.add(relative);
  } else if (Array.isArray(value)) {
    for (const item of value) publicFilesIn(item, publicRoot, found);
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) publicFilesIn(item, publicRoot, found);
  }
  return found;
}

async function place(source, target) {
  await mkdir(path.dirname(target), {recursive: true});
  await link(source, target).catch(() => copyFile(source, target));
}

async function placeTree(source, target) {
  for (const entry of await readdir(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await placeTree(from, to);
    else if (entry.isFile()) await place(from, to);
  }
}

/** Monta `target` desde cero con las carpetas comunes y los ficheros del build. */
export async function isolatePublicDir({publicRoot, build, target, shared = SHARED_PUBLIC_DIRS}) {
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  for (const dir of shared) {
    if (existsSync(path.join(publicRoot, dir))) await placeTree(path.join(publicRoot, dir), path.join(target, dir));
  }
  const files = [...publicFilesIn(build, publicRoot)].filter((file) => !shared.some((dir) => file.startsWith(dir + '/')));
  for (const file of files) await place(path.join(publicRoot, file), path.join(target, file));
  return {target, files: files.length};
}
