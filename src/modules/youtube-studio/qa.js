import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import {ffprobe} from '../../lib/ffmpeg.js';
import {run} from '../../lib/utils.js';
import {parseSilences} from '../video-studio/silences.js';

/**
 * Checks a render without a reference: what a viewer would notice before taste
 * matters. Black gaps and clipping are errors; the rest are warnings with a time
 * so an agent or the editor can jump straight to them. Not a visual approval.
 */

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

export function parseIntervals(stderr, startKey, endKey) {
  const out = [];
  const re = new RegExp(`${startKey}[:=]\\s*([\\d.]+)[\\s\\S]*?${endKey}[:=]\\s*([\\d.]+)`, 'g');
  for (const m of String(stderr).matchAll(re)) out.push({start: Number(m[1]), end: Number(m[2])});
  return out;
}

/** Cuts between takes, on the edit clock. */
export function takeCuts(plan) {
  return plan.segments.filter((s, i) => i > 0 && s.take !== plan.segments[i - 1].take).map((s) => s.at);
}

/** A cut is clean when the mix is quiet right at it; otherwise a syllable was probably clipped. */
export function cutsOnSpeech(cuts, silences, margin = 0.06) {
  return cuts.filter((t) => !silences.some((s) => s.start <= t + margin && s.end >= t - margin));
}

export function judge({probe, expected, black, frozen, loudness, speechCuts, loudnessRange = [-20, -12]}) {
  const errors = [], warnings = [];
  const video = probe.raw.streams.find((s) => s.codec_type === 'video');
  if (probe.width !== expected.width || probe.height !== expected.height) errors.push({code: 'resolution', message: `Resolucion ${probe.width}x${probe.height}`});
  if (Math.abs(probe.duration - expected.duration) > 0.2) errors.push({code: 'duration', message: `Dura ${round(probe.duration, 2)} s y el plan ${expected.duration} s`});
  if (video?.codec_name !== 'h264') errors.push({code: 'codec', message: 'El video no es H.264'});
  for (const b of black) errors.push({code: 'black', at: round(b.start), message: `Negro de ${round(b.end - b.start, 2)} s`});
  for (const f of frozen) warnings.push({code: 'frozen', at: round(f.start), message: `Imagen congelada ${round(f.end - f.start, 1)} s`});
  if (loudness) {
    if (loudness.truePeak > 0) errors.push({code: 'clipping', message: `Picos de ${loudness.truePeak} dBTP: satura`});
    else if (loudness.truePeak > -1) warnings.push({code: 'peak', message: `Picos de ${loudness.truePeak} dBTP con poco margen`});
    if (loudness.integrated < loudnessRange[0] || loudness.integrated > loudnessRange[1]) {
      warnings.push({code: 'loudness', message: `Volumen integrado ${loudness.integrated} LUFS fuera de ${loudnessRange.join('..')}`});
    }
  } else errors.push({code: 'loudness', message: 'No se pudo medir el audio'});
  for (const t of speechCuts) warnings.push({code: 'cut-on-speech', at: round(t), message: 'Corte con voz sonando: revisar si se come una silaba'});
  return {passed: !errors.length, errors, warnings};
}

export async function qaRender({file, plan, expected, outDir, sharp, loudnessRange}) {
  const probe = await ffprobe(file);
  const {stderr: visual} = await run('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', 'blackdetect=d=0.1:pix_th=0.08,freezedetect=n=-60dB:d=3', '-f', 'null', '-']);
  const black = parseIntervals(visual, 'black_start', 'black_end');
  const frozen = parseIntervals(visual.replace(/lavfi\.freezedetect\./g, ''), 'freeze_start', 'freeze_end');
  const {stderr: audio} = await run('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'silencedetect=noise=-32dB:d=0.03,loudnorm=print_format=json', '-f', 'null', '-']);
  const json = /\{\s*"input_i"[\s\S]*?\}/.exec(audio);
  const measured = json ? JSON.parse(json[0]) : null;
  const loudness = measured ? {integrated: Number(measured.input_i), truePeak: Number(measured.input_tp), range: Number(measured.input_lra)} : null;
  const speechCuts = cutsOnSpeech(takeCuts(plan), parseSilences(audio, probe.duration));
  const verdict = judge({probe, expected, black, frozen, loudness, speechCuts, loudnessRange});
  const sheet = outDir && sharp ? await reviewSheet({file, plan, outDir, sharp}) : null;
  return {version: 1, kind: 'render-qa', file: path.resolve(file), ...verdict, metrics: {duration: round(probe.duration, 3), black, frozen, loudness, cuts: takeCuts(plan).length},
    reviewSheet: sheet, visualReview: 'pending'};
}

/** One labelled frame per decision so a person or a vision model reviews the edit in one image. */
export async function reviewSheet({file, plan, outDir, sharp, limit = 24}) {
  await mkdir(outDir, {recursive: true});
  const picks = plan.decisions.filter((d) => ['insert', 'punch-in', 'push', 'sticker', 'outro'].includes(d.type))
    .filter((d) => !(d.type === 'push' && d.to < d.from)).slice(0, limit);
  const tiles = [];
  for (const [i, d] of picks.entries()) {
    const at = Math.min(plan.duration - 0.1, d.at + (d.type === 'push' ? Math.min(d.seconds, 4) : 0.5));
    const frame = path.join(outDir, `frame-${String(i).padStart(2, '0')}.jpg`);
    await run('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=480:270', frame]);
    const label = Buffer.from(`<svg width="480" height="26"><rect width="480" height="26" fill="#111"/><text x="8" y="18" fill="#fff" font-size="15" font-family="Arial">${round(at, 1)} s · ${d.type}${d.layout ? ' ' + d.layout : ''}</text></svg>`);
    tiles.push({frame, label});
  }
  if (!tiles.length) return null;
  const columns = 4, rows = Math.ceil(tiles.length / columns);
  const composites = tiles.flatMap((t, i) => [{input: t.label, left: (i % columns) * 480, top: Math.floor(i / columns) * 296},
    {input: t.frame, left: (i % columns) * 480, top: Math.floor(i / columns) * 296 + 26}]);
  const sheet = path.join(outDir, 'review-sheet.jpg');
  await sharp({create: {width: columns * 480, height: rows * 296, channels: 3, background: '#111'}}).composite(composites).jpeg({quality: 88}).toFile(sheet);
  return sheet;
}
