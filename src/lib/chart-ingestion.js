import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  dateFraction,
  exactSeriesDatum,
  interpolateIsoDate,
  interpolateSeriesValue,
  normalizeSeries,
  parseIsoDate,
  valueFraction
} from '../../remotion-animations/src/charts/chart-geometry.mjs';
import {
  getVisionLlmConfig,
  isVisionLlmEnabled
} from './animation-scout-llm.js';
import {
  chatJson,
  getLlmConfig,
  isLlmEnabled
} from './llm.js';
import {ROOT, clamp, round} from './utils.js';
import {validateChartIngestionInput} from './schema-validation.js';
import {planAnimationVariety} from './animation-variety.js';

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp'
]);
const DATA_ANNOTATIONS = new Set([
  'line-retrace',
  'cursor-journey',
  'peak-to-trough',
  'before-after'
]);
const ALL_ANNOTATIONS = new Set([
  ...DATA_ANNOTATIONS,
  'range-highlight',
  'event-marker'
]);
const DEFAULT_COLORS = {
  accentColor: '#42C7F5',
  dangerColor: '#FF6B78'
};
const FOCUS_INTENTS = new Set([
  'auto',
  'range',
  'event',
  'before-after',
  'peak-to-trough',
  'trend'
]);
const MAX_SOURCE_BYTES = 80 * 1024 * 1024;

function cleanText(value, maxLength = 500) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeSearchText(value) {
  return cleanText(value, 20_000)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function slugifyChartProject(value) {
  const slug = String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (!slug) throw new Error('project debe contener al menos un carácter alfanumérico.');
  return slug;
}

function finiteNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} debe ser un número finito.`);
  }
  return parsed;
}

function normalizeColor(value, fallback, label) {
  const color = String(value || fallback);
  if (!/^#[a-fA-F0-9]{6}$/.test(color)) {
    throw new Error(`${label} debe usar el formato #RRGGBB.`);
  }
  return color;
}

function assertIsoDate(value, label) {
  const normalized = String(value ?? '');
  parseIsoDate(normalized);
  return normalized;
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return Boolean(
    relative
    && !relative.startsWith('..')
    && !path.isAbsolute(relative)
  );
}

async function sha256File(file) {
  const bytes = await readFile(file);
  return createHash('sha256').update(bytes).digest('hex');
}

function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function profileBoundary(profile, start, end, prior) {
  const from = Math.max(1, Math.floor(profile.length * start));
  const to = Math.min(profile.length - 2, Math.ceil(profile.length * end));
  const slice = profile.slice(from, to + 1);
  const maximum = Math.max(1, ...slice);
  let best = {index: Math.round(profile.length * prior), score: -Infinity, edge: 0};
  const band = Math.max(0.01, end - start);
  for (let index = from; index <= to; index += 1) {
    const edge = profile[index] / maximum;
    const priorScore = 1 - Math.min(1, Math.abs(index / profile.length - prior) / band);
    const score = edge * 0.62 + priorScore * 0.38;
    if (score > best.score) best = {index, score, edge};
  }
  return best;
}

async function estimatePlotRegion(imageFile, metadata) {
  const {data, info} = await sharp(imageFile, {density: 144})
    .resize({width: 480, height: 340, fit: 'inside', withoutEnlargement: true})
    .flatten({background: '#0B1420'})
    .grayscale()
    .raw()
    .toBuffer({resolveWithObject: true});
  const vertical = new Array(info.width).fill(0);
  const horizontal = new Array(info.height).fill(0);
  const yStart = Math.floor(info.height * 0.04);
  const yEnd = Math.ceil(info.height * 0.95);
  const xStart = Math.floor(info.width * 0.03);
  const xEnd = Math.ceil(info.width * 0.97);

  for (let y = yStart; y < yEnd; y += 1) {
    const row = y * info.width;
    for (let x = 1; x < info.width; x += 1) {
      vertical[x] += Math.abs(data[row + x] - data[row + x - 1]);
    }
  }
  for (let y = 1; y < info.height; y += 1) {
    const row = y * info.width;
    const previous = (y - 1) * info.width;
    for (let x = xStart; x < xEnd; x += 1) {
      horizontal[y] += Math.abs(data[row + x] - data[previous + x]);
    }
  }

  const left = profileBoundary(vertical, 0.04, 0.2, 0.07);
  const right = profileBoundary(vertical, 0.76, 0.97, 0.93);
  const top = profileBoundary(horizontal, 0.03, 0.24, 0.09);
  const bottom = profileBoundary(horizontal, 0.66, 0.94, 0.84);
  let normalized = {
    x: left.index / info.width,
    y: top.index / info.height,
    width: (right.index - left.index) / info.width,
    height: (bottom.index - top.index) / info.height
  };
  if (normalized.width < 0.55 || normalized.height < 0.45) {
    normalized = {x: 0.07, y: 0.09, width: 0.86, height: 0.75};
  }
  const edgeSupport = (left.edge + right.edge + top.edge + bottom.edge) / 4;
  const confidence = round(clamp(0.28 + edgeSupport * 0.28, 0.28, 0.62), 2);
  return {
    method: 'edge-profile-safe-frame-v1',
    confidence,
    normalized: {
      x: round(normalized.x, 4),
      y: round(normalized.y, 4),
      width: round(normalized.width, 4),
      height: round(normalized.height, 4)
    },
    pixels: {
      x: Math.round(normalized.x * metadata.width),
      y: Math.round(normalized.y * metadata.height),
      width: Math.round(normalized.width * metadata.width),
      height: Math.round(normalized.height * metadata.height)
    },
    diagnostics: {
      edgeSupport: round(edgeSupport, 3),
      rasterWidth: info.width,
      rasterHeight: info.height
    }
  };
}

export async function inspectChartImage(imageFile) {
  const absolute = path.resolve(imageFile);
  const extension = path.extname(absolute).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`Formato de gráfica no soportado: ${extension || '(sin extensión)'}.`);
  }
  const fileStat = await stat(absolute).catch(() => null);
  if (!fileStat?.isFile()) throw new Error(`No existe la imagen de gráfica: ${absolute}`);
  if (fileStat.size > MAX_SOURCE_BYTES) {
    throw new Error(`La imagen supera el límite de ${MAX_SOURCE_BYTES} bytes.`);
  }
  const metadata = await sharp(absolute).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('No se pudieron determinar las dimensiones de la gráfica.');
  }
  const plotRegionProposal = await estimatePlotRegion(absolute, metadata);
  return {
    file: absolute,
    extension,
    format: metadata.format || extension.slice(1),
    width: metadata.width,
    height: metadata.height,
    sizeBytes: fileStat.size,
    sha256: await sha256File(absolute),
    plotRegionProposal
  };
}

function normalizedRegionToPixels(region, width, height) {
  const x = clamp(finiteNumber(region?.x, 'plotRegion.x'), 0, 1);
  const y = clamp(finiteNumber(region?.y, 'plotRegion.y'), 0, 1);
  const regionWidth = clamp(finiteNumber(region?.width, 'plotRegion.width'), 0.01, 1 - x);
  const regionHeight = clamp(finiteNumber(region?.height, 'plotRegion.height'), 0.01, 1 - y);
  return {
    x: Math.round(x * width),
    y: Math.round(y * height),
    width: Math.round(regionWidth * width),
    height: Math.round(regionHeight * height)
  };
}

function normalizeVisionAnalysis(raw, inspection) {
  const confidence = round(clamp(Number(raw?.confidence) || 0, 0, 1), 2);
  let plotRegion = null;
  if (raw?.plotRegion) {
    try {
      plotRegion = normalizedRegionToPixels(
        raw.plotRegion,
        inspection.width,
        inspection.height
      );
    } catch {
      plotRegion = null;
    }
  }
  let xAxis = null;
  try {
    if (raw?.xAxis?.start && raw?.xAxis?.end) {
      xAxis = {
        start: assertIsoDate(raw.xAxis.start, 'vision.xAxis.start'),
        end: assertIsoDate(raw.xAxis.end, 'vision.xAxis.end')
      };
      if (parseIsoDate(xAxis.end) <= parseIsoDate(xAxis.start)) xAxis = null;
    }
  } catch {
    xAxis = null;
  }
  let yAxis = null;
  try {
    if (raw?.yAxis?.min != null && raw?.yAxis?.max != null) {
      yAxis = {
        min: finiteNumber(raw.yAxis.min, 'vision.yAxis.min'),
        max: finiteNumber(raw.yAxis.max, 'vision.yAxis.max'),
        unit: cleanText(raw.yAxis.unit, 12),
        decimals: clamp(Math.round(Number(raw.yAxis.decimals) || 0), 0, 4)
      };
      if (yAxis.max <= yAxis.min) yAxis = null;
    }
  } catch {
    yAxis = null;
  }
  return {
    confidence,
    plotRegion,
    xAxis,
    yAxis,
    observations: Array.isArray(raw?.observations)
      ? raw.observations.map((item) => cleanText(item, 200)).filter(Boolean)
      : [],
    uncertainties: Array.isArray(raw?.uncertainties)
      ? raw.uncertainties.map((item) => cleanText(item, 200)).filter(Boolean)
      : []
  };
}

export async function analyzeChartImageWithVision(imageFile, inspection, options = {}) {
  const config = getVisionLlmConfig(options.visionConfig || {});
  if (!isVisionLlmEnabled(config)) {
    throw new Error(
      'El LLM visual no está configurado. Define VISION_LLM_API_KEY y VISION_LLM_MODEL.'
    );
  }
  const png = await sharp(imageFile, {density: 144})
    .resize({width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true})
    .png()
    .toBuffer();
  const prompt = `Inspecciona esta única imagen de una gráfica.
Solo puedes describir píxeles visibles. No inventes valores ni completes etiquetas cortadas.

Dimensiones originales: ${inspection.width}x${inspection.height}.

Devuelve JSON:
{
  "plotRegion": {"x": 0, "y": 0, "width": 1, "height": 1},
  "xAxis": {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"},
  "yAxis": {"min": 0, "max": 0, "unit": "", "decimals": 0},
  "confidence": 0,
  "observations": [],
  "uncertainties": []
}

plotRegion usa coordenadas normalizadas de la zona donde se dibuja la serie,
sin incluir título, leyenda ni etiquetas exteriores. Omite xAxis o yAxis si
no se leen con claridad. La salida es una propuesta no confirmada.`;
  const chatJsonImpl = options.chatJsonImpl || chatJson;
  const raw = await chatJsonImpl([
    {
      role: 'system',
      content: 'Eres un analista visual de gráficas. Devuelve solo JSON y conserva toda incertidumbre.'
    },
    {
      role: 'user',
      content: [
        {type: 'text', text: prompt},
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${png.toString('base64')}`,
            detail: config.imageDetail
          }
        }
      ]
    }
  ], {
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    maxTokens: 1_600,
    json: config.jsonMode,
    fetch: options.fetch,
    sleep: options.sleep,
    signal: options.signal
  });
  return normalizeVisionAnalysis(raw, inspection);
}

function normalizePlotRegion(region, inspection) {
  if (!region) return null;
  const x = finiteNumber(region.x, 'calibration.plotRegion.x');
  const y = finiteNumber(region.y, 'calibration.plotRegion.y');
  const width = finiteNumber(region.width, 'calibration.plotRegion.width');
  const height = finiteNumber(region.height, 'calibration.plotRegion.height');
  if (
    x < 0
    || y < 0
    || width <= 0
    || height <= 0
    || x + width > inspection.width
    || y + height > inspection.height
  ) {
    throw new Error('calibration.plotRegion debe quedar dentro de la imagen original.');
  }
  return {x, y, width, height};
}

function normalizeXAxis(axis, label = 'calibration.xAxis') {
  if (!axis) return null;
  const start = assertIsoDate(axis.start, `${label}.start`);
  const end = assertIsoDate(axis.end, `${label}.end`);
  if (parseIsoDate(end) <= parseIsoDate(start)) {
    throw new Error(`${label}.end debe ser posterior a ${label}.start.`);
  }
  return {start, end};
}

function normalizeYAxis(axis, label = 'calibration.yAxis') {
  if (!axis) return null;
  const min = finiteNumber(axis.min, `${label}.min`);
  const max = finiteNumber(axis.max, `${label}.max`);
  if (max <= min) throw new Error(`${label}.max debe ser mayor que ${label}.min.`);
  return {
    min,
    max,
    unit: cleanText(axis.unit, 12),
    decimals: clamp(Math.round(Number(axis.decimals) || 0), 0, 4)
  };
}

function normalizeSeriesInput(series) {
  if (series == null) return [];
  if (!Array.isArray(series)) throw new Error('series debe ser un array.');
  if (series.length === 0) return [];
  return normalizeSeries(series).map(({date, value}) => ({date, value}));
}

function axesFromSeries(series) {
  if (series.length < 2) return {xAxis: null, yAxis: null};
  const values = series.map((datum) => datum.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding = range > 0 ? range * 0.08 : Math.max(1, Math.abs(maxValue) * 0.05);
  const decimals = values.some((value) => !Number.isInteger(value)) ? 1 : 0;
  return {
    xAxis: {start: series[0].date, end: series.at(-1).date},
    yAxis: {
      min: round(minValue - padding, Math.max(1, decimals)),
      max: round(maxValue + padding, Math.max(1, decimals)),
      unit: '',
      decimals
    }
  };
}

function validateSeriesAgainstAxes(series, xAxis, yAxis) {
  const warnings = [];
  if (!series.length || !xAxis || !yAxis) return warnings;
  const start = parseIsoDate(xAxis.start);
  const end = parseIsoDate(xAxis.end);
  const outsideDate = series.find((datum) => {
    const timestamp = parseIsoDate(datum.date);
    return timestamp < start || timestamp > end;
  });
  const outsideValue = series.find(
    (datum) => datum.value < yAxis.min || datum.value > yAxis.max
  );
  if (outsideDate) {
    warnings.push(`La serie contiene ${outsideDate.date} fuera del eje temporal.`);
  }
  if (outsideValue) {
    warnings.push(`La serie contiene ${outsideValue.value} fuera del eje vertical.`);
  }
  return warnings;
}

export function proposeChartCalibration(input, inspection, vision, options = {}) {
  const calibration = input.calibration || {};
  const confirmation = calibration.confirmation;
  const explicitlyConfirmed = Boolean(
    confirmation?.status === 'accepted'
    && confirmation?.scope === 'plot-region-and-axes'
    && cleanText(confirmation?.acceptedBy, 80)
  );
  const suppliedSource = explicitlyConfirmed ? 'user-confirmed' : 'user-proposal';
  const suppliedConfidence = explicitlyConfirmed ? 1 : 0.9;
  const inferredAxes = axesFromSeries(input.series);
  const plotRegion = calibration.plotRegion
    ? {
        value: normalizePlotRegion(calibration.plotRegion, inspection),
        source: suppliedSource,
        confidence: suppliedConfidence
      }
    : vision?.plotRegion
      ? {
          value: normalizePlotRegion(vision.plotRegion, inspection),
          source: 'vision-proposal',
          confidence: Math.min(0.78, vision.confidence)
        }
      : {
          value: inspection.plotRegionProposal.pixels,
          source: 'heuristic-proposal',
          confidence: inspection.plotRegionProposal.confidence
        };
  const xAxis = calibration.xAxis
    ? {
        value: normalizeXAxis(calibration.xAxis),
        source: suppliedSource,
        confidence: suppliedConfidence
      }
    : vision?.xAxis
      ? {value: normalizeXAxis(vision.xAxis, 'vision.xAxis'), source: 'vision-proposal', confidence: Math.min(0.72, vision.confidence)}
      : inferredAxes.xAxis
        ? {value: inferredAxes.xAxis, source: 'series-proposal', confidence: 0.68}
        : null;
  const yAxis = calibration.yAxis
    ? {
        value: normalizeYAxis(calibration.yAxis),
        source: suppliedSource,
        confidence: suppliedConfidence
      }
    : vision?.yAxis
      ? {value: normalizeYAxis(vision.yAxis, 'vision.yAxis'), source: 'vision-proposal', confidence: Math.min(0.68, vision.confidence)}
      : inferredAxes.yAxis
        ? {value: inferredAxes.yAxis, source: 'series-proposal', confidence: 0.64}
        : null;
  const complete = Boolean(plotRegion?.value && xAxis?.value && yAxis?.value);
  const confirmed = Boolean(
    complete
    && plotRegion.source === 'user-confirmed'
    && xAxis.source === 'user-confirmed'
    && yAxis.source === 'user-confirmed'
  );
  const axisWarnings = validateSeriesAgainstAxes(
    input.series,
    xAxis?.value,
    yAxis?.value
  );
  const renderReady = Boolean(
    complete
    && axisWarnings.length === 0
    && (confirmed || options.allowProposed)
  );
  const warnings = [...axisWarnings];
  if (!complete) {
    warnings.push('Faltan límites de ejes; no se generarán props de render.');
  } else if (!confirmed && !options.allowProposed) {
    warnings.push(
      'La calibración es una propuesta. Revísala o usa --allow-proposed para generar props.'
    );
  }
  if (
    calibration.plotRegion
    && calibration.xAxis
    && calibration.yAxis
    && !explicitlyConfirmed
  ) {
    warnings.push(
      'La calibración fue aportada, pero no incluye una aceptación explícita de región y ejes.'
    );
  }
  return {
    status: !complete ? 'blocked' : confirmed ? 'confirmed' : 'proposed',
    renderReady,
    requiresReview: !confirmed,
    confirmation: explicitlyConfirmed ? confirmation : null,
    plotRegion,
    xAxis,
    yAxis,
    warnings
  };
}

function annotationDates(annotation) {
  if (annotation.type === 'range-highlight' || annotation.type === 'cursor-journey') {
    return [annotation.from, annotation.to];
  }
  if (annotation.type === 'peak-to-trough') {
    return [annotation.peakDate, annotation.troughDate];
  }
  if (annotation.type === 'before-after') return [annotation.from, annotation.to];
  if (annotation.type === 'event-marker') return [annotation.date];
  return [];
}

function buildAllowedDates(input, calibration) {
  const dates = new Set(input.series.map((datum) => datum.date));
  for (const field of ['from', 'to', 'date', 'peakDate', 'troughDate']) {
    if (input.focus?.[field]) dates.add(assertIsoDate(input.focus[field], `focus.${field}`));
  }
  return dates;
}

function normalizeAnnotationDraft(annotation, context) {
  const type = cleanText(annotation?.type, 40);
  if (!ALL_ANNOTATIONS.has(type)) throw new Error(`Tipo de anotación no permitido: ${type}.`);
  if (DATA_ANNOTATIONS.has(type) && context.series.length < 2) {
    throw new Error(`La anotación ${type} requiere una serie.`);
  }
  const normalized = {type};
  if (type === 'range-highlight' || type === 'cursor-journey' || type === 'before-after') {
    normalized.from = assertIsoDate(annotation.from, `${type}.from`);
    normalized.to = assertIsoDate(annotation.to, `${type}.to`);
    if (parseIsoDate(normalized.to) <= parseIsoDate(normalized.from)) {
      throw new Error(`${type}.to debe ser posterior a from.`);
    }
  } else if (type === 'peak-to-trough') {
    normalized.peakDate = assertIsoDate(annotation.peakDate, 'peak-to-trough.peakDate');
    normalized.troughDate = assertIsoDate(annotation.troughDate, 'peak-to-trough.troughDate');
    if (parseIsoDate(normalized.troughDate) <= parseIsoDate(normalized.peakDate)) {
      throw new Error('peak-to-trough.troughDate debe ser posterior a peakDate.');
    }
  } else if (type === 'event-marker') {
    normalized.date = assertIsoDate(annotation.date, 'event-marker.date');
    if (context.series.length >= 2) {
      const exact = context.series.find((datum) => datum.date === normalized.date);
      if (exact) {
        normalized.value = exact.value;
      } else if (
        context.focus?.date === normalized.date
        && Number.isFinite(Number(context.focus?.value))
      ) {
        normalized.value = finiteNumber(context.focus.value, 'focus.value');
      } else {
        throw new Error(
          `La fecha ${normalized.date} no tiene un valor observado o explícitamente autorizado.`
        );
      }
    } else {
      const trustedValue = context.focus?.date === normalized.date
        ? context.focus?.value
        : undefined;
      normalized.value = finiteNumber(trustedValue, 'focus.value');
    }
  }
  for (const date of annotationDates(normalized)) {
    if (!context.allowedDates.has(date)) {
      throw new Error(`La fecha ${date} no pertenece a la evidencia autorizada.`);
    }
  }
  if (
    context.series.length >= 2
    && ['cursor-journey', 'peak-to-trough', 'before-after'].includes(type)
  ) {
    for (const date of annotationDates(normalized)) {
      exactSeriesDatum(context.series, date);
    }
  }
  const label = cleanText(annotation.label, 32);
  if (label) normalized.label = label;
  if (type === 'range-highlight' && !label) normalized.label = 'TRAMO';
  if (type === 'event-marker' && !label) normalized.label = 'Evento';
  return normalized;
}

function dedupeAnnotations(annotations) {
  const seen = new Set();
  return annotations.filter((annotation) => {
    const key = JSON.stringify(annotation);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function scheduleAnnotations(drafts) {
  let eventIndex = 0;
  return drafts.map((annotation) => {
    if (annotation.type === 'line-retrace') {
      return {...annotation, startSeconds: 0.25, endSeconds: 2.2};
    }
    if (annotation.type === 'range-highlight') {
      return {...annotation, startSeconds: 1.8, endSeconds: 2.8};
    }
    if (annotation.type === 'cursor-journey') {
      return {
        ...annotation,
        startSeconds: 2.5,
        endSeconds: 4.9,
        hideAtSeconds: 5.45
      };
    }
    if (annotation.type === 'peak-to-trough') {
      return {...annotation, startSeconds: 4.7, endSeconds: 5.9};
    }
    if (annotation.type === 'before-after') {
      return {...annotation, startSeconds: 2.4, endSeconds: 5.6};
    }
    const startSeconds = 1.8 + eventIndex * 0.9;
    eventIndex += 1;
    return {...annotation, startSeconds, endSeconds: startSeconds + 0.85};
  });
}

function largestMove(series, direction = 'any') {
  const moves = [];
  for (let index = 1; index < series.length; index += 1) {
    const from = series[index - 1];
    const to = series[index];
    const change = to.value - from.value;
    if (direction === 'down' && change >= 0) continue;
    if (direction === 'up' && change <= 0) continue;
    moves.push({from, to, change, magnitude: Math.abs(change)});
  }
  return moves.sort((left, right) => right.magnitude - left.magnitude)[0] || null;
}

function fallbackAnnotationDrafts(input) {
  const text = normalizeSearchText(input.transcript);
  const series = input.series;
  const drafts = [];
  if (series.length >= 2) drafts.push({type: 'line-retrace', label: 'Recorrido'});

  const focus = input.focus || {};
  if (focus.intent && focus.intent !== 'auto') {
    if (focus.intent === 'range') {
      drafts.push({
        type: 'range-highlight',
        from: focus.from,
        to: focus.to,
        label: focus.label || 'Tramo'
      });
      if (series.length >= 2) {
        drafts.push({
          type: 'cursor-journey',
          from: focus.from,
          to: focus.to,
          label: focus.label || 'Cambio'
        });
      }
    } else if (focus.intent === 'event') {
      drafts.push({
        type: 'event-marker',
        date: focus.date,
        value: focus.value,
        label: focus.label || 'Evento'
      });
    } else if (focus.intent === 'before-after') {
      drafts.push({
        type: 'before-after',
        from: focus.from,
        to: focus.to,
        label: focus.label || 'Antes → después'
      });
    } else if (focus.intent === 'peak-to-trough') {
      drafts.push({
        type: 'peak-to-trough',
        peakDate: focus.peakDate,
        troughDate: focus.troughDate,
        label: focus.label || 'Máximo → mínimo'
      });
    } else if (focus.intent === 'trend' && series.length >= 2) {
      drafts.push({
        type: 'before-after',
        from: focus.from || series[0].date,
        to: focus.to || series.at(-1).date,
        label: focus.label || 'Evolución'
      });
    }
    return drafts.slice(0, 4);
  }

  if (series.length < 2) {
    throw new Error(
      'Sin serie numérica, declara focus.intent=range o event para evitar una selección inventada.'
    );
  }
  const decline = /\b(caida|cayo|bajo|bajada|correccion|perdio|retroceso)\b/.test(text);
  const rise = /\b(subida|subio|crecio|avance|gano|aumento)\b/.test(text);
  const balance = /\b(inicio|final|cierre|termina|balance|acaba|periodo)\b/.test(text);
  const move = largestMove(series, decline ? 'down' : rise ? 'up' : 'any');

  if ((decline || rise || /\b(tramo|mes|meses|periodo)\b/.test(text)) && move) {
    drafts.push({
      type: 'range-highlight',
      from: move.from.date,
      to: move.to.date,
      label: decline ? 'CAÍDA' : rise ? 'SUBIDA' : 'TRAMO'
    });
    drafts.push({
      type: 'cursor-journey',
      from: move.from.date,
      to: move.to.date,
      label: decline ? 'Caída' : rise ? 'Subida' : 'Cambio'
    });
    if (move.change < 0) {
      drafts.push({
        type: 'peak-to-trough',
        peakDate: move.from.date,
        troughDate: move.to.date,
        label: 'Máximo → mínimo'
      });
    }
  } else if (balance) {
    drafts.push({
      type: 'before-after',
      from: series[0].date,
      to: series.at(-1).date,
      label: 'Balance'
    });
  } else {
    drafts.push({
      type: 'before-after',
      from: series[0].date,
      to: series.at(-1).date,
      label: 'Evolución'
    });
  }
  return drafts.slice(0, 4);
}

function defaultEditorial(input, annotations) {
  const main = annotations.find((annotation) => annotation.type !== 'line-retrace');
  let title = 'La evolución que importa';
  if (main?.type === 'range-highlight') title = 'El tramo que concentra el cambio';
  if (main?.type === 'peak-to-trough') title = 'Del máximo a la corrección';
  if (main?.type === 'before-after') title = 'Cómo cambia del inicio al final';
  if (main?.type === 'event-marker') title = main.label || 'El evento decisivo';
  return {
    claim: cleanText(input.transcript, 600) || 'Anotación visual solicitada por el usuario.',
    title: cleanText(input.title, 90) || title,
    supportingText: cleanText(input.supportingText, 150),
    showHeader: input.showHeader !== false
  };
}

function llmSelectionPrompt(input, calibration, allowedDates) {
  return `Selecciona anotaciones para una gráfica ya calibrada.
No decidas el patrón: es asset.annotated-chart. No inventes fechas, valores ni hechos.

Transcripción o evidencia:
${cleanText(input.transcript, 6_000)}

Fechas autorizadas:
${JSON.stringify([...allowedDates])}

Serie autorizada:
${JSON.stringify(input.series)}

Foco explícito:
${JSON.stringify(input.focus || null)}

Ejes:
${JSON.stringify({
    xAxis: calibration.xAxis?.value,
    yAxis: calibration.yAxis?.value
  })}

Tipos permitidos:
${input.series.length >= 2
    ? 'line-retrace, range-highlight, cursor-journey, peak-to-trough, before-after, event-marker'
    : 'range-highlight, event-marker'}

Devuelve solo:
{
  "claim": "afirmación fiel",
  "title": "máximo 8 palabras o vacío",
  "supportingText": "máximo 16 palabras o vacío",
  "showHeader": true,
  "annotations": []
}

No incluyas tiempos. Usa como máximo cuatro anotaciones. Para event-marker
no emitas value: el sistema lo deriva de la evidencia autorizada.`;
}

function factualTokens(value) {
  const text = cleanText(value, 20_000);
  const tokens = new Set();
  for (const match of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    tokens.add(match[0]);
  }
  for (const match of text.matchAll(/(?<![\p{L}\d])[-+]?\d+(?:[.,]\d+)?\s*%?/gu)) {
    const normalized = match[0].replace(/\s+/g, '').replace(',', '.');
    tokens.add(normalized);
  }
  return tokens;
}

function evidenceForEditorial(input, calibration) {
  return [
    input.transcript,
    input.title,
    input.supportingText,
    input.sourceLabel,
    JSON.stringify(input.series),
    JSON.stringify(input.focus || null),
    JSON.stringify(calibration.xAxis?.value || null),
    JSON.stringify(calibration.yAxis?.value || null)
  ].filter(Boolean).join(' ');
}

export function assertEditorialFactsSupported(editorial, evidence) {
  const allowed = factualTokens(evidence);
  for (const [field, value] of Object.entries(editorial)) {
    if (field === 'showHeader') continue;
    for (const token of factualTokens(value)) {
      if (!allowed.has(token)) {
        throw new Error(
          `El texto editorial introduce el dato no autorizado "${token}" en ${field}.`
        );
      }
    }
  }
  return editorial;
}

export async function selectChartAnnotations(input, calibration, options = {}) {
  const allowedDates = buildAllowedDates(input, calibration);
  const context = {
    allowedDates,
    focus: input.focus,
    series: input.series
  };
  const warnings = [];
  if (options.useLlm) {
    const config = getLlmConfig(options.llmConfig || {});
    if (!isLlmEnabled(config)) {
      warnings.push('LLM editorial no configurado; se usa fallback determinista.');
    } else {
      try {
        const raw = await (options.chatJsonImpl || chatJson)([
          {
            role: 'system',
            content: 'Eres un planner de motion graphics. Devuelve JSON estricto y no inventes datos.'
          },
          {
            role: 'user',
            content: llmSelectionPrompt(input, calibration, allowedDates)
          }
        ], {
          ...config,
          temperature: 0.1,
          maxTokens: 1_800,
          fetch: options.fetch,
          sleep: options.sleep,
          signal: options.signal
        });
        const rawAnnotations = Array.isArray(raw?.annotations) ? raw.annotations : [];
        if (rawAnnotations.length < 1 || rawAnnotations.length > 4) {
          throw new Error('El LLM debe devolver entre una y cuatro anotaciones.');
        }
        const annotations = scheduleAnnotations(
          dedupeAnnotations(
            rawAnnotations.map((annotation) =>
              normalizeAnnotationDraft(annotation, context)
            )
          )
        );
        const rawEditorial = assertEditorialFactsSupported(
          {
            claim: cleanText(raw.claim, 600),
            title: cleanText(raw.title, 90),
            supportingText: cleanText(raw.supportingText, 150),
            showHeader: raw.showHeader !== false
          },
          evidenceForEditorial(input, calibration)
        );
        return {
          mode: 'llm-validated',
          llmUsed: true,
          fallbackUsed: false,
          warnings,
          editorial: {
            claim: cleanText(input.transcript, 600)
              || rawEditorial.claim
              || 'Anotación visual solicitada por el usuario.',
            title: rawEditorial.title,
            supportingText: rawEditorial.supportingText,
            showHeader: rawEditorial.showHeader && Boolean(rawEditorial.title)
          },
          annotations
        };
      } catch (error) {
        warnings.push(
          `Selección LLM rechazada; se usa fallback determinista: ${cleanText(error.message, 240)}`
        );
      }
    }
  }
  const normalized = dedupeAnnotations(
    fallbackAnnotationDrafts(input).map((annotation) =>
      normalizeAnnotationDraft(annotation, context)
    )
  );
  return {
    mode: 'deterministic-fallback',
    llmUsed: false,
    fallbackUsed: true,
    warnings,
    editorial: defaultEditorial(input, normalized),
    annotations: scheduleAnnotations(normalized)
  };
}

function focusForAnnotations(annotations, series, yAxis) {
  const priority = [
    'event-marker',
    'peak-to-trough',
    'before-after',
    'cursor-journey',
    'range-highlight',
    'line-retrace'
  ];
  const annotation = priority
    .map((type) => [...annotations].reverse().find((item) => item.type === type))
    .find(Boolean);
  const fallbackDate = series.at(-1)?.date;
  const fallbackValue = series.at(-1)?.value ?? (yAxis.min + yAxis.max) / 2;
  if (!annotation) return {date: fallbackDate, value: fallbackValue};
  if (annotation.type === 'event-marker') {
    return {
      date: annotation.date,
      value: round(annotation.value ?? fallbackValue, 4)
    };
  }
  if (annotation.type === 'peak-to-trough') {
    const date = interpolateIsoDate(annotation.peakDate, annotation.troughDate, 0.5);
    const value = series.length >= 2
      ? (interpolateSeriesValue(series, annotation.peakDate)
        + interpolateSeriesValue(series, annotation.troughDate)) / 2
      : fallbackValue;
    return {date, value: round(value, 4)};
  }
  if (
    annotation.type === 'before-after'
    || annotation.type === 'cursor-journey'
  ) {
    return {
      date: annotation.to,
      value: round(series.length >= 2
        ? interpolateSeriesValue(series, annotation.to)
        : fallbackValue, 4)
    };
  }
  if (annotation.type === 'range-highlight') {
    const date = interpolateIsoDate(annotation.from, annotation.to, 0.5);
    return {
      date,
      value: round(series.length >= 2
        ? interpolateSeriesValue(series, date)
        : fallbackValue, 4)
    };
  }
  return {date: fallbackDate, value: round(fallbackValue, 4)};
}

function scalePlotRegion(region, stagedAsset, inspection) {
  const scaleX = stagedAsset.width / inspection.width;
  const scaleY = stagedAsset.height / inspection.height;
  return {
    x: round(region.x * scaleX, 3),
    y: round(region.y * scaleY, 3),
    width: round(region.width * scaleX, 3),
    height: round(region.height * scaleY, 3)
  };
}

export async function stageChartAsset(input, inspection, options = {}) {
  const publicRoot = path.resolve(
    options.publicRoot || path.join(ROOT, 'remotion-animations', 'public')
  );
  const source = path.resolve(input.imageFile);
  if (isInside(publicRoot, source)) {
    return {
      sourceFile: source,
      stagedFile: source,
      publicPath: path.relative(publicRoot, source).replace(/\\/g, '/'),
      width: inspection.width,
      height: inspection.height,
      sourceSha256: inspection.sha256,
      stagedSha256: inspection.sha256,
      reused: true,
      resized: false,
      rasterized: false
    };
  }

  const scale = Math.min(1, 1700 / inspection.width, 760 / inspection.height);
  const resize = scale < 0.999;
  const rasterize = inspection.extension === '.svg';
  const normalizeRaster = resize || rasterize;
  const extension = normalizeRaster ? '.png' : inspection.extension;
  let bytes;
  let width = inspection.width;
  let height = inspection.height;
  if (normalizeRaster) {
    const result = await sharp(source, {density: 144})
      .resize({
        width: Math.max(1, Math.round(inspection.width * scale)),
        height: Math.max(1, Math.round(inspection.height * scale)),
        fit: 'fill'
      })
      .png()
      .toBuffer({resolveWithObject: true});
    bytes = result.data;
    width = result.info.width;
    height = result.info.height;
  } else {
    bytes = await readFile(source);
  }
  const stagedSha256 = sha256Bytes(bytes);
  const project = slugifyChartProject(input.project);
  const directory = path.join(publicRoot, 'assets', 'projects', project, 'charts');
  await mkdir(directory, {recursive: true});
  const target = path.join(directory, `${stagedSha256.slice(0, 16)}${extension}`);
  const reused = existsSync(target);
  if (!reused) {
    await writeFile(target, bytes, {flag: 'wx'});
  } else if (await sha256File(target) !== stagedSha256) {
    throw new Error(`Colisión de hash al preparar el asset: ${target}`);
  }
  const manifestFile = path.join(directory, `${stagedSha256.slice(0, 16)}.asset.json`);
  if (!existsSync(manifestFile)) {
    await writeFile(manifestFile, `${JSON.stringify({
      version: 1,
      kind: 'chart-image',
      sourceFile: source,
      stagedFile: target,
      sourceSha256: inspection.sha256,
      stagedSha256,
      width,
      height,
      provenance: input.provenance || 'user-provided',
      licenseNote: input.licenseNote || null,
      createdAt: new Date().toISOString()
    }, null, 2)}\n`, {encoding: 'utf8', flag: 'wx'});
  }
  return {
    sourceFile: source,
    stagedFile: target,
    publicPath: path.relative(publicRoot, target).replace(/\\/g, '/'),
    width,
    height,
    sourceSha256: inspection.sha256,
    stagedSha256,
      reused,
      resized: resize,
      rasterized: rasterize
  };
}

function soundCuesForAnnotations(annotations) {
  const cues = [];
  const line = annotations.find((annotation) => annotation.type === 'line-retrace');
  const range = annotations.find((annotation) => annotation.type === 'range-highlight');
  const cursor = annotations.find((annotation) => annotation.type === 'cursor-journey');
  const conclusion = [...annotations].reverse().find((annotation) =>
    ['peak-to-trough', 'before-after', 'event-marker'].includes(annotation.type)
  );
  if (line) {
    cues.push({
      event: 'inicio del trazado',
      atSeconds: line.startSeconds,
      file: 'sfx/amaliometria-rise-whoosh.wav'
    });
  }
  if (range) {
    cues.push({
      event: 'fijación del rango',
      atSeconds: range.startSeconds,
      file: 'sfx/amaliometria-ui-pulse.wav'
    });
  }
  if (cursor) {
    cues.push({
      event: 'llegada del cursor',
      atSeconds: cursor.endSeconds,
      file: 'sfx/amaliometria-data-tick.wav'
    });
  }
  if (conclusion) {
    cues.push({
      event: 'conclusión',
      atSeconds: conclusion.endSeconds,
      file: 'sfx/amaliometria-soft-impact.wav'
    });
  }
  return cues.slice(0, 4);
}

function effectForAnnotation(annotation) {
  if (annotation.type === 'line-retrace') return 'reveal.path-draw';
  if (annotation.type === 'range-highlight') return 'focus.spotlight-mask';
  if (annotation.type === 'cursor-journey') return 'focus.path-follow';
  return 'focus.freeze-callout';
}

function preferredChartArtDirection(input) {
  if (input.artDirection) return input.artDirection;
  const text = normalizeSearchText([
    input.transcript,
    input.title,
    input.sourceLabel
  ].filter(Boolean).join(' '));
  if (/\b(indice|mercado|accion|sp ?500|cotizacion|rendimiento|bolsa)\b/.test(text)) {
    return 'market-data';
  }
  if (/\b(captura|documento|fuente|evidencia|informe)\b/.test(text)) {
    return 'documentary-evidence';
  }
  if (/\b(sistema|proceso|pipeline|arquitectura|flujo)\b/.test(text)) {
    return 'diagrammatic-system';
  }
  return 'editorial-report';
}

function chartCompositionFor(props) {
  if (props.series.length < 2) return 'Chart-Annotated-Image-Only';
  if (props.artDirection === 'market-data') return 'Chart-Annotated-Market';
  if (props.artDirection === 'documentary-evidence') {
    return 'Chart-Annotated-Documentary';
  }
  if (props.artDirection === 'editorial-report') {
    return 'Chart-Annotated-Editorial';
  }
  return 'Chart-Annotated-Range';
}

export function buildChartAnimationSpec({
  input,
  inspection,
  stagedAsset,
  calibration,
  selection,
  props,
  variety
}) {
  const soundDeliver = input.sound?.deliver || 'both';
  const renderFiles = soundDeliver === 'silent'
    ? ['annotated-chart.mp4']
    : soundDeliver === 'with-sfx'
      ? ['annotated-chart-audio.mp4']
      : ['annotated-chart.mp4', 'annotated-chart-audio.mp4'];
  const effects = selection.annotations.map((annotation) => ({
    effectId: effectForAnnotation(annotation),
    phase: annotation.type === 'line-retrace' ? 'build' : 'focus',
    target: annotation.type,
    startSeconds: annotation.startSeconds,
    endSeconds: annotation.endSeconds,
    parameters: Object.fromEntries(
      Object.entries(annotation).filter(([key]) =>
        !['startSeconds', 'endSeconds', 'hideAtSeconds'].includes(key)
      )
    )
  }));
  if (props.camera.enabled) {
    effects.push({
      effectId: 'camera.focus-zoom',
      phase: 'focus',
      target: 'chart-focus',
      startSeconds: props.camera.startSeconds,
      endSeconds: props.camera.endSeconds,
      parameters: {zoomScale: props.camera.zoomScale}
    });
  }
  const evidenceText = cleanText(input.transcript, 1_200)
    || 'Imagen y foco aportados por el usuario.';
  const sourceInSeconds = Math.max(0, Number(input.sourceInSeconds) || 0);
  const sourceOutSeconds = Math.max(
    sourceInSeconds + 0.1,
    Number(input.sourceOutSeconds) || 9
  );
  const focusTreatments = [];
  if (selection.annotations.some((annotation) => annotation.type === 'range-highlight')) {
    focusTreatments.push('spotlight-mask');
  } else {
    focusTreatments.push('freeze-and-callout');
  }
  if (props.camera.enabled) focusTreatments.push('camera-zoom');
  const soundCues = soundCuesForAnnotations(selection.annotations);
  const silentCompositionId = chartCompositionFor(props);
  const renderTargets = [];
  if (soundDeliver !== 'with-sfx') {
    renderTargets.push({
      compositionId: silentCompositionId,
      propsFile: 'metadata/annotated-chart-props.json',
      renderFile: 'annotated-chart.mp4',
      sound: 'silent'
    });
  }
  if (soundDeliver !== 'silent') {
    renderTargets.push({
      compositionId: 'Chart-Annotated-Range-Audio',
      propsFile: 'metadata/annotated-chart-props.json',
      renderFile: 'annotated-chart-audio.mp4',
      sound: 'with-sfx'
    });
  }
  return {
    version: 1,
    project: input.project,
    clipId: input.clipId || 'chart-ingestion',
    source: {
      imageFile: stagedAsset.sourceFile,
      transcriptFile: input.transcriptFile || null,
      sourceInSeconds,
      sourceOutSeconds,
      evidence: [
        {
          text: evidenceText,
          startSeconds: sourceInSeconds,
          endSeconds: sourceOutSeconds
        }
      ]
    },
    selection: {
      patternId: 'asset.annotated-chart',
      rationale: 'La fuente es una gráfica real y la explicación señala un tramo, evento o variación calibrable.',
      clarityGain: 5,
      evidenceStrength: calibration.status === 'confirmed' ? 5 : 4,
      motionPotential: 5,
      assetUtility: 3,
      redundancyPenalty: 0,
      readingPenalty: selection.editorial.showHeader ? -1 : 0,
      totalScore: calibration.status === 'confirmed' ? 17 : 16,
      implementationStatus: 'ready'
    },
    variety,
    editorial: {
      claim: selection.editorial.claim || evidenceText,
      title: selection.editorial.title || 'Gráfica anotada',
      supportingText: selection.editorial.supportingText || '',
      language: input.language || 'es'
    },
    dataSeries: input.series.length
      ? [
          {
            id: 'chart-series',
            unit: props.yAxis.unit,
            items: input.series.map((datum) => ({
              label: datum.date,
              value: datum.value
            })),
            focusIndex: null,
            maxValue: props.yAxis.max,
            qualitative: false
          }
        ]
      : [],
    assets: [
      {
        id: 'chart-image',
        sourceFile: stagedAsset.sourceFile,
        stagedFile: stagedAsset.publicPath,
        sha256: stagedAsset.stagedSha256,
        role: 'screenshot',
        fit: 'contain',
        targetRegion: {
          x: round(props.image.plotRegion.x / props.image.width, 5),
          y: round(props.image.plotRegion.y / props.image.height, 5),
          width: round(props.image.plotRegion.width / props.image.width, 5),
          height: round(props.image.plotRegion.height / props.image.height, 5)
        }
      }
    ],
    visual: {
      durationSeconds: 9,
      fps: 60,
      width: 1920,
      height: 1080,
      accentColor: props.accentColor,
      backgroundMode: 'image-dimmed',
      focusTreatments: focusTreatments.slice(0, 2),
      effects,
      cameraPlan: {
        mode: props.camera.enabled ? 'final-punch' : 'none',
        rationale: props.camera.enabled
          ? 'Construir primero la gráfica y acercarse después a la conclusión.'
          : 'La región destacada ya domina el encuadre.',
        cues: props.camera.enabled
          ? [
              {
                effectId: 'camera.focus-zoom',
                target: 'chart-focus',
                startSeconds: props.camera.startSeconds,
                endSeconds: props.camera.endSeconds,
                focus: {
                  x: round(dateFraction(props.camera.focusDate, props.xAxis), 5),
                  y: round(
                    1 - valueFraction(props.camera.focusValue, props.yAxis),
                    5
                  )
                },
                anchor: {x: 0.5, y: 0.52},
                startScale: 1,
                endScale: props.camera.zoomScale
              }
            ]
          : []
      },
      motionVerb: 'calibrar, recorrer y enfocar'
    },
    storyboard: [
      {percent: 0, purpose: 'Contexto', visibleState: 'La gráfica entra completa y reconocible.'},
      {percent: 15, purpose: 'Promesa', visibleState: 'Comienza el trazado o aparece el rango relevante.'},
      {percent: 45, purpose: 'Desarrollo', visibleState: 'La anotación recorre fechas y valores autorizados.'},
      {percent: 75, purpose: 'Conclusión', visibleState: 'La variación o evento queda aislado y legible.'},
      {percent: 95, purpose: 'Hold', visibleState: 'La conclusión permanece estable para montaje.'}
    ],
    sound: {
      deliver: soundDeliver,
      profile: 'trend-focus',
      soundMix: props.soundMix,
      cues: soundCues
    },
    output: {
      compositionId: silentCompositionId,
      format: 'fullscreen',
      propsFile: 'metadata/annotated-chart-props.json',
      renderFiles,
      renderTargets
    },
    qa: {
      factualIntegrity: calibration.status === 'confirmed',
      silentTest: false,
      thumbnailTest: false,
      continuityTest: false,
      targetScore: 90,
      notes: calibration.requiresReview
        ? 'Confirmar la calibración propuesta antes del render editorial.'
        : 'Calibración confirmada; quedan pendientes stills y revisión visual.'
    }
  };
}

function normalizeInput(raw) {
  validateChartIngestionInput(raw);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('El input de ingestión debe ser un objeto JSON.');
  }
  if (raw.version !== 1) throw new Error('chart ingestion version debe ser 1.');
  const project = slugifyChartProject(raw.project);
  const imageFile = path.resolve(String(raw.imageFile || ''));
  if (!raw.imageFile) throw new Error('imageFile es obligatorio.');
  const series = normalizeSeriesInput(raw.series);
  const focusIntent = raw.focus?.intent || 'auto';
  if (!FOCUS_INTENTS.has(focusIntent)) {
    throw new Error(`focus.intent no es válido: ${focusIntent}.`);
  }
  return {
    ...raw,
    project,
    imageFile,
    transcript: cleanText(raw.transcript, 20_000),
    series,
    showHeader: raw.showHeader !== false
  };
}

export async function ingestAnnotatedChart(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const warnings = [];
  const inspection = await inspectChartImage(input.imageFile);
  let vision = null;
  if (options.useVision) {
    try {
      vision = await analyzeChartImageWithVision(
        input.imageFile,
        inspection,
        options
      );
    } catch (error) {
      warnings.push(`Análisis visual no disponible: ${cleanText(error.message, 240)}`);
    }
  }
  const calibration = proposeChartCalibration(
    input,
    inspection,
    vision,
    options
  );
  warnings.push(...calibration.warnings);
  const stagedAsset = await stageChartAsset(input, inspection, options);
  const selection = await selectChartAnnotations(
    input,
    calibration,
    options
  );
  warnings.push(...selection.warnings);
  let props = null;
  let animationSpec = null;
  if (calibration.renderReady) {
    const plotRegion = scalePlotRegion(
      calibration.plotRegion.value,
      stagedAsset,
      inspection
    );
    const focus = focusForAnnotations(
      selection.annotations,
      input.series,
      calibration.yAxis.value
    );
    const cameraStartSeconds = finiteNumber(
      input.camera?.startSeconds ?? 5.7,
      'camera.startSeconds'
    );
    const cameraEndSeconds = finiteNumber(
      input.camera?.endSeconds ?? 6.8,
      'camera.endSeconds'
    );
    if (cameraEndSeconds <= cameraStartSeconds) {
      throw new Error('camera.endSeconds debe ser posterior a camera.startSeconds.');
    }
    const plannedEffectIds = selection.annotations.map(effectForAnnotation);
    if (input.camera?.enabled !== false) plannedEffectIds.push('camera.focus-zoom');
    const variety = planAnimationVariety({
      patternId: 'asset.annotated-chart',
      preferredArtDirection: preferredChartArtDirection(input),
      artDirectionCandidates: [
        'market-data',
        'editorial-report',
        'documentary-evidence',
        'diagrammatic-system'
      ],
      effectIds: plannedEffectIds,
      recentSelections: input.recentSelections
    });
    props = {
      title: selection.editorial.showHeader ? selection.editorial.title : '',
      supportingText: selection.editorial.showHeader
        ? selection.editorial.supportingText || undefined
        : undefined,
      showHeader: selection.editorial.showHeader,
      source: cleanText(input.sourceLabel, 120)
        || cleanText(input.provenance, 60)
        || 'ASSET APORTADO POR EL USUARIO',
      image: {
        publicPath: stagedAsset.publicPath,
        alt: cleanText(input.alt, 180) || `Gráfica del proyecto ${input.project}`,
        width: stagedAsset.width,
        height: stagedAsset.height,
        plotRegion
      },
      xAxis: calibration.xAxis.value,
      yAxis: calibration.yAxis.value,
      series: input.series,
      annotations: selection.annotations,
      camera: {
        enabled: input.camera?.enabled !== false,
        focusDate: focus.date,
        focusValue: focus.value,
        startSeconds: cameraStartSeconds,
        endSeconds: cameraEndSeconds,
        zoomScale: clamp(
          finiteNumber(input.camera?.zoomScale ?? 1.7, 'camera.zoomScale'),
          1,
          3
        )
      },
      accentColor: normalizeColor(
        input.colors?.accentColor,
        DEFAULT_COLORS.accentColor,
        'colors.accentColor'
      ),
      dangerColor: normalizeColor(
        input.colors?.dangerColor,
        DEFAULT_COLORS.dangerColor,
        'colors.dangerColor'
      ),
      soundEnabled: false,
      soundMix: clamp(
        finiteNumber(input.sound?.mix ?? 0.65, 'sound.mix'),
        0,
        1
      ),
      artDirection: variety.selected.artDirection
    };
    animationSpec = buildChartAnimationSpec({
      input,
      inspection,
      stagedAsset,
      calibration,
      selection,
      props,
      variety
    });
  }
  return {
    version: 1,
    generatedAt: new Date(options.now || Date.now()).toISOString(),
    project: input.project,
    patternId: 'asset.annotated-chart',
    renderReady: calibration.renderReady,
    inspection,
    vision,
    calibration,
    stagedAsset,
    selection,
    warnings: [...new Set(warnings)],
    props,
    animationSpec
  };
}
