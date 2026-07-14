import {getAssetHostConfig} from './asset-host.js';

function present(...keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

function row(configured, blockers, details = {}) {
  return {configured, blockers: configured ? [] : blockers, ...details};
}

export function publishingReadiness() {
  const assetHost = getAssetHostConfig();
  const youtube = present('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN');
  const instagram = present('META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID');
  const tiktok = present('TIKTOK_ACCESS_TOKEN');
  const xOauth2 = Boolean(process.env.X_USER_ACCESS_TOKEN || process.env.X_OAUTH2_ACCESS_TOKEN);
  const xOauth1 = present('X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET');
  return {
    safeMode: true,
    generatedAt: new Date().toISOString(),
    platforms: {
      youtube: row(youtube, ['OAuth de YouTube incompleto'], {testMode: 'privacyStatus=private', remoteRecovery: 'resumable-session'}),
      instagram: row(instagram && assetHost.configured, [
        ...(!instagram ? ['Token/cuenta profesional de Instagram incompletos'] : []),
        ...(!assetHost.configured ? ['Asset host HTTPS incompleto'] : [])
      ], {testMode: 'cuenta profesional de prueba', remoteRecovery: 'container-and-media-id', assetHost: {configured: assetHost.configured, provider: assetHost.provider}}),
      tiktok: row(tiktok, ['Token de TikTok Content Posting API ausente'], {testMode: 'inbox/draft SELF_ONLY', remoteRecovery: 'publish-id'}),
      x: row(xOauth2 || xOauth1, ['Credenciales OAuth de usuario de X ausentes'], {testMode: 'cuenta de prueba', remoteRecovery: 'media-id-with-ambiguity-guard', oauthMode: xOauth2 ? 'oauth2' : xOauth1 ? 'oauth1' : null})
    }
  };
}
