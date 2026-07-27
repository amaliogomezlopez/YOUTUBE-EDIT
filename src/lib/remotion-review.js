import {randomUUID} from 'node:crypto';
import {readFile, readdir, rename, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {DATA_DIR, ROOT} from './utils.js';
import {evaluateRemotionProps} from './remotion-visual-qa.js';

const REVIEW_ROOT = path.join(DATA_DIR, 'review', 'remotion');
const MANIFEST_FILE = path.join(
  ROOT,
  'remotion-animations',
  'catalog',
  'capabilities.manifest.json'
);
const DESIGN_PROFILE_FILE = path.join(
  ROOT,
  'remotion-animations',
  'catalog',
  'design',
  'brand-profiles.json'
);
const SESSION_STATUSES = new Set([
  'draft',
  'in-review',
  'changes-requested',
  'approved'
]);

function cleanText(value, max = 1000) {
  return String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
}

function sessionFile(id) {
  if (!/^review-[a-z0-9-]{8,80}$/.test(id)) {
    const error = new Error('Identificador de revisión no válido.');
    error.status = 400;
    error.code = 'INVALID_REVIEW_ID';
    throw error;
  }
  return path.join(REVIEW_ROOT, `${id}.json`);
}

async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function normalizeVariants(input, fallbackProps) {
  const source = Array.isArray(input) && input.length
    ? input
    : [
        {
          id: 'variant-a',
          label: 'A · Editorial',
          compositionId: 'Pattern-Screenshot-Spotlight',
          props: {...fallbackProps, themeId: 'ink-lime', motionProfile: 'editorial'}
        },
        {
          id: 'variant-b',
          label: 'B · Documental',
          compositionId: 'Pattern-Screenshot-Spotlight',
          props: {...fallbackProps, themeId: 'oxide-documentary', motionProfile: 'restrained'}
        },
        {
          id: 'variant-c',
          label: 'C · Técnica',
          compositionId: 'Pattern-Screenshot-Spotlight',
          props: {...fallbackProps, themeId: 'signal-cobalt', motionProfile: 'technical'}
        }
      ];
  return source.slice(0, 6).map((variant, index) => ({
    id: cleanText(variant.id || `variant-${index + 1}`, 64)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-'),
    label: cleanText(variant.label || `Variante ${index + 1}`, 80),
    compositionId: cleanText(
      variant.compositionId || 'Pattern-Screenshot-Spotlight',
      100
    ),
    props: variant.props && typeof variant.props === 'object'
      ? variant.props
      : {...fallbackProps}
  }));
}

function defaultPatternProps(input = {}) {
  return {
    pattern: 'screenshot-spotlight',
    format: 'landscape',
    themeId: 'ink-lime',
    motionProfile: 'editorial',
    title: 'La evidencia ya está en la imagen',
    supportingText: 'Revisa composición, ritmo y jerarquía antes de renderizar.',
    showHeader: true,
    primaryLabel: 'ANTES',
    secondaryLabel: 'DESPUÉS',
    callout: 'TRAMO CLAVE',
    items: [
      {label: 'ENERO', value: 42},
      {label: 'MARZO', value: 61},
      {label: 'JUNIO', value: 78},
      {label: 'DICIEMBRE', value: 93}
    ],
    imagePath: 'assets/library/chart-samples/demo-index-2025.png',
    focalPoint: {x: 58, y: 49},
    soundEnabled: false,
    soundMix: 0.62,
    ...input
  };
}

export async function reviewStudioCatalog() {
  const [manifest, designProfiles] = await Promise.all([
    readJson(MANIFEST_FILE),
    readJson(DESIGN_PROFILE_FILE).catch(() => ({version: 1, profiles: []}))
  ]);
  const sessions = await listReviewSessions();
  return {
    manifest,
    designProfiles,
    sessions,
    statuses: [...SESSION_STATUSES],
    reviewUrl: '/remotion-review/'
  };
}

export async function listReviewSessions({limit = 50} = {}) {
  await mkdir(REVIEW_ROOT, {recursive: true});
  const entries = await readdir(REVIEW_ROOT, {withFileTypes: true});
  const sessions = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /^review-.*\.json$/.test(entry.name))
      .map((entry) => readJson(path.join(REVIEW_ROOT, entry.name)).catch(() => null))
  );
  return sessions
    .filter(Boolean)
    .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
    .slice(0, Math.max(1, Math.min(100, limit)))
    .map((session) => ({
      id: session.id,
      title: session.title,
      projectId: session.projectId,
      status: session.status,
      selectedVariantId: session.selectedVariantId,
      revision: session.revision,
      updatedAt: session.updatedAt,
      commentCount: session.comments.length,
      qa: session.qa
    }));
}

export async function createReviewSession(input = {}) {
  const now = new Date().toISOString();
  const baseProps = defaultPatternProps(input.props);
  const variants = normalizeVariants(input.variants, baseProps);
  const id = `review-${randomUUID()}`;
  const session = {
    version: 1,
    id,
    projectId: cleanText(input.projectId || 'motion-library', 80),
    title: cleanText(input.title || baseProps.title || 'Revisión Remotion', 140),
    status: 'draft',
    revision: 1,
    selectedVariantId: variants[0].id,
    variants,
    context: {
      sourceVideo: cleanText(input.context?.sourceVideo, 2000) || null,
      trimBeforeSeconds: Math.max(0, Number(input.context?.trimBeforeSeconds || 0)),
      mode: ['overlay', 'picture-in-picture', 'replace'].includes(input.context?.mode)
        ? input.context.mode
        : 'overlay'
    },
    checkpoints: Array.isArray(input.checkpoints)
      ? input.checkpoints.map(Number).filter((value) => value >= 0 && value <= 1).slice(0, 12)
      : [0.08, 0.28, 0.55, 0.78, 0.94],
    comments: [],
    qa: null,
    createdAt: now,
    updatedAt: now
  };
  await writeJsonAtomic(sessionFile(id), session);
  return session;
}

export async function loadReviewSession(id) {
  try {
    return await readJson(sessionFile(id));
  } catch (error) {
    if (error.code === 'ENOENT') {
      const notFound = new Error('Revisión no encontrada.');
      notFound.status = 404;
      notFound.code = 'REVIEW_NOT_FOUND';
      throw notFound;
    }
    throw error;
  }
}

export async function updateReviewSession(id, patch = {}) {
  const session = await loadReviewSession(id);
  if (patch.revision !== undefined && Number(patch.revision) !== session.revision) {
    const conflict = new Error('La revisión cambió en otra pestaña. Recarga antes de guardar.');
    conflict.status = 409;
    conflict.code = 'REVIEW_REVISION_CONFLICT';
    throw conflict;
  }
  if (patch.selectedVariantId !== undefined) {
    if (!session.variants.some((variant) => variant.id === patch.selectedVariantId)) {
      const error = new Error('La variante seleccionada no existe.');
      error.status = 400;
      error.code = 'REVIEW_VARIANT_NOT_FOUND';
      throw error;
    }
    session.selectedVariantId = patch.selectedVariantId;
  }
  if (patch.variantProps && typeof patch.variantProps === 'object') {
    const variant = session.variants.find(
      (item) => item.id === (patch.variantId || session.selectedVariantId)
    );
    if (!variant) {
      const error = new Error('La variante que se quiere editar no existe.');
      error.status = 400;
      error.code = 'REVIEW_VARIANT_NOT_FOUND';
      throw error;
    }
    variant.props = {...variant.props, ...patch.variantProps};
    session.qa = null;
    if (session.status === 'approved') {
      session.status = 'changes-requested';
    }
  }
  if (patch.status !== undefined) {
    if (!SESSION_STATUSES.has(patch.status)) {
      const error = new Error('Estado de revisión no válido.');
      error.status = 400;
      error.code = 'INVALID_REVIEW_STATUS';
      throw error;
    }
    if (patch.status === 'approved' && !session.qa?.passed) {
      const error = new Error('La aprobación requiere un QA visual superado.');
      error.status = 409;
      error.code = 'REVIEW_QA_REQUIRED';
      throw error;
    }
    session.status = patch.status;
  }
  session.revision += 1;
  session.updatedAt = new Date().toISOString();
  await writeJsonAtomic(sessionFile(id), session);
  return session;
}

export async function addReviewComment(id, input = {}) {
  const session = await loadReviewSession(id);
  const variantId = cleanText(input.variantId || session.selectedVariantId, 64);
  if (!session.variants.some((variant) => variant.id === variantId)) {
    const error = new Error('No se puede comentar una variante inexistente.');
    error.status = 400;
    error.code = 'REVIEW_VARIANT_NOT_FOUND';
    throw error;
  }
  const text = cleanText(input.text, 1200);
  if (!text) {
    const error = new Error('El comentario no puede estar vacío.');
    error.status = 400;
    error.code = 'EMPTY_REVIEW_COMMENT';
    throw error;
  }
  const category = ['layout', 'motion', 'text', 'asset', 'sound', 'other'].includes(input.category)
    ? input.category
    : 'other';
  session.comments.push({
    id: `comment-${randomUUID()}`,
    variantId,
    frame: Math.max(0, Math.round(Number(input.frame || 0))),
    category,
    text,
    resolved: false,
    createdAt: new Date().toISOString()
  });
  session.status = session.status === 'approved' ? 'changes-requested' : 'in-review';
  session.revision += 1;
  session.updatedAt = new Date().toISOString();
  await writeJsonAtomic(sessionFile(id), session);
  return session;
}

export async function runReviewQa(id) {
  const session = await loadReviewSession(id);
  const variant = session.variants.find((item) => item.id === session.selectedVariantId);
  session.qa = evaluateRemotionProps(
    {
      ...variant.props,
      sourceVideo: session.context.sourceVideo
    },
    {
      sourceContext: true,
      requireSoundDecision: true
    }
  );
  session.revision += 1;
  session.updatedAt = new Date().toISOString();
  await writeJsonAtomic(sessionFile(id), session);
  return session;
}

export const reviewStudioRoot = REVIEW_ROOT;
