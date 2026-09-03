import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {run} from '../src/lib/utils.js';
import {processJob, saveJobState} from '../src/lib/pipeline.js';
import {sampleRange} from '../src/lib/webcam.js';
import {
  buildShortPlanForCandidate,
  rebaseWords,
  renderCandidateWithRemotion
} from '../src/modules/shorts-studio/from-long-video.js';
import {mediaDir, projectDir} from '../src/modules/shorts-studio/constants.js';
import {DEFAULT_FOCUS} from '../src/modules/shorts-studio/face-tracking.js';
import {readJson} from '../src/lib/utils.js';

test('el plan mapea renderMode a layout y solo pip lleva webcamBox', () => {
  const candidate = {id: 'clip-1', start: 10, end: 25};
  const box = {x: 1400, y: 700, w: 320, h: 240};

  const pip = buildShortPlanForCandidate({candidate, renderMode: 'pip', webcamBox: box});
  assert.equal(pip.scenes[0].layout, 'pip');
  assert.deepEqual(pip.scenes[0].webcamBox, box);
  assert.equal(pip.captions.mode, 'progressive');
  assert.equal(pip.scenes[0].camera, 'static');
  assert.ok(!('trim' in pip.scenes[0]), 'el clip ya viene cortado: sin trim');

  const fit = buildShortPlanForCandidate({candidate, renderMode: 'fit'});
  assert.equal(fit.scenes[0].layout, 'fit');
  assert.ok(!('webcamBox' in fit.scenes[0]));

  const crop = buildShortPlanForCandidate({candidate, renderMode: 'crop'});
  assert.equal(crop.scenes[0].layout, 'full');
  assert.ok(!('webcamBox' in crop.scenes[0]));

  assert.throws(
    () => buildShortPlanForCandidate({candidate, renderMode: 'pip'}),
    /webcamBox/
  );
});

test('rebaseWords rebasa las palabras al reloj del corte y las clampa', () => {
  const captions = [{
    id: 'seg-1',
    start: 8,
    end: 30,
    text: 'antes dentro del corte fuera',
    words: [
      {word: 'antes', start: 8, end: 9.5},
      {word: 'dentro', start: 10.2, end: 11},
      {word: 'del', start: 11, end: 11.4},
      {word: 'corte', start: 11.4, end: 12},
      {word: 'fuera', start: 28, end: 30}
    ]
  }];
  const {words, captionTiming} = rebaseWords(captions, 10, 25);
  // "antes" acaba antes del corte y "fuera" empieza despues: fuera las dos.
  assert.deepEqual(words.map((word) => word.text), ['dentro', 'del', 'corte']);
  assert.equal(words[0].start, 0.2);
  assert.equal(words[0].timing, 'word');
  assert.deepEqual(words.map((word) => word.index), [0, 1, 2]);
  assert.equal(captionTiming, 'word');
});

test('rebaseWords aproxima tiempos cuando el segmento no trae palabras', () => {
  const captions = [{id: 'seg-1', start: 10, end: 14, text: 'hola mundo entero'}];
  const {words, captionTiming} = rebaseWords(captions, 10, 14);
  assert.equal(words.length, 3);
  assert.ok(words.every((word) => word.timing === 'approximate'));
  assert.equal(words[0].start, 0);
  assert.equal(words.at(-1).end, 4);
  assert.equal(captionTiming, 'approximate');
});

test('el bridge escribe proyecto coherente y copia el mp4 al output del job', async (t) => {
  const slug = 'short-test-bridge-clip-1';
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-bridge-'));
  const cleanup = async () => {
    await rm(root, {recursive: true, force: true});
    await rm(projectDir(slug), {recursive: true, force: true});
    await rm(mediaDir(slug), {recursive: true, force: true});
    // Sin build real no hay short-build.json: el proyecto temporal nunca
    // aparece en el registro de composiciones.
  };
  t.after(cleanup);
  try {
    const renderedSource = path.join(root, 'rendered.mp4');
    const state = {
      id: 'test-bridge',
      outputDir: path.join(root, 'output'),
      sourceVideo: path.join(root, 'source.mp4'),
      media: {duration: 120, width: 1920, height: 1080, fps: 30}
    };
    const candidate = {id: 'clip-1', start: 10, end: 25};
    const captions = [{
      id: 'seg-1',
      start: 10,
      end: 25,
      text: 'una frase completa',
      words: [
        {word: 'una', start: 10.5, end: 11},
        {word: 'frase', start: 11, end: 12},
        {word: 'completa', start: 12, end: 13}
      ]
    }];
    const cuts = [];
    const result = await renderCandidateWithRemotion({
      state,
      candidate,
      captions,
      renderMode: 'fit',
      runners: {
        cutClip: async (args) => { cuts.push(args); },
        build: async () => {},
        render: async () => {
          await writeFile(renderedSource, 'mp4-falso');
          return renderedSource;
        }
      }
    });

    assert.equal(result.slug, slug);
    assert.equal(result.captionTiming, 'word');
    assert.equal(cuts.length, 1);
    assert.equal(cuts[0].start, 10);
    assert.equal(cuts[0].durationSeconds, 15);
    assert.equal(cuts[0].videoFile, state.sourceVideo);

    const manifest = await readJson(path.join(projectDir(slug), 'manifest.json'));
    assert.equal(manifest.surface, 'shorts');
    assert.equal(manifest.clips.length, 1);
    const clip = manifest.clips[0];
    assert.equal(clip.durationSeconds, 15);
    assert.equal(clip.width, 1920);
    assert.equal(clip.transcript, 'transcripts/01.json');
    assert.equal(clip.wordCount, 3);
    assert.deepEqual(clip.focus, DEFAULT_FOCUS, 'en fit el encuadre lo fija el layout');
    assert.equal(clip.webcamBox, null, 'webcamBox solo en pip');

    const plan = await readJson(path.join(projectDir(slug), 'short-plan.json'));
    assert.equal(plan.scenes[0].layout, 'fit');
    assert.equal(plan.captions.mode, 'progressive');

    const transcript = await readJson(path.join(projectDir(slug), 'transcripts', '01.json'));
    assert.equal(transcript.words[0].start, 0.5);
    assert.equal(transcript.words[0].text, 'una');

    // El mp4 del runner se copio al artefacto del candidato.
    assert.equal(
      await readFile(path.join(state.outputDir, 'clip-1', 'short.mp4'), 'utf8'),
      'mp4-falso'
    );
    assert.equal(result.outputFile, path.join(state.outputDir, 'clip-1', 'short.mp4'));
  } finally {
    await cleanup();
  }
});

test('el bridge usa el focus del trackFace en layout full', async (t) => {
  const slug = 'short-test-bridge-full-clip-1';
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-bridge-full-'));
  const cleanup = async () => {
    await rm(root, {recursive: true, force: true});
    await rm(projectDir(slug), {recursive: true, force: true});
    await rm(mediaDir(slug), {recursive: true, force: true});
    // Sin build real no hay short-build.json: el proyecto temporal nunca
    // aparece en el registro de composiciones.
  };
  t.after(cleanup);
  try {
    const renderedSource = path.join(root, 'rendered.mp4');
    const face = {
      focus: {x: 0.42, y: 0.4, faceHeightRatio: 0.3},
      track: [{t: 0.5, x: 0.42, y: 0.4}, {t: 2, x: 0.5, y: 0.42}]
    };
    const result = await renderCandidateWithRemotion({
      state: {
        id: 'test-bridge-full',
        outputDir: path.join(root, 'output'),
        sourceVideo: path.join(root, 'source.mp4'),
        media: {duration: 120, width: 1080, height: 1920, fps: 30}
      },
      candidate: {id: 'clip-1', start: 0, end: 8},
      captions: [{id: 'seg-1', start: 0, end: 8, text: 'vertical', words: [{word: 'vertical', start: 1, end: 2}]}],
      renderMode: 'crop',
      runners: {
        cutClip: async () => {},
        build: async () => {},
        trackFace: async () => face,
        render: async () => {
          await writeFile(renderedSource, 'mp4-falso');
          return renderedSource;
        }
      }
    });
    const manifest = await readJson(path.join(projectDir(result.slug), 'manifest.json'));
    assert.deepEqual(manifest.clips[0].focus, face.focus);
    assert.deepEqual(manifest.clips[0].focusTrack, face.track);
    const plan = await readJson(path.join(projectDir(result.slug), 'short-plan.json'));
    assert.equal(plan.scenes[0].layout, 'full');
  } finally {
    await cleanup();
  }
});

test('processJob con renderEngine remotion usa el bridge y escribe su metadata', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-engine-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const videoFile = path.join(root, 'vertical.mp4');
  const transcriptFile = path.join(root, 'transcript.srt');
  // Video vertical real (crop): evita la deteccion de webcam y su modelo ONNX.
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=6:size=720x1280:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    videoFile
  ]);
  await writeFile(transcriptFile, [
    '1', '00:00:00,000 --> 00:00:03,000', 'primera frase del video', '',
    '2', '00:00:03,000 --> 00:00:06,000', 'segunda frase del video', ''
  ].join('\n'), 'utf8');

  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  const state = {
    id: 'job-engine',
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobDir,
    outputDir,
    sourceVideo: videoFile,
    sourceTranscript: transcriptFile,
    error: null,
    clips: []
  };
  await saveJobState(state);

  const calls = [];
  const finalState = await processJob(state, {
    renderEngine: 'remotion',
    useLlm: false,
    topN: 1,
    minDuration: 1,
    maxDuration: 6,
    renderCandidate: async ({candidate: selected}) => {
      calls.push(selected.id);
      const outputFile = path.join(outputDir, selected.id, 'short.mp4');
      await writeFile(outputFile, 'mp4-remotion');
      return {outputFile, slug: 'short-job-engine-x', buildFile: null, captionTiming: 'approximate', renderMode: 'crop', webcamBox: null};
    }
  });

  assert.equal(finalState.status, 'done');
  assert.equal(calls.length, 1, 'el bridge se llamo una vez por candidato');
  const clip = finalState.clips[0];
  assert.equal(clip.renderSettings.engine, 'remotion');
  assert.equal(clip.renderSettings.mode, 'crop', 'fuente vertical: modo crop');
  assert.equal(clip.renderSettings.slug, 'short-job-engine-x');
  assert.deepEqual(Object.keys(clip.files).sort(), ['metadata', 'video'], 'sin ass en la rama remotion');
  assert.equal(await readFile(clip.files.video, 'utf8'), 'mp4-remotion');
  assert.ok(
    (finalState.warnings ?? []).some((warning) => warning.includes('tiempos aproximados')),
    'mantiene el aviso de tiempos aproximados'
  );
  const metadata = JSON.parse(await readFile(clip.files.metadata, 'utf8'));
  assert.equal(metadata.renderSettings.engine, 'remotion');
});

test('sampleRange muestrea dentro de la ventana con inset del 5%', () => {
  // Sin ventana, el rango historico del job completo.
  assert.deepEqual(sampleRange(100), {start: 8, end: 88});
  // Con ventana: 5% de inset en cada extremo.
  assert.deepEqual(sampleRange(100, {startSeconds: 10, endSeconds: 20}), {start: 10.5, end: 19.5});
  // La ventana se clampa a la duracion del video.
  assert.deepEqual(sampleRange(100, {startSeconds: 90, endSeconds: 120}), {start: 91.5, end: 100});
});

test('el bridge clasifica el layout por segmento', async (t) => {
  const roots = [];
  const slugs = [];
  t.after(async () => {
    for (const root of roots) await rm(root, {recursive: true, force: true});
    for (const slug of slugs) {
      await rm(projectDir(slug), {recursive: true, force: true});
      await rm(mediaDir(slug), {recursive: true, force: true});
    }
    // Con el build mockeado no hay short-build.json: el proyecto temporal nunca
    // aparece en el registro de composiciones y no hay nada que regenerar.
  });

  const captions = [{
    id: 'seg-1',
    start: 0,
    end: 60,
    text: 'algo que decir',
    words: [{word: 'algo', start: 1, end: 2}, {word: 'que', start: 2, end: 2.4}, {word: 'decir', start: 2.4, end: 3}]
  }];
  const face = {
    focus: {x: 0.42, y: 0.4, faceHeightRatio: 0.3},
    track: [{t: 0.5, x: 0.42, y: 0.4}, {t: 2, x: 0.5, y: 0.42}]
  };

  const runCase = async (name, {
    media,
    candidate = {id: 'c1', start: 5, end: 20},
    renderMode = null,
    webcamBox = null,
    webcamResult = null,
    faceResult = null
  }) => {
    const root = await mkdtemp(path.join(tmpdir(), `shortsmith-cls-${name}-`));
    roots.push(root);
    const renderedSource = path.join(root, 'rendered.mp4');
    const calls = {detect: 0, detectArgs: null, track: 0, cut: 0};
    const state = {
      id: `cls-${name}`,
      outputDir: path.join(root, 'output'),
      sourceVideo: path.join(root, 'src.mp4'),
      media
    };
    const result = await renderCandidateWithRemotion({
      state,
      candidate,
      captions,
      renderMode,
      webcamBox,
      runners: {
        cutClip: async () => { calls.cut += 1; },
        build: async () => {},
        render: async () => {
          await writeFile(renderedSource, 'x');
          return renderedSource;
        },
        detectWebcam: async (videoFile, detectedMedia, options) => {
          calls.detect += 1;
          calls.detectArgs = {videoFile, options};
          return webcamResult;
        },
        trackFace: async () => {
          calls.track += 1;
          return faceResult;
        }
      }
    });
    slugs.push(result.slug);
    const manifest = await readJson(path.join(projectDir(result.slug), 'manifest.json'));
    const plan = await readJson(path.join(projectDir(result.slug), 'short-plan.json'));
    return {result, manifest, plan, calls, candidate};
  };

  // (a) Horizontal con webcam en la ventana del candidato -> pip con ESE box.
  const box = {x: 1400, y: 700, w: 320, h: 240, confidence: 0.9, method: 'yunet-face-tracking'};
  const pip = await runCase('pip', {
    media: {duration: 60, width: 1920, height: 1080, fps: 30},
    webcamResult: box
  });
  assert.equal(pip.result.renderMode, 'pip');
  assert.deepEqual(pip.result.webcamBox, box);
  assert.equal(pip.calls.detect, 1);
  assert.equal(pip.calls.track, 0, 'con webcam no hace falta buscar cara a pantalla completa');
  assert.deepEqual(pip.calls.detectArgs.options.window, {startSeconds: 5, endSeconds: 20});
  assert.equal(pip.calls.detectArgs.videoFile, path.join(roots.at(-1), 'src.mp4'), 'la webcam se busca en la fuente, no en el corte');
  assert.equal(pip.plan.scenes[0].layout, 'pip');
  assert.deepEqual(pip.plan.scenes[0].webcamBox, box);
  assert.deepEqual(pip.manifest.clips[0].webcamBox, box);

  // (b) Horizontal sin webcam pero con cara a pantalla completa -> crop/full.
  const head = await runCase('cara', {
    media: {duration: 60, width: 1920, height: 1080, fps: 30},
    faceResult: face
  });
  assert.equal(head.result.renderMode, 'crop');
  assert.equal(head.result.webcamBox, null);
  assert.equal(head.calls.detect, 1);
  assert.equal(head.calls.track, 1, 'el trackFace de la clasificacion se reutiliza para el foco');
  assert.equal(head.plan.scenes[0].layout, 'full');
  assert.deepEqual(head.manifest.clips[0].focus, face.focus);
  assert.deepEqual(head.manifest.clips[0].focusTrack, face.track);

  // (c) Horizontal sin webcam ni cara -> fit.
  const fit = await runCase('fit', {
    media: {duration: 60, width: 1920, height: 1080, fps: 30}
  });
  assert.equal(fit.result.renderMode, 'fit');
  assert.equal(fit.calls.track, 1);
  assert.equal(fit.plan.scenes[0].layout, 'fit');
  assert.equal(fit.manifest.clips[0].webcamBox, null);

  // (d) Vertical -> crop directo, sin buscar webcam.
  const vertical = await runCase('vertical', {
    media: {duration: 60, width: 1080, height: 1920, fps: 30},
    faceResult: face
  });
  assert.equal(vertical.result.renderMode, 'crop');
  assert.equal(vertical.calls.detect, 0, 'una fuente vertical nunca es pip');
  assert.equal(vertical.calls.track, 1, 'pero si busca la cara para el foco');
  assert.equal(vertical.plan.scenes[0].layout, 'full');

  // (e) renderMode explicito se respeta y no clasifica nada.
  const forced = await runCase('forzado', {
    media: {duration: 60, width: 1920, height: 1080, fps: 30},
    renderMode: 'fit',
    faceResult: face
  });
  assert.equal(forced.result.renderMode, 'fit');
  assert.equal(forced.calls.detect, 0);
  assert.equal(forced.calls.track, 0);
  assert.equal(forced.plan.scenes[0].layout, 'fit');

  // (f) pip explicito usa el webcamBox recibido, sin detectar.
  const forcedPip = await runCase('pip-forzado', {
    media: {duration: 60, width: 1920, height: 1080, fps: 30},
    renderMode: 'pip',
    webcamBox: box,
    webcamResult: {x: 0, y: 0, w: 99, h: 99}
  });
  assert.equal(forcedPip.result.renderMode, 'pip');
  assert.equal(forcedPip.calls.detect, 0, 'con modo explicito no se clasifica');
  assert.deepEqual(forcedPip.result.webcamBox, box);
});

test('processJob con renderEngine remotion y sin renderMode no detecta webcam a nivel job', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-classify-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const videoFile = path.join(root, 'horizontal.mp4');
  const transcriptFile = path.join(root, 'transcript.srt');
  // Video horizontal real: con la logica anterior esto dispararia la deteccion
  // de webcam del job; con la clasificacion por segmento no debe ejecutarse.
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=6:size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    videoFile
  ]);
  await writeFile(transcriptFile, [
    '1', '00:00:00,000 --> 00:00:03,000', 'primera frase del video', '',
    '2', '00:00:03,000 --> 00:00:06,000', 'segunda frase del video', ''
  ].join('\n'), 'utf8');

  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  const state = {
    id: 'job-classify',
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobDir,
    outputDir,
    sourceVideo: videoFile,
    sourceTranscript: transcriptFile,
    error: null,
    clips: []
  };
  await saveJobState(state);

  const bridgeArgs = [];
  const finalState = await processJob(state, {
    renderEngine: 'remotion',
    useLlm: false,
    topN: 1,
    minDuration: 1,
    maxDuration: 6,
    renderCandidate: async (args) => {
      bridgeArgs.push(args);
      const outputFile = path.join(outputDir, args.candidate.id, 'short.mp4');
      await writeFile(outputFile, 'mp4-remotion');
      return {outputFile, slug: 'short-job-classify-x', buildFile: null, captionTiming: 'approximate', renderMode: 'fit', webcamBox: null};
    }
  });

  assert.equal(finalState.status, 'done');
  assert.equal(finalState.webcamBox ?? null, null, 'no se detecto webcam a nivel job');
  assert.ok(
    !(finalState.warnings ?? []).some((warning) => warning.includes('No se detectó una webcam')),
    'el warning de deteccion de job ya no aplica'
  );
  assert.equal(bridgeArgs.length, 1);
  assert.equal(bridgeArgs[0].renderMode, null, 'sin modo explicito el bridge clasifica por segmento');
  assert.equal(bridgeArgs[0].webcamBox, null, 'y no hereda el webcamBox de job');
  assert.equal(finalState.clips[0].renderSettings.mode, 'fit', 'la metadata registra el modo efectivo del candidato');
  assert.equal(finalState.clips[0].renderSettings.webcamBox, null);
});

test('processJob remotion + pip explicito cae a fit si no hay webcam', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-pip-fallback-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const videoFile = path.join(root, 'horizontal.mp4');
  const transcriptFile = path.join(root, 'transcript.srt');
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc=duration=6:size=640x360:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
    videoFile
  ]);
  await writeFile(transcriptFile, [
    '1', '00:00:00,000 --> 00:00:03,000', 'primera frase del video', '',
    '2', '00:00:03,000 --> 00:00:06,000', 'segunda frase del video', ''
  ].join('\n'), 'utf8');

  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  const state = {
    id: 'job-pip-fallback',
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobDir,
    outputDir,
    sourceVideo: videoFile,
    sourceTranscript: transcriptFile,
    error: null,
    clips: []
  };
  await saveJobState(state);

  const bridgeArgs = [];
  const finalState = await processJob(state, {
    renderEngine: 'remotion',
    renderMode: 'pip',
    useLlm: false,
    topN: 1,
    minDuration: 1,
    maxDuration: 6,
    detectWebcam: async () => null,
    renderCandidate: async (args) => {
      bridgeArgs.push(args);
      const outputFile = path.join(outputDir, args.candidate.id, 'short.mp4');
      await writeFile(outputFile, 'mp4-remotion');
      return {
        outputFile,
        slug: 'short-job-pip-fallback',
        buildFile: null,
        captionTiming: 'word',
        renderMode: args.renderMode,
        webcamBox: args.webcamBox
      };
    }
  });

  assert.equal(finalState.status, 'done');
  assert.equal(bridgeArgs.length, 1);
  assert.equal(bridgeArgs[0].renderMode, 'fit', 'pip sin webcam se degrada a fit, no se pasa pip al bridge');
  assert.equal(bridgeArgs[0].webcamBox, null);
  assert.equal(finalState.clips[0].renderSettings.mode, 'fit');
  assert.ok(
    (finalState.warnings ?? []).some((warning) => warning.includes('webcam')),
    'avisa de que no hubo webcam estable'
  );
});
