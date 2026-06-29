import {spawn} from 'node:child_process';
import path from 'node:path';

const REQUIRED_SSH_ENV = [
  'ASSET_HOST_SSH_HOST',
  'ASSET_HOST_SSH_USER',
  'ASSET_HOST_SSH_KEY_PATH',
  'ASSET_HOST_REMOTE_DIR',
  'ASSET_HOST_PUBLIC_BASE_URL'
];

function cleanSegment(value) {
  return String(value || 'asset.mp4')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'asset.mp4';
}

function remoteQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runCommand(command, args, {timeoutMs = 120000} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.trim() || 'no stderr'}`));
    });
  });
}

export function getAssetHostConfig(env = process.env) {
  if ((env.ASSET_HOST_PROVIDER || '').toLowerCase() !== 'ssh') {
    return {configured: false, provider: env.ASSET_HOST_PROVIDER || '', missingEnv: ['ASSET_HOST_PROVIDER']};
  }
  const missingEnv = REQUIRED_SSH_ENV.filter((key) => !env[key]);
  if (missingEnv.length) return {configured: false, provider: 'ssh', missingEnv};
  return {
    configured: true,
    provider: 'ssh',
    host: env.ASSET_HOST_SSH_HOST,
    port: Number(env.ASSET_HOST_SSH_PORT || 22),
    user: env.ASSET_HOST_SSH_USER,
    keyPath: env.ASSET_HOST_SSH_KEY_PATH,
    remoteDir: env.ASSET_HOST_REMOTE_DIR.replace(/[\\/]+$/g, ''),
    publicBaseUrl: env.ASSET_HOST_PUBLIC_BASE_URL.replace(/\/+$/g, '')
  };
}

export function buildHostedAssetTarget(videoFile, {remoteDir, publicBaseUrl, filenamePrefix = 'shortsmith'} = {}) {
  const parsed = path.parse(videoFile || 'clip.mp4');
  const ext = cleanSegment(parsed.ext || '.mp4');
  const stem = cleanSegment(parsed.name || 'clip');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${cleanSegment(filenamePrefix)}-${stamp}-${stem}${ext}`;
  return {
    filename,
    remotePath: `${remoteDir}/${filename}`,
    publicUrl: `${publicBaseUrl}/${encodeURIComponent(filename)}`
  };
}

export async function uploadAssetToSshHost(videoFile, {env = process.env, timeoutMs} = {}) {
  const config = getAssetHostConfig(env);
  if (!config.configured) {
    return {ok: false, status: 'requires_manual_action', missingEnv: config.missingEnv};
  }
  const target = buildHostedAssetTarget(videoFile, config);
  const commonSshArgs = [
    '-i', config.keyPath,
    '-p', String(config.port),
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new'
  ];
  const remote = `${config.user}@${config.host}`;
  await runCommand('ssh', [
    ...commonSshArgs,
    remote,
    `mkdir -p ${remoteQuote(config.remoteDir)}`
  ], {timeoutMs});
  await runCommand('scp', [
    '-i', config.keyPath,
    '-P', String(config.port),
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    videoFile,
    `${remote}:${target.remotePath}`
  ], {timeoutMs});
  return {ok: true, provider: 'ssh', publicUrl: target.publicUrl, remotePath: target.remotePath};
}
