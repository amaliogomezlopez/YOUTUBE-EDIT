import {getAssetHostConfig} from './asset-host.js';
import {validateInstagramToken} from './instagram-oauth.js';
import {queryTiktokCreatorInfo, validateTiktokToken} from './tiktok-oauth.js';
import {refreshYoutubeAccessToken} from './youtube-oauth.js';

function present(...keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

function scopes(name, separator = /[,\s]+/) {
  return String(process.env[name] || '').split(separator).map((scope) => scope.trim()).filter(Boolean);
}

function safeError(error) {
  return {
    ok: false,
    code: error?.code || null,
    status: Number(error?.status) || null,
    error: String(error?.message || error || 'Error desconocido')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]')
  };
}

async function check(run) {
  try {
    return {ok: true, ...(await run())};
  } catch (error) {
    return safeError(error);
  }
}

function state({
  configured,
  blockers = [],
  warnings = [],
  auth = null,
  freeProgrammatic,
  mode,
  fullyAutomatic,
  ...details
}) {
  const allBlockers = [...blockers];
  if (auth?.ok === false) allBlockers.push(auth.error || 'La autorización remota no es válida.');
  let status = 'ready';
  if (!configured) status = 'needs_configuration';
  else if (auth?.ok === false || allBlockers.length) status = 'blocked';
  else if (!freeProgrammatic) status = 'paid';
  else if (!fullyAutomatic) status = 'manual_finish';
  return {
    configured,
    operational: configured && auth?.ok !== false && allBlockers.length === 0,
    status,
    blockers: allBlockers,
    warnings,
    auth,
    freeProgrammatic,
    mode,
    fullyAutomatic,
    ...details
  };
}

export async function publishingReadiness({verify = false, validators = {}} = {}) {
  const assetHost = getAssetHostConfig();
  const youtubeConfigured = present('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN');
  const instagramConfigured = present('META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID');
  const tiktokHasAccess = Boolean(process.env.TIKTOK_ACCESS_TOKEN);
  const tiktokHasRefresh = present('TIKTOK_REFRESH_TOKEN', 'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET');
  const tiktokConfigured = tiktokHasAccess || tiktokHasRefresh;
  const tiktokMode = String(process.env.TIKTOK_PUBLISH_MODE || 'inbox').trim().toLowerCase();
  const tiktokScopes = scopes('TIKTOK_SCOPES');
  const xOauth2 = Boolean(process.env.X_USER_ACCESS_TOKEN || process.env.X_OAUTH2_ACCESS_TOKEN);
  const xOauth1 = present('X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET');
  const xScopes = scopes('X_SCOPES');

  let youtubeAuth = null;
  let instagramAuth = null;
  let tiktokAuth = null;
  if (verify) {
    [youtubeAuth, instagramAuth, tiktokAuth] = await Promise.all([
      youtubeConfigured
        ? check(async () => {
          const token = await (validators.refreshYoutubeAccessToken || refreshYoutubeAccessToken)();
          return {expiresIn: token.expires_in || null, scope: token.scope || null};
        })
        : null,
      instagramConfigured
        ? check(async () => {
          const token = await (validators.validateInstagramToken || validateInstagramToken)(
            process.env.META_ACCESS_TOKEN,
            {fields: 'id,user_id,username,account_type'}
          );
          if (!token.isProfessional) throw new Error('La cuenta de Instagram no es BUSINESS o CREATOR.');
          if (token.matchesEnv === false) throw new Error('El token de Instagram no corresponde a INSTAGRAM_BUSINESS_ACCOUNT_ID.');
          return {
            username: token.username || null,
            accountType: token.accountType || null,
            isProfessional: token.isProfessional,
            matchesEnv: token.matchesEnv
          };
        })
        : null,
      tiktokHasAccess
        ? check(async () => {
          if (tiktokMode === 'direct') {
            const creator = await (validators.queryTiktokCreatorInfo || queryTiktokCreatorInfo)(
              process.env.TIKTOK_ACCESS_TOKEN
            );
            return {
              username: creator.creator_username || null,
              privacyLevelOptions: creator.privacy_level_options || [],
              maxVideoPostDurationSec: creator.max_video_post_duration_sec || null
            };
          }
          const user = await (validators.validateTiktokToken || validateTiktokToken)(
            process.env.TIKTOK_ACCESS_TOKEN
          );
          return {displayName: user.display_name || null};
        })
        : tiktokHasRefresh
          ? {ok: null, refreshable: true, error: 'El access token se renovará automáticamente al publicar.'}
          : null
    ]);
  }

  const youtube = state({
    configured: youtubeConfigured,
    blockers: youtubeConfigured ? [] : ['OAuth de YouTube incompleto'],
    warnings: ['Los proyectos de API no auditados por YouTube solo pueden subir vídeos privados.'],
    auth: youtubeAuth,
    freeProgrammatic: true,
    mode: 'direct_upload',
    fullyAutomatic: true,
    testMode: 'privacyStatus=private',
    remoteRecovery: 'resumable-session',
    apiCost: 'Sin tarifa por publicación; cuota predeterminada de 100 uploads/día.'
  });

  const instagram = state({
    configured: instagramConfigured && assetHost.configured,
    blockers: [
      ...(!instagramConfigured ? ['Token/cuenta profesional de Instagram incompletos'] : []),
      ...(!assetHost.configured ? ['Asset host HTTPS incompleto'] : [])
    ],
    auth: instagramAuth,
    freeProgrammatic: true,
    mode: 'direct_reel',
    fullyAutomatic: true,
    testMode: 'cuenta profesional de prueba',
    remoteRecovery: 'container-and-media-id',
    apiCost: 'Sin tarifa por publicación en la API oficial.',
    assetHost: {configured: assetHost.configured, provider: assetHost.provider}
  });

  const directScopeDeclared = tiktokScopes.includes('video.publish');
  const tiktok = state({
    configured: tiktokConfigured,
    blockers: [
      ...(!tiktokConfigured ? ['Token de TikTok Content Posting API ausente'] : []),
      ...(tiktokMode === 'direct' && tiktokScopes.length && !directScopeDeclared
        ? ['TIKTOK_SCOPES no incluye video.publish']
        : [])
    ],
    warnings: tiktokMode === 'direct'
      ? ['Sin auditoría de TikTok, Direct Post queda limitado a SELF_ONLY y a cuentas privadas.']
      : ['El modo inbox sube un borrador, pero exige terminar la publicación dentro de TikTok.'],
    auth: tiktokAuth,
    freeProgrammatic: true,
    mode: tiktokMode === 'direct' ? 'direct_post' : 'inbox_draft',
    fullyAutomatic: tiktokMode === 'direct' && (directScopeDeclared || !tiktokScopes.length),
    testMode: tiktokMode === 'direct' ? 'Direct Post SELF_ONLY' : 'inbox/draft SELF_ONLY',
    remoteRecovery: 'publish-id',
    apiCost: 'Sin tarifa por publicación; requiere aprobación de scopes y auditoría para contenido público.',
    privacyLevel: process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY',
    refreshTokenPresent: Boolean(process.env.TIKTOK_REFRESH_TOKEN)
  });

  const x = state({
    configured: xOauth2 || xOauth1,
    blockers: xOauth2 || xOauth1 ? [] : ['Credenciales OAuth de usuario de X ausentes'],
    warnings: ['X requiere comprar créditos; Shortsmith no puede certificar el saldo sin realizar una operación facturable.'],
    auth: null,
    freeProgrammatic: false,
    mode: 'direct_post',
    fullyAutomatic: true,
    testMode: 'cuenta de prueba',
    remoteRecovery: 'media-id-with-ambiguity-guard',
    apiCost: 'Pago por uso; Content Create cuesta actualmente 0,015 USD por solicitud.',
    oauthMode: xOauth2 ? 'oauth2' : xOauth1 ? 'oauth1' : null,
    mediaWriteDeclared: xScopes.includes('media.write'),
    refreshTokenPresent: Boolean(process.env.X_REFRESH_TOKEN)
  });

  return {
    safeMode: true,
    verified: verify,
    generatedAt: new Date().toISOString(),
    platforms: {youtube, instagram, tiktok, x}
  };
}
