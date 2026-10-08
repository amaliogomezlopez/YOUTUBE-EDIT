import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraAt, cameraCrop, cameraExpression, cubicBezier, GLIDE} from '../src/modules/video-studio/camera-track.js';
import {framedProfile, classifyTake, cardRect, toCanvas, bubbleRect, zoomFor, patchReveal, sentenceEnd, defaultUntil, zoomCandidates, faceCrop, transcriptMarkdown, frameEditPlan, compileFramedPlan, CANVAS} from '../src/modules/youtube-studio/framed.js';

const profile = framedProfile();
const words = Array.from({length: 150}, (_, i) => ({start: i * 0.4, end: i * 0.4 + 0.3, text: i % 10 === 9 ? 'final.' : i === 20 ? '33%' : i === 60 ? 'fijaos' : 'palabra'}));
const clip = {id: '01', sourceName: '1.mkv', file: 'projects/youtube/demo/clips/01.mp4', width: 1920, height: 1080, durationSeconds: 60, words, focus: {faceHeightRatio: 0.23}};
const webcam = {x: 1374, y: 0, w: 546, h: 532};
const takes = {'01': {kind: 'screen', webcam, patchColor: '#101010'}};
const base = () => ({version: 1, kind: 'youtube-edit-plan', duration: 60, segments: [{clipId: '01', sourceName: '1.mkv', in: 0, out: 60, at: 0, zoom: 1, take: 0}],
  decisions: [{type: 'push', at: 3, from: 1, to: 1.1, seconds: 2}], warnings: [], pendingAssets: []});
const box = {x: 100, y: 300, w: 600, h: 300};

test('glide is the measured curve: slow start, soft landing, monotone', () => {
  assert.equal(cubicBezier(GLIDE, 0), 0);
  assert.equal(cubicBezier(GLIDE, 1), 1);
  assert.ok(cubicBezier(GLIDE, 0.1) < 0.1, 'arranca suave');
  assert.ok(cubicBezier(GLIDE, 0.9) > 0.95, 'aterriza suave');
  let prev = 0;
  for (let x = 0; x <= 1; x += 0.01) {const y = cubicBezier(GLIDE, x); assert.ok(y >= prev - 1e-9); prev = y;}
});

test('glide zoom keeps its fixed point still on screen', () => {
  const track = {keys: [{time: 0, zoom: 1, x: 0.5, y: 0.5}, {time: 1, zoom: 2.4, x: 0.3, y: 0.62, ease: 'glide'}]};
  const full = {x: 0, y: 0, w: 1920, h: 1080};
  const project = (p, t) => {const c = cameraCrop(full, cameraAt(track, t)); return {x: (p.x - c.x) * 1920 / c.w, y: (p.y - c.y) * 1080 / c.h};};
  // Fixed point F of the move: F = (x*z - 0.5) / (z - 1) for the end key from the rest key.
  const F = {x: (0.3 * 2.4 - 0.5) / 1.4 * 1920, y: (0.62 * 2.4 - 0.5) / 1.4 * 1080};
  for (const t of [0, 0.2, 0.5, 0.8, 1]) {
    const q = project(F, t);
    assert.ok(Math.abs(q.x - F.x) < 0.01 && Math.abs(q.y - F.y) < 0.01, `punto fijo quieto en t=${t}`);
  }
  assert.throws(() => cameraExpression(track, 'zoom'), /smooth/);
});

test('webcam panel and camera takes are told apart', () => {
  assert.deepEqual(classifyTake(clip, {sourceBox: webcam, x: 1, y: 1, w: 2, h: 2}), {kind: 'screen', webcam});
  assert.equal(classifyTake({focus: {faceHeightRatio: 0.44}}, {method: 'talking-head-face', faceBox: {}}).kind, 'camera');
  assert.deepEqual(classifyTake(clip, null), {kind: 'screen', webcam: null});
});

test('stage geometry: centred card, bubble over the embedded panel, zoom inside canvas', () => {
  const card = cardRect(profile, clip);
  assert.ok(Math.abs(card.x - (1920 - card.w) / 2) < 1e-9 && Math.abs(card.w / 1920 - profile.card.scale) < 1e-9);
  const bubble = bubbleRect(profile, card, webcam), r = toCanvas(webcam, card);
  assert.ok(bubble.x < r.x && bubble.y < r.y && bubble.x + bubble.w > r.x + r.w && bubble.y + bubble.h > r.y + r.h);
  assert.equal(patchReveal(r, bubble, {zoom: 1, x: 0.5, y: 0.5}), 0);
  const corner = {x: 1800, y: 900, w: 100, h: 80};
  const z = zoomFor(corner, profile);
  assert.equal(z.zoom, profile.zoom.maxZoom);
  const crop = cameraCrop({x: 0, y: 0, w: 1920, h: 1080}, z);
  assert.ok(crop.x + crop.w <= 1920 + 1e-6 && crop.y + crop.h <= 1080 + 1e-6);
});

test('candidates are numbers and pointing words of screen takes', () => {
  const found = zoomCandidates(base(), [clip], takes);
  assert.deepEqual(found.map((c) => [c.atWord, c.kind]), [[20, 'numero'], [60, 'senala']]);
  assert.equal(sentenceEnd(words, 20), 29);
});

test('zooms compile to glide keys, drop the face punch-ins and hold until the sentence ends', () => {
  const {errors, plan} = frameEditPlan(base(), {clips: [clip], takes, profile, zooms: [{clipId: '01', atWord: 20, box, reason: 'El 33 % de la tabla de la izquierda'}]});
  assert.deepEqual(errors, []);
  const pushes = plan.decisions.filter((d) => d.type === 'push');
  assert.equal(pushes.length, 2);
  assert.equal(pushes[0].reason, 'El 33 % de la tabla de la izquierda');
  const keys = plan.stage.camera.keys;
  assert.deepEqual(keys.map((k) => k.ease ?? null), [null, null, 'glide', 'linear', 'glide']);
  assert.ok(Math.abs(keys[3].time - words[defaultUntil(words, 20, profile.zoom)].end) < 1e-6);
  assert.ok(keys[3].zoom > keys[2].zoom, 'deriva lenta mientras se mantiene');
  assert.equal(keys.at(-1).zoom, 1);
  assert.ok(plan.segments.every((s) => !('zoom' in s)));
});

test('the build refuses trimmed words, tight rhythm and boxes that highlight nothing', () => {
  const trimmed = base();
  trimmed.segments[0].in = 10;
  trimmed.segments[0].out = 60;
  const run = (zooms, plan = base()) => frameEditPlan(plan, {clips: [clip], takes, profile, zooms}).errors.join('\n');
  assert.match(run([{clipId: '01', atWord: 20, box, reason: 'dato de la tabla'}], trimmed), /recortado/);
  assert.match(run([{clipId: '01', atWord: 20, box, reason: 'dato de la tabla'}, {clipId: '01', atWord: 32, box, reason: 'otro dato cercano'}]), /minGapSeconds/);
  assert.match(run([{clipId: '01', atWord: 20, box: {x: 0, y: 0, w: 1900, h: 1060}, reason: 'casi toda la pantalla'}]), /no destaca/);
  assert.match(run([{clipId: '01', atWord: 20, box: {x: 1800, y: 0, w: 400, h: 100}, reason: 'fuera de la toma'}]), /dentro de la toma/);
  assert.match(run([{clipId: '01', atWord: 20, box}]), /reason/);
  const many = [0, 1, 2, 3].map((k) => ({clipId: '01', atWord: 5 + k * 30, untilWord: 14 + k * 30, box, reason: 'zoom de prueba ' + k}));
  const short = {...profile, zoom: {...profile.zoom, minGapSeconds: 1}};
  assert.match(frameEditPlan(base(), {clips: [clip], takes, profile: short, zooms: many}).errors.join('\n'), /maxPerMinute/);
});

test('render plan: wallpaper and cards on the stage, bubble outside it and silent', () => {
  const {plan} = frameEditPlan(base(), {clips: [clip], takes, profile, zooms: [{clipId: '01', atWord: 20, box, reason: 'El 33 % de la tabla'}]});
  const rp = compileFramedPlan(plan, {clips: [clip], takes, profile, wallpaper: {file: 'C:/fondo.png', width: 1920, height: 1080}});
  const byId = Object.fromEntries(rp.layers.map((l) => [l.id, l]));
  assert.equal(rp.durationInFrames, 60 * CANVAS.fps);
  assert.ok(byId.wallpaper.stage && byId.wallpaper.fit === 'cover');
  assert.ok(byId['card-1'].stage && byId['card-1'].frame.radius > 0 && byId['card-1'].patches[0].color === '#101010');
  assert.ok(!byId['cam-1'].stage && byId['cam-1'].volume === 0 && byId['cam-1'].crop.w === webcam.w);
  assert.equal(rp.stage.camera.keys.length, plan.stage.camera.keys.length);
  assert.ok(rp.layers.indexOf(byId.wallpaper) < rp.layers.indexOf(byId['card-1']));
});

test('webcam panel flush with the top-right edges is read from its inner borders', async () => {
  const {panelFromFrames, consensusPanels} = await import('../src/modules/video-studio/webcam-panel.js');
  const W = 320, H = 180, media = {width: 1920, height: 1080};
  const frames = [0, 1, 2].map((n) => {
    const data = Buffer.alloc(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const panel = x >= 228 && y < 88;
      data[y * W + x] = panel ? 60 + ((x * 7 + y * 3 + n * 11) % 9) : (y % 12 < 2 && x % 40 < 25 ? 30 : 235);
    }
    return {width: W, height: H, data};
  });
  const face = {x: 1500, y: 120, w: 190, h: 250};
  const p = panelFromFrames(frames, face, media);
  assert.ok(Math.abs(p.x - 1368) <= 12 && p.y === 0 && p.x + p.w === 1920 && Math.abs(p.h - 528) <= 12, JSON.stringify(p));
  const agreed = consensusPanels({a: p, b: p, c: {...p, x: p.x + 30, w: p.w - 30}, d: null}, {d: face}, media);
  assert.equal(agreed.c.x, p.x, 'una lectura estrecha se ensancha a la mediana');
  assert.equal(agreed.d.method, 'consensus');
});

test('an excerpt keeps the stage curve and shifts media in time', async () => {
  const {excerptRenderPlan} = await import('../src/modules/youtube-studio/render-plan.js');
  const {plan} = frameEditPlan(base(), {clips: [clip], takes, profile, zooms: [{clipId: '01', atWord: 20, box, reason: 'El 33 % de la tabla'}]});
  const rp = compileFramedPlan(plan, {clips: [clip], takes, profile, wallpaper: {file: 'C:/fondo.png', width: 1920, height: 1080}});
  const cut = excerptRenderPlan(rp, 8.5, 12);
  assert.equal(cut.durationInFrames, 105);
  const card = cut.layers.find((l) => l.id === 'card-1');
  assert.ok(Math.abs(card.sourceIn - 8.5) < 1e-9 && card.from === 0);
  assert.ok(Math.abs(cameraAt(cut.stage.camera, 0.5).zoom - cameraAt(rp.stage.camera, 9).zoom) < 1e-9);
});

const faceClip = {id: '05', sourceName: '5.mkv', file: 'projects/youtube/demo/clips/05.mp4', width: 1920, height: 1080, durationSeconds: 60, words,
  focus: {faceHeightRatio: 0.44}, faceBox: {x: 800, y: 280, w: 360, h: 470}};
const camTakes = {'05': {kind: 'camera', webcam: null}};
const camBase = () => ({...base(), segments: [{clipId: '05', sourceName: '5.mkv', in: 0, out: 60, at: 0, take: 0}], decisions: []});
const catalog = {noticia: {id: 'noticia', kind: 'image', file: 'C:/a/noticia.png', width: 1600, height: 900}, demo: {id: 'demo', kind: 'video', file: 'C:/a/demo.mp4', width: 1920, height: 1080, durationSeconds: 3}};

test('camera variant: corner puts the asset in a card and the face in the bubble, cover hides the face but keeps the voice', () => {
  const shots = [{clipId: '05', atWord: 20, untilWord: 29, layout: 'corner', asset: 'noticia', reason: 'Se nombra la noticia'},
    {clipId: '05', atWord: 60, untilWord: 69, layout: 'cover', asset: 'demo', reason: 'Demo a pantalla completa'}];
  const {errors, plan} = frameEditPlan(camBase(), {clips: [faceClip], takes: camTakes, zooms: [], shots, assets: catalog, profile});
  assert.deepEqual(errors, []);
  const rp = compileFramedPlan(plan, {clips: [faceClip], takes: camTakes, profile, wallpaper: {file: 'C:/fondo.png', width: 1920, height: 1080}, assets: Object.values(catalog)});
  const faces = rp.layers.filter((l) => l.id.startsWith('face-'));
  assert.ok(faces.every((l) => l.volume === 1), 'la voz nunca se corta');
  const bubble = faces.find((l) => l.crop);
  assert.ok(bubble && bubble.rect.w < 600 && bubble.enter.from.w === 1920, 'la cara se encoge de pantalla completa a la burbuja');
  assert.ok(faces.some((l) => l.enter?.from?.w === bubble.rect.w), 'y vuelve a crecer');
  const card = rp.layers.find((l) => l.id.startsWith('shot-noticia'));
  assert.ok(card.stage && card.fit === 'contain' && card.enter.fade);
  const covers = rp.layers.filter((l) => l.id.startsWith('shot-demo'));
  assert.ok(covers.length >= 2 && covers.every((l) => !l.stage && l.rect.w === 1920), 'un video corto se repite y tapa todo');
  const crop = faceCrop(faceClip, profile.camera);
  assert.ok(crop.x <= 800 && crop.x + crop.w >= 1160 && crop.y <= 280 && crop.y + crop.h >= 750, 'el recorte contiene la cara');
});

test('camera variant rules: no zooms on a face take, shots need assets, no overlaps, long face-only stretches warn', () => {
  const run = (shots, zooms = []) => frameEditPlan(camBase(), {clips: [faceClip], takes: camTakes, zooms, shots, assets: catalog, profile});
  assert.match(run([], [{clipId: '05', atWord: 20, box, reason: 'zoom a la cara'}]).errors.join(), /planos\.json/);
  assert.match(run([{clipId: '05', atWord: 20, layout: 'corner', asset: 'nada', reason: 'recurso que falta'}]).errors.join(), /no existe/);
  assert.match(run([{clipId: '05', atWord: 20, layout: 'lado', asset: 'noticia', reason: 'layout raro'}]).errors.join(), /layout/);
  assert.match(run([{clipId: '05', atWord: 20, untilWord: 39, layout: 'corner', asset: 'noticia', reason: 'primero largo'},
    {clipId: '05', atWord: 30, untilWord: 39, layout: 'cover', asset: 'demo', reason: 'se solapa'}]).errors.join(), /solapa/);
  assert.match(run([]).plan.warnings.join(), /solo con tu cara/);
  assert.match(transcriptMarkdown(camBase(), [faceClip], camTakes), /`05:0-9`/);
});

test('asset requests that say where they go become shots; error pages are not news', async () => {
  const {draftShots} = await import('../src/modules/youtube-studio/framed.js');
  const {ERROR_PAGE} = await import('../src/modules/video-studio/page-capture.js');
  const requests = {assets: [{id: 'noticia', at: '05:20', until: '05:29', reason: 'Se cita la noticia'}, {id: 'demo', at: '05:60', reason: 'La demo'}, {id: 'suelto', reason: 'sin ancla'}]};
  assert.deepEqual(draftShots(requests, catalog).map((s) => [s.atWord, s.untilWord, s.layout]), [[20, 29, 'corner'], [60, undefined, 'cover']]);
  assert.ok(ERROR_PAGE.test('403 ERROR ERROR: The request could not be satisfied'));
  assert.ok(ERROR_PAGE.test('404 Not Found'));
  assert.ok(!ERROR_PAGE.test('OpenAI adds $500 Pro subscription, nerfs its existing $200 tier'));
});
