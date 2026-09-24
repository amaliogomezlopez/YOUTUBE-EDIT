import assert from 'node:assert/strict';
import test from 'node:test';
import {cameraKeys, numberPop, planMontage} from '../src/modules/montage-studio/planner.js';
import {resolveMontageProfile, profileBudget} from '../src/modules/montage-studio/profiles.js';
import {MONTAGE_FORMATS} from '../src/modules/montage-studio/constants.js';
import {runMontageRules} from '../src/modules/montage-studio/rules/index.js';
import {partitionAtAnchors} from '../src/modules/video-studio/shot-schedule.js';

const GEOMETRY = {
  safeBottom: 1748,
  captionRect: {left: 60, top: 1210, width: 960, height: 270},
  popRect: {left: 80, top: 380, width: 920, height: 380}
};

/** Locucion sintetica: una palabra cada 0,35 s durante `seconds`. */
function voice(seconds, texts = []) {
  const words = [];
  for (let t = 0.2, i = 0; t < seconds - 0.3; t += 0.35, i += 1) {
    words.push({index: i, text: texts[i] ?? 'palabra', start: Number(t.toFixed(3)), end: Number((t + 0.28).toFixed(3))});
  }
  return words;
}

const photo = (id, extra = {}) => ({id, kind: 'image', src: `projects/montage/t/assets/${id}.jpg`, width: 2560, height: 1440, name: `${id}.jpg`, tokens: [id], ...extra});

function plan(overrides = {}) {
  const words = overrides.words ?? voice(30);
  return planMontage({
    words,
    voiceDurationSeconds: 30,
    assets: overrides.assets ?? Array.from({length: 14}, (_, i) => photo(`foto${String.fromCharCode(97 + i)}`)),
    plan: overrides.plan ?? {},
    profile: resolveMontageProfile('viral-short'),
    format: MONTAGE_FORMATS['9x16'],
    geometry: GEOMETRY
  });
}

test('la locucion se reparte en visuales de 1,5-3 s sin huecos y ancladas a palabras', () => {
  const words = voice(30);
  const result = plan({words});
  const starts = new Set(words.map((word) => Math.round((word.start - (words[0].start - 0.06)) * 60)));
  let cursor = 0;
  result.beats.forEach((beat, index) => {
    assert.equal(beat.fromFrame, cursor, `${beat.id} no empieza donde acaba el anterior`);
    cursor += beat.durationInFrames;
    const seconds = beat.durationInFrames / 60;
    assert.ok(seconds <= 3 + 1e-6, `${beat.id} dura ${seconds}`);
    if (index < result.beats.length - 1) assert.ok(seconds >= 1.5 - 1e-6, `${beat.id} dura ${seconds}`);
    if (index > 0) assert.ok(starts.has(beat.fromFrame), `${beat.id} no empieza en una palabra`);
  });
  assert.equal(cursor, result.durationInFrames);
});

test('la camara nunca repite movimiento dos beats seguidos y cada cambio suena', () => {
  const result = plan();
  for (let i = 1; i < result.beats.length; i += 1) {
    assert.notEqual(result.beats[i].camera.move, result.beats[i - 1].camera.move);
    assert.ok(result.beats[i].sfx.length >= 1, `${result.beats[i].id} entra sin sonido`);
    assert.notEqual(result.beats[i].transitionIn.kind, result.beats[i - 1].transitionIn.kind);
  }
});

test('los assets rotan antes de repetirse y el nombrado entra donde se nombra', () => {
  const texts = [];
  texts[40] = 'powell';
  const result = plan({words: voice(30, texts), assets: [photo('powell'), ...Array.from({length: 13}, (_, i) => photo(`foto${i}`))]});
  const ids = result.beats.map((beat) => beat.visual.assetId);
  const powell = result.beats.find((beat) => beat.visual.assetId === 'powell');
  assert.equal(powell.visual.reason, 'mention');
  assert.ok(powell.spokenText.includes('powell'));
  assert.equal(new Set(ids.slice(0, 10)).size, 10, 'se repite un asset habiendo otros sin usar');
});

test('un override fija asset y camara en su palabra, y el asset reservado no se gasta antes', () => {
  const words = voice(30);
  const atWord = 40;
  const result = plan({words, plan: {overrides: [{atWord, assetId: 'fotoc', camera: 'punch'}]}});
  const beat = result.beats.find((candidate) => candidate.atWord === atWord);
  assert.ok(beat, 'el override no abre beat');
  assert.equal(beat.visual.assetId, 'fotoc');
  assert.equal(beat.camera.move, 'punch');
  const earlier = result.beats.filter((candidate) => candidate.fromFrame < beat.fromFrame);
  assert.ok(!earlier.some((candidate) => candidate.visual.assetId === 'fotoc'));
});

test('sin assets o con assets diminutos el montaje falla en vez de dejar huecos', () => {
  assert.throws(() => plan({assets: []}), /huecos/);
  assert.throws(() => plan({assets: [photo('logo', {width: 80, height: 80})]}), /huecos/);
});

test('las cifras dichas salen como texto con sonido y se respeta la densidad', () => {
  const texts = [];
  texts[10] = '5,2'; texts[11] = 'por'; texts[12] = 'ciento';
  texts[14] = '300'; texts[15] = 'millones';
  const result = plan({words: voice(30, texts)});
  const pops = result.beats.flatMap((beat) => beat.overlays);
  assert.equal(pops[0].text, '5,2 %');
  assert.ok(pops[0].sound?.family, 'el texto entra en silencio');
  // Dos cifras a 1,4 s: la segunda cede ante el techo de 3 textos cada 10 s.
  assert.equal(pops.length, 1);
  assert.equal(numberPop([{text: '300'}, {text: 'millones'}], 0), '300 M');
});

test('los paneos quedan acotados para que el borde nunca entre en cuadro', () => {
  const zoom = {min: 1.06, max: 1.32};
  for (const move of ['pan-left', 'pan-right', 'tilt-up', 'tilt-down']) {
    for (const focus of [{x: 0.5, y: 0.5}, {x: 0.2, y: 0.8}]) {
      for (const key of cameraKeys(move, {zoom, punchZoom: 1.16, focus})) {
        const f = move.startsWith('pan') ? focus.x : focus.y;
        const shift = move.startsWith('pan') ? key.x : key.y;
        // Con origen en f, el borde izquierdo queda en f(1-s)+s*shift <= 0 y el derecho >= 1.
        assert.ok(f * (1 - key.scale) + key.scale * shift <= 1e-9, `${move} deja ver el borde inicial`);
        assert.ok(f + key.scale * (1 - f) + key.scale * shift >= 1 - 1e-9, `${move} deja ver el borde final`);
      }
    }
  }
});

test('un build planificado pasa todas las reglas de montaje', async () => {
  const profile = resolveMontageProfile('viral-short');
  const result = plan();
  const {issues} = await runMontageRules({...result, format: MONTAGE_FORMATS['9x16'], geometry: GEOMETRY, budget: profileBudget(profile)});
  assert.deepEqual(issues.filter((issue) => issue.severity === 'error'), []);
});

test('el reparto comun devuelve null cuando la ventana de ritmo no cabe', () => {
  assert.equal(partitionAtAnchors([{frame: 0}], 60, {minVisualSeconds: 2, maxVisualSeconds: 3}, 60), null);
  const segments = partitionAtAnchors([{frame: 0}, {frame: 150}], 300, {minVisualSeconds: 2, maxVisualSeconds: 3}, 60);
  assert.deepEqual(segments.map((segment) => segment.endFrame), [150, 300]);
});

test('las paginas de subtitulos nunca se solapan ni un frame', () => {
  const {captions} = plan();
  for (let i = 1; i < captions.pages.length; i += 1) {
    const previous = captions.pages[i - 1];
    assert.ok(previous.fromFrame + previous.durationInFrames <= captions.pages[i].fromFrame, `pagina ${i - 1} pisa la ${i}`);
  }
});

test('un logo solo entra cuando se nombra su marca', () => {
  const texts = [];
  texts[50] = 'nvidia';
  const assets = [photo('logo-a', {role: 'logo'}), photo('nvidia', {role: 'logo'}), ...Array.from({length: 12}, (_, i) => photo(`foto${i}`))];
  const result = plan({words: voice(30, texts), assets});
  const ids = result.beats.map((beat) => beat.visual.assetId);
  assert.ok(!ids.includes('logo-a'), 'un logo sin mencion entro por rotacion');
  assert.equal(result.beats.find((beat) => beat.visual.assetId === 'nvidia')?.visual.reason, 'mention');
});
