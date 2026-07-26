import {createHash, randomBytes} from 'node:crypto';
import {makeOAuthState} from './youtube-oauth.js';
import {publicOAuthCallback} from './oauth-redirect.js';
import {fetchWithTimeout} from './network.js';

export const X_AUTH_URL = 'https://x.com/i/oauth2/authorize';
export const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
export const DEFAULT_X_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];

export {makeOAuthState};

function env(...keys) {
  return keys.map((key) => process.env[key]).find(Boolean);
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function makePkceVerifier() {
  return base64Url(randomBytes(32));
}

export function makePkceChallenge(verifier) {
  return base64Url(createHash('sha256').update(verifier).digest());
}

export function xRedirectUri() {
  return env('X_REDIRECT_URI_NEW_APP', 'X_REDIRECT_URI') || publicOAuthCallback('x') || `http://127.0.0.1:${process.env.PORT || 3000}/api/oauth/x/callback`;
}

export function getXOAuthConfig() {
  const scopes = (env('X_SCOPES_NEW_APP', 'X_SCOPES') || DEFAULT_X_SCOPES.join(' '))
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return {
    clientId: env('X_CLIENT_ID_NEW_APP', 'X_CLIENT_ID'),
    clientSecret: env('X_CLIENT_SECRET_NEW_APP', 'X_CLIENT_SECRET'),
    redirectUri: xRedirectUri(),
    scopes
  };
}

export function validateXOAuthConfig(config = getXOAuthConfig()) {
  const missing = [];
  if (!config.clientId) missing.push('X_CLIENT_ID');
  if (!config.clientSecret) missing.push('X_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('X_REDIRECT_URI');
  return missing;
}

export function xAuthUrl({state, codeChallenge, config = getXOAuthConfig()} = {}) {
  const missing = validateXOAuthConfig(config);
  if (missing.length) throw new Error(`Faltan variables OAuth de X: ${missing.join(', ')}`);
  if (!codeChallenge) throw new Error('Falta codeChallenge PKCE para OAuth de X.');
  const url = new URL(X_AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state || makeOAuthState());
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function exchangeXCode(code, codeVerifier, config = getXOAuthConfig(), options = {}) {
  const missing = validateXOAuthConfig(config);
  if (missing.length) throw new Error(`Faltan variables OAuth de X: ${missing.join(', ')}`);
  const body = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier
  });
  const response = await fetchWithTimeout(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.timeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `X token exchange failed with ${response.status}`);
  }
  return payload;
}

export async function refreshXAccessToken(
  refreshToken = process.env.X_REFRESH_TOKEN,
  config = getXOAuthConfig(),
  options = {}
) {
  const missing = validateXOAuthConfig(config).filter((key) => key !== 'X_REDIRECT_URI');
  if (missing.length) throw new Error(`Faltan variables OAuth de X: ${missing.join(', ')}`);
  if (!refreshToken) throw new Error('Falta X_REFRESH_TOKEN.');
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const response = await fetchWithTimeout(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.timeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = payload.error || '';
    const error = new Error(payload.error_description || code || `X token refresh failed with ${response.status}`);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function describeXConfig(config = getXOAuthConfig()) {
  return {
    hasClientId: Boolean(config.clientId),
    hasClientSecret: Boolean(config.clientSecret),
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    hasMediaWrite: config.scopes.includes('media.write'),
    missingEnv: validateXOAuthConfig(config)
  };
}
