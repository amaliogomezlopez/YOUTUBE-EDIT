export const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
export const META_DIALOG_URL = 'https://www.facebook.com/dialog/oauth';
export const INSTAGRAM_DIALOG_URL = 'https://www.instagram.com/oauth/authorize';
export const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
export const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com';
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const DEFAULT_INSTAGRAM_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish'
];

export function instagramRedirectUri() {
  return process.env.META_REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/api/oauth/instagram/callback`;
}

export function getInstagramOAuthConfig() {
  return {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    redirectUri: instagramRedirectUri(),
    omitScopes: process.env.META_INSTAGRAM_OMIT_SCOPES === 'true',
    scopes: (process.env.META_INSTAGRAM_SCOPES || DEFAULT_INSTAGRAM_SCOPES.join(','))
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean)
  };
}

export function usesInstagramLogin(config = getInstagramOAuthConfig()) {
  return config.scopes.some((scope) => scope.startsWith('instagram_business_'));
}

export function validateInstagramOAuthConfig(config = getInstagramOAuthConfig()) {
  const missing = [];
  if (!config.appId) missing.push('META_APP_ID');
  if (!config.appSecret) missing.push('META_APP_SECRET');
  return missing;
}

export function instagramAuthUrl({state, config = getInstagramOAuthConfig()} = {}) {
  const missing = validateInstagramOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de Instagram/Meta: ${missing.join(', ')}`);
  }
  const url = new URL(usesInstagramLogin(config) ? INSTAGRAM_DIALOG_URL : META_DIALOG_URL);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  if (!config.omitScopes) url.searchParams.set('scope', config.scopes.join(','));
  if (usesInstagramLogin(config)) {
    url.searchParams.set('enable_fb_login', '0');
    url.searchParams.set('force_authentication', '1');
  }
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

async function graphGet(pathname, params = {}, base = META_GRAPH_BASE) {
  const url = new URL(`${base}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(explainOAuthError(payload) || `Meta Graph API failed with ${response.status}`);
  }
  return payload;
}

export async function exchangeInstagramCode(code, config = getInstagramOAuthConfig()) {
  const missing = validateInstagramOAuthConfig(config);
  if (missing.length) {
    throw new Error(`Faltan variables OAuth de Instagram/Meta: ${missing.join(', ')}`);
  }
  if (usesInstagramLogin(config)) {
    const body = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
      code
    });
    const response = await fetch(INSTAGRAM_TOKEN_URL, {
      method: 'POST',
      headers: {'content-type': 'application/x-www-form-urlencoded'},
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(explainOAuthError(payload) || `Instagram token exchange failed with ${response.status}`);
    }
    return payload;
  }
  return graphGet('/oauth/access_token', {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code
  });
}

export async function exchangeLongLivedMetaToken(shortLivedToken, config = getInstagramOAuthConfig()) {
  if (usesInstagramLogin(config)) {
    return graphGet('/access_token', {
      grant_type: 'ig_exchange_token',
      client_secret: config.appSecret,
      access_token: shortLivedToken
    }, INSTAGRAM_GRAPH_BASE);
  }
  return graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken
  });
}

function maskSecret(value) {
  if (!value) return null;
  const str = String(value);
  if (str.length <= 8) return `***(${str.length})`;
  return `${str.slice(0, 4)}…${str.slice(-4)}(${str.length})`;
}

export function describeInstagramConfig(config = getInstagramOAuthConfig()) {
  const scopes = config.scopes || [];
  return {
    appId: config.appId ? String(config.appId) : null,
    hasAppSecret: Boolean(config.appSecret),
    appSecretMasked: maskSecret(config.appSecret),
    redirectUri: config.redirectUri,
    scopes,
    usesInstagramLogin: usesInstagramLogin({scopes}),
    usesMetaLogin: !usesInstagramLogin({scopes}),
    omitScopes: Boolean(config.omitScopes),
    missingEnv: validateInstagramOAuthConfig(config)
  };
}

export async function validateInstagramToken(accessToken, {fields} = {}) {
  if (!accessToken) {
    throw new Error('Falta META_ACCESS_TOKEN para validar.');
  }
  const requestedFields = fields || 'id,user_id,username,account_type,profile_pic_url,followers_count';
  const account = await graphGet('/me', {fields: requestedFields, access_token: accessToken}, INSTAGRAM_GRAPH_BASE);
  const accountId = account.user_id || account.id;
  const wantsProfessional = ['BUSINESS', 'CREATOR', 'MEDIA_CREATOR'].includes(account.account_type);
  return {
    ok: true,
    id: account.id,
    user_id: account.user_id,
    username: account.username,
    accountType: account.account_type,
    isProfessional: wantsProfessional,
    instagramBusinessAccountId: accountId,
    followersCount: account.followers_count ?? null,
    profilePicUrl: account.profile_pic_url ?? null,
    matchesEnv: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
      ? String(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) === String(accountId)
      : null
  };
}

const PLATFORM_APP_HINT = 'Invalid platform app suele indicar que la app de Instagram no tiene la plataforma "Instagram Login" configurada con la redirect URI exacta, o que client_id/secret no corresponden a esa app Instagram-only. Ver: App Settings > Instagram Login > Valid OAuth Redirect URIs.';

function explainOAuthError(payload) {
  const metaMessage = payload.error_message || payload.error?.message || payload.error || '';
  const metaType = payload.error_type || payload.error?.type || '';
  const metaCode = payload.code ?? payload.error?.code ?? '';
  const message = String(metaMessage || `Instagram OAuth failed`);
  const parts = [message, metaType && `type=${metaType}`, metaCode && `code=${metaCode}`].filter(Boolean);
  if (/invalid platform app/i.test(message) || metaCode === 200 || metaCode === 190) {
    parts.push(`[hint] ${PLATFORM_APP_HINT}`);
  }
  return parts.join(' ');
}

export async function findInstagramBusinessAccount(accessToken, config = getInstagramOAuthConfig()) {
  if (usesInstagramLogin(config)) {
    const account = await graphGet('/me', {
      fields: 'id,user_id,username,account_type',
      access_token: accessToken
    }, INSTAGRAM_GRAPH_BASE);
    return {
      page: null,
      instagramBusinessAccount: {
        id: account.user_id || account.id,
        username: account.username,
        accountType: account.account_type
      },
      pages: []
    };
  }
  const accounts = await graphGet('/me/accounts', {
    fields: 'id,name,instagram_business_account{id,username}',
    access_token: accessToken
  });
  const page = (accounts.data || []).find((item) => item.instagram_business_account?.id);
  return {
    page,
    instagramBusinessAccount: page?.instagram_business_account || null,
    pages: accounts.data || []
  };
}
