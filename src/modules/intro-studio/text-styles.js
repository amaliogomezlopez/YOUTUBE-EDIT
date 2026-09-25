/**
 * Estilos de texto de la intro (`text-styles.json`).
 *
 * El plan elige uno con `textStyleId` (o el perfil con el suyo) y el build copia sus
 * tokens a `intro-build.json`. El renderer no conoce los estilos por nombre: solo lee
 * tokens, de modo que un estilo nuevo es una entrada del JSON y no un componente.
 */
import {readFileSync} from 'node:fs';

const CATALOG = JSON.parse(readFileSync(new URL('./text-styles.json', import.meta.url), 'utf8'));

export const TEXT_REVEALS = new Set(['letters', 'words', 'mask', 'fade']);
export const ACCENT_MODES = new Set(['writing', 'highlight', 'ink']);
export const STAT_PRESENTATIONS = new Set(['column', 'floating']);

export function textStyleIds() {
  return CATALOG.styles.map((style) => style.id);
}

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
function merge(base, over) {
  const out = {...base};
  for (const [key, value] of Object.entries(over ?? {})) {
    out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : value;
  }
  return out;
}

/** Estilo completo: el pedido fundido sobre el de por defecto (la v3 aprobada). */
export function resolveTextStyle(id) {
  const base = CATALOG.styles.find((style) => style.id === CATALOG.defaultStyle);
  const wanted = id ?? CATALOG.defaultStyle;
  const style = CATALOG.styles.find((entry) => entry.id === wanted);
  if (!style) throw new Error(`textStyleId "${wanted}" no existe (${textStyleIds().join(', ')})`);
  const resolved = merge(base, style);
  if (!TEXT_REVEALS.has(resolved.reveal)) throw new Error(`${wanted}: reveal "${resolved.reveal}" no valido`);
  if (!ACCENT_MODES.has(resolved.color.accentMode)) throw new Error(`${wanted}: accentMode "${resolved.color.accentMode}" no valido`);
  if (!STAT_PRESENTATIONS.has(resolved.stat.presentation)) throw new Error(`${wanted}: stat.presentation "${resolved.stat.presentation}" no valida`);
  return resolved;
}

export function textStyleCatalog() {
  return CATALOG;
}
