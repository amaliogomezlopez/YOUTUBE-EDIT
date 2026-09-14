import {DEFAULT_TIKTOK_SCOPES, exchangeTiktokCode, makeOAuthState, queryTiktokCreatorInfo, tiktokAuthUrl, validateTiktokToken} from './tiktok-oauth.js';

// Sandbox credentials and tokens deliberately live only in this server session.
// Production environment variables are never replaced by a review demonstration.
export function createTikTokSandboxSession({exchange = exchangeTiktokCode, userInfo = validateTiktokToken, creatorInfo = queryTiktokCreatorInfo, now = Date.now} = {}) {
  let config = null;
  let accessToken = '';
  let expiresAt = 0;
  let version = 0;
  const states = new Map();
  const status = () => ({configured: Boolean(config), connected: Boolean(accessToken && now() < expiresAt), scopes: [...DEFAULT_TIKTOK_SCOPES]});
  return {
    status,
    configure({clientKey, clientSecret, redirectUri}) {
      if (![clientKey, clientSecret].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]{8,256}$/.test(value))) throw new Error('Introduce las credenciales válidas del Sandbox.');
      const redirect = new URL(redirectUri);
      if (redirect.protocol !== 'https:' || redirect.username || redirect.password) throw new Error('El retorno OAuth debe usar HTTPS.');
      config = {clientKey, clientSecret, redirectUri: redirect.href, scopes: [...DEFAULT_TIKTOK_SCOPES]};
      accessToken = '';
      expiresAt = 0;
      version += 1;
      states.clear();
      return status();
    },
    start() {
      if (!config) throw new Error('Configura primero las credenciales del Sandbox.');
      for (const [state, entry] of states) if (entry.expiresAt <= now()) states.delete(state);
      if (states.size >= 10) throw new Error('Demasiados intentos OAuth pendientes. Espera diez minutos.');
      const state = makeOAuthState();
      states.set(state, {expiresAt: now() + 600_000, version});
      return tiktokAuthUrl({state, config});
    },
    ownsState(state) { return states.has(state); },
    async callback({state, code, error}) {
      const pending = states.get(state);
      states.delete(state);
      if (!pending || pending.expiresAt <= now() || pending.version !== version) throw new Error('Autorización caducada. Vuelve a conectar el Sandbox.');
      if (error) throw new Error('TikTok no concedió la autorización del Sandbox.');
      if (!code) throw new Error('TikTok no devolvió el código de autorización.');
      const tokens = await exchange(code, config);
      if (pending.version !== version) throw new Error('La configuración cambió durante la autorización.');
      if (!tokens.access_token || !(Number(tokens.expires_in) > 0)) throw new Error('TikTok no devolvió un token válido.');
      accessToken = tokens.access_token;
      expiresAt = now() + Number(tokens.expires_in) * 1000;
      return status();
    },
    token() {
      if (!status().connected) throw new Error('Conecta de nuevo la cuenta al Sandbox.');
      return accessToken;
    },
    async account() {
      const token = this.token();
      const user = await userInfo(token);
      let creator = null;
      let creatorError = null;
      try { creator = await creatorInfo(token); } catch { creatorError = 'TikTok todavía no permite consultar Direct Post para esta autorización.'; }
      return {user: {display_name: user.display_name, avatar_url: user.avatar_url}, creator, creatorError};
    }
  };
}
