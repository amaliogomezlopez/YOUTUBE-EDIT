import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  EFFECT_SECONDS,
  EFFECTS,
  INTRO_FORMAT,
  REMOTION_ROOT,
  STRONG_EFFECTS,
  projectDir,
  staticPath
} from '../src/modules/intro-studio/constants.js';
import {
  BACK_SLOTS,
  INTRO_GEOMETRY,
  faceRectOnScreen,
  insideSafeArea,
  rectsOverlap,
  scaledRect,
  slotIds,
  slotRect
} from '../src/modules/intro-studio/geometry.js';
import {
  INTRO_PROFILES,
  introProfileIds,
  profileBudget,
  resolveIntroProfile
} from '../src/modules/intro-studio/profiles.js';
import {
  DEFAULT_CUE_SOUND,
  DEFAULT_EFFECT_SOUND,
  DEFAULT_TRANSITION_SOUND,
  SOUND_FAMILIES,
  soundFamilyIds
} from '../src/modules/intro-studio/sound.js';
import {compositionIdForSlug} from '../src/modules/intro-studio/registry.js';
import {estimatePhase, estimateTempo} from '../src/modules/video-studio/music.js';
import {loadIntroRules} from '../src/modules/intro-studio/rules/index.js';
import {runIntroRules} from '../src/modules/intro-studio/rules/index.js';

test('el formato de la intro es 1920x1080 a 60 fps', () => {
  assert.deepEqual(INTRO_FORMAT, {width: 1920, height: 1080, fps: 60});
  assert.equal(INTRO_GEOMETRY.width, INTRO_FORMAT.width);
  assert.equal(INTRO_GEOMETRY.height, INTRO_FORMAT.height);
});

test('staticPath separa la media de la intro de la del short', () => {
  assert.equal(staticPath('demo', 'clips', '01.mp4'), 'projects/intro/demo/clips/01.mp4');
});

test('el id de composicion mantiene los conectores en minuscula', () => {
  assert.equal(compositionIdForSlug('demo-canal'), 'Intro-Demo-Canal');
  assert.equal(compositionIdForSlug('modelos-vs-agentes'), 'Intro-Modelos-vs-Agentes');
});

test('todos los slots declarados caben en la zona segura', () => {
  const outside = slotIds().filter((slot) => !insideSafeArea(slotRect(slot)));
  assert.deepEqual(
    outside,
    [],
    'un slot que nace fuera de la zona segura convierte IN-R-030 en un aviso imposible de evitar'
  );
});

test('los slots de fondo existen y estan declarados como tales', () => {
  for (const slot of BACK_SLOTS) {
    assert.ok(slotRect(slot), `el slot de fondo ${slot} no tiene rectangulo`);
  }
  assert.ok(BACK_SLOTS.size >= 4, 'hacen falta varios slots de fondo para repartir logos');
});

test('escalar un slot lo mantiene centrado en su rectangulo', () => {
  const rect = {left: 100, top: 100, width: 200, height: 200};
  const scaled = scaledRect(rect, 0.5);
  assert.deepEqual(scaled, {left: 150, top: 150, width: 100, height: 100});
  // El centro no se mueve: es lo que permite escalar sin recolocar el slot.
  assert.equal(scaled.left + scaled.width / 2, rect.left + rect.width / 2);
});

test('un cue escalado por encima de 1 puede salirse de la zona segura', () => {
  const grown = scaledRect(slotRect('strip'), 1.4);
  assert.ok(!insideSafeArea(grown), 'ampliar un cue a lo ancho tiene que ser detectable');
});

test('rectsOverlap distingue contacto de solape', () => {
  const a = {left: 0, top: 0, width: 100, height: 100};
  assert.ok(rectsOverlap(a, {left: 50, top: 50, width: 100, height: 100}));
  // Dos rectangulos que solo comparten el borde no se pisan ningun pixel.
  assert.ok(!rectsOverlap(a, {left: 100, top: 0, width: 100, height: 100}));
});

test('la cara se proyecta dentro de la ventana del sujeto', () => {
  const face = faceRectOnScreen({
    faceBox: {x: 860, y: 300, w: 200, h: 240},
    clipWidth: 1920,
    clipHeight: 1080,
    focus: {x: 0.5, y: 0.42},
    layout: 'hero'
  });
  // En `hero` la ventana es el frame completo y el clip ya es 16:9: la caja no se
  // escala y se proyecta donde estaba.
  assert.deepEqual(face, {left: 860, top: 300, width: 200, height: 240});
});

test('la cara se reencuadra al cambiar de layout', () => {
  const box = {faceBox: {x: 860, y: 300, w: 200, h: 240}, clipWidth: 1920, clipHeight: 1080, focus: {x: 0.5, y: 0.42}};
  const hero = faceRectOnScreen({...box, layout: 'hero'});
  const frame = faceRectOnScreen({...box, layout: 'frame'});
  assert.ok(frame.width < hero.width, 'en `frame` el sujeto es una tarjeta: la cara ocupa menos');
  const subject = INTRO_GEOMETRY.subject.frame;
  assert.ok(frame.left >= subject.left && frame.top >= subject.top);
  assert.ok(frame.left + frame.width <= subject.left + subject.width);
});

test('sin caja de cara no hay rectangulo que medir', () => {
  assert.equal(
    faceRectOnScreen({faceBox: null, clipWidth: 1920, clipHeight: 1080, focus: {x: 0.5, y: 0.5}, layout: 'hero'}),
    null
  );
});

test('cada perfil declara umbrales completos y un tema valido', async () => {
  const themes = new Set(['ink-lime', 'editorial-ivory', 'signal-cobalt', 'oxide-documentary', 'slate-chalk']);
  for (const profile of INTRO_PROFILES.profiles) {
    assert.ok(themes.has(profile.themeId), `${profile.id}: tema desconocido ${profile.themeId}`);
    const budget = profileBudget(profile);
    assert.ok(budget.maxStrongEffectsPerSecond > 0, `${profile.id}: sin techo de golpes`);
    assert.ok(budget.maxSecondsWithoutChange > 0, `${profile.id}: sin cadencia`);
    assert.ok(budget.beatToleranceSeconds > 0, `${profile.id}: sin tolerancia de beat`);
    assert.ok(
      budget.durationBudgetSeconds.min < budget.durationBudgetSeconds.max,
      `${profile.id}: intervalo de duracion invalido`
    );
    for (const effect of profile.effectAllowlist) {
      assert.ok(EFFECTS.has(effect), `${profile.id}: efecto desconocido ${effect}`);
    }
  }
  assert.ok(introProfileIds.includes(INTRO_PROFILES.defaultProfile));
});

test('un perfil desconocido falla con las opciones disponibles', () => {
  assert.throws(() => resolveIntroProfile('inexistente'), /Perfil de intro desconocido/);
});

test('el perfil sobrio no autoriza roturas de senal', () => {
  const sobrio = resolveIntroProfile('sobrio-finanzas');
  assert.ok(!sobrio.effectAllowlist.includes('glitch'));
  assert.ok(!sobrio.effectAllowlist.includes('rgb-split'));
  // Y aguanta menos golpes por segundo que el perfil nervioso.
  assert.ok(sobrio.maxStrongEffectsPerSecond < resolveIntroProfile('hype-tech').maxStrongEffectsPerSecond);
});

test('cada efecto declara duracion y familia de sonido por defecto', () => {
  for (const effect of EFFECTS) {
    assert.ok(EFFECT_SECONDS[effect] > 0, `${effect}: sin duracion por defecto`);
    assert.ok(effect in DEFAULT_EFFECT_SOUND, `${effect}: sin familia de sonido declarada`);
    const family = DEFAULT_EFFECT_SOUND[effect];
    if (family === null) continue;
    assert.ok(soundFamilyIds.includes(family), `${effect}: familia inexistente ${family}`);
  }
  for (const effect of STRONG_EFFECTS) {
    assert.ok(EFFECTS.has(effect), `${effect} se cuenta como golpe pero no es un efecto valido`);
    assert.notEqual(
      DEFAULT_EFFECT_SOUND[effect],
      null,
      `${effect} es un golpe visual: sin sonido se percibe como un fallo de reproduccion`
    );
  }
});

test('cada tipo de cue y cada transicion de intro tienen familia valida', () => {
  for (const [type, family] of Object.entries(DEFAULT_CUE_SOUND)) {
    assert.ok(soundFamilyIds.includes(family), `${type}: familia inexistente ${family}`);
  }
  for (const [transition, family] of Object.entries(DEFAULT_TRANSITION_SOUND)) {
    if (family === null) continue;
    assert.ok(soundFamilyIds.includes(family), `${transition}: familia inexistente ${family}`);
  }
});

test('las familias propias de la intro apuntan a ficheros que existen', () => {
  const sfxRoot = path.join(REMOTION_ROOT, 'public');
  const missing = [];
  for (const family of ['riser', 'boom', 'glitch', 'shutter']) {
    assert.ok(SOUND_FAMILIES[family], `falta la familia ${family}`);
    for (const file of SOUND_FAMILIES[family].files) {
      if (!existsSync(path.join(sfxRoot, file))) missing.push(`${family} -> ${file}`);
    }
  }
  assert.deepEqual(missing, []);
});

/**
 * El estimador de tempo se prueba sobre una envolvente sintetica y no sobre un WAV:
 * asi el test no depende de ffmpeg ni de ficheros de audio, y mide exactamente lo
 * que puede fallar, que es el error de octava.
 */
test('el tempo estimado no se queda en la mitad del real', () => {
  const HOP_SECONDS = 64 / 8000;
  const onsetFor = (bpm, seconds = 12) => {
    const frames = Math.round(seconds / HOP_SECONDS);
    const onset = new Float64Array(frames);
    const period = (60 / bpm) / HOP_SECONDS;
    for (let beat = 0; beat * period < frames; beat += 1) {
      onset[Math.round(beat * period)] = 1;
    }
    return onset;
  };
  for (const bpm of [60, 90, 120, 150]) {
    const estimated = estimateTempo(onsetFor(bpm));
    assert.ok(
      Math.abs(estimated.bpm - bpm) <= 1,
      `pista de ${bpm} BPM estimada como ${estimated.bpm}: entre dos rejillas que ` +
      'explican los mismos golpes tiene que ganar la mas rapida'
    );
  }
});

test('la fase de la rejilla encuentra el desplazamiento del primer golpe', () => {
  const HOP_SECONDS = 64 / 8000;
  const period = 0.5 / HOP_SECONDS;
  const frames = Math.round(10 / HOP_SECONDS);
  const onset = new Float64Array(frames);
  const shift = 20;
  for (let beat = 0; beat * period + shift < frames; beat += 1) {
    onset[Math.round(beat * period) + shift] = 1;
  }
  const phase = estimatePhase(onset, period);
  assert.ok(Math.abs(phase.offsetFrames - shift) <= 2, `fase ${phase.offsetFrames}, esperada ${shift}`);
});

test('la intro de referencia pasa todas las reglas evaluables', async () => {
  const buildFile = path.join(projectDir('demo-canal'), 'intro-build.json');
  const build = JSON.parse(await readFile(buildFile, 'utf8'));
  const ruleSet = await loadIntroRules();
  const {summary, issues} = await runIntroRules(build, {ruleSet});
  assert.deepEqual(
    issues.map((issue) => `${issue.ruleId}: ${issue.message}`),
    [],
    'demo-canal es el proyecto de referencia: no puede incumplir el contrato'
  );
  assert.equal(summary.failed, 0);
  // La media del proyecto de referencia es sintetica y no tiene cara, asi que la
  // regla de oclusion se declara no evaluable en vez de dar un veredicto inventado.
  // Tampoco evalua el respiro entre golpes (IN-R-042): su perfil, hype-tech, no
  // declara `hitBreathing` y la regla no se inventa un techo.
  assert.equal(summary.skipped, 2);
});

test('el build de referencia ancla todo por beat', async () => {
  const build = JSON.parse(
    await readFile(path.join(projectDir('demo-canal'), 'intro-build.json'), 'utf8')
  );
  assert.equal(build.music.bpm, 120);
  const anchors = build.scenes.flatMap((scene) => [
    ...scene.cues.map((cue) => cue.atBeat),
    ...scene.effects.map((effect) => effect.atBeat)
  ]);
  assert.ok(anchors.length > 0);
  assert.ok(
    anchors.every((beat) => Number.isInteger(beat)),
    'sin transcripcion el unico ancla posible es el beat'
  );
  // Y todos los golpes fuertes caen exactamente en su beat.
  const strong = build.scenes.flatMap((scene) => scene.effects.filter((effect) => effect.strong));
  assert.ok(strong.length >= 3);
  for (const effect of strong) {
    assert.equal(effect.beatDeltaSeconds, 0, `${effect.id} no cae en el beat`);
  }
});

test('la biblioteca SONIDOS-REELS pone efectos cortos en los cambios y respeta los usos especiales', async () => {
  const {userSoundPalette, USER_TRANSITION_FAMILIES} = await import('../src/modules/intro-studio/sound.js');
  const entry = (name, use, durationSeconds) => ({
    sourceName: name, use, durationSeconds, file: `sfx/user-reel-${name.toLowerCase()}.wav`
  });
  const selection = {entries: [
    entry('whip', 'transition', 0.14),
    entry('slice', 'transition', 1.08),
    entry('money', 'money', 2.27),
    entry('message', 'message', 0.64),
    entry('riser', 'intro', 1.7)
  ]};
  const result = userSoundPalette(selection);
  for (const family of USER_TRANSITION_FAMILIES) {
    assert.deepEqual(result.palette[family], ['sfx/user-reel-whip.wav'], `${family} solo usa efectos cortos`);
  }
  assert.deepEqual(result.palette.money, ['sfx/user-reel-money.wav']);
  assert.deepEqual(result.palette.message, ['sfx/user-reel-message.wav']);
  assert.equal(result.palette.riser, undefined, 'el riser del usuario no entra en la rotacion');
  assert.equal(result.openingRiser, 'sfx/user-reel-riser.wav');
  assert.equal(result.palette.boom, undefined, 'sin impactos del usuario los golpes siguen en la libreria');
  assert.throws(() => userSoundPalette({entries: [entry('slice', 'transition', 1.08)]}), /0.7s o menos/);
});

test('los usos de montaje de SONIDOS-REELS ocupan sus familias y acotan la cola', async () => {
  const {userSoundPalette, placeUserSound} = await import('../src/modules/intro-studio/sound.js');
  const {resolveSoundCue} = await import('../src/modules/video-studio/sound-families.js');
  const entry = (name, use, durationSeconds) => ({
    sourceName: name, use, durationSeconds, file: `sfx/user-reel-${name}.wav`
  });
  const result = userSoundPalette({entries: [
    entry('whip', 'transition', 0.14),
    entry('grave', 'impact-low', 1.2),
    entry('remate', 'impact-finisher', 3.1),
    entry('inverso', 'whoosh-in', 0.72),
    entry('clic', 'click', 0.05),
    entry('ding', 'data', 0.3),
    entry('glitch', 'glitch', 0.66)
  ]}, {peaks: {'sfx/user-reel-inverso.wav': 0.67}});
  assert.deepEqual(result.palette.boom, ['sfx/user-reel-grave.wav']);
  assert.deepEqual(result.palette.hit, ['sfx/user-reel-grave.wav']);
  assert.deepEqual(result.palette.impact, ['sfx/user-reel-remate.wav']);
  assert.deepEqual(result.palette.rewind, ['sfx/user-reel-inverso.wav']);
  assert.deepEqual(result.palette.ui, ['sfx/user-reel-clic.wav']);
  assert.deepEqual(result.palette.tick, ['sfx/user-reel-ding.wav']);
  assert.deepEqual(result.palette.glitch, ['sfx/user-reel-glitch.wav']);
  assert.deepEqual(result.palette.whoosh, ['sfx/user-reel-whip.wav'], 'las transiciones no cambian');
  assert.equal(result.metadata['sfx/user-reel-remate.wav'].durationSeconds, 1.4, 'la cola del remate se corta');
  assert.equal(result.metadata['sfx/user-reel-grave.wav'].durationSeconds, 0.9);

  // El whoosh inverso empieza antes del corte para que su pico caiga en el.
  const cut = 10;
  const inverso = placeUserSound(resolveSoundCue('rewind', cut, 1, 0, result), cut, result);
  assert.equal(inverso.startSeconds, cut - 0.67);
  assert.equal(inverso.hitSeconds, cut);
  const grave = placeUserSound(resolveSoundCue('boom', cut, 1, 0, result), cut, result);
  assert.equal(grave.startSeconds, cut);
  assert.equal(grave.hitSeconds, cut);
});

test('IN-R-042 cuenta el golpe de un efecto anclado por el final donde se oye', async () => {
  const {default: check} = await import('../src/modules/intro-studio/rules/checks/intro-hit-breathing.js');
  const budget = {hitBreathing: {windowSeconds: 4, maxHits: 3}};
  // Tres golpes en 1-3 s y un whoosh inverso que arranca en 2,5 s pero golpea en 6 s.
  const soundCues = [1, 2, 3].map((s) => ({startSeconds: s}));
  soundCues.push({startSeconds: 2.5, hitSeconds: 6});
  assert.deepEqual(check.run({budget, scenes: [], soundCues}), []);
  soundCues.at(-1).hitSeconds = undefined;
  assert.equal(check.run({budget, scenes: [], soundCues}).length, 1);
});

test('el pico de un efecto se mide sobre el PCM', async () => {
  const {peakIndex} = await import('../src/modules/video-studio/sound-edges.js');
  const pcm = Buffer.alloc(2 * 1024);
  pcm.writeInt16LE(20000, 2 * 700);
  assert.equal(peakIndex(pcm, 128), 5);
});

test('las familias semanticas money y message existen en el catalogo comun', () => {
  assert.ok(SOUND_FAMILIES.money && SOUND_FAMILIES.message);
});

test('la franja de palabra clave cabe en la zona segura y deja libre el sujeto de insert', () => {
  for (const slot of ['lower', 'lower-left']) assert.ok(insideSafeArea(slotRect(slot)), slot);
  assert.equal(rectsOverlap(slotRect('lower-left'), INTRO_GEOMETRY.subject.insert), false);
});
