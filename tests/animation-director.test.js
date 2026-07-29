import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CueAnchorError,
  cueDeviationMs,
  reanchorCues,
  resolveSceneCues
} from '../src/modules/editorial-video/visuals/cue-anchoring.js';
import {buildCueCoverage, mineSceneCues} from '../src/modules/editorial-video/visuals/cue-mining.js';
import {
  applyCueBudget,
  applyCueOverrides,
  mergeCueSets
} from '../src/modules/editorial-video/visuals/cue-budget.js';
import {createPatternRegistry} from '../src/modules/editorial-video/visuals/pattern-registry.js';
import {
  buildEventTimeline,
  generateFillerEvents,
  validateEventDensity
} from '../src/modules/editorial-video/visuals/event-timeline.js';
import {
  buildSoundReport,
  planDucking,
  planEpisodeSound,
  validateSoundVariety
} from '../src/modules/editorial-video/visuals/sound-director.js';
import {planSceneVariety, validateVariety} from '../src/modules/editorial-video/visuals/variety-planner.js';
import {
  MAX_PATTERN_REPEATS_IN_WINDOW,
  PatternSelector,
  selectScenePatterns
} from '../src/modules/editorial-video/visuals/pattern-selector.js';
import {runRuleEngine} from '../src/modules/editorial-video/visuals/rules-engine.js';

const WORDS = [
  {text: 'El', startSeconds: 0, endSeconds: 0.2},
  {text: 'mercado', startSeconds: 0.2, endSeconds: 0.6},
  {text: 'cae', startSeconds: 0.6, endSeconds: 0.9},
  {text: 'un', startSeconds: 0.9, endSeconds: 1},
  {text: '20', startSeconds: 1, endSeconds: 1.3},
  {text: '%', startSeconds: 1.3, endSeconds: 1.4},
  {text: 'pero', startSeconds: 1.6, endSeconds: 1.9},
  {text: 'NVIDIA', startSeconds: 2, endSeconds: 2.5},
  {text: 'sube', startSeconds: 2.6, endSeconds: 2.9},
  {text: 'en', startSeconds: 3, endSeconds: 3.1},
  {text: '2026', startSeconds: 3.1, endSeconds: 3.6},
  {text: 'y', startSeconds: 3.7, endSeconds: 3.8},
  {text: 'el', startSeconds: 3.8, endSeconds: 3.9},
  {text: 'mercado', startSeconds: 3.9, endSeconds: 4.3}
];
const RANGE = {startIndex: 0, endIndex: WORDS.length - 1};

test('el anclaje falla en vez de degradar cuando el ancla no existe', () => {
  assert.throws(
    () => resolveSceneCues(
      [{id: 'fantasma', anchorText: 'inexistente', action: 'zoom', target: 'x'}],
      {words: WORDS, wordRange: RANGE, startSeconds: 0, endSeconds: 5, sceneId: 'scene-001'}
    ),
    (error) => error instanceof CueAnchorError &&
      error.issues[0].code === 'anchor-not-found' &&
      error.issues[0].sceneId === 'scene-001'
  );
});

test('el anclaje respeta la ocurrencia N dentro del rango de la escena', () => {
  const {cues} = resolveSceneCues(
    [
      {id: 'primera', anchorText: 'mercado', anchorOccurrence: 1, action: 'focus', target: 'a'},
      {id: 'segunda', anchorText: 'mercado', anchorOccurrence: 2, action: 'focus', target: 'a'}
    ],
    {words: WORDS, wordRange: RANGE, startSeconds: 0, endSeconds: 5, sceneId: 'scene-001'}
  );
  assert.equal(cues[0].anchorWordIndex, 1);
  assert.equal(cues[1].anchorWordIndex, 13);
  assert.equal(cues[1].atSeconds, 3.9);
});

test('la búsqueda no sale del rango de palabras de la escena', () => {
  const {issues} = resolveSceneCues(
    [{id: 'fuera', anchorText: 'NVIDIA', action: 'focus', target: 'a'}],
    {
      words: WORDS,
      wordRange: {startIndex: 0, endIndex: 5},
      startSeconds: 0,
      endSeconds: 1.5,
      sceneId: 'scene-001',
      strict: false
    }
  );
  assert.equal(issues[0].code, 'anchor-not-found');
});

test('un cue anclado fuera del intervalo de la escena se detecta', () => {
  const {issues} = resolveSceneCues(
    [{id: 'tarde', anchorText: '2026', action: 'reveal', target: 'a'}],
    {
      words: WORDS,
      wordRange: RANGE,
      startSeconds: 0,
      endSeconds: 1.5,
      sceneId: 'scene-001',
      strict: false
    }
  );
  assert.equal(issues[0].code, 'anchor-outside-scene');
});

test('reanchorCues recalcula los segundos tras recortar el audio', () => {
  const {cues} = resolveSceneCues(
    [{id: 'cifra', anchorText: '20', action: 'highlight', target: 'a'}],
    {words: WORDS, wordRange: RANGE, startSeconds: 0, endSeconds: 5, sceneId: 'scene-001'}
  );
  const compacted = WORDS.map((word) => ({...word, startSeconds: word.startSeconds - 0.4}));
  const [recalculated] = reanchorCues(cues, {words: compacted, startSeconds: 0});
  assert.equal(recalculated.anchorWordIndex, cues[0].anchorWordIndex);
  assert.equal(recalculated.atSeconds, 0.6);
  assert.equal(cueDeviationMs(recalculated, compacted), 0);
});

test('la minería detecta cifras, entidades, giros, fechas y verbos', () => {
  const mined = mineSceneCues(WORDS, {
    wordRange: RANGE,
    startSeconds: 0,
    sceneId: 'scene-001',
    entities: [{id: 'nvidia', name: 'NVIDIA'}]
  });
  const kinds = new Set(mined.map((cue) => cue.kind));
  assert.ok(kinds.has('number'), 'debe detectar la cifra narrada');
  assert.ok(kinds.has('entity'), 'debe detectar la entidad del dossier');
  assert.ok(kinds.has('turn'), 'debe detectar el giro narrativo');
  assert.ok(kinds.has('date'), 'debe detectar el año');
  assert.ok(kinds.has('verb'), 'debe detectar el verbo visualizable');
  for (const cue of mined) {
    assert.equal(typeof cue.anchorWordIndex, 'number');
    assert.ok(cue.sound.family, 'cada cue minado pide una familia sonora');
  }
});

test('el verbo visualizable trae su metáfora y su familia sonora', () => {
  const mined = mineSceneCues(WORDS, {wordRange: RANGE, sceneId: 'scene-001'});
  const caer = mined.find((cue) => cue.anchorText === 'cae');
  assert.equal(caer.metaphor, 'fall');
  assert.equal(caer.sound.family, 'impact');
});

test('el presupuesto por ventana protege los cues obligatorios', () => {
  const cues = [
    {id: 'a', atSeconds: 0.1, priority: 3, mandatory: false, target: 't'},
    {id: 'b', atSeconds: 0.6, priority: 3, mandatory: false, target: 't'},
    {id: 'c', atSeconds: 1.1, priority: 3, mandatory: false, target: 't'},
    {id: 'd', atSeconds: 1.6, priority: 9, mandatory: true, target: 't'}
  ];
  const {cues: kept, dropped} = applyCueBudget(cues, {maxPerWindow: 3});
  assert.ok(kept.some((cue) => cue.id === 'd'), 'el cue obligatorio sobrevive');
  assert.equal(dropped.length, 1);
});

test('los cues a menos de 0,25 s se fusionan conservando la prioridad alta', () => {
  const {cues, dropped} = applyCueBudget([
    {id: 'debil', atSeconds: 1, priority: 2, target: 't'},
    {id: 'fuerte', atSeconds: 1.1, priority: 9, target: 't'}
  ]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].id, 'fuerte');
  assert.equal(dropped[0].reason, 'merged-window');
});

test('un override sin motivo no se acepta', () => {
  assert.throws(
    () => applyCueOverrides([{id: 'a', atSeconds: 1}], [{op: 'suppress', cueId: 'a'}]),
    /no declara motivo/
  );
});

test('el cue autoral gana sobre el minado en la misma palabra', () => {
  const merged = mergeCueSets({
    mined: [{id: 'm', anchorWordIndex: 4, kind: 'number', atSeconds: 1, priority: 8}],
    authored: [{id: 'a', anchorWordIndex: 4, label: 'VEINTE POR CIENTO', atSeconds: 1, priority: 5}]
  });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].label, 'VEINTE POR CIENTO');
  assert.equal(merged[0].kind, 'number');
  assert.equal(merged[0].priority, 8);
});

test('la cobertura nombra las menciones obligatorias sin cue', () => {
  const mined = mineSceneCues(WORDS, {
    wordRange: RANGE,
    sceneId: 'scene-001',
    entities: [{id: 'nvidia', name: 'NVIDIA'}]
  });
  const coverage = buildCueCoverage(mined, mined.slice(0, 1), {sceneId: 'scene-001'});
  assert.ok(coverage.coverageRatio < 1);
  assert.ok(coverage.uncovered.length > 0);
});

const BINDINGS = {
  bindings: [{
    componentKey: 'demo',
    patternId: 'data.line-trend-zoom',
    geometry: 'line',
    emphasis: 'zoom',
    focusTargets: ['spy-line', 'divergence-gap'],
    defaultTargets: {number: 'spy-line', entity: 'spy-line'}
  }]
};

test('un target inventado es un error de build, no un zoom a ninguna parte', () => {
  const registry = createPatternRegistry(BINDINGS, {patterns: [{id: 'data.line-trend-zoom'}]});
  const issues = registry.validateSceneTargets({
    id: 'scene-001',
    componentKey: 'demo',
    cues: [{id: 'typo', target: 'divergence-gapp'}]
  });
  assert.equal(issues[0].code, 'cue-target-unknown');
  assert.equal(issues[0].severity, 'error');
});

test('un cue minado recibe destino desde el patrón', () => {
  const registry = createPatternRegistry(BINDINGS);
  const {cues} = registry.bindCueTargets('demo', [{id: 'c', kind: 'number'}]);
  assert.equal(cues[0].target, 'spy-line');
});

test('un intervalo narrado sin focus.divergence-range queda avisado', () => {
  const registry = createPatternRegistry(BINDINGS);
  const issues = registry.validateSceneTargets({
    id: 'scene-001',
    componentKey: 'demo',
    effectIds: [],
    cues: [{id: 'rango', target: '2026-05-28/2026-06-26'}]
  });
  assert.equal(issues[0].code, 'range-target-without-divergence-effect');
});

const DENSITY_SCENES = [
  {
    id: 'scene-001',
    startSeconds: 0,
    endSeconds: 10,
    act: 'desarrollo',
    geometry: 'line',
    focusTargets: ['spy-line'],
    cues: [{id: 'c1', atSeconds: 0.2, action: 'reveal', target: 'spy-line'}]
  }
];

test('un hueco de más de 2 s sin evento visible es un error', () => {
  const {issues, report} = validateEventDensity(DENSITY_SCENES, {durationSeconds: 10});
  assert.ok(issues.some((issue) => issue.code === 'event-gap-max'));
  assert.ok(report.maxGapSeconds > 2);
});

test('una escena larga con un solo cambio incumple el ritmo', () => {
  const {issues} = validateEventDensity(DENSITY_SCENES, {durationSeconds: 10});
  assert.ok(issues.some((issue) => issue.code === 'scene-secondary-change'));
});

test('una respiración declarada no cuenta como hueco', () => {
  const {issues} = validateEventDensity(
    [{...DENSITY_SCENES[0], endSeconds: 3, intent: 'breath'}],
    {durationSeconds: 3}
  );
  assert.ok(!issues.some((issue) => issue.code === 'event-gap-max'));
});

test('los eventos de relleno declaran función y motivo', () => {
  const fillers = generateFillerEvents(DENSITY_SCENES[0]);
  assert.ok(fillers.length > 0);
  for (const filler of fillers) {
    assert.ok(filler.function, 'ningún relleno es movimiento decorativo puro');
    assert.ok(filler.reason);
  }
});

test('el timeline mezcla cues, entradas de escena y fases del patrón', () => {
  const events = buildEventTimeline(DENSITY_SCENES);
  const types = new Set(events.map((event) => event.type));
  assert.ok(types.has('scene-enter'));
  assert.ok(types.has('cue'));
  assert.ok(types.has('pattern-phase'));
});

const SOUND_CATALOG = {
  families: [
    {
      id: 'data',
      cooldownSeconds: 6,
      defaultVolume: 0.4,
      variants: Array.from({length: 6}, (_, index) => ({
        id: `data-0${index + 1}`,
        file: `sfx/data-0${index + 1}.wav`,
        durationSeconds: 0.11,
        volume: 0.4
      }))
    },
    {
      id: 'impact',
      cooldownSeconds: 10,
      defaultVolume: 0.5,
      variants: Array.from({length: 6}, (_, index) => ({
        id: `impact-0${index + 1}`,
        file: `sfx/impact-0${index + 1}.wav`,
        durationSeconds: 0.56,
        volume: 0.5
      }))
    },
    {
      id: 'tension',
      cooldownSeconds: 18,
      defaultVolume: 0.26,
      variants: [{id: 'tension-01', file: 'sfx/tension-01.wav', durationSeconds: 1.7, volume: 0.26}]
    },
    {
      id: 'reveal',
      cooldownSeconds: 11,
      defaultVolume: 0.32,
      variants: [{id: 'reveal-01', file: 'sfx/reveal-01.wav', durationSeconds: 0.46, volume: 0.32}]
    },
    {
      id: 'texture',
      cooldownSeconds: 0,
      defaultVolume: 0.16,
      loopable: true,
      variants: [
        {id: 'texture-01', file: 'sfx/texture-01.wav', durationSeconds: 6, volume: 0.16},
        {id: 'texture-02', file: 'sfx/texture-02.wav', durationSeconds: 6, volume: 0.16}
      ]
    }
  ],
  legacyAliases: {
    'soft-impact': {family: 'impact', variant: 'impact-01'},
    'alert-sting': {family: 'impact', variant: 'impact-05'}
  }
};

function soundScenes(count) {
  return Array.from({length: count}, (_, index) => ({
    id: `scene-${String(index + 1).padStart(3, '0')}`,
    startSeconds: index * 4,
    endSeconds: index * 4 + 4,
    act: index < 2 ? 'hook' : 'desarrollo',
    cues: [{
      id: `cue-${index}`,
      atSeconds: 0.5,
      absoluteSeconds: index * 4 + 0.5,
      kind: 'number',
      action: 'highlight',
      sound: {family: 'data', intensity: 0.6}
    }]
  }));
}

test('el selector rota variantes en vez de repetir el mismo fichero', () => {
  const plan = planEpisodeSound({
    episodeId: 'episode-test-001',
    scenes: soundScenes(6),
    catalog: SOUND_CATALOG
  });
  const files = plan.scenes.flatMap((scene) => scene.cues.map((cue) => cue.file));
  assert.ok(new Set(files).size >= 5, `esperaba variedad, obtuve ${[...new Set(files)].join()}`);
});

test('un alias histórico no monopoliza su variante frente al resto de la familia', () => {
  // Los alias legacy llevan `variantHint` fijo. Si el hint fuera un cerrojo, un
  // alias frecuente agotaría siempre el mismo fichero dejando el resto sin usar.
  const scenes = Array.from({length: 8}, (_, index) => ({
    id: `scene-${index}`,
    startSeconds: index * 12,
    endSeconds: index * 12 + 12,
    act: 'desarrollo',
    cues: [{
      id: `cue-${index}`,
      atSeconds: 1,
      absoluteSeconds: index * 12 + 1,
      kind: 'number',
      action: 'highlight',
      sound: {family: 'data', intensity: 0.6, variantHint: 'data-01'}
    }]
  }));
  const plan = planEpisodeSound({
    episodeId: 'episode-test-hint',
    scenes,
    catalog: SOUND_CATALOG
  });
  const files = plan.scenes.flatMap((scene) =>
    scene.cues.filter((cue) => cue.role === 'cue').map((cue) => cue.file));
  const hinted = files.filter((file) => file.includes('data-01')).length;
  assert.ok(hinted < files.length,
    `el hint monopolizó las ${files.length} instancias de la familia`);
  assert.ok(new Set(files).size >= 3,
    `esperaba rotación pese al hint, obtuve ${[...new Set(files)].join()}`);
});

test('el cooldown se mide contra la familia, no contra una constante plana', () => {
  // `data` declara 6 s: una repetición a 7 s es legítima y no debe reportarse.
  const scenes = [{
    id: 'scene-001',
    startSeconds: 0,
    endSeconds: 20,
    act: 'desarrollo',
    cues: [
      {id: 'a', atSeconds: 0.5, absoluteSeconds: 0.5, kind: 'number', action: 'highlight',
        sound: {family: 'data', intensity: 0.6}},
      {id: 'b', atSeconds: 7.5, absoluteSeconds: 7.5, kind: 'number', action: 'highlight',
        sound: {family: 'data', intensity: 0.6}}
    ]
  }];
  const sound = planEpisodeSound({episodeId: 'episode-test-cd', scenes, catalog: SOUND_CATALOG});
  const rule = {id: 'T-1', check: 'sound-file-cooldown', params: {cooldownSeconds: 12}};
  const issues = runRuleEngine(
    {rules: [{...rule, severity: 'warning', statement: 'cooldown'}]},
    {plan: {}, scenes, sound, soundCatalog: SOUND_CATALOG, issues: []}
  ).issues;
  assert.deepEqual(issues, [], `no debía incumplir: ${issues.map((i) => i.message).join(' | ')}`);
});

test('la mezcla es determinista para el mismo episodio', () => {
  const first = planEpisodeSound({
    episodeId: 'episode-test-001',
    scenes: soundScenes(6),
    catalog: SOUND_CATALOG
  });
  const second = planEpisodeSound({
    episodeId: 'episode-test-001',
    scenes: soundScenes(6),
    catalog: SOUND_CATALOG
  });
  assert.deepEqual(
    first.scenes.flatMap((scene) => scene.cues.map((cue) => [cue.file, cue.playbackRate])),
    second.scenes.flatMap((scene) => scene.cues.map((cue) => [cue.file, cue.playbackRate]))
  );
});

test('el jitter de tono se mantiene dentro del ±3 %', () => {
  const plan = planEpisodeSound({
    episodeId: 'episode-test-001',
    scenes: soundScenes(6),
    catalog: SOUND_CATALOG
  });
  for (const scene of plan.scenes) {
    for (const cue of scene.cues.filter((item) => item.role === 'cue')) {
      assert.ok(cue.playbackRate >= 0.97 && cue.playbackRate <= 1.03);
    }
  }
});

test('un giro narrativo trae riser antes de la palabra', () => {
  const plan = planEpisodeSound({
    episodeId: 'episode-test-001',
    catalog: SOUND_CATALOG,
    scenes: [{
      id: 'scene-001',
      startSeconds: 0,
      endSeconds: 6,
      act: 'giro',
      cues: [{
        id: 'giro',
        kind: 'turn',
        atSeconds: 2,
        absoluteSeconds: 2,
        action: 'highlight',
        sound: {family: 'impact', intensity: 0.8}
      }]
    }]
  });
  const riser = plan.scenes[0].cues.find((cue) => cue.role === 'riser');
  assert.ok(riser, 'el giro debe llevar riser');
  assert.ok(riser.startSeconds < 2);
});

test('los alias históricos dejan de compartir fichero', () => {
  const plan = planEpisodeSound({
    episodeId: 'episode-test-001',
    catalog: SOUND_CATALOG,
    scenes: [{
      id: 'scene-001',
      startSeconds: 0,
      endSeconds: 30,
      cues: [
        {id: 'suave', atSeconds: 1, absoluteSeconds: 1, action: 'highlight', sound: 'soft-impact'},
        {id: 'alerta', atSeconds: 20, absoluteSeconds: 20, action: 'highlight', sound: 'alert-sting'}
      ]
    }]
  });
  const files = plan.scenes[0].cues
    .filter((cue) => cue.role === 'cue')
    .map((cue) => cue.file);
  assert.notEqual(files[0], files[1]);
});

test('el ducking cubre las palabras y atenúa al menos 4 dB', () => {
  const windows = planDucking(WORDS);
  assert.ok(windows.length > 0);
  assert.ok(windows.every((window) => window.gainDb <= -4));
  assert.ok(windows[0].startSeconds <= 0.1);
});

test('el validador de sonido detecta un fichero dominante', () => {
  const instances = Array.from({length: 20}, (_, index) => ({
    file: index < 18 ? 'sfx/data-01.wav' : `sfx/data-0${index}.wav`,
    family: 'data',
    absoluteSeconds: index
  }));
  const issues = validateSoundVariety(buildSoundReport({instances}));
  assert.ok(issues.some((issue) => issue.code === 'sound-file-share'));
  assert.ok(issues.some((issue) => issue.code === 'sound-family-count'));
});

test('el lecho cubre cada acto del episodio', () => {
  const plan = planEpisodeSound({
    episodeId: 'episode-test-001',
    scenes: soundScenes(6),
    catalog: SOUND_CATALOG
  });
  assert.ok(plan.bedTrack.length >= 2);
  assert.deepEqual([...new Set(plan.bedTrack.map((segment) => segment.act))], ['hook', 'desarrollo']);
});

test('el eje de familia sonora resuelve los alias históricos', () => {
  // `data-tick` y `{family:'data'}` suenan a la misma familia: contarlos por
  // separado escondía la monotonía real en la ventana deslizante (ANM-H02).
  const legacyAliases = {'data-tick': {family: 'data', variant: 'data-01'}};
  const scenes = planSceneVariety([
    {id: 's1', cues: [{sound: 'data-tick'}]},
    {id: 's2', cues: [{sound: {family: 'data'}}]}
  ], {legacyAliases});
  assert.equal(scenes[0].soundFamily, 'data');
  assert.equal(scenes[1].soundFamily, 'data');
});

test('una regla sin contexto se informa como no evaluable, no como incumplida', () => {
  const ruleSet = {rules: [{
    id: 'T-2',
    check: 'silent-variant-present',
    severity: 'warning',
    statement: 'variante silenciosa'
  }]};
  const sinContexto = runRuleEngine(ruleSet, {plan: {}, scenes: [], issues: []});
  assert.equal(sinContexto.results[0].status, 'skipped');
  assert.equal(sinContexto.issues.length, 0);
  assert.equal(sinContexto.summary.skipped, 1);

  const conContexto = runRuleEngine(ruleSet, {
    plan: {}, scenes: [], issues: [], artifacts: {silentPropsFile: null}
  });
  assert.equal(conContexto.results[0].status, 'warn');
  assert.equal(conContexto.issues.length, 1);
});

test('la ventana de variedad marca el patrón que domina seis escenas', () => {
  const registry = createPatternRegistry(BINDINGS);
  const scenes = planSceneVariety(
    Array.from({length: 6}, (_, index) => ({
      id: `scene-00${index + 1}`,
      componentKey: 'demo',
      startSeconds: index * 4,
      endSeconds: index * 4 + 4,
      cues: []
    })),
    {registry}
  );
  const {issues, report} = validateVariety(scenes);
  assert.ok(issues.some((issue) => issue.code === 'variety-window' && issue.severity === 'error'));
  assert.equal(report.distinctPatterns, 1);
});

test('la rotación de énfasis no repite mecanismo en escenas seguidas', () => {
  const registry = createPatternRegistry(BINDINGS);
  const scenes = planSceneVariety(
    Array.from({length: 4}, (_, index) => ({
      id: `scene-00${index + 1}`,
      componentKey: 'demo',
      startSeconds: index * 4,
      endSeconds: index * 4 + 4,
      cues: []
    })),
    {registry}
  );
  assert.notEqual(scenes[0].emphasis, scenes[1].emphasis);
});

// ---------------------------------------------------------------------------
// ANM-H05 — Selección de patrón con ventana deslizante.
// ---------------------------------------------------------------------------

const SELECTOR_BINDINGS = {
  bindings: [
    {
      componentKey: 'flow',
      patternId: 'process.signal-flow',
      patternCandidates: ['process.funnel-filter', 'process.branch-merge'],
      geometry: 'node-graph',
      emphasis: 'connector',
      focusTargets: ['flow-output'],
      defaultTargets: {number: 'flow-output'}
    },
    {
      componentKey: 'chart',
      patternId: 'data.line-trend-zoom',
      patternCandidates: ['data.part-to-whole', 'text.kinetic-phrase'],
      geometry: 'line',
      emphasis: 'zoom',
      focusTargets: ['spy-line'],
      defaultTargets: {number: 'spy-line'}
    }
  ]
};
const SELECTOR_PATTERNS = {
  patterns: [
    {id: 'process.signal-flow', status: 'ready'},
    {id: 'process.funnel-filter', status: 'ready'},
    {id: 'process.branch-merge', status: 'ready'},
    {id: 'data.line-trend-zoom', status: 'ready'},
    {id: 'data.part-to-whole', status: 'ready'},
    {id: 'text.kinetic-phrase', status: 'planned'}
  ]
};

function selectorRegistry() {
  return createPatternRegistry(SELECTOR_BINDINGS, SELECTOR_PATTERNS);
}

test('el mismo componentKey deja de producir siempre el mismo patrón', () => {
  const scenes = Array.from({length: 9}, () => ({componentKey: 'flow'}));
  const {selections, report} = selectScenePatterns(scenes, {
    registry: selectorRegistry(),
    episodeId: 'episode-finance-cavaliers-001'
  });
  assert.equal(report.distinctPatterns, 3);
  // Nueve escenas repartidas entre tres candidatos: reparto plano, no una tabla
  // fija con el 100 % en el preferente.
  for (const count of Object.values(report.usage)) assert.equal(count, 3);
  assert.equal(selections.length, 9);
});

test('ningún patrón supera dos apariciones en la ventana de seis escenas', () => {
  const scenes = Array.from({length: 24}, (_, index) => ({
    componentKey: index % 3 === 0 ? 'chart' : 'flow'
  }));
  const {selections} = selectScenePatterns(scenes, {
    registry: selectorRegistry(),
    episodeId: 'episode-finance-cavaliers-001'
  });
  const chosen = selections.map((selection) => selection.patternId);
  for (let position = 0; position < chosen.length; position += 1) {
    const window = chosen.slice(Math.max(0, position - 5), position + 1);
    const repeats = window.filter((id) => id === chosen[position]).length;
    assert.ok(
      repeats <= MAX_PATTERN_REPEATS_IN_WINDOW,
      `«${chosen[position]}» aparece ${repeats} veces en la ventana que termina ` +
        `en la escena ${position}`
    );
  }
});

test('el preferente del binding gana mientras no se despegue del reparto', () => {
  const selector = new PatternSelector({
    registry: selectorRegistry(),
    episodeId: 'episode-finance-cavaliers-001'
  });
  const first = selector.select('flow');
  assert.equal(first.patternId, 'process.signal-flow');
  assert.equal(first.rule, 'preferred');
  // Ya usado una vez: el siguiente turno del mismo grupo va a un candidato con
  // menos uso acumulado, igual que hace VariantSelector con los ficheros de SFX.
  assert.notEqual(selector.select('flow').patternId, 'process.signal-flow');
});

test('no se rota hacia un patrón sin implementación en el catálogo', () => {
  const selector = new PatternSelector({
    registry: selectorRegistry(),
    episodeId: 'episode-finance-cavaliers-001'
  });
  assert.deepEqual(
    selector.candidatesFor('chart'),
    ['data.line-trend-zoom', 'data.part-to-whole']
  );
});

test('la selección de patrón deja escrito su motivo', () => {
  const selector = new PatternSelector({
    registry: selectorRegistry(),
    episodeId: 'episode-finance-cavaliers-001'
  });
  const selection = selector.select('flow');
  assert.match(selection.reason, /process\.signal-flow/);
  assert.match(selection.reason, /ventana de 6/);
});

test('un patrón fuera de los candidatos del binding es error de contrato', () => {
  const registry = selectorRegistry();
  const issues = registry.validateSceneTargets({
    id: 'scene-001',
    componentKey: 'chart',
    patternId: 'process.signal-flow',
    cues: []
  });
  assert.equal(issues[0].code, 'pattern-not-a-candidate');
  assert.equal(issues[0].severity, 'error');
});

test('el patrón elegido por variedad no se marca como fuera de contrato', () => {
  const registry = selectorRegistry();
  const issues = registry.validateSceneTargets({
    id: 'scene-001',
    componentKey: 'chart',
    patternId: 'data.part-to-whole',
    cues: []
  });
  assert.deepEqual(issues, []);
});

test('planSceneVariety conserva el motivo de la elección de patrón', () => {
  const [scene] = planSceneVariety(
    [{
      id: 'scene-001',
      componentKey: 'demo',
      patternId: 'data.line-trend-zoom',
      startSeconds: 0,
      endSeconds: 4,
      cues: [],
      varietyReasons: ['Patrón data.line-trend-zoom: preferente de «demo».']
    }],
    {registry: createPatternRegistry(BINDINGS)}
  );
  assert.equal(
    scene.varietyReasons[0],
    'Patrón data.line-trend-zoom: preferente de «demo».'
  );
  assert.ok(scene.varietyReasons.length > 1);
});

// ---------------------------------------------------------------------------
// ANM-E03 — El render dejó de ignorar `patternId`. Mientras dure la migración
// conviven dos caminos, y la geometría medida tiene que ser la que se pinta.
// ---------------------------------------------------------------------------

const ROUTED_CATALOG = {
  patterns: [
    {
      id: 'data.line-trend-zoom',
      status: 'ready',
      implementation: {compositionId: 'Toolkit-LineChartZoom'}
    },
    {
      id: 'comparison.before-after-wipe',
      status: 'ready',
      implementation: {compositionId: 'Pattern-Before-After-Wipe'}
    }
  ]
};
const ROUTES = {
  routed: ['Toolkit-LineChartZoom'],
  geometryByComposition: {'Toolkit-LineChartZoom': 'line'},
  kindFallback: [{kind: 'before-after', reason: 'sin las dos imágenes comparables'}]
};
const GEOMETRY_BINDINGS = {
  bindings: [
    {
      componentKey: 'sloos-chart',
      patternId: 'data.line-trend-zoom',
      geometry: 'line',
      focusTargets: ['sloos-line'],
      defaultTargets: {}
    },
    {
      componentKey: 'before-after',
      patternId: 'comparison.before-after-wipe',
      geometry: 'split',
      focusTargets: ['before'],
      defaultTargets: {}
    }
  ]
};

test('una escena enrutada por patrón mide la geometría del patrón', () => {
  const registry = createPatternRegistry(GEOMETRY_BINDINGS, ROUTED_CATALOG, ROUTES);
  assert.equal(registry.rendersByPattern('sloos-chart', 'data.line-trend-zoom'), true);
  assert.equal(registry.geometryFor('sloos-chart', 'data.line-trend-zoom'), 'line');
});

test('un kind del camino heredado sigue midiendo la geometría de su binding', () => {
  const registry = createPatternRegistry(GEOMETRY_BINDINGS, ROUTED_CATALOG, ROUTES);
  // Aunque su patrón tuviera composición, el píxel lo sigue decidiendo el
  // componente antiguo: medir la del patrón sería contar lo que no se ve.
  assert.equal(
    registry.rendersByPattern('before-after', 'comparison.before-after-wipe'),
    false
  );
  assert.equal(
    registry.geometryFor('before-after', 'comparison.before-after-wipe'),
    'split'
  );
});

test('un patrón sin adaptador no cuenta como enrutado aunque el catálogo lo declare ready', () => {
  const registry = createPatternRegistry(
    GEOMETRY_BINDINGS,
    ROUTED_CATALOG,
    {...ROUTES, kindFallback: []}
  );
  assert.equal(
    registry.rendersByPattern('before-after', 'comparison.before-after-wipe'),
    false
  );
});

test('planSceneVariety toma la geometría del registro, no solo del binding', () => {
  const registry = createPatternRegistry(GEOMETRY_BINDINGS, ROUTED_CATALOG, ROUTES);
  const [routed, legacy] = planSceneVariety(
    [
      {id: 'scene-001', componentKey: 'sloos-chart', patternId: 'data.line-trend-zoom', cues: []},
      {id: 'scene-002', componentKey: 'before-after', patternId: 'comparison.before-after-wipe', cues: []}
    ],
    {registry}
  );
  assert.equal(routed.geometry, 'line');
  assert.equal(legacy.geometry, 'split');
});
