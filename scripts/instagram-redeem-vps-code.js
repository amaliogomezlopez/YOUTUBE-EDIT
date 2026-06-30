import {execFile} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {exchangeInstagramCode, exchangeLongLivedMetaToken, findInstagramBusinessAccount} from '../src/lib/instagram-oauth.js';
import {loadDotEnv, ROOT} from '../src/lib/utils.js';

const execFileAsync = promisify(execFile);
const REMOTE_CODE_FILE = '/home/amalio/shortsmith-oauth/instagram-code.json';

function env(name) {
  return process.env[name]?.trim();
}

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

function sshArgs(remoteCommand) {
  const key = env('ASSET_HOST_SSH_KEY_PATH');
  const host = env('ASSET_HOST_SSH_HOST');
  const user = env('ASSET_HOST_SSH_USER');
  const port = env('ASSET_HOST_SSH_PORT') || '22';
  if (!key || !host || !user) {
    throw new Error('Faltan ASSET_HOST_SSH_KEY_PATH, ASSET_HOST_SSH_HOST o ASSET_HOST_SSH_USER.');
  }
  return [
    '-i', key,
    '-p', port,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'UserKnownHostsFile=.ssh_known_hosts_sibelion',
    `${user}@${host}`,
    remoteCommand
  ];
}

async function ssh(remoteCommand) {
  const {stdout} = await execFileAsync('ssh', sshArgs(remoteCommand), {cwd: ROOT, windowsHide: true});
  return stdout;
}

await loadDotEnv();

const rawCode = await ssh(`cat ${REMOTE_CODE_FILE}`);
const payload = JSON.parse(rawCode);
if (payload.provider !== 'instagram' || !payload.code) {
  throw new Error('El archivo remoto no contiene un code OAuth de Instagram valido.');
}

const shortToken = await exchangeInstagramCode(payload.code);
let longToken = {};
try {
  longToken = await exchangeLongLivedMetaToken(shortToken.access_token);
} catch {
  longToken = {};
}
const accessToken = longToken.access_token || shortToken.access_token;
const accountInfo = await findInstagramBusinessAccount(accessToken);
if (!accountInfo.instagramBusinessAccount?.id) {
  throw new Error('OAuth completado, pero no se encontro una cuenta profesional de Instagram.');
}

const envFile = path.join(ROOT, '.env');
const rawEnv = await readFile(envFile, 'utf8');
await writeFile(envFile, upsertEnv(rawEnv, {
  META_ACCESS_TOKEN: accessToken,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: accountInfo.instagramBusinessAccount.id
}), 'utf8');

await ssh(`rm -f ${REMOTE_CODE_FILE}`);

console.log(JSON.stringify({
  status: 'redeemed',
  username: accountInfo.instagramBusinessAccount.username || null,
  instagramBusinessAccountId: accountInfo.instagramBusinessAccount.id,
  expiresInDays: longToken.expires_in ? Math.round(longToken.expires_in / 86400) : null,
  envUpdated: '.env',
  remoteCodeDeleted: true
}, null, 2));
