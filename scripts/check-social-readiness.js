import {loadDotEnv} from '../src/lib/utils.js';
import {describeInstagramConfig, validateInstagramToken} from '../src/lib/instagram-oauth.js';
import {describeTiktokConfig, validateTiktokToken} from '../src/lib/tiktok-oauth.js';

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function assetHostReport() {
  const required = [
    'ASSET_HOST_PROVIDER',
    'ASSET_HOST_SSH_HOST',
    'ASSET_HOST_SSH_USER',
    'ASSET_HOST_SSH_KEY_PATH',
    'ASSET_HOST_REMOTE_DIR',
    'ASSET_HOST_PUBLIC_BASE_URL'
  ];
  return {
    configured: required.every(present),
    missingEnv: required.filter((key) => !present(key)),
    provider: process.env.ASSET_HOST_PROVIDER || null,
    publicBaseUrl: process.env.ASSET_HOST_PUBLIC_BASE_URL || null
  };
}

await loadDotEnv();

const report = {
  instagram: {
    config: describeInstagramConfig(),
    accessTokenPresent: present('META_ACCESS_TOKEN'),
    businessAccountIdPresent: present('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
    assetHost: assetHostReport()
  },
  tiktok: {
    config: describeTiktokConfig(),
    accessTokenPresent: present('TIKTOK_ACCESS_TOKEN'),
    openIdPresent: present('TIKTOK_OPEN_ID')
  }
};

if (report.instagram.accessTokenPresent) {
  try {
    const token = await validateInstagramToken(process.env.META_ACCESS_TOKEN, {
      fields: 'id,user_id,username,account_type'
    });
    report.instagram.token = {
      ok: true,
      username: token.username,
      accountType: token.accountType,
      isProfessional: token.isProfessional,
      matchesEnv: token.matchesEnv,
      instagramBusinessAccountId: token.instagramBusinessAccountId
    };
  } catch (error) {
    report.instagram.token = {ok: false, error: error.message};
  }
}

if (report.tiktok.accessTokenPresent) {
  try {
    const user = await validateTiktokToken(process.env.TIKTOK_ACCESS_TOKEN);
    report.tiktok.token = {
      ok: true,
      openIdPresent: Boolean(user.open_id),
      displayName: user.display_name || null
    };
  } catch (error) {
    report.tiktok.token = {ok: false, error: error.message};
  }
}

console.log(JSON.stringify(report, null, 2));
