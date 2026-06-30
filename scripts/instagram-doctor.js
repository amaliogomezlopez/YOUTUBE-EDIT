import {loadDotEnv} from '../src/lib/utils.js';
import {describeInstagramConfig, validateInstagramToken} from '../src/lib/instagram-oauth.js';

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
    publicBaseUrl: process.env.ASSET_HOST_PUBLIC_BASE_URL || null
  };
}

await loadDotEnv();

const report = {
  config: describeInstagramConfig(),
  metaAccessTokenPresent: present('META_ACCESS_TOKEN'),
  businessAccountIdPresent: present('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
  assetHost: assetHostReport()
};

if (report.metaAccessTokenPresent) {
  try {
    const token = await validateInstagramToken(process.env.META_ACCESS_TOKEN, {
      fields: 'id,user_id,username,account_type'
    });
    report.token = {
      ok: true,
      username: token.username,
      accountType: token.accountType,
      isProfessional: token.isProfessional,
      matchesEnv: token.matchesEnv,
      instagramBusinessAccountId: token.instagramBusinessAccountId
    };
  } catch (error) {
    report.token = {ok: false, error: error.message};
  }
}

console.log(JSON.stringify(report, null, 2));
