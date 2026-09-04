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
  assert.equal(summary.skipped, 1);
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
