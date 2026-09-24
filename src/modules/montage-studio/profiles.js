import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MONTAGE_PROFILES_FILE = path.join(HERE, 'montage-profiles.json');

/**
 * Perfiles de estilo del montaje. La superficie decide *que* se puede hacer
 * (formatos, movimientos, transiciones) y el perfil *cuanto*: cada cuanto cambia la
 * visual, cuanto se mueve, que suena en cada cambio. Las reglas de ritmo leen sus
 * umbrales del `budget` que el build copia de aqui.
 */
export const MONTAGE_PROFILES = JSON.parse(readFileSync(MONTAGE_PROFILES_FILE, 'utf8'));

export const montageProfileIds = MONTAGE_PROFILES.profiles.map((profile) => profile.id);

export function resolveMontageProfile(profileId) {
  const id = profileId ?? MONTAGE_PROFILES.defaultProfile;
  const profile = MONTAGE_PROFILES.profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    throw new Error(`Perfil de montaje desconocido: "${id}". Disponibles: ${montageProfileIds.join(', ')}`);
  }
  return profile;
}

export function profileBudget(profile) {
  return {
    profileId: profile.id,
    minVisualSeconds: profile.minVisualSeconds,
    maxVisualSeconds: profile.maxVisualSeconds,
    maxSecondsWithoutCut: profile.maxSecondsWithoutCut,
    maxSecondsStatic: profile.maxSecondsStatic,
    maxCutsPer10s: profile.maxCutsPer10s,
    assetRepeatGapSeconds: profile.assetRepeatGapSeconds,
    zoom: {...profile.zoom},
    textPopsPer10s: profile.textPops.maxPer10s,
    textPopMaxWords: profile.textPops.maxWords
  };
}
