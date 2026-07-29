/**
 * Resolución de entidades y sus assets.
 *
 * ANM-G01 · ANM-G02 · ANM-G05 — Las empresas dejan de estar escritas en el
 * script de build. Un episodio con otras compañías solo necesita entradas en
 * `channels/<canal>/brand/entities.json`; y si falta alguna, el resolutor dice
 * exactamente qué comando la trae. El render nunca toca la red.
 */
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {normalizeToken} from './word-index.js';

function keysFor(entity) {
  return [entity.name, ...(entity.aliases ?? []), entity.id]
    .filter(Boolean)
    .map((value) => normalizeToken(value));
}

export async function loadEntityRegistry(channelId, {root = process.cwd()} = {}) {
  const file = path.join(root, 'channels', channelId, 'brand', 'entities.json');
  const registry = JSON.parse(await readFile(file, 'utf8'));
  return createEntityRegistry(registry, {root});
}

export function createEntityRegistry(registry, {root = process.cwd()} = {}) {
  const byKey = new Map();
  for (const entity of registry.entities ?? []) {
    for (const key of keysFor(entity)) {
      if (!byKey.has(key)) byKey.set(key, entity);
    }
  }

  return {
    registry,
    entities: registry.entities ?? [],

    /** Formato que consume la minería de cues (ANM-B01). */
    miningEntities() {
      return (registry.entities ?? []).map((entity) => ({
        id: entity.id,
        name: entity.name,
        aliases: entity.aliases ?? []
      }));
    },

    resolve(name) {
      return byKey.get(normalizeToken(name)) ?? null;
    },

    group(groupId) {
      const ids = registry.groups?.[groupId] ?? [];
      return ids.map((id) => byKey.get(normalizeToken(id))).filter(Boolean);
    },

    /** Assets de escena a partir de nombres o de un grupo declarado. */
    assetsFor(names = []) {
      const assets = [];
      const missing = [];
      for (const name of names) {
        const entity = byKey.get(normalizeToken(name));
        if (!entity) {
          missing.push({name, reason: 'unknown-entity'});
          continue;
        }
        if (!entity.asset) {
          missing.push({name, entityId: entity.id, reason: 'no-asset'});
          continue;
        }
        assets.push({
          id: entity.asset.id,
          kind: entity.asset.kind,
          label: entity.label ?? entity.name.toUpperCase(),
          path: entity.asset.path,
          entityId: entity.id
        });
      }
      return {assets, missing};
    },

    supportImage(concept) {
      const wanted = normalizeToken(concept);
      return (registry.supportImages ?? []).find(
        (image) => normalizeToken(image.concept).includes(wanted) ||
          wanted.includes(normalizeToken(image.concept))
      ) ?? null;
    },

    supportImageById(id) {
      return (registry.supportImages ?? []).find((image) => image.id === id) ?? null;
    },

    /** ANM-G05 — Todo asset existe en disco antes del bundle. Cero red. */
    async verifyLocalAssets({publicRoot = path.join(root, 'remotion-animations', 'public')} = {}) {
      const declared = [
        ...(registry.entities ?? [])
          .filter((entity) => entity.asset)
          .map((entity) => ({id: entity.asset.id, path: entity.asset.path})),
        ...(registry.supportImages ?? []).map((image) => ({id: image.id, path: image.path}))
      ];
      const missing = [];
      for (const asset of declared) {
        const file = path.join(publicRoot, asset.path);
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) missing.push(asset);
      }
      return {declared, missing};
    },

    /** Instrucción accionable en lugar de un fallo opaco. */
    importCommandFor(entity) {
      return (
        `npm run channel:entities -- --channel ${registry.channelId} ` +
        `--resolve "${entity.name ?? entity}" --allow-remote`
      );
    }
  };
}

/**
 * ANM-G01 — Resolución remota nombre → dominio → logo.
 * Solo se ejecuta bajo petición explícita: descarga, importa al catálogo
 * gestionado y devuelve el registro para escribirlo en `entities.json`.
 */
export async function resolveEntityRemotely(name, {
  searchBrandfetch,
  downloadTo,
  importRemotionAsset,
  collection = 'entity-logos',
  channelId = 'channel'
}) {
  const results = await searchBrandfetch(name, {limit: 5});
  const best = results.find((item) => item.claimed) ?? results[0];
  if (!best) {
    throw new Error(
      `Brand Search API no devolvió ninguna marca para «${name}». ` +
      'Importa el logo a mano con `npm run remotion:asset:import`.'
    );
  }
  const id = `${channelId}-${normalizeToken(name)}`;
  const localFile = await downloadTo(best.downloadUrl, id);
  const imported = await importRemotionAsset({
    sourceFile: localFile,
    id,
    collection,
    assetType: 'logo',
    alt: `Logotipo de ${best.title}`,
    source: best.sourceUrl,
    author: best.author,
    license: best.license,
    attribution: best.attribution,
    tags: ['logo', normalizeToken(name)]
  });
  return {
    id: normalizeToken(name),
    name: best.title,
    aliases: [],
    kind: 'company',
    domain: best.domain,
    label: String(best.title ?? name).toUpperCase(),
    asset: {
      id: imported.id ?? id,
      kind: 'logo',
      path: imported.publicPath ?? `assets/library/${collection}/${id}.png`
    }
  };
}
