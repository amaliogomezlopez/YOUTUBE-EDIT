import {randomBytes} from 'node:crypto';

export const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function youtubeRedirectUri() {
  return process.env.YOUTUBE_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/oauth/youtube/callback`;
}

export function getYoutubeOAuthConfig() {
  return {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    redirectUri: youtubeRedirectUri()
  };
}

export function validateYoutubeOAuthConfig(config = getYoutubeOAuthConfig()) {
  const missing = [];
  if (!config.clientId) missing.push('YOUTUBE_CLIENT_ID');
  if (!config.clientSecret) missing.push('YOUTUBE_CLIENT_SECRET');
  return missing;
}

export function makeOAuthState() {
  return randomBytes(16).toString('hex');
}

export function youtubeAuthUrl({state, config = getYoutubeOAuthConfig()} = {}) {
  const missing = validateYoutubeOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de YouTube: ${missing.join(', ')}`);
  }
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', YOUTUBE_UPLOAD_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeYoutubeCode(code, config = getYoutubeOAuthConfig()) {
  const missing = validateYoutubeOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de YouTube: ${missing.join(', ')}`);
  }
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Google token exchange failed with ${response.status}`);
  }
  return payload;
}

export async function refreshYoutubeAccessToken(config = getYoutubeOAuthConfig()) {
  const missing = validateYoutubeOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de YouTube: ${missing.join(', ')}`);
  }
  if (!process.env.YOUTUBE_REFRESH_TOKEN) {
    throw new Error('Falta YOUTUBE_REFRESH_TOKEN');
  }
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || `Google refresh failed with ${response.status}`);
  }
  return payload;
}
