import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  ingestAnnotatedChart,
  inspectChartImage,
  proposeChartCalibration,
  selectChartAnnotations,
  stageChartAsset
} from '../src/lib/chart-ingestion.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SAMPLE_IMAGE = path.join(
  ROOT,
  'remotion-animations',
  'public',
  'assets',
  'library',
  'chart-samples',
  'demo-index-2025.svg'
);
const PUBLIC_ROOT = path.join(ROOT, 'remotion-animations', 'public');
const SAMPLE_INPUT_FILE = path.join(
  ROOT,
  'remotion-animations',
  'projects',
  'chart-ingestion-demo',
  'chart-ingestion-input.json'
);

async function sampleInput() {
  const input = JSON.parse(await readFile(SAMPLE_INPUT_FILE, 'utf8'));
  return {...input, imageFile: SAMPLE_IMAGE};
}

test('inspecciona la gráfica y propone una región acotada sin OCR', async () => {
  const inspection = await inspectChartImage(SAMPLE_IMAGE);
  assert.equal(inspection.width, 1700);
  assert.equal(inspection.height, 760);
  assert.match(inspection.sha256, /^[a-f0-9]{64}$/);
  assert.ok(inspection.plotRegionProposal.confidence >= 0.28);
  const region = inspection.plotRegionProposal.pixels;
  assert.ok(region.x >= 0 && region.y >= 0);
  assert.ok(region.width > 900 && region.height > 300);
  assert.ok(region.x + region.width <= inspection.width);
  assert.ok(region.y + region.height <= inspection.height);
});

test('la ingestión confirmada genera props y animation-spec listos', async () => {
  const result = await ingestAnnotatedChart(await sampleInput(), {
    publicRoot: PUBLIC_ROOT,
    now: '2026-07-27T08:00:00.000Z'
  });
  assert.equal(result.calibration.status, 'confirmed');
  assert.equal(result.renderReady, true);
  assert.equal(result.selection.mode, 'deterministic-fallback');
  assert.deepEqual(
    result.props.annotations.map((annotation) => annotation.type),
    ['line-retrace', 'range-highlight', 'cursor-journey', 'peak-to-trough']
  );
  assert.deepEqual(
    result.props.annotations
      .filter((annotation) => annotation.from)
      .map((annotation) => [annotation.from, annotation.to]),
    [
      ['2025-04-01', '2025-05-01'],
      ['2025-04-01', '2025-05-01']
    ]
  );
  assert.equal(result.animationSpec.selection.patternId, 'asset.annotated-chart');
  assert.equal(result.animationSpec.source.imageFile, SAMPLE_IMAGE);
  assert.equal(result.props.artDirection, 'market-data');
  assert.equal(result.animationSpec.output.compositionId, 'Chart-Annotated-Market');
  assert.deepEqual(
    result.animationSpec.output.renderTargets.map((target) => target.sound),
    ['silent', 'with-sfx']
  );
  assert.equal(
    result.animationSpec.output.renderTargets[1].compositionId,
    'Chart-Annotated-Range-Audio'
  );
  assert.equal(result.props.image.publicPath, 'assets/library/chart-samples/demo-index-2025.svg');
});

test('las inferencias quedan bloqueadas hasta aceptar la propuesta', async () => {
  const input = await sampleInput();
  delete input.calibration;
  const blocked = await ingestAnnotatedChart(input, {
    publicRoot: PUBLIC_ROOT,
    now: '2026-07-27T08:00:00.000Z'
  });
  assert.equal(blocked.calibration.status, 'proposed');
  assert.equal(blocked.renderReady, false);
  assert.equal(blocked.props, null);
  assert.match(blocked.warnings.join(' '), /propuesta/i);

  const accepted = await ingestAnnotatedChart(input, {
    publicRoot: PUBLIC_ROOT,
    allowProposed: true,
    now: '2026-07-27T08:00:00.000Z'
  });
  assert.equal(accepted.renderReady, true);
  assert.equal(accepted.calibration.requiresReview, true);
  assert.ok(accepted.props.image.plotRegion.width > 0);
});

test('una calibración aportada sin aceptación explícita sigue siendo propuesta', async () => {
  const input = await sampleInput();
  delete input.calibration.confirmation;
  const inspection = await inspectChartImage(input.imageFile);
  const calibration = proposeChartCalibration(input, inspection, null);
  assert.equal(calibration.status, 'proposed');
  assert.equal(calibration.renderReady, false);
  assert.match(calibration.warnings.join(' '), /aceptación explícita/i);
});

test('el selector LLM acepta solo fechas autorizadas', async () => {
  const input = await sampleInput();
  const calibration = {
    xAxis: {value: input.calibration.xAxis},
    yAxis: {value: input.calibration.yAxis}
  };
  const result = await selectChartAnnotations(input, calibration, {
    useLlm: true,
    llmConfig: {
      provider: 'openai-compatible',
      baseUrl: 'https://example.invalid/v1',
      apiKey: 'test',
      model: 'test'
    },
    chatJsonImpl: async () => ({
      claim: 'El cierre queda por encima del inicio.',
      title: 'El balance del año',
      supportingText: '',
      showHeader: true,
      annotations: [
        {
          type: 'before-after',
          from: '2025-01-02',
          to: '2025-12-01',
          label: 'Balance'
        }
      ]
    })
  });
  assert.equal(result.mode, 'llm-validated');
  assert.equal(result.llmUsed, true);
  assert.equal(result.annotations[0].type, 'before-after');
});

test('una fecha inventada por el LLM activa fallback controlado', async () => {
  const input = await sampleInput();
  const calibration = {
    xAxis: {value: input.calibration.xAxis},
    yAxis: {value: input.calibration.yAxis}
  };
  const result = await selectChartAnnotations(input, calibration, {
    useLlm: true,
    llmConfig: {
      provider: 'openai-compatible',
      baseUrl: 'https://example.invalid/v1',
      apiKey: 'test',
      model: 'test'
    },
    chatJsonImpl: async () => ({
      title: 'Dato inventado',
      showHeader: true,
      annotations: [
        {
          type: 'event-marker',
          date: '2025-04-15',
          label: 'Evento'
        }
      ]
    })
  });
  assert.equal(result.mode, 'deterministic-fallback');
  assert.equal(result.llmUsed, false);
  assert.equal(result.fallbackUsed, true);
  assert.match(result.warnings.join(' '), /fecha .* (no pertenece|no tiene)/i);
});

test('un dato editorial inventado por el LLM activa fallback controlado', async () => {
  const input = await sampleInput();
  const calibration = {
    xAxis: {value: input.calibration.xAxis},
    yAxis: {value: input.calibration.yAxis}
  };
  const result = await selectChartAnnotations(input, calibration, {
    useLlm: true,
    llmConfig: {
      provider: 'openai-compatible',
      baseUrl: 'https://example.invalid/v1',
      apiKey: 'test',
      model: 'test'
    },
    chatJsonImpl: async () => ({
      claim: 'El índice subió un 37%.',
      title: 'Sube un 37%',
      supportingText: '',
      showHeader: true,
      annotations: [
        {
          type: 'before-after',
          from: '2025-01-02',
          to: '2025-12-01',
          label: 'Balance'
        }
      ]
    })
  });
  assert.equal(result.mode, 'deterministic-fallback');
  assert.match(result.warnings.join(' '), /dato no autorizado/i);
});

test('el staging normaliza imágenes grandes y conserva hashes', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'shortsmith-chart-ingestion-'));
  try {
    const source = path.join(temporary, 'large-chart.png');
    const publicRoot = path.join(temporary, 'public');
    await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: '#07111F'
      }
    }).png().toFile(source);
    const inspection = await inspectChartImage(source);
    const staged = await stageChartAsset(
      {
        project: 'Prueba de gráfica',
        imageFile: source,
        provenance: 'project-owned'
      },
      inspection,
      {publicRoot}
    );
    assert.equal(staged.resized, true);
    assert.equal(staged.reused, false);
    assert.ok(staged.width <= 1700);
    assert.ok(staged.height <= 760);
    assert.match(staged.publicPath, /^assets\/projects\/prueba-de-grafica\/charts\//);
    assert.match(staged.stagedSha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
});

test('el staging rasteriza SVG externos antes de publicarlos', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'shortsmith-chart-svg-'));
  try {
    const source = path.join(temporary, 'external-chart.svg');
    const publicRoot = path.join(temporary, 'public');
    await writeFile(
      source,
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#07111F"/></svg>'
    );
    const inspection = await inspectChartImage(source);
    const staged = await stageChartAsset(
      {project: 'svg-externo', imageFile: source, provenance: 'user-provided'},
      inspection,
      {publicRoot}
    );
    assert.equal(staged.rasterized, true);
    assert.match(staged.publicPath, /\.png$/);
    const metadata = await sharp(staged.stagedFile).metadata();
    assert.equal(metadata.format, 'png');
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
});
