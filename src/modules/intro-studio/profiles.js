import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const INTRO_PROFILES_FILE = path.join(HERE, 'intro-profiles.json');

/**
 * Perfiles de estilo de la intro.
 *
 * La superficie decide *que* se puede hacer (formato, layouts, slots, reglas) y el
 * perfil decide *cuanto*: cuantos golpes por segundo, cuanto se ve el fondo, que
 * efectos estan permitidos, cuanto puede durar. Es la misma separacion que ya usa
 * el canal editorial entre `channel.config.json` (allowlists) y
 * `catalog/design/brand-profiles.json` (defaults), y sirve para lo mismo: que la
 * intro de un video de finanzas y la de uno de modelos salgan del mismo codigo.
 */
export const INTRO_PROFILES = JSON.parse(readFileSync(INTRO_PROFILES_FILE, 'utf8'));

export const introProfileIds = INTRO_PROFILES.profiles.map((profile) => profile.id);

export function resolveIntroProfile(profileId) {
  const id = profileId ?? INTRO_PROFILES.defaultProfile;
  const profile = INTRO_PROFILES.profiles.find((candidate) => candidate.id === id);
  if (!profile) {
    throw new Error(
      `Perfil de intro desconocido: "${id}". Disponibles: ${introProfileIds.join(', ')}`
    );
  }
  return profile;
}

/**
 * Presupuesto que el build copia al JSON compilado para que las reglas midan contra
 * el perfil activo y no contra una constante. Sin esto, una regla de densidad seria
 * o demasiado permisiva para el perfil sobrio o demasiado estricta para el nervioso,
 * y acabaria con excepciones en vez de con umbrales.
 */
export function profileBudget(profile) {
  return {
    profileId: profile.id,
    maxStrongEffectsPerSecond: profile.maxStrongEffectsPerSecond,
    maxSecondsWithoutChange: profile.maxSecondsWithoutChange,
    beatToleranceSeconds: profile.beatToleranceSeconds,
    durationBudgetSeconds: profile.durationBudgetSeconds,
    effectAllowlist: [...profile.effectAllowlist]
  };
}
