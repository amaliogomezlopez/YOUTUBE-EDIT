import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  compileEscaleta, escaletaTemplate, loadDecisionTables, phrasesOf, transcriptMarkdown, validateEscaleta
} from '../src/modules/intro-viral/escaleta.js';
import {validateAssetRequests} from '../src/modules/intro-viral/assets.js';
import {fixForRule, reviewMoments} from '../src/modules/intro-viral/workflow.js';
import {parseEbur128} from '../src/modules/video-studio/media-review.js';
import {publicFilesIn} from '../src/modules/video-studio/render-public.js';
import {CAMERAS, LAYOUTS, TRANSITIONS} from '../src/modules/intro-studio/constants.js';
import {resolveIntroProfile} from '../src/modules/intro-studio/profiles.js';

const tables = loadDecisionTables();

/** Palabras sinteticas: `spec` es una lista de [texto, duracion, silencioDespues]. */
function wordsOf(spec, start = 0.2) {
  let t = start;
  return spec.map(([text, duration = 0.3, gap = 0.05], index) => {
    const word = {index, text, start: Math.round(t * 1000) / 1000, end: Math.round((t + duration) * 1000) / 1000};
    t += duration + gap;
    return word;
  });
}
const plain = (n, gapAt = {}) => wordsOf(Array.from({length: n}, (_, i) => [`p${i}`, 0.3, gapAt[i] ?? 0.05]));

function fixture() {
  const w1 = plain(30, {9: 0.7});
  const w2 = plain(20);
  const manifest = {
    clips: [
      {id: '01', sourceName: '1.mkv', durationSeconds: w1.at(-1).end + 1, transcript: 't/01.json'},
      {id: '02', sourceName: '2.mkv', durationSeconds: w2.at(-1).end + 1, transcript: 't/02.json'}
    ],
    assets: [
      {id: 'portada', kind: 'image'},
      {id: 'demo', kind: 'video', durationSeconds: 6}
    ],
    music: {bpm: 120}
  };
  const transcripts = {'01': {words: w1}, '02': {words: w2}};
  const beats = Array.from({length: 200}, (_, i) => i * 0.5);
  return {manifest, transcripts, beats};
}

const baseEscaleta = () => ({
  accentColor: '#D97757',
  titular: {text: 'Producto X', kicker: 'Lo nuevo', clip: '02', atWord: 2},
  scenes: [
    {id: 'a', clip: '01', from: 0, to: 14, intent: 'gancho', hitWord: 3},
    {id: 'b', clip: '01', from: 15, to: 22, intent: 'mostrar', broll: 'demo', keyword: {text: 'Una demo real', atWord: 17}},
    {id: 'c', clip: '01', from: 23, to: 29, intent: 'enfasis', hitWord: 26, keyword: {text: '100 $ al mes', atWord: 25, money: 'precio del plan'}},
    {id: 'd', clip: '02', from: 0, to: 9, intent: 'noticia', asset: {id: 'portada', atWord: 0}},
    {id: 'e', clip: '02', from: 10, to: 19, intent: 'cifra', stat: {text: '+25 %', note: 'de uso', atWord: 12}}
  ]
});

test('las tablas de decision solo usan vocabulario de intro-studio y del perfil', () => {
  const profile = resolveIntroProfile(tables.profileId);
  for (const [id, intent] of Object.entries(tables.intents)) {
    for (const layout of intent.layouts) assert.ok(LAYOUTS.has(layout), `${id}: layout ${layout}`);
    for (const camera of intent.cameras) assert.ok(CAMERAS.has(camera), `${id}: camara ${camera}`);
    if (intent.effect) assert.ok(profile.effectAllowlist.includes(intent.effect.id), `${id}: efecto ${intent.effect.id}`);
    assert.ok(intent.when, `${id} necesita "when" para que el agente sepa cuando usarla`);
  }
  const t = tables.transitions;
  for (const value of [t.sameShot, t.silenceJump, t.newClip, t.intoFrame, t.outOfBroll, t.intoColumn, ...t.intoInsert]) {
    assert.ok(TRANSITIONS.has(value), value);
  }
});

test('las frases se parten en silencios largos y en tramos de ~4,5 s', () => {
  const words = plain(40, {12: 0.8});
  const phrases = phrasesOf(words);
  assert.ok(phrases.some((p) => p.to === 12), 'el silencio de 0,8 s separa');
  for (const p of phrases) assert.ok(p.end - p.start <= 6, `frase de ${p.end - p.start}s`);
  assert.equal(phrases[0].from, 0);
  assert.equal(phrases.at(-1).to, 39);
  for (let i = 1; i < phrases.length; i++) assert.equal(phrases[i].from, phrases[i - 1].to + 1, 'contiguas');
});

test('la plantilla cubre las tomas enteras y empieza con gancho', () => {
  const {manifest, transcripts} = fixture();
  const template = escaletaTemplate({slug: 'x', manifest, transcripts});
  assert.equal(template.scenes[0].intent, 'gancho');
  assert.equal(template.textStyle, 'anton-impacto', 'eleccion del usuario');
  assert.equal(template.accentColor, '#FFD60A');
  const {errors} = validateEscaleta(template, {manifest, transcripts});
  assert.deepEqual(errors, []);
  const md = transcriptMarkdown({manifest, transcripts});
  assert.match(md, /9:p9 ‖0\.7s/);
});

test('una escaleta correcta valida sin errores', () => {
  const {manifest, transcripts} = fixture();
  assert.deepEqual(validateEscaleta(baseEscaleta(), {manifest, transcripts}).errors, []);
});

test('la validacion explica cada error de escaleta', () => {
  const {manifest, transcripts} = fixture();
  const cases = [
    [(e) => { e.scenes[0].intent = 'frase'; }, /primera escena tiene que ser `gancho`/],
    [(e) => { e.scenes[1].intent = 'bailar'; }, /intent "bailar" no existe/],
    [(e) => { e.scenes[1].to = 20; }, /faltan las palabras 21-22/],
    [(e) => { e.scenes[1].keyword.text = 'una frase demasiado larga para abajo'; }, /6 palabras/],
    [(e) => { e.scenes[4].stat.money = 'porcentaje'; }, /solo vale para cifras de dinero/],
    [(e) => { e.scenes[4].stat.text = '1.000.000 $'; }, /1-6 caracteres/],
    [(e) => { e.scenes[3].stat = {text: '2', atWord: 1}; }, /`stat` no vale en una escena `noticia`/],
    [(e) => { e.scenes[1].broll = 'inexistente'; }, /broll "inexistente" no esta ingerido/],
    [(e) => { e.scenes[3].asset.id = 'demo'; }, /en primer plano solo van imagenes/],
    [(e) => { e.scenes[2].hitWord = 2; }, /hitWord 2 fuera de la escena/],
    [(e) => { e.accentColor = 'naranja'; }, /accentColor/],
    [(e) => { e.scenes.splice(2, 0, e.scenes.splice(3, 1)[0]); }, /no se vuelve a una toma ya cerrada/]
  ];
  for (const [mutate, expected] of cases) {
    const escaleta = baseEscaleta();
    mutate(escaleta);
    const {errors} = validateEscaleta(escaleta, {manifest, transcripts});
    assert.ok(errors.some((e) => expected.test(e)), `${expected}: ${errors.join(' | ')}`);
  }
});

test('una palabra clave que transcribe la locucion da aviso', () => {
  const {manifest, transcripts} = fixture();
  const escaleta = baseEscaleta();
  escaleta.scenes[1].keyword = {text: 'p15 p16 p17 p18', atWord: 17};
  const {errors, warnings} = validateEscaleta(escaleta, {manifest, transcripts});
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /repite la locucion/.test(w)));
});

test('la compilacion corta al beat, parte en silencios y calcula transiciones y sonido', () => {
  const {manifest, transcripts, beats} = fixture();
  // La columna lateral es de la v3; el estilo por defecto del perfil (Anton) la hace flotar.
  const {plan, report} = compileEscaleta({...baseEscaleta(), textStyle: 'v3-fraunces'}, {manifest, transcripts, beats});
  const byId = Object.fromEntries(plan.scenes.map((s) => [s.id, s]));

  // El silencio de 0,7 s tras la palabra 9 parte el gancho en dos (jump cut).
  assert.ok(byId['a-b'], 'el gancho se parte en el silencio');
  assert.equal(report.silenceSplits, 1);
  assert.equal(byId['a-b'].transitionIn, 'cut');
  assert.ok(byId['a-b'].trim.start > transcripts['01'].words[9].end + 0.5, 'el silencio se quita');

  // Cada frontera cae en beat (reloj de la pieza), salvo las que el informe declara.
  let clock = 0;
  let offBeat = 0;
  for (const scene of plan.scenes) {
    clock += Math.round((scene.trim.end - scene.trim.start) * 60) / 60;
    if (Math.abs(clock - Math.round(clock / 0.5) * 0.5) > 0.03) offBeat++;
  }
  assert.equal(offBeat, report.offBeatCuts);
  assert.ok(offBeat <= 1, `${offBeat} cortes fuera de beat`);

  assert.equal(byId.b.layout, 'insert');
  assert.equal(byId.b.transitionIn, 'slide-up');
  assert.deepEqual(byId.b.backdrop, {assetId: 'demo', motion: 'slow-zoom', opacity: 1});
  assert.equal(byId.b.cues[0].slot, 'lower-left');
  assert.equal(byId.b.cues[0].sound, false);
  assert.equal(byId.c.transitionIn, 'whip', 'salir de un b-roll');
  assert.equal(byId.c.cues[0].soundUse, 'money');
  assert.equal(byId.c.effects[0].id, 'zoom-punch');
  assert.ok(Number.isInteger(byId.c.effects[0].atBeat));
  assert.equal(byId.d.transitionIn, 'flash-cut', 'toma nueva');
  // La portada entra con la transicion: no suenan dos cosas a la vez.
  assert.equal(byId.d.cues.find((c) => c.type === 'screenshot').sound, false);
  assert.equal(byId.e.layout, 'hero-left');
  assert.equal(byId.e.cues[0].slot, 'fore-right');
  assert.equal(plan.profileId, 'hype-apertura');
  assert.equal(plan.sound.library, 'SONIDOS-REELS');
  assert.ok(Number.isInteger(plan.titleCard.atBeat));
});

test('nunca repite camara en dos escenas seguidas', () => {
  const {manifest, transcripts, beats} = fixture();
  const escaleta = baseEscaleta();
  escaleta.scenes[2].intent = 'frase';
  delete escaleta.scenes[2].hitWord;
  const {plan} = compileEscaleta(escaleta, {manifest, transcripts, beats});
  for (let i = 1; i < plan.scenes.length; i++) {
    if (plan.scenes[i].camera === 'static') continue;
    assert.notEqual(plan.scenes[i].camera, plan.scenes[i - 1].camera, plan.scenes[i].id);
  }
});

const referenceProject = path.resolve('remotion-animations/projects/intro-opus-5-5');
test('la escaleta de referencia de la skill sigue siendo valida', {skip: !existsSync(path.join(referenceProject, 'manifest.json'))}, () => {
  const manifest = JSON.parse(readFileSync(path.join(referenceProject, 'manifest.json'), 'utf8'));
  const transcripts = Object.fromEntries(manifest.clips.map((c) => [c.id, JSON.parse(readFileSync(path.join(referenceProject, c.transcript), 'utf8'))]));
  const escaleta = JSON.parse(readFileSync('.claude/skills/intro-viral/references/escaleta.opus-5-5.json', 'utf8'));
  assert.deepEqual(validateEscaleta(escaleta, {manifest, transcripts}).errors, []);
});

test('el contrato de recursos exige id, fuente, tramo y motivo', () => {
  assert.deepEqual(validateAssetRequests({assets: [
    {id: 'portada', kind: 'web', url: 'https://example.com/a', reason: 'se nombra'},
    {id: 'demo', kind: 'youtube', url: 'https://youtube.com/watch?v=1', start: 3, duration: 6, reason: 'se describe'}
  ]}), []);
  const errors = validateAssetRequests({assets: [
    {id: 'Mal Id', kind: 'web', url: 'http://inseguro', reason: 'x'},
    {id: 'demo', kind: 'youtube', url: 'https://youtube.com/watch?v=1', reason: 'x'},
    {id: 'largo', kind: 'local', path: 'a.mp4', start: 0, duration: 30, reason: 'x'},
    {id: 'music', kind: 'image', url: 'https://a/b.png'}
  ]});
  for (const pattern of [/minusculas/, /https obligatoria/, /start` y `duration/, /fragmentos de 4-8 s/, /reservado/, /reason/]) {
    assert.ok(errors.some((e) => pattern.test(e)), `${pattern}: ${errors.join(' | ')}`);
  }
});

test('la sonoridad se lee del resumen de ebur128', () => {
  const stderr = '[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -14.3 LUFS\n    Threshold: -24.5 LUFS\n\n  Loudness range:\n    LRA:         6.1 LU\n\n  True peak:\n    Peak:       -1.2 dBFS\n';
  assert.deepEqual(parseEbur128(stderr), {integrated: -14.3, range: 6.1, truePeak: -1.2});
});

test('el public aislado solo recoge ficheros de media que existen', () => {
  const found = publicFilesIn({a: 'fonts/fraunces-latin-ext-variable.woff2', b: ['sfx/no-existe.wav', 'texto'], c: {d: '../fuera.png'}},
    path.resolve('remotion-animations/public'));
  assert.deepEqual([...found], ['fonts/fraunces-latin-ext-variable.woff2']);
});

test('la hoja de revision toma un fotograma por escena, 20 como maximo', () => {
  const scene = (id, from) => ({id, from, durationInFrames: 120, layout: 'hero', cues: [{type: 'keyword', fromFrame: 10, text: 'Hola mundo'}]});
  const build = {format: {fps: 60}, scenes: Array.from({length: 30}, (_, i) => scene(`s${i}`, i * 120))};
  const moments = reviewMoments(build);
  assert.equal(moments.length, 20);
  assert.equal(moments[0].seconds, 55 / 60);
  assert.match(moments[0].label, /s0 · hero · Hola mundo/);
  assert.match(fixForRule('IN-R-042'), /Nunca subas el techo/);
});

test('cada estilo de texto se resuelve y solo usa fuentes cargadas en fonts.ts', async () => {
  const {resolveTextStyle, textStyleIds} = await import('../src/modules/intro-studio/text-styles.js');
  const fontsTs = readFileSync('remotion-animations/src/motion/fonts.ts', 'utf8');
  const loaded = new Set([...fontsTs.matchAll(/_FAMILY = "([^"]+)"/g)].map((m) => m[1]));
  for (const id of textStyleIds()) {
    const style = resolveTextStyle(id);
    for (const family of [style.display.family, style.label.family, style.stat.family, style.title?.family].filter(Boolean)) {
      assert.ok(loaded.has(family), `${id}: la fuente ${family} no esta cargada en fonts.ts`);
    }
  }
  assert.equal(resolveTextStyle().id, 'v3-fraunces', 'sin estilo, la v3 aprobada');
  assert.throws(() => resolveTextStyle('no-existe'), /no existe/);
});

test('con cifra flotante la escena cifra va sobre la camara, sin columna', () => {
  const {manifest, transcripts, beats} = fixture();
  const escaleta = {...baseEscaleta(), textStyle: 'serif-editorial'};
  assert.deepEqual(validateEscaleta(escaleta, {manifest, transcripts}).errors, []);
  const {plan} = compileEscaleta(escaleta, {manifest, transcripts, beats});
  const cifra = plan.scenes.find((s) => s.id === 'e');
  assert.equal(cifra.layout, 'hero');
  assert.ok(['fore-left', 'fore-right'].includes(cifra.cues[0].slot));
  assert.equal(plan.textStyleId, 'serif-editorial');
  const bad = validateEscaleta({...baseEscaleta(), textStyle: 'comic-sans'}, {manifest, transcripts});
  assert.ok(bad.errors.some((e) => /textStyle "comic-sans" no existe/.test(e)));
});

test('la plantilla de versiones solo nombra estilos que existen', async () => {
  const {textStyleIds} = await import('../src/modules/intro-studio/text-styles.js');
  const {variantsTemplate, comparisonMoments} = await import('../src/modules/intro-viral/workflow.js');
  for (const v of variantsTemplate().variants) {
    assert.ok(textStyleIds().includes(v.textStyle), v.textStyle);
    assert.match(v.id, /^[a-z0-9-]+$/);
    assert.match(v.accentColor, /^#[0-9A-F]{6}$/i);
  }
  const scene = (id, layout, cue) => ({id, from: 0, durationInFrames: 200, layout, cues: [cue]});
  const moments = comparisonMoments({format: {fps: 60}, titleCard: {fromFrame: 100},
    scenes: [scene('k', 'hero', {type: 'keyword', fromFrame: 0}), scene('i', 'insert', {type: 'keyword', fromFrame: 0}), scene('s', 'hero', {type: 'stat', fromFrame: 0})]});
  assert.deepEqual(moments.map((m) => m.label).sort(), ['b-roll + palabra', 'cifra', 'palabra clave', 'titular']);
});

test('las preferencias de sonido ordenan cada situacion y quitan los descartados', async () => {
  const {userSoundPalette, applySoundPreferences} = await import('../src/modules/intro-studio/sound.js');
  const entry = (name, use, durationSeconds = 0.2) => ({sourceName: name, use, durationSeconds, file: `sfx/${name}.wav`});
  const entries = [entry('whip', 'transition'), entry('pop', 'transition'), entry('shutter', 'transition'), entry('grave', 'impact-low'), entry('riser', 'intro', 1.7)];
  const base = userSoundPalette({entries});
  const prefs = {situaciones: {'entrar-broll': ['pop', 'whip'], 'golpe-palabra': ['grave']}, descartados: ['shutter']};
  const result = applySoundPreferences(base, entries, prefs);
  assert.deepEqual(result.palette.whoosh, ['sfx/pop.wav', 'sfx/whip.wav'], 'orden del usuario');
  assert.ok(result.ownRotation.has('whoosh'));
  assert.ok(!result.palette.whip.includes('sfx/shutter.wav'), 'descartado fuera de las rotaciones');
  assert.deepEqual(result.palette.boom, ['sfx/grave.wav']);
  assert.equal(result.openingRiser, 'sfx/riser.wav');
  assert.throws(() => applySoundPreferences(base, entries, {situaciones: {dinero: ['no-existe']}}), /no esta en SONIDOS-REELS/);
  assert.equal(applySoundPreferences(base, entries, null), base, 'sin preferencias, nada cambia');
});

test('el compilador pide la familia de sonido de cada situacion', () => {
  const {manifest, transcripts, beats} = fixture();
  const {plan} = compileEscaleta(baseEscaleta(), {manifest, transcripts, beats});
  const byId = Object.fromEntries(plan.scenes.map((s) => [s.id, s]));
  assert.equal(byId.b.transitionSound, 'whoosh', 'entrar a un b-roll');
  assert.equal(byId.c.transitionSound, 'whip', 'volver a camara');
  assert.equal(byId.d.transitionSound, 'shutter', 'toma nueva');
  assert.equal(byId['a-b'].transitionSound, undefined, 'corte seco mudo');
});

test('agenda: lista numerada y recordatorio con el punto activo', () => {
  const {manifest, transcripts, beats} = fixture();
  const escaleta = baseEscaleta();
  escaleta.scenes[1] = {id: 'b', clip: '01', from: 15, to: 22, intent: 'agenda', agenda: {items: [{text: 'Primer motivo'}, {text: 'Segundo motivo', atWord: 20}]}};
  escaleta.scenes[2] = {...escaleta.scenes[2], agendaPoint: {of: 'b', item: 2}};
  delete escaleta.scenes[2].keyword;
  assert.deepEqual(validateEscaleta(escaleta, {manifest, transcripts}).errors, []);
  const {plan} = compileEscaleta(escaleta, {manifest, transcripts, beats});
  const list = plan.scenes.find((s) => s.id === 'b').cues[0];
  assert.equal(list.type, 'list');
  assert.equal(list.slot, 'agenda');
  assert.deepEqual(list.items, [{text: 'Primer motivo'}, {text: 'Segundo motivo', atWord: 20}]);
  assert.equal(list.sound, false);
  const recall = plan.scenes.find((s) => s.id === 'c').cues.find((c) => c.type === 'list');
  assert.equal(recall.active, 1, 'el punto 2 se cuenta desde 1 en la escaleta');

  const bad = structuredClone(escaleta);
  bad.scenes[2].agendaPoint = {of: 'b', item: 3};
  bad.scenes[1].agenda.items[0].text = 'un punto con demasiadas palabras';
  const {errors} = validateEscaleta(bad, {manifest, transcripts});
  assert.ok(errors.some((e) => /tiene 2 puntos/.test(e)));
  assert.ok(errors.some((e) => /1-4 palabras/.test(e)));
});

test('comparar: dos cifras arriba, la primera muda y en tinta', () => {
  const {manifest, transcripts, beats} = fixture();
  const escaleta = baseEscaleta();
  escaleta.scenes[4] = {id: 'e', clip: '02', from: 10, to: 19, intent: 'comparar',
    pair: [{text: '20 $', note: 'Plan Pro', atWord: 11}, {text: '100 $', note: 'Plan Max', atWord: 15, money: 'precio del plan Max'}]};
  assert.deepEqual(validateEscaleta(escaleta, {manifest, transcripts}).errors, []);
  const {plan} = compileEscaleta(escaleta, {manifest, transcripts, beats});
  const [first, second] = plan.scenes.find((s) => s.id === 'e').cues;
  assert.equal(first.slot, 'top-left');
  assert.equal(first.tone, 'muted');
  assert.equal(first.sound, false);
  assert.equal(second.slot, 'top-right');
  assert.equal(second.soundUse, 'money');
  const bad = structuredClone(escaleta);
  bad.scenes[4].pair.pop();
  assert.ok(validateEscaleta(bad, {manifest, transcripts}).errors.some((e) => /exactamente dos cifras/.test(e)));
});

test('mostrar: la cara en tarjeta o en circulo, con su slot y su transicion', () => {
  const {manifest, transcripts, beats} = fixture();
  const card = baseEscaleta();
  card.scenes[1].face = 'tarjeta';
  let plan = compileEscaleta(card, {manifest, transcripts, beats}).plan;
  let scene = plan.scenes.find((s) => s.id === 'b');
  assert.equal(scene.layout, 'card-left');
  assert.equal(scene.cues[0].slot, 'lower-card');
  assert.equal(scene.transitionSound, 'whoosh');

  const circle = baseEscaleta();
  circle.scenes[1].face = 'circulo';
  plan = compileEscaleta(circle, {manifest, transcripts, beats}).plan;
  scene = plan.scenes.find((s) => s.id === 'b');
  assert.equal(scene.layout, 'circle');
  assert.equal(scene.transitionIn, 'page-curl');
  assert.equal(scene.transitionSound, 'paper');
  assert.equal(scene.cues[0].slot, 'lower-circle');

  const wrong = baseEscaleta();
  wrong.scenes[1].face = 'grande';
  assert.ok(validateEscaleta(wrong, {manifest, transcripts}).errors.some((e) => /face "grande" no existe/.test(e)));
});

test('los zooms suenan solo donde caben en el techo de respiro', () => {
  const {manifest, transcripts, beats} = fixture();
  const {plan, report} = compileEscaleta(baseEscaleta(), {manifest, transcripts, beats});
  const zooms = plan.scenes.filter((s) => s.cameraSound === 'camera');
  assert.equal(zooms.length, report.zoomSounds);
  for (const s of zooms) {
    assert.ok(['punch-in', 'snap-zoom', 'push-out'].includes(s.camera));
    assert.equal(s.transitionSound, undefined, 'un zoom no suena encima de una transicion');
  }
});

test('la subcarpeta apertura no entra en los Reels; dinero y riser por nombre si', async () => {
  const {describeReelSound} = await import('../src/modules/talking-head/sound-usage.js');
  assert.equal(describeReelSound('apertura/pop_4.mp3').use, 'library');
  assert.equal(describeReelSound('apertura\\camara_flash.mp3').use, 'library');
  assert.equal(describeReelSound('apertura/impacto-grave_hit-1.mp3').use, 'impact-low', 'el prefijo manda');
  assert.equal(describeReelSound('apertura/dinero_x.mp3').use, 'money', 'el uso semantico va antes que la carpeta');
});

test('repetir un sonido en preferencias le da mas peso en la rotacion', async () => {
  const {userSoundPalette, applySoundPreferences} = await import('../src/modules/intro-studio/sound.js');
  const entry = (name, use) => ({sourceName: name, use, durationSeconds: 0.2, file: `sfx/${name.replace(/[\\/]/g, '-')}.wav`});
  const entries = [entry('chunky', 'transition'), entry('apertura\\zoom', 'library')];
  const result = applySoundPreferences(userSoundPalette({entries}), entries, {situaciones: {zoom: ['chunky', 'apertura/zoom', 'chunky']}});
  assert.deepEqual(result.palette.camera, ['sfx/chunky.wav', 'sfx/apertura-zoom.wav', 'sfx/chunky.wav']);
});

test('la geometria nueva cabe en la zona segura', async () => {
  const {slotRect, insideSafeArea, INTRO_GEOMETRY} = await import('../src/modules/intro-studio/geometry.js');
  for (const slot of ['agenda', 'top-left', 'top-right', 'lower-card', 'lower-circle']) assert.ok(insideSafeArea(slotRect(slot)), slot);
  for (const layout of ['card-left', 'circle']) {
    const r = INTRO_GEOMETRY.subject[layout];
    assert.ok(r.left + r.width <= 1920 && r.top + r.height <= INTRO_GEOMETRY.safeBottom, layout);
  }
});

test('comparar: la primera cifra sigue en pantalla cuando sale la segunda', () => {
  const {manifest, transcripts, beats} = fixture();
  const escaleta = baseEscaleta();
  escaleta.scenes[4] = {id: 'e', clip: '02', from: 10, to: 19, intent: 'comparar',
    pair: [{text: '20 $', atWord: 10}, {text: '100 $', atWord: 18}]};
  const {plan} = compileEscaleta(escaleta, {manifest, transcripts, beats});
  const [first, second] = plan.scenes.find((s) => s.id === 'e').cues;
  const words = transcripts['02'].words;
  assert.ok(first.holdSeconds >= (words[18].start - words[10].start) + second.holdSeconds - 0.01);
});

test('las noticias se capturan por su titular; captura solo vale en web', () => {
  assert.deepEqual(validateAssetRequests({assets: [
    {id: 'noticia', kind: 'web', captura: 'titular', url: 'https://example.com/news/a', reason: 'se cita'}
  ]}), []);
  const errors = validateAssetRequests({assets: [
    {id: 'mal', kind: 'image', captura: 'titular', url: 'https://example.com/a.png', reason: 'x'},
    {id: 'raro', kind: 'web', captura: 'todo', url: 'https://example.com/a', reason: 'x'}
  ]});
  assert.equal(errors.filter((e) => /captura/.test(e)).length, 2);
});
