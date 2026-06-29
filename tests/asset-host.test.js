import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHostedAssetTarget, getAssetHostConfig} from '../src/lib/asset-host.js';

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
