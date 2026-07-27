import {lstat, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {DATA_DIR, ROOT} from './utils.js';

export const ANIMATION_CLEANUP_CONFIRMATION = 'DELETE_ANIMATION_ARTIFACTS';
export const REMOTION_OUTPUT_DIR = path.join(ROOT, 'remotion-animations', 'out');
export const ANIMATION_SCOUT_OUTPUT_DIR = path.join(DATA_DIR, 'review', 'animation-scout');

function numberOption(value, fallback, {integer = false, min = 0, max = 36500} = {}) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isInteger(number))) {
    throw new Error(`Valor numérico no válido: ${value}`);
  }
  return number;
}

async function directEntries(directory) {
  return readdir(directory, {withFileTypes: true}).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
}

async function inspectTree(target) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) {
    return {bytes: info.size, newestMs: info.mtimeMs, hasSymlink: true};
  }
  if (!info.isDirectory()) {
    return {bytes: info.size, newestMs: info.mtimeMs, hasSymlink: false};
  }
  let bytes = 0;
  let newestMs = info.mtimeMs;
  let hasSymlink = false;
  for (const entry of await directEntries(target)) {
    const child = await inspectTree(path.join(target, entry.name));
    bytes += child.bytes;
    newestMs = Math.max(newestMs, child.newestMs);
    hasSymlink ||= child.hasSymlink;
  }
  return {bytes, newestMs, hasSymlink};
}

async function artifact({scope, project = null, id, target, parent, complete = null}) {
  const inspection = await inspectTree(target);
  return {
    scope,
    project,
    id,
    path: target,
    parent,
    bytes: inspection.bytes,
    modifiedAt: new Date(inspection.newestMs).toISOString(),
    modifiedMs: inspection.newestMs,
    complete,
    safe: !inspection.hasSymlink
  };
}

async function collectRemotionRuns(remotionRoot, projectFilter) {
  const artifacts = [];
  const legacy = [];
  const rootEntries = await directEntries(remotionRoot);
  if (!projectFilter) {
    for (const entry of rootEntries) {
      if (entry.isDirectory() || entry.name === '.gitkeep' || entry.isSymbolicLink()) continue;
      legacy.push(await artifact({
        scope: 'remotion-legacy',
        project: '_root',
        id: entry.name,
        target: path.join(remotionRoot, entry.name),
        parent: remotionRoot
      }));
    }
  }
  for (const projectEntry of rootEntries) {
    if (!projectEntry.isDirectory() || projectEntry.isSymbolicLink()) continue;
    if (projectFilter && projectEntry.name !== projectFilter) continue;
    const projectRoot = path.join(remotionRoot, projectEntry.name);
    const runsRoot = path.join(projectRoot, 'runs');
    for (const runEntry of await directEntries(runsRoot)) {
      if (!runEntry.isDirectory() || runEntry.isSymbolicLink()) continue;
      const runPath = path.join(runsRoot, runEntry.name);
      const complete = await lstat(path.join(runPath, 'run-result.json'))
        .then((info) => info.isFile())
        .catch(() => false);
      artifacts.push(await artifact({
        scope: 'remotion-run',
        project: projectEntry.name,
        id: runEntry.name,
        target: runPath,
        parent: runsRoot,
        complete
      }));
    }
    for (const entry of await directEntries(projectRoot)) {
      if (entry.name === 'runs' || entry.name === '.gitkeep' || entry.isSymbolicLink()) continue;
      legacy.push(await artifact({
        scope: 'remotion-legacy',
        project: projectEntry.name,
        id: entry.name,
        target: path.join(projectRoot, entry.name),
        parent: projectRoot
      }));
    }
  }
  return {artifacts, legacy};
}

async function collectScoutJobs(scoutRoot) {
  const artifacts = [];
  for (const entry of await directEntries(scoutRoot)) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const jobPath = path.join(scoutRoot, entry.name);
    const complete = await lstat(path.join(jobPath, 'manifest.json'))
      .then((info) => info.isFile())
      .catch(() => false);
    artifacts.push(await artifact({
      scope: 'scout-job',
      id: entry.name,
      target: jobPath,
      parent: scoutRoot,
      complete
    }));
  }
  return artifacts;
}

function groupKey(item) {
  if (item.scope === 'scout-job') return item.scope;
  return `${item.scope}:${item.project}`;
}

function selectCandidates(artifacts, {
  now,
  olderThanDays,
  keepLast,
  includeIncomplete
}) {
  const cutoff = now - olderThanDays * 86400_000;
  const groups = new Map();
  for (const item of artifacts) {
    const key = groupKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const candidates = [];
  const protectedArtifacts = [];
  for (const items of groups.values()) {
    items.sort((a, b) => b.modifiedMs - a.modifiedMs);
    for (const [index, item] of items.entries()) {
      let protectedReason = null;
      if (!item.safe) protectedReason = 'contains-symlink';
      else if (index < keepLast) protectedReason = 'keep-last';
      else if (item.modifiedMs >= cutoff) protectedReason = 'too-new';
      else if (item.complete === false && !includeIncomplete) protectedReason = 'incomplete';
      if (protectedReason) protectedArtifacts.push({...item, protectedReason});
      else candidates.push(item);
    }
  }
  return {candidates, protectedArtifacts};
}

function assertManagedCandidate(item) {
  const target = path.resolve(item.path);
  const parent = path.resolve(item.parent);
  if (path.dirname(target) !== parent) {
    throw new Error(`Ruta de limpieza fuera del contenedor permitido: ${target}`);
  }
  if (!item.safe) {
    throw new Error(`Se rechazó un artefacto con enlaces simbólicos: ${target}`);
  }
}

export async function cleanupAnimationArtifacts({
  dryRun = true,
  confirm = null,
  scope = 'all',
  project = null,
  olderThanDays = 30,
  keepLast = 3,
  includeIncomplete = false,
  includeLegacy = false,
  now = Date.now(),
  remotionRoot = REMOTION_OUTPUT_DIR,
  scoutRoot = ANIMATION_SCOUT_OUTPUT_DIR
} = {}) {
  if (!['all', 'remotion', 'scout'].includes(scope)) {
    throw new Error('scope debe ser all, remotion o scout.');
  }
  if (project && scope !== 'remotion') {
    throw new Error('--project requiere --scope remotion para evitar ampliar el borrado a scouting.');
  }
  const policy = {
    scope,
    project: project || null,
    olderThanDays: numberOption(olderThanDays, 30),
    keepLast: numberOption(keepLast, 3, {integer: true, max: 1000}),
    includeIncomplete: Boolean(includeIncomplete),
    includeLegacy: Boolean(includeLegacy)
  };
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) throw new Error('now no es válido.');

  const artifacts = [];
  const legacyArtifacts = [];
  if (scope === 'all' || scope === 'remotion') {
    const remotion = await collectRemotionRuns(path.resolve(remotionRoot), project);
    artifacts.push(...remotion.artifacts);
    legacyArtifacts.push(...remotion.legacy);
  }
  if (scope === 'all' || scope === 'scout') {
    artifacts.push(...await collectScoutJobs(path.resolve(scoutRoot)));
  }
  if (policy.includeLegacy) artifacts.push(...legacyArtifacts);

  const {candidates, protectedArtifacts} = selectCandidates(artifacts, {
    ...policy,
    now: timestamp
  });
  const bytes = candidates.reduce((sum, item) => sum + item.bytes, 0);

  if (!dryRun && confirm !== ANIMATION_CLEANUP_CONFIRMATION) {
    throw new Error(
      `La limpieza requiere --confirm=${ANIMATION_CLEANUP_CONFIRMATION} después de revisar la simulación.`
    );
  }

  const deleted = [];
  if (!dryRun) {
    for (const item of candidates) {
      assertManagedCandidate(item);
      const current = await lstat(item.path);
      if (current.isSymbolicLink()) {
        throw new Error(`Se rechazó borrar un enlace simbólico: ${item.path}`);
      }
      await rm(item.path, {recursive: current.isDirectory(), force: false});
      deleted.push(item.path);
    }
  }

  return {
    dryRun,
    policy,
    scanned: artifacts.length,
    legacyExcluded: policy.includeLegacy ? 0 : legacyArtifacts.length,
    count: candidates.length,
    bytes,
    candidates: candidates.map(({modifiedMs, parent, safe, ...item}) => item),
    protected: protectedArtifacts.map(({modifiedMs, parent, safe, ...item}) => item),
    deleted
  };
}
