export const SHORTSMITH_OAUTH_PREFIX = '/shortsmith/oauth';

function trimSlash(value) {
  return String(value || '').replace(/\/+$/g, '');
}

export function publicBaseUrl() {
  return trimSlash(process.env.SHORTSMITH_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || '');
}

export function publicOAuthCallback(provider) {
  const base = publicBaseUrl();
  if (!base) return null;
  return `${base}${SHORTSMITH_OAUTH_PREFIX}/${provider}/callback`;
}

export function normalizeOAuthPath(pathname) {
  if (!pathname.startsWith(`${SHORTSMITH_OAUTH_PREFIX}/`)) return pathname;
  return pathname.replace(SHORTSMITH_OAUTH_PREFIX, '/api/oauth');
}
