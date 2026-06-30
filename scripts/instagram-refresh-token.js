import {existsSync} from 'node:fs';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {refreshInstagramLongLivedToken, validateInstagramToken} from '../src/lib/instagram-oauth.js';
import {loadDotEnv, ROOT} from '../src/lib/utils.js';

const ENV_FILE = path.join(ROOT, '.env');

function upsertEnv(raw, updates) {
  const seen = new Set();
  const lines = raw.split(/\r?\n/).map((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (!match || !Object.hasOwn(updates, match[1])) return line;
    seen.add(match[1]);
    return `${match[1]}=${updates[match[1]]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  return `${lines.join('\n').replace(/\n+$/g, '')}\n`;
}

function tokenAgeDays(expiresIn) {
  const days = Math.floor(Number(expiresIn || 0) / 86400);
  return Number.isFinite(days) && days > 0 ? days : null;
}

await loadDotEnv();

if (!existsSync(ENV_FILE)) {
  throw new Error('No existe .env; no puedo actualizar META_ACCESS_TOKEN.');
}

const refreshed = await refreshInstagramLongLivedToken();
const accessToken = refreshed.access_token;
if (!accessToken) {
  throw new Error('Instagram no devolvio access_token al refrescar.');
}

const probe = await validateInstagramToken(accessToken, {fields: 'id,user_id,username,account_type'});
const updates = {
  META_ACCESS_TOKEN: accessToken,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: String(probe.instagramBusinessAccountId)
};

const raw = await readFile(ENV_FILE, 'utf8');
await writeFile(ENV_FILE, upsertEnv(raw, updates), 'utf8');

console.log(JSON.stringify({
  status: 'refreshed',
  username: probe.username,
  accountType: probe.accountType,
  instagramBusinessAccountId: probe.instagramBusinessAccountId,
  expiresInDays: tokenAgeDays(refreshed.expires_in),
  envUpdated: '.env'
}, null, 2));
