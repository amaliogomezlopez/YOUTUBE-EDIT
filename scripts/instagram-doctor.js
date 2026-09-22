import {loadDotEnv} from '../src/lib/utils.js';
import {getAssetHostConfig} from '../src/lib/asset-host.js';
import {describeInstagramConfig, validateInstagramToken} from '../src/lib/instagram-oauth.js';

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function assetHostReport() {
  const config = getAssetHostConfig();
  return {
    configured: config.configured,
    missingEnv: config.missingEnv ?? [],
    connectionMode: config.alias ? 'ssh-alias' : 'identity-file',
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
