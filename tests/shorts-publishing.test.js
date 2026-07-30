import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLATFORMS,
  assembleShortCaptions,
  composeShortPublishing,
  loadShortCaptions
} from '../src/modules/shorts-studio/publishing.js';

const REFERENCE_SLUG = 'harness-vs-modelo';

const scene = (overrides) => ({
  clipId: '01',
  from: 0,
  durationInFrames: 60,
  trimStartSeconds: 0,
  trimEndSeconds: 1,
  ...overrides
});

test('la transcripcion montada rebasa los tiempos al reloj del short', () => {
  const build = {
    format: {fps: 60},
    scenes: [
      scene({clipId: '01', from: 0, trimStartSeconds: 2, trimEndSeconds: 3}),
      scene({clipId: '02', from: 60, trimStartSeconds: 10, trimEndSeconds: 11})
    ]
  };
  const captions = assembleShortCaptions(build, new Map([
    ['01', [{text: 'antes', start: 0.2, end: 0.5}, {text: 'dentro', start: 2.1, end: 2.6}]],
    ['02', [{text: 'segunda', start: 10.4, end: 10.9}]]
  ]));
  assert.deepEqual(captions.map((caption) => caption.text), ['dentro', 'segunda']);
  assert.equal(captions[0].start, 0.1, 'la palabra recortada empieza en el reloj del short');
  assert.equal(captions[1].start, 1.4, 'la escena 2 arranca en el frame 60 = 1 s');
});

test('un clip partido en dos escenas no duplica las palabras del limite', async () => {
  // El clip 02 de harness-vs-modelo esta partido con trims contiguos en 7.3 s.
  const {build, captions} = await loadShortCaptions(REFERENCE_SLUG);
  const split = build.scenes.filter((item) => item.clipId === '02');
  assert.equal(split.length, 2, 'el proyecto de referencia debe seguir teniendo el clip partido');
  const words = captions.flatMap((caption) => caption.text.split(/\s+/));
  const total = build.scenes
    .filter((item) => item.clipId === '02')
    .reduce((sum, item) => sum + (item.trimEndSeconds - item.trimStartSeconds), 0);
  assert.ok(total > 12, 'los dos tramos cubren el clip completo');
  assert.equal(
    words.filter((word) => word === 'caro').length,
    1,
    'la palabra del limite entre las dos escenas aparece una sola vez'
  );
});

test('la transcripcion montada nunca retrocede en el tiempo', async () => {
  const {captions} = await loadShortCaptions(REFERENCE_SLUG);
  for (let index = 1; index < captions.length; index += 1) {
    assert.ok(
      captions[index].start >= captions[index - 1].start,
      `caption ${index} empieza antes que la anterior`
    );
  }
});

test('la transcripcion montada cabe dentro de la duracion del short', async () => {
  const {build, captions} = await loadShortCaptions(REFERENCE_SLUG);
  assert.ok(captions.at(-1).end <= build.durationSeconds + 0.001);
});

test('la metadata cumple el contrato de publicacion sin LLM', async () => {
  const {build, captions} = await loadShortCaptions(REFERENCE_SLUG);
  const payload = await composeShortPublishing({
    slug: REFERENCE_SLUG,
    build,
    plan: {title: 'Deja de usar Claude Code'},
    captions,
    useLlm: false
  });

  assert.equal(payload.llmUsed, false);
  assert.ok(payload.summary.short.length > 0);
  assert.ok(payload.summary.medium.length > 0);
  assert.ok(payload.summary.youtube_description.includes('Capitulos:'));

  assert.equal(payload.hashtags.split('\n').length, 1, 'los hashtags van en una sola linea');
  assert.equal(payload.hashtags.split(' ').length, 14, 'exactamente 14 hashtags');
  for (const tag of payload.hashtags.split(' ')) assert.match(tag, /^#[\p{L}\p{N}_]+$/u);

  assert.match(payload.timestamps[0], /^00:00 /, 'el primer capitulo es 00:00');

  assert.deepEqual(Object.keys(payload.platform_posts), PLATFORMS);
  for (const platform of PLATFORMS) {
    const post = payload.platform_posts[platform];
    const text = post.caption ?? post.text ?? post.description;
    assert.ok(text?.length > 0, `${platform} no trae texto publicable`);
    assert.ok(text.includes('#'), `${platform} no lleva hashtags`);
  }
  for (const platform of PLATFORMS) {
    assert.equal(payload.titles[platform].length, 10, `${platform}: se esperan 10 titulos`);
  }
});

test('el titulo del plan encabeza las propuestas', async () => {
  const {build, captions} = await loadShortCaptions(REFERENCE_SLUG);
  const payload = await composeShortPublishing({
    slug: REFERENCE_SLUG,
    build,
    plan: {title: 'Deja de usar Claude Code'},
    captions,
    useLlm: false
  });
  assert.equal(payload.titles.youtube[0].title, 'Deja de usar Claude Code');
  assert.equal(payload.platform_posts.youtube.title, 'Deja de usar Claude Code');
});
