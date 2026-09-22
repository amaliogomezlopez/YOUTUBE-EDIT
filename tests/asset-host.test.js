import test from 'node:test';
import assert from 'node:assert/strict';
import {assetHostSshArgs, buildHostedAssetTarget, getAssetHostConfig} from '../src/lib/asset-host.js';

test('SSH alias uses system identity for both ssh and scp', () => {
  const config = getAssetHostConfig({ASSET_HOST_PROVIDER: 'ssh', ASSET_HOST_SSH_ALIAS: 'sibelion', ASSET_HOST_REMOTE_DIR: '/videos', ASSET_HOST_PUBLIC_BASE_URL: 'https://example.com/videos'});
  assert.equal(config.configured, true);
  assert.equal(config.alias, 'sibelion');
  for (const scp of [false, true]) {
    assert.deepEqual(assetHostSshArgs(config, scp), ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new']);
  }
  assert.throws(() => getAssetHostConfig({ASSET_HOST_PROVIDER: 'ssh', ASSET_HOST_SSH_ALIAS: '-oProxyCommand=bad'}), /invalido/);
});

test('explicit identity retains SSH and SCP port flags', () => {
  const config = {keyPath: 'key', port: 2223};
  assert.deepEqual(assetHostSshArgs(config).slice(0, 4), ['-i', 'key', '-p', '2223']);
  assert.deepEqual(assetHostSshArgs(config, true).slice(0, 4), ['-i', 'key', '-P', '2223']);
});

test('asset host reports missing ssh configuration', () => {
  const config = getAssetHostConfig({ASSET_HOST_PROVIDER: 'ssh'});
  assert.equal(config.configured, false);
  assert.equal(config.provider, 'ssh');
  assert.deepEqual(config.missingEnv, [
    'ASSET_HOST_SSH_HOST',
    'ASSET_HOST_SSH_USER',
    'ASSET_HOST_SSH_KEY_PATH',
    'ASSET_HOST_REMOTE_DIR',
    'ASSET_HOST_PUBLIC_BASE_URL'
  ]);
});

test('asset host builds safe remote path and public URL', () => {
  const target = buildHostedAssetTarget('D:\\clips\\Mi Clip Final!.mp4', {
    remoteDir: '/var/www/html/shortsmith/videos',
    publicBaseUrl: 'https://sibelion.ddns.net/shortsmith/videos'
  });
  assert.match(target.filename, /^shortsmith-\d{4}-\d{2}-\d{2}T.*-Mi-Clip-Final\.mp4$/);
  assert.equal(target.remotePath.endsWith(`/${target.filename}`), true);
  assert.equal(target.publicUrl, `https://sibelion.ddns.net/shortsmith/videos/${encodeURIComponent(target.filename)}`);
});
