import {makeOAuthState} from './youtube-oauth.js';
import {fetchWithTimeout} from './network.js';

export const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
export const TIKTOK_CREATOR_INFO_URL = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
export const DEFAULT_TIKTOK_SCOPES = ['user.info.basic', 'user.info.profile', 'video.upload', 'video.publish'];

export {makeOAuthState};

export function tiktokRedirectUri() {
  return process.env.TIKTOK_REDIRECT_URI || 'https://amaliogomezlopez.github.io/YOUTUBE-EDIT/oauth/tiktok/callback/';
}

export function getTiktokOAuthConfig() {
  return {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    redirectUri: tiktokRedirectUri(),
    scopes: (process.env.TIKTOK_SCOPES || DEFAULT_TIKTOK_SCOPES.join(','))
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)
  };
}

export function validateTiktokOAuthConfig(config = getTiktokOAuthConfig()) {
  const missing = [];
  if (!config.clientKey) missing.push('TIKTOK_CLIENT_KEY');
  if (!config.clientSecret) missing.push('TIKTOK_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('TIKTOK_REDIRECT_URI');
  return missing;
}

export function tiktokAuthUrl({state, config = getTiktokOAuthConfig()} = {}) {
  const missing = validateTiktokOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de TikTok: ${missing.join(', ')}`);
  }
  const url = new URL(TIKTOK_AUTH_URL);
  url.searchParams.set('client_key', config.clientKey);
  url.searchParams.set('scope', config.scopes.join(','));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', config.redirectUri);
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeTiktokCode(code, config = getTiktokOAuthConfig(), options = {}) {
  const missing = validateTiktokOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de TikTok: ${missing.join(', ')}`);
  }
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri
  });
  const response = await fetchWithTimeout(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.timeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `TikTok token exchange failed with ${response.status}`);
  }
  return payload;
}

export async function refreshTiktokAccessToken(
  refreshToken = process.env.TIKTOK_REFRESH_TOKEN,
  config = getTiktokOAuthConfig(),
  options = {}
) {
  const missing = validateTiktokOAuthConfig(config).filter((key) => key !== 'TIKTOK_REDIRECT_URI');
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de TikTok: ${missing.join(', ')}`);
  }
  if (!refreshToken) throw new Error('Falta TIKTOK_REFRESH_TOKEN.');
  const body = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const response = await fetchWithTimeout(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.timeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error?.code) {
    const code = payload.error?.code || payload.error || '';
    const message = payload.error?.message || payload.error_description || code || `TikTok token refresh failed with ${response.status}`;
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function describeTiktokConfig(config = getTiktokOAuthConfig()) {
  return {
    hasClientKey: Boolean(config.clientKey),
    hasClientSecret: Boolean(config.clientSecret),
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    missingEnv: validateTiktokOAuthConfig(config)
  };
}

export async function queryTiktokCreatorInfo(
  accessToken,
  {signal, fetch: fetchImpl = fetch, timeoutMs = 30_000} = {}
) {
  if (!accessToken) throw new Error('Falta TIKTOK_ACCESS_TOKEN para consultar el creador.');
  const response = await fetchWithTimeout(TIKTOK_CREATOR_INFO_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8'
    }
  }, {fetchImpl, signal, timeoutMs});
  const payload = await response.json().catch(() => ({}));
  const code = payload.error?.code || '';
  if (!response.ok || (code && code !== 'ok')) {
    const error = new Error(payload.error?.message || payload.error_description || code || `TikTok creator info failed with ${response.status}`);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return payload.data ?? {};
}

export async function validateTiktokToken(accessToken, {fields = ['open_id', 'avatar_url', 'display_name'], signal, fetch: fetchImpl = fetch, timeoutMs = 30_000} = {}) {
  if (!accessToken) {
    throw new Error('Falta TIKTOK_ACCESS_TOKEN para validar.');
  }
  const url = new URL(TIKTOK_USER_INFO_URL);
  url.searchParams.set('fields', fields.join(','));
  const response = await fetchWithTimeout(url, {
    headers: {authorization: `Bearer ${accessToken}`}
  }, {fetchImpl, signal, timeoutMs});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error?.code) {
    throw new Error(payload.error?.message || payload.error_description || `TikTok user info failed with ${response.status}`);
  }
  return payload.data?.user || payload.data || payload;
}
