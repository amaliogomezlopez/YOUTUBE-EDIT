import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {selectTrackedFace} from '../src/lib/face-detector.js';
import {buildShort} from '../src/modules/shorts-studio/build.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {writeShortsRegistry} from '../src/modules/shorts-studio/registry.js';
import {writeJson} from '../src/lib/utils.js';

const FOCUS_TRACK = [
  {t: 0.5, x: 0.42, y: 0.4},
  {t: 2.5, x: 0.5, y: 0.42},
  {t: 4.5, x: 0.58, y: 0.44}
];

test('selectTrackedFace expone la membresia del track ganador con withFaces', () => {
  const frames = [
    [{x: 100, y: 50, w: 50, h: 50, score: 0.9}, {x: 400, y: 200, w: 60, h: 60, score: 0.99}],
    [{x: 104, y: 51, w: 51, h: 50, score: 0.88}],
    [{x: 98, y: 53, w: 49, h: 52, score: 0.91}],
    [],
    [{x: 102, y: 49, w: 50, h: 50, score: 0.9}]
  ];
  const tracked = selectTrackedFace(frames, {minimumFrames: 3, withFaces: true});
  assert.ok(tracked);
  assert.equal(tracked.faces.length, 4, 'la muestra vacia queda fuera del track');
  // `frame` es la referencia al array de detecciones de la muestra: con el se
  // recupera el indice temporal sin rehacer la agrupacion.
  assert.deepEqual(
    tracked.faces.map((face) => frames.indexOf(face.frame)),
    [0, 1, 2, 3].map((index) => [0, 1, 2, 4][index])
  );
  // Sin la opcion, la salida se mantiene como antes.
  assert.ok(!('faces' in selectTrackedFace(frames, {minimumFrames: 3})));
});

test('el build propaga el focusTrack del clip y un focus del plan lo anula', async (t) => {
  const slug = `test-focus-track-${process.pid}`;
  const project = projectDir(slug);
  const cleanup = async () => {
    await rm(project, {recursive: true, force: true});
    // El build regenera el registro incluyendo este proyecto temporal; al
    // borrarlo hay que regenerar otra vez para dejarlo sincronizado.
    await writeShortsRegistry();
  };
  t.after(cleanup);
  try {
    await writeJson(path.join(project, 'manifest.json'), {
      slug,
      clips: [{
        id: '01',
        file: 'projects/shorts/x/clips/01.mp4',
        durationSeconds: 8,
        width: 1920,
        height: 1080,
        fps: 30,
        focus: {x: 0.5, y: 0.42},
        focusTrack: FOCUS_TRACK,
        transcript: null,
        wordCount: 0
      }],
      assets: []
    });
    await writeJson(path.join(project, 'short-plan.json'), {
      scenes: [
        {id: 'libre', clipId: '01', layout: 'full', trim: {start: 0, end: 4}},
        {id: 'fijo', clipId: '01', layout: 'full', trim: {start: 4, end: 8}, focus: {x: 0.5, y: 0.5}}
      ]
    });
    const build = await buildShort({slug});
    const libre = build.scenes.find((scene) => scene.id === 'libre');
    const fijo = build.scenes.find((scene) => scene.id === 'fijo');
    assert.deepEqual(libre.focusTrack, FOCUS_TRACK);
    assert.equal(fijo.focusTrack, null, 'el focus declarado en el plan manda sobre el tracking');
    assert.deepEqual(fijo.focus, {x: 0.5, y: 0.5});
  } finally {
    await cleanup();
  }
});
