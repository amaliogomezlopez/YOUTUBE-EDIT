import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {ROOT} from '../../lib/utils.js';
import {validateChannelConfig} from './validator.js';

const CHANNEL_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export const CHANNELS_ROOT = path.join(ROOT, 'channels');

export function assertChannelId(id) {
  const value = String(id || '');
  if (!CHANNEL_ID_PATTERN.test(value)) {
    const error = new Error(
      `Identificador de canal no válido: ${value || '(vacío)'}`
    );
    error.code = 'INVALID_EDITORIAL_CHANNEL_ID';
    error.status = 400;
    throw error;
  }
  return value;
}

function channelConfigFile(root, id) {
  return path.join(root, assertChannelId(id), 'channel.config.json');
}

function channelConfigError(id, error) {
  const wrapped = new Error(
    `No se puede cargar el canal "${id}": ${error.message}`
  );
  wrapped.code = error.code === 'ENOENT'
    ? 'EDITORIAL_CHANNEL_NOT_FOUND'
    : 'EDITORIAL_CHANNEL_CONFIG_INVALID';
  wrapped.status = error.code === 'ENOENT' ? 404 : 500;
  wrapped.cause = error;
  return wrapped;
}

export class ChannelRegistry {
  constructor({root = CHANNELS_ROOT} = {}) {
    this.root = path.resolve(root);
  }

  async load(id) {
    const channelId = assertChannelId(id);
    try {
      const parsed = JSON.parse(
        await readFile(channelConfigFile(this.root, channelId), 'utf8')
      );
      validateChannelConfig(parsed);
      if (parsed.id !== channelId) {
        throw new Error(
          `/id debe coincidir con el directorio "${channelId}", recibido "${parsed.id}"`
        );
      }
      return structuredClone(parsed);
    } catch (error) {
      throw channelConfigError(channelId, error);
    }
  }

  async list() {
    const entries = await readdir(this.root, {withFileTypes: true}).catch(
      (error) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    );
    const ids = entries
      .filter(
        (entry) => entry.isDirectory() && CHANNEL_ID_PATTERN.test(entry.name)
      )
      .map((entry) => entry.name)
      .sort();
    return Promise.all(ids.map((id) => this.load(id)));
  }
}

export function channelPublicDto(channel) {
  return {
    version: channel.version,
    id: channel.id,
    label: channel.label,
    language: channel.language,
    formats: [...channel.formats],
    episode: structuredClone(channel.episode),
    research: {
      lookbackHours: channel.research.lookbackHours,
      minimumIndependentSources:
        channel.research.minimumIndependentSources,
      connectors: [...channel.research.connectors]
    },
    editorial: structuredClone(channel.editorial),
    visual: structuredClone(channel.visual),
    workflow: {
      humanGates: [...channel.workflow.humanGates]
    }
  };
}
