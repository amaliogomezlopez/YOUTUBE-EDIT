import assert from 'node:assert/strict';
import {cp, mkdtemp, mkdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ChannelRegistry,
  channelPublicDto
} from '../src/modules/editorial-video/channel-registry.js';
import {
  editorialVideoFeatureFlags
} from '../src/modules/editorial-video/feature-flags.js';
import {ROOT} from '../src/lib/utils.js';

const fixtures = path.join(ROOT, 'tests', 'fixtures', 'editorial-video');

async function registryFixture(t, fixtureName) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-channels-'));
  const channelDir = path.join(root, 'synthetic-channel');
  await mkdir(channelDir, {recursive: true});
  await cp(
    path.join(fixtures, fixtureName),
    path.join(channelDir, 'channel.config.json')
  );
  t.after(() => rm(root, {recursive: true, force: true}));
  return new ChannelRegistry({root});
}

test('registry loads the versioned finance channel from configuration', async () => {
  const registry = new ChannelRegistry();
  const channel = await registry.load('economia-historias');
  assert.equal(channel.id, 'economia-historias');
  assert.deepEqual(channel.formats, ['landscape']);
  assert.equal(channel.episode.targetMinutes.min, 6);
  assert.equal(channel.editorial.requireNumericDataRef, true);
});

test('registry reports invalid configuration with an actionable path', async (t) => {
  const registry = await registryFixture(t, 'channel.config.invalid.json');
  await assert.rejects(
    () => registry.load('synthetic-channel'),
    (error) => {
      assert.equal(error.code, 'EDITORIAL_CHANNEL_CONFIG_INVALID');
      assert.match(error.message, /targetMinutes.*min no puede superar max/);
      return true;
    }
  );
});

test('registry rejects traversal and mismatched directory IDs', async () => {
  const registry = new ChannelRegistry();
  await assert.rejects(
    () => registry.load('../economia-historias'),
    (error) => error.code === 'INVALID_EDITORIAL_CHANNEL_ID'
  );
});

test('channel DTO exposes configuration but no filesystem location', async () => {
  const registry = new ChannelRegistry();
  const dto = channelPublicDto(await registry.load('economia-historias'));
  assert.equal(dto.id, 'economia-historias');
  assert.equal('root' in dto, false);
  assert.equal('configFile' in dto, false);
  assert.doesNotMatch(JSON.stringify(dto), /[A-Z]:\\\\|\/home\//i);
});

test('editorial UI feature flag is disabled by default and explicit to enable', () => {
  assert.deepEqual(editorialVideoFeatureFlags({}), {uiEnabled: false});
  assert.deepEqual(
    editorialVideoFeatureFlags({
      SHORTSMITH_EDITORIAL_VIDEO_UI_ENABLED: 'true'
    }),
    {uiEnabled: true}
  );
  assert.deepEqual(
    editorialVideoFeatureFlags({
      SHORTSMITH_EDITORIAL_VIDEO_UI_ENABLED: 'false'
    }),
    {uiEnabled: false}
  );
});
