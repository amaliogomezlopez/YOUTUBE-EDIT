import assert from 'node:assert/strict';
import {writeShortsRegistry} from '../src/modules/shorts-studio/registry.js';
import {rm} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {buildShort} from '../src/modules/shorts-studio/build.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {fitLayout, pipLayout, PIP_CARD} from '../src/modules/shorts-studio/pip-layout.js';
import {buildVerticalFilter} from '../src/lib/ffmpeg.js';
import {writeJson} from '../src/lib/utils.js';


test('el montaje de detalle centra pip, fit y comparaciones con margenes iguales', async () => {
  const slug = 'test-pantalla-centrada-' + process.pid;
  const project = projectDir(slug);
  try {
    await writeJson(path.join(project,'manifest.json'),{slug,clips:[{id:'01',file:'unused.mp4',durationSeconds:5,width:1920,height:1080,fps:30,focus:{x:.5,y:.42},transcript:null}],assets:[]});
    const box={x:1500,y:40,w:320,h:400};
    await writeJson(path.join(project,'short-plan.json'),{sound:{enabled:false},scenes:[
      {id:'pip',clipId:'01',layout:'pip',webcamBox:box,screenEmphasis:true},
      {id:'fit',clipId:'01',layout:'fit',screenEmphasis:true},
      {id:'comparacion',clipId:'01',layout:'fit',comparison:[{x:0,y:0,w:960,h:1080,label:'A'},{x:960,y:0,w:960,h:1080,label:'B'}]}
    ]});
    const result=await buildShort({slug});
    const panels=[result.scenes[0].pip.screen,result.scenes[1].fit.screen,...result.scenes[2].comparison.map(c=>c.slot)];
    for(const panel of panels) {
      assert.equal(panel.left,90);
      assert.equal(panel.left,result.format.width-panel.left-panel.width);
    }
  } finally {
    await rm(project,{recursive:true,force:true});
    await writeShortsRegistry();
  }
});

test('la tarjeta de cara cabe en 540 y arranca a 80 px del borde superior', () => {
  const layout = pipLayout({x: 1400, y: 700, w: 320, h: 240}, {sourceWidth: 1920, sourceHeight: 1080});
  assert.equal(layout.camCard.top, 80);
  assert.equal(layout.camCard.radius, 28);
  assert.equal(layout.camCard.stroke, 3);
  assert.ok(layout.camCard.width <= PIP_CARD.maxWidth + layout.camCard.stroke * 2);
  assert.equal(layout.screen.left, 0);
  assert.equal(layout.screen.width, 1080);
  assert.ok(layout.screen.top >= layout.camCard.top + layout.camCard.height + 180);
  assert.equal(layout.captionBand.height, PIP_CARD.screenGap);
  assert.equal(layout.captionBand.top, layout.camCard.top + layout.camCard.height);
  assert.equal(layout.captionBand.bottom, layout.screen.top);
  assert.equal(layout.screen.top + layout.screen.height, 1920);
});

test('la pantalla cubre el hueco restante y no usa el recorte 1600/-130', () => {
  const layout = pipLayout({x: 1400, y: 700, w: 320, h: 240}, {sourceWidth: 1920, sourceHeight: 1080});
  assert.equal(layout.screen.left, 0);
  assert.ok(layout.screen.width === 1080);
  assert.ok(layout.cover.scale > 1, 'cover agranda el 16:9 para llenar el hueco vertical');
  const small = pipLayout({x: 10, y: 5, w: 100, h: 100}, {sourceWidth: 1920, sourceHeight: 1080});
  assert.ok(small.camCard.width >= PIP_CARD.minWidth);
});

test('el filtergraph de FFmpeg ya no pega la pantalla en x=-130 ni usa pad negro', () => {
  const filter = buildVerticalFilter({
    mode: 'pip',
    webcamBox: {x: 1400, y: 700, w: 320, h: 240},
    sourceWidth: 1920,
    sourceHeight: 1080
  });
  assert.equal(filter.includes('overlay=-130:'), false);
  assert.equal(filter.includes('pad=iw+12:ih+12:6:6:black'), false);
  assert.match(filter, /pad=iw\+6:ih\+6:3:3:white/);
  assert.match(filter, /format=rgba,geq=/);
  assert.match(filter, /colorchannelmixer=aa=0.35,boxblur=16:4/);
  assert.match(filter, /overlay=0:\d+/);
  assert.equal(filter.includes('overlay=0:520'), false);
});

test('sin webcamBox no hay layout pip', () => {
  assert.throws(() => pipLayout(null, {sourceWidth: 1920, sourceHeight: 1080}), /webcamBox/);
});

test('fit centra el video a 1080 de ancho manteniendo la proporcion', () => {
  assert.deepEqual(fitLayout({sourceWidth: 1920, sourceHeight: 1080}), {
    screen: {left: 0, top: 656, width: 1080, height: 608}
  });
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
    await rm(project, {recursive: true, force: true});
  }
});
