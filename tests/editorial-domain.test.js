import assert from 'node:assert/strict';
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {ROOT} from '../src/lib/utils.js';
import {
  ChannelRegistry
} from '../src/modules/editorial-video/channel-registry.js';
import {
  runEditorialVideoCli
} from '../src/modules/editorial-video/cli.js';
import {
  episodePublicDto
} from '../src/modules/editorial-video/dto.js';
import {
  EPISODE_DIRECTORIES,
  EditorialEpisodeRepository,
  createEpisodeManifest
} from '../src/modules/editorial-video/repository.js';
import {
  transitionEpisode
} from '../src/modules/editorial-video/state-machine.js';
import {
  validateResearchDossier,
  validateSourceRecord,
  validateStoryPackage,
  validateVisualPlan
} from '../src/modules/editorial-video/validator.js';

const fixtures = path.join(ROOT, 'tests', 'fixtures', 'editorial-video');
const fixedEpisodeId = 'episode-20260728090000-deadbeef';
const timestamp = '2026-07-28T09:00:00.000Z';
const hashes = {
  a: 'a'.repeat(64),
  b: 'b'.repeat(64),
  c: 'c'.repeat(64)
};

async function readFixture(name) {
  return JSON.parse(await readFile(path.join(fixtures, name), 'utf8'));
}

async function temporaryRepository(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-editorial-'));
  const channelRoot = path.join(root, 'channels');
  const channelDir = path.join(channelRoot, 'synthetic-channel');
  const dataRoot = path.join(root, 'data');
  await mkdir(channelDir, {recursive: true});
  await cp(
    path.join(fixtures, 'channel.config.synthetic.json'),
    path.join(channelDir, 'channel.config.json')
  );
  const registry = new ChannelRegistry({root: channelRoot});
  const times = [
    new Date(timestamp),
    new Date('2026-07-28T09:01:00.000Z'),
    new Date('2026-07-28T09:02:00.000Z'),
    new Date('2026-07-28T09:03:00.000Z')
  ];
  const repository = new EditorialEpisodeRepository({
    root: dataRoot,
    channelRegistry: registry,
    idFactory: () => fixedEpisodeId,
    now: () => times.shift() || new Date('2026-07-28T09:04:00.000Z')
  });
  t.after(() => rm(root, {recursive: true, force: true}));
  return {root, dataRoot, registry, repository};
}

function artifact(status = 'ready', file = 'research/artifact.json') {
  return {
    status,
    file,
    sha256: hashes.a,
    revision: 1,
    inputSignature: hashes.b,
    generatedAt: timestamp
  };
}

function approvedStory() {
  return {
    ...artifact('approved', 'story/story-package.json'),
    approval: {
      status: 'approved',
      approvedAt: timestamp,
      approvedRevision: 1,
      notes: ''
    }
  };
}

test('synthetic source, dossier and story fixtures satisfy closed schemas', async () => {
  const sources = await readFixture('source-records.synthetic.json');
  const dossier = await readFixture('research-dossier.synthetic.json');
  const story = await readFixture('story-package.synthetic.json');
  assert.equal(sources.map(validateSourceRecord).length, 3);
  assert.equal(
    validateResearchDossier(dossier, {requireNumericDataRef: true}),
    dossier
  );
  assert.equal(validateStoryPackage(story, {dossier}), story);
});

test('dossier rejects invented refs and story rejects blocked claims', async () => {
  const dossier = await readFixture('research-dossier.synthetic.json');
  dossier.claims[0].sourceRefs.push('source-invented');
  assert.throws(
    () => validateResearchDossier(dossier),
    /source-invented/
  );

  const cleanDossier = await readFixture('research-dossier.synthetic.json');
  const story = await readFixture('story-package.synthetic.json');
  cleanDossier.claims.find((claim) => claim.id === 'claim-cause').status =
    'unsupported';
  assert.throws(
    () => validateStoryPackage(story, {dossier: cleanDossier}),
    /claim bloqueado "claim-cause"/
  );
});

test('visual plan validates ordered, complete scene timing', () => {
  const plan = {
    version: 1,
    episodeId: fixedEpisodeId,
    audioDurationSeconds: 10,
    fps: 30,
    scenes: [
      {
        id: 'scene-opening',
        order: 0,
        startSeconds: 0,
        endSeconds: 10,
        narrationText: 'Texto sintético.',
        wordRange: {startIndex: 0, endIndex: 2},
        claimRefs: ['claim-output'],
        sourceRefs: ['source-alpha'],
        dataRefs: ['data-index'],
        visualIntent: 'chart',
        patternId: 'pattern-chart',
        compositionId: 'Pattern-Chart',
        effectIds: [],
        assetRefs: [],
        themeId: 'editorial-ivory',
        motionProfile: 'restrained',
        soundProfile: 'documentary',
        soundDecision: 'silence',
        header: null,
        props: {value: 112},
        fallback: {
          patternId: 'pattern-static',
          compositionId: 'Pattern-Static',
          reason: 'Fallback determinista',
          props: {value: 112}
        }
      }
    ],
    coverage: {
      startSeconds: 0,
      endSeconds: 10,
      gaps: [],
      overlaps: []
    },
    generatedAt: timestamp
  };
  assert.equal(validateVisualPlan(plan), plan);
  plan.scenes[0].endSeconds = 11;
  assert.throws(() => validateVisualPlan(plan), /duración del audio/);
});

test('state machine enforces story, preview QA and final render gates', () => {
  let manifest = createEpisodeManifest({
    id: fixedEpisodeId,
    channelId: 'synthetic-channel',
    now: new Date(timestamp)
  });
  manifest = transitionEpisode(manifest, 'researching');
  manifest = transitionEpisode(manifest, 'research-ready');
  manifest = transitionEpisode(manifest, 'planning-story');
  manifest = transitionEpisode(manifest, 'awaiting-story-approval');
  assert.throws(
    () => transitionEpisode(manifest, 'awaiting-narration'),
    (error) => error.code === 'EDITORIAL_STORY_APPROVAL_REQUIRED'
  );
  manifest.story = approvedStory();
  manifest = transitionEpisode(manifest, 'awaiting-narration');
  manifest = transitionEpisode(manifest, 'transcribing');
  manifest = transitionEpisode(manifest, 'aligning');
  manifest = transitionEpisode(manifest, 'planning-visuals');
  assert.throws(
    () => transitionEpisode(manifest, 'rendering-preview'),
    (error) => error.code === 'EDITORIAL_PREVIEW_INPUTS_REQUIRED'
  );
  manifest.narration = {
    status: 'ready',
    file: 'narration/original.wav',
    metadataFile: 'narration/metadata.json',
    sha256: hashes.a,
    durationSeconds: 10,
    codec: 'pcm_s16le',
    channels: 1,
    sampleRate: 48000,
    importedAt: timestamp
  };
  manifest.transcript = artifact('ready', 'transcript/transcript.json');
  manifest.visualPlan = artifact('ready', 'visuals/visual-plan.json');
  manifest = transitionEpisode(manifest, 'rendering-preview');
  manifest = transitionEpisode(manifest, 'preview-ready');
  assert.throws(
    () => transitionEpisode(manifest, 'approved'),
    (error) => error.code === 'EDITORIAL_PREVIEW_APPROVAL_REQUIRED'
  );
});

test('repository creates the episode template and survives reopen/list', async (t) => {
  const {repository} = await temporaryRepository(t);
  const created = await repository.create({
    channelId: 'synthetic-channel',
    title: 'Episodio sintético'
  });
  assert.equal(created.revision, 1);
  assert.equal(created.status, 'draft');
  for (const directory of EPISODE_DIRECTORIES) {
    const info = await stat(
      path.join(repository.episodeDir(created.channelId, created.id), directory)
    );
    assert.equal(info.isDirectory(), true);
  }
  const reopened = await repository.load(created.channelId, created.id);
  assert.deepEqual(reopened, created);
  const listed = await repository.list({channelId: created.channelId});
  assert.deepEqual(listed.map((episode) => episode.id), [created.id]);
  const found = await repository.find(created.id);
  assert.equal(found.channelId, 'synthetic-channel');
});

test('repository writes atomically and rejects a stale revision', async (t) => {
  const {repository} = await temporaryRepository(t);
  const original = await repository.create({
    channelId: 'synthetic-channel'
  });
  const saved = await repository.update(
    original.channelId,
    original.id,
    {title: 'Revisión dos'},
    {expectedRevision: 1}
  );
  assert.equal(saved.revision, 2);
  assert.equal(saved.title, 'Revisión dos');
  original.title = 'Sobrescritura obsoleta';
  await assert.rejects(
    () => repository.save(original, {expectedRevision: 1}),
    (error) => {
      assert.equal(error.code, 'EDITORIAL_REVISION_CONFLICT');
      assert.equal(error.currentRevision, 2);
      return true;
    }
  );
  assert.equal(
    (await repository.load(original.channelId, original.id)).title,
    'Revisión dos'
  );
});

test('public episode DTO strips every managed local file reference', () => {
  const manifest = createEpisodeManifest({
    id: fixedEpisodeId,
    channelId: 'synthetic-channel',
    now: new Date(timestamp)
  });
  manifest.research = artifact();
  manifest.story = approvedStory();
  manifest.transcript = artifact('ready', 'transcript/private.json');
  manifest.progress.message = 'Leyendo D:\\privado\\fuente.json';
  manifest.warnings.push({
    code: 'PRIVATE_PATH_REMOVED',
    message: 'Fallo temporal en C:\\secretos\\audio.wav',
    stage: 'transcribing',
    createdAt: timestamp
  });
  const dto = episodePublicDto(manifest);
  const serialized = JSON.stringify(dto);
  assert.equal('file' in dto.research, false);
  assert.equal('inputSignature' in dto.research, false);
  assert.doesNotMatch(serialized, /artifact\.json|private\.json|inputSignature/);
  assert.doesNotMatch(serialized, /privado|secretos|audio\.wav/);
  assert.match(serialized, /\[ruta privada\]/);
});

test('CLI creates, lists and shows an episode without exposing storage paths', async (t) => {
  const {registry, repository, dataRoot} = await temporaryRepository(t);
  const output = [];
  const dependencies = {
    registry,
    repository,
    stdout: (value) => output.push(value)
  };
  const created = await runEditorialVideoCli(
    ['create', '--channel', 'synthetic-channel'],
    dependencies
  );
  const listed = await runEditorialVideoCli(
    ['list', '--channel', 'synthetic-channel'],
    dependencies
  );
  const shown = await runEditorialVideoCli(
    ['show', '--episode', created.id],
    dependencies
  );
  assert.deepEqual(listed.map((episode) => episode.id), [created.id]);
  assert.equal(shown.id, created.id);
  assert.doesNotMatch(output.join('\n'), new RegExp(dataRoot.replace(/\\/g, '\\\\')));
  assert.doesNotMatch(output.join('\n'), /episode-manifest\.json/);
});
