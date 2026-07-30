import {access, readdir} from 'node:fs/promises';
import path from 'node:path';
import {publishJob} from '../../lib/publishers.js';
import {readJson} from '../../lib/utils.js';
import {REMOTION_ROOT, projectDir} from './constants.js';

const exists = (file) => access(file).then(() => true, () => false);

/**
 * Ultimo MP4 renderizado del short.
 *
 * Cada render reserva su directorio en `out/shorts-<slug>/runs/<runId>/renders/`
 * (ver `render-safe.mjs`); los runId llevan timestamp ISO sin separadores, asi que
 * el orden alfabetico es el cronologico. Devuelve null si aun no hay ninguno.
 */
export async function findShortRender(slug, {outputRoot = path.join(REMOTION_ROOT, 'out')} = {}) {
  const runsDir = path.join(outputRoot, `shorts-${slug}`, 'runs');
  let runIds;
  try {
    runIds = await readdir(runsDir);
  } catch {
    return null;
  }
  for (const runId of [...runIds].sort().reverse()) {
    const candidate = path.join(runsDir, runId, 'renders', `${slug}.mp4`);
    if (await exists(candidate)) return candidate;
  }
  return null;
}

/**
 * Estado que espera `publishJob`, construido desde el proyecto del short.
 *
 * Es el mismo contrato que deja el pipeline de video largo: `publishingMetadata`
 * (la escribe `shorts:publishing`), `clips` con el MP4 renderizado y `jobDir`,
 * donde se persiste `publish-runs.json`. Los conectores de `src/lib/publishers/`
 * no distinguen un short de un clip de video largo.
 */
export async function loadShortPublishState(slug, {videoFile = null, project = projectDir(slug)} = {}) {
  const metadata = await readJson(path.join(project, 'publishing-metadata.json')).catch(() => null);
  if (!metadata) {
    throw new Error(
      `No existe publishing-metadata.json para "${slug}". ` +
      `Ejecuta primero: npm run shorts:publishing -- --slug ${slug}`
    );
  }
  const video = videoFile ?? await findShortRender(slug);
  if (!video) {
    throw new Error(
      `No hay MP4 renderizado para "${slug}". ` +
      `Ejecuta primero: npm run shorts:render -- --slug ${slug}`
    );
  }
  return {
    id: `shorts-${slug}`,
    jobDir: project,
    publishingMetadata: metadata,
    clips: [{
      id: slug,
      suggestedTitle: metadata.title ?? metadata.titles?.youtube_shorts?.[0]?.title,
      files: {video}
    }]
  };
}

/**
 * Publica un short montado con los conectores ya existentes. Sin credenciales o
 * sin hosting HTTPS para Instagram, el conector devuelve `requires_manual_action`
 * con el caption y el asset listos, igual que en el pipeline de video largo.
 */
export async function publishShort({slug, videoFile = null, platforms, ...options} = {}, {publish = publishJob} = {}) {
  const state = await loadShortPublishState(slug, {videoFile});
  return publish(state, {platforms, ...options});
}
