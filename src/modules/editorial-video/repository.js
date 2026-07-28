import {randomUUID} from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import {DATA_DIR} from '../../lib/utils.js';
import {
  ChannelRegistry,
  assertChannelId
} from './channel-registry.js';
import {validateEpisodeManifest} from './validator.js';

const EPISODE_ID_PATTERN = /^episode-[a-z0-9][a-z0-9-]{7,95}$/;

export const EDITORIAL_CHANNEL_DATA_ROOT = path.join(DATA_DIR, 'channels');
export const EPISODE_DIRECTORIES = Object.freeze([
  'sources',
  'research',
  'story',
  'narration',
  'transcript',
  'visuals',
  'review',
  'renders',
  'publishing'
]);

function repositoryError(message, code, status, cause = null) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  if (cause) error.cause = cause;
  return error;
}

export function assertEpisodeId(id) {
  const value = String(id || '');
  if (!EPISODE_ID_PATTERN.test(value)) {
    throw repositoryError(
      `Identificador de episodio no válido: ${value || '(vacío)'}`,
      'INVALID_EDITORIAL_EPISODE_ID',
      400
    );
  }
  return value;
}

function cleanTitle(title) {
  const value = String(title || 'Nuevo episodio')
    .replace(/\0/g, '')
    .trim()
    .slice(0, 200);
  if (!value) {
    throw repositoryError(
      'El título del episodio no puede estar vacío.',
      'INVALID_EDITORIAL_EPISODE_TITLE',
      400
    );
  }
  return value;
}

function makeEpisodeId(now = new Date()) {
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
  return `episode-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function replaceFile(temp, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temp, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code) || attempt >= 5) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
    }
  }
}

async function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await replaceFile(temp, file);
}

export function createEpisodeManifest({
  id,
  channelId,
  title = 'Nuevo episodio',
  now = new Date()
}) {
  const timestamp = now.toISOString();
  const manifest = {
    version: 1,
    id: assertEpisodeId(id),
    channelId: assertChannelId(channelId),
    title: cleanTitle(title),
    status: 'draft',
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    progress: {
      stage: 'draft',
      completedUnits: 0,
      totalUnits: 0,
      message: '',
      attempt: 0,
      retryable: true
    },
    research: null,
    story: null,
    narration: null,
    transcript: null,
    visualPlan: null,
    review: null,
    renders: {
      preview: null,
      final: null
    },
    publishing: {
      status: 'pending',
      package: null,
      confirmation: {
        status: 'pending',
        confirmedAt: null
      },
      idempotencyKey: null
    },
    warnings: []
  };
  return validateEpisodeManifest(manifest);
}

export class EditorialEpisodeRepository {
  constructor({
    root = EDITORIAL_CHANNEL_DATA_ROOT,
    channelRegistry = new ChannelRegistry(),
    now = () => new Date(),
    idFactory = makeEpisodeId
  } = {}) {
    this.root = path.resolve(root);
    this.channelRegistry = channelRegistry;
    this.now = now;
    this.idFactory = idFactory;
  }

  channelEpisodesDir(channelId) {
    return path.join(
      this.root,
      assertChannelId(channelId),
      'episodes'
    );
  }

  episodeDir(channelId, episodeId) {
    return path.join(
      this.channelEpisodesDir(channelId),
      assertEpisodeId(episodeId)
    );
  }

  manifestFile(channelId, episodeId) {
    return path.join(
      this.episodeDir(channelId, episodeId),
      'episode-manifest.json'
    );
  }

  async create({channelId, title = 'Nuevo episodio', id = null}) {
    const channel = await this.channelRegistry.load(channelId);
    const now = this.now();
    const episodeId = id ? assertEpisodeId(id) : this.idFactory(now);
    const parent = this.channelEpisodesDir(channel.id);
    const directory = this.episodeDir(channel.id, episodeId);
    await mkdir(parent, {recursive: true});
    try {
      await mkdir(directory);
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw repositoryError(
          `El episodio ya existe: ${episodeId}`,
          'EDITORIAL_EPISODE_EXISTS',
          409,
          error
        );
      }
      throw error;
    }
    await Promise.all(
      EPISODE_DIRECTORIES.map((name) =>
        mkdir(path.join(directory, name), {recursive: true})
      )
    );
    const manifest = createEpisodeManifest({
      id: episodeId,
      channelId: channel.id,
      title,
      now
    });
    await writeJsonAtomic(this.manifestFile(channel.id, episodeId), manifest);
    return structuredClone(manifest);
  }

  async load(channelId, episodeId) {
    const safeChannelId = assertChannelId(channelId);
    const safeEpisodeId = assertEpisodeId(episodeId);
    try {
      const manifest = JSON.parse(
        await readFile(
          this.manifestFile(safeChannelId, safeEpisodeId),
          'utf8'
        )
      );
      validateEpisodeManifest(manifest);
      if (
        manifest.id !== safeEpisodeId ||
        manifest.channelId !== safeChannelId
      ) {
        throw new Error('El manifest no coincide con su directorio.');
      }
      return structuredClone(manifest);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw repositoryError(
          `No existe el episodio "${safeEpisodeId}" en "${safeChannelId}".`,
          'EDITORIAL_EPISODE_NOT_FOUND',
          404,
          error
        );
      }
      if (error.code?.startsWith?.('EDITORIAL_')) throw error;
      throw repositoryError(
        `No se puede abrir el episodio "${safeEpisodeId}": ${error.message}`,
        'EDITORIAL_EPISODE_INVALID',
        500,
        error
      );
    }
  }

  async save(manifest, {expectedRevision} = {}) {
    if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw repositoryError(
        'expectedRevision es obligatorio para guardar un episodio.',
        'EDITORIAL_EXPECTED_REVISION_REQUIRED',
        400
      );
    }
    const current = await this.load(manifest.channelId, manifest.id);
    if (current.revision !== expectedRevision) {
      const error = repositoryError(
        `Revisión obsoleta: se esperaba ${expectedRevision} y la actual es ${current.revision}.`,
        'EDITORIAL_REVISION_CONFLICT',
        409
      );
      error.expectedRevision = expectedRevision;
      error.currentRevision = current.revision;
      throw error;
    }
    if (
      manifest.createdAt !== current.createdAt ||
      manifest.id !== current.id ||
      manifest.channelId !== current.channelId
    ) {
      throw repositoryError(
        'No se pueden cambiar la identidad ni la fecha de creación del episodio.',
        'EDITORIAL_EPISODE_IDENTITY_IMMUTABLE',
        400
      );
    }
    const next = structuredClone(manifest);
    next.title = cleanTitle(next.title);
    next.revision = current.revision + 1;
    next.updatedAt = this.now().toISOString();
    validateEpisodeManifest(next);
    await writeJsonAtomic(
      this.manifestFile(next.channelId, next.id),
      next
    );
    return structuredClone(next);
  }

  async update(channelId, episodeId, update, {expectedRevision} = {}) {
    const current = await this.load(channelId, episodeId);
    const candidate = typeof update === 'function'
      ? await update(structuredClone(current))
      : {...current, ...structuredClone(update)};
    return this.save(candidate, {
      expectedRevision: expectedRevision ?? current.revision
    });
  }

  async list({channelId, limit = 50} = {}) {
    const safeChannelId = assertChannelId(channelId);
    const entries = await readdir(
      this.channelEpisodesDir(safeChannelId),
      {withFileTypes: true}
    ).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const manifests = await Promise.all(
      entries
        .filter(
          (entry) =>
            entry.isDirectory() && EPISODE_ID_PATTERN.test(entry.name)
        )
        .map(async (entry) => {
          try {
            return await this.load(safeChannelId, entry.name);
          } catch {
            return null;
          }
        })
    );
    return manifests
      .filter(Boolean)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(1, Math.min(500, Number(limit) || 50)));
  }

  async find(episodeId) {
    const safeEpisodeId = assertEpisodeId(episodeId);
    const channelEntries = await readdir(this.root, {
      withFileTypes: true
    }).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const matches = [];
    for (const entry of channelEntries) {
      if (!entry.isDirectory()) continue;
      try {
        matches.push(await this.load(entry.name, safeEpisodeId));
      } catch (error) {
        if (error.code !== 'EDITORIAL_EPISODE_NOT_FOUND') throw error;
      }
    }
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw repositoryError(
        `El ID "${safeEpisodeId}" existe en más de un canal; indica --channel.`,
        'EDITORIAL_EPISODE_AMBIGUOUS',
        409
      );
    }
    throw repositoryError(
      `No existe el episodio "${safeEpisodeId}".`,
      'EDITORIAL_EPISODE_NOT_FOUND',
      404
    );
  }
}
