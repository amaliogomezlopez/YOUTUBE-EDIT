import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {buildShort} from '../src/modules/shorts-studio/build.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {fitLayout, pipLayout} from '../src/modules/shorts-studio/pip-layout.js';
import {writeJson} from '../src/lib/utils.js';

// Los numeros se verifican contra el filtergraph de `src/lib/ffmpeg.js`
// (`pipLayoutForWebcamBox` + `buildVerticalFilter`): el PIP de Remotion tiene
// que salir igual que el que ya renderiza el pipeline de video largo.

test('la tarjeta de cara crece x2.5 con techo 650 y suelo 360', () => {
  const layout = pipLayout({x: 1400, y: 700, w: 320, h: 240}, {sourceWidth: 1920, sourceHeight: 1080});
  // 320 * 2.5 = 800, capado a 650. La tarjeta incluye el borde negro de 6 px.
  assert.deepEqual(layout.camCard, {left: 209, top: 42, width: 662, height: 500});
  assert.deepEqual(layout.camCrop, {
    scale: 2.03125,
    offsetX: -2843.75,
    offsetY: -1421.87,
    videoWidth: 3900,
    videoHeight: 2193.75
  });

  const small = pipLayout({x: 10, y: 5, w: 100, h: 100}, {sourceWidth: 1920, sourceHeight: 1080});
  // 100 * 2.5 = 250, elevado al minimo 360.
  assert.equal(small.camCard.width, 372);
  // 42 + 372 + 42 = 456 < 520: la pantalla nunca sube del minimo.
  assert.equal(small.screen.top, 520);
});

test('la pantalla va a 1600 de ancho en x=-130 y la mascara replica los margenes', () => {
  const layout = pipLayout({x: 1400, y: 700, w: 320, h: 240}, {sourceWidth: 1920, sourceHeight: 1080});
  // screenY = max(520, 42 + (488+12) + 42) = 584; alto par de 1600x1080/1920.
  assert.deepEqual(layout.screen, {left: -130, top: 584, width: 1600, height: 900});
  // Mascara fuente (1376, 682, 374, 282) proyectada sobre la pantalla a 1600.
  assert.deepEqual(layout.mask, {left: 1016.67, top: 1152.33, width: 311.67, height: 235});

  // Cerca del borde la mascara no sale del frame: los margenes 24/18 se capan a 0.
  const corner = pipLayout({x: 10, y: 5, w: 100, h: 100}, {sourceWidth: 1920, sourceHeight: 1080});
  assert.equal(corner.mask.left, -130, 'maskX = max(0, x-24) = 0 -> borde izquierdo de la pantalla');
  assert.equal(corner.mask.top, 520, 'maskY = max(0, y-18) = 0 -> borde superior de la pantalla');
  // (100+54) y (100+42) escalados por 1600/1920.
  assert.equal(corner.mask.width, 128.33);
  assert.equal(corner.mask.height, 118.33);
});

test('sin webcamBox no hay layout pip', () => {
  assert.throws(() => pipLayout(null, {sourceWidth: 1920, sourceHeight: 1080}), /webcamBox/);
});

test('fit centra el video a 1080 de ancho manteniendo la proporcion', () => {
  assert.deepEqual(fitLayout({sourceWidth: 1920, sourceHeight: 1080}), {
    screen: {left: 0, top: 656, width: 1080, height: 608}
  });
  // Un clip vertical ya llena el frame: centrado es top 0.
  assert.deepEqual(fitLayout({sourceWidth: 1080, sourceHeight: 1920}), {
    screen: {left: 0, top: 0, width: 1080, height: 1920}
  });
});

test('el build rechaza una escena pip sin webcamBox', async () => {
  const slug = `test-pip-sin-webcam-${process.pid}`;
  const project = projectDir(slug);
  try {
    await writeJson(path.join(project, 'manifest.json'), {
      slug,
      clips: [{
        id: '01',
        file: 'projects/shorts/x/clips/01.mp4',
        durationSeconds: 5,
        width: 1920,
        height: 1080,
        fps: 30,
        focus: {x: 0.5, y: 0.42},
        transcript: null,
        wordCount: 0
      }],
      assets: []
    });
    await writeJson(path.join(project, 'short-plan.json'), {
      scenes: [{id: 'a', clipId: '01', layout: 'pip'}]
    });
    await assert.rejects(buildShort({slug}), /webcamBox/);
  } finally {
    // El error salta antes de escribir short-build.json, asi que el proyecto
    // nunca llega a aparecer en el registro de composiciones.
    await rm(project, {recursive: true, force: true});
  }
});
