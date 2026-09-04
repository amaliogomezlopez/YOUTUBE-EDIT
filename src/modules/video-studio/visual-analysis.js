import path from 'node:path';
import {readdir, readFile, stat} from 'node:fs/promises';
import sharp from 'sharp';
import {detectFacesInFrame} from '../../lib/face-detector.js';
import {isCornerWebcamFace, webcamBoxForTrackedFace} from '../../lib/webcam.js';
import {ensureDir, readJson, round, run, writeJson, sha1} from '../../lib/utils.js';
import {focusFromFace} from './face-tracking.js';
import {webcamPanel} from './webcam-art.js';
import {smoothFocusTrack} from './framing.js';

export function parseSilences(stderr, duration) {
  const out = [];
  let start = null;
  for (const match of stderr.matchAll(/silence_(start|end):\s*([\d.]+)/g)) {
    if (match[1] === 'start') start = Number(match[2]);
    else if (start !== null) { out.push({start, end: Number(match[2])}); start = null; }
  }
  if (start !== null) out.push({start, end: duration});
  return out;
}

/** El movimiento apunta a una region, no a un pixel de cursor. */
export function changedRegion(current, previous, media, exclude = null) {
  if (!previous || current.data.length !== previous.data.length) return null;
  const {width, height, data} = current;
  const cells = [];
  const cols = 8, rows = 6;
  let total = 0;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let changed = 0, count = 0;
    for (let y = Math.floor(cy * height / rows); y < (cy + 1) * height / rows; y += 3) {
      for (let x = Math.floor(cx * width / cols); x < (cx + 1) * width / cols; x += 3) {
        if (exclude && x / width >= exclude.x / media.width && x / width <= (exclude.x + exclude.w) / media.width &&
          y / height >= exclude.y / media.height && y / height <= (exclude.y + exclude.h) / media.height) continue;
        const i = (Math.floor(y) * width + Math.floor(x)) * 3;
        const diff = Math.abs(data[i] - previous.data[i]) + Math.abs(data[i + 1] - previous.data[i + 1]) + Math.abs(data[i + 2] - previous.data[i + 2]);
        if (diff > 100) changed++;
        count++;
      }
    }
    const ratio = changed / Math.max(1, count);
    total += ratio;
    if (ratio > 0.13) cells.push({cx, cy, ratio});
  }
  // Un scroll global no es una region a ampliar.
  if (!cells.length || cells.length > 16) return {sceneChange: total / (cols * rows)};
  const x = Math.max(0, Math.min(...cells.map(c => c.cx)) / cols - 0.04);
  const y = Math.max(0, Math.min(...cells.map(c => c.cy)) / rows - 0.04);
  const right = Math.min(1, (Math.max(...cells.map(c => c.cx)) + 1) / cols + 0.04);
  const bottom = Math.min(1, (Math.max(...cells.map(c => c.cy)) + 1) / rows + 0.04);
  return {x: round(x * media.width), y: round(y * media.height),
    w: round((right - x) * media.width), h: round((bottom - y) * media.height),
    confidence: 0.58, method: 'cambio-visual', sceneChange: total / (cols * rows)};
}

function tokens(text) { return String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]{3,}/gu) ?? []; }
/** Conserva contexto alrededor de una etiqueta o tooltip antes de ampliar. */
export function contextualRegion(region, media) {
  if (!region) return null;
  const w = Math.min(media.width, Math.max(region.w, media.width * .56));
  const h = Math.min(media.height, Math.max(region.h, media.height * .8));
  return {...region, x:Math.max(0,Math.min(media.width-w,region.x+region.w/2-w/2)),
    y:Math.max(0,Math.min(media.height-h,region.y+region.h/2-h/2)), w, h};
}
export function textRegion(lines, spokenText, media, imageWidth = 960) {
  const spoken = new Set(tokens(spokenText));
  const matches = lines.filter(line => tokens(line.text).some(t => spoken.has(t) && !['para', 'como', 'este', 'esta', 'esto', 'pero', 'porque', 'tiene'].includes(t)));
  if (!matches.length) return null;
  const scale = media.width / imageWidth;
  const x = Math.max(0, Math.min(...matches.map(l => l.x)) * scale - 80);
  const y = Math.max(0, Math.min(...matches.map(l => l.y)) * scale - 100);
  const right = Math.min(media.width, Math.max(...matches.map(l => l.x + l.w)) * scale + 100);
  const bottom = Math.min(media.height, Math.max(...matches.map(l => l.y + l.h)) * scale + 120);
  return {x, y, w: Math.max(24, right - x), h: Math.max(24, bottom - y), confidence: 0.8, method: 'texto-mencionado', text: matches.map(l => l.text).join(' ')};
}

/** Cambios de modo requieren dos observaciones; una perdida aislada no mueve el plano. */
export function stabilizeShots(samples, duration) {
  if (!samples.length) return [];
  const shots = [{...samples[0], start: 0}];
  for (let i = 1; i < samples.length; i++) {
    const current = samples[i], last = shots.at(-1);
    const confirmedMode = current.mode !== last.mode && samples[i + 1]?.mode === current.mode;
    const changedScreen = current.mode === last.mode && (current.sceneChange > 0.28 || current.region?.method === 'texto-mencionado') && current.t - last.start >= 3;
    if (confirmedMode || changedScreen) shots.push({...current, start: current.t});
  }
  return shots.map((shot, i) => ({...shot, end: shots[i + 1]?.start ?? duration}));
}

export function comparisonRegions(lines, media, imageWidth = 960) {
  const height = imageWidth * media.height/media.width;
  const labels = lines.filter(l => l.y < height*.15 && l.w > 40 && /astra|fable|claude|gpt|gemini|kimi/i.test(l.text));
  const left=labels.find(l=>l.x<imageWidth*.4), right=labels.find(l=>l.x>imageWidth*.45);
  if(!left || !right || Math.abs(left.y-right.y)>35) return null;
  const scale=media.width/imageWidth;
  const split=media.width/2;
  return [{x:0,y:Math.max(0,left.y*scale-20),w:split,h:media.height-Math.max(0,left.y*scale-20),label:left.text},
    {x:split,y:Math.max(0,right.y*scale-20),w:split,h:media.height-Math.max(0,right.y*scale-20),label:right.text}];
}

export async function analyzeVisualTimeline(videoFile, media, {outDir, words = [], signal, interval = 1.5, ocr = true, window = null} = {}) {
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('Intervalo de analisis visual invalido.');
  const fingerprint = await stat(videoFile);
  const key = sha1(JSON.stringify([videoFile, fingerprint.size, fingerprint.mtimeMs, media.width, media.height, media.duration, interval, ocr, window, words.map(w => [w.text,w.start,w.end])]));
  const cache = path.join(outDir, 'visual-analysis.json');
  const cached = await readJson(cache).catch(() => null);
  if (cached?.key === key && cached.version === 3) return cached;
  const framesDir = path.join(outDir, 'analysis-frames-' + key.slice(0,12));
  await ensureDir(framesDir);
  const sourceArgs = [...(window ? ['-ss', String(window.start)] : []), '-i', videoFile, ...(window ? ['-t', String(window.end-window.start)] : [])];
  await run('ffmpeg', ['-y', ...sourceArgs, '-vf', 'fps=1/' + interval + ',scale=960:-2', path.join(framesDir, '%05d.png')], {signal});
  const names = (await readdir(framesDir)).filter(n => n.endsWith('.png')).sort();
  const warnings = [];
  let ocrFrames = {};
  if (ocr && process.platform !== 'win32') warnings.push('OCR local de Windows no disponible; se usan cambios visuales y revision manual.');
  if (ocr && process.platform === 'win32') {
    try {
      const result = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/video-ocr.ps1', '-Directory', framesDir], {signal, timeoutMs: 180000});
      ocrFrames = JSON.parse(result.stdout.replace(/^\uFEFF/, ''));
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push('OCR no disponible; las regiones usan cambios visuales y admiten correccion manual.');
    }
  }
  const samples = [];
  let previous = null;
  for (let i = 0; i < names.length; i++) {
    signal?.throwIfAborted();
    const {data, info} = await sharp(await readFile(path.join(framesDir, names[i]))).removeAlpha().raw().toBuffer({resolveWithObject: true});
    const frame = {width: info.width, height: info.height, data};
    const sx = media.width / info.width, sy = media.height / info.height;
    let faces = [];
    try { faces = (await detectFacesInFrame(frame, {confidence: 0.65})).map(f => ({...f, x:f.x*sx,y:f.y*sy,w:f.w*sx,h:f.h*sy})); }
    catch (error) { if (signal?.aborted) throw error; if (!warnings.includes('Detector facial no disponible.')) warnings.push('Detector facial no disponible.'); }
    const corner = faces.filter(f => isCornerWebcamFace(f, media)).sort((a,b) => b.score-a.score)[0];
    const main = faces.filter(f => f.w*f.h/(media.width*media.height) > 0.018).sort((a,b) => b.w*b.h-a.w*a.h)[0];
    const t = Math.min(media.duration, i * interval + interval / 2);
    const box = corner ? webcamBoxForTrackedFace({...corner, confidence: corner.score}, media) : null;
    if (box) box.sourceBox = webcamPanel(frame, corner, media) ?? undefined;
    const changed = changedRegion(frame, previous, media, box?.sourceBox ?? box);
    const text = words.filter(w => w.start >= t - 2 && w.start <= t + 4).map(w => w.text).join(' ');
    const region = contextualRegion(textRegion(ocrFrames[names[i]] ?? [], text, media) ?? (changed?.w ? changed : null), media);
    samples.push({t, mode: media.height >= media.width ? 'crop' : box ? 'pip' : main ? 'crop' : 'fit',
      webcamBox: box, faceBox: main ?? corner ?? null, focus: main ? focusFromFace(main, media) : null,
      region, comparison: comparisonRegions(ocrFrames[names[i]] ?? [], media), sceneChange: changed?.sceneChange ?? 0, confidence: corner?.score ?? main?.score ?? 0});
    previous = frame;
  }
  const audio = await run('ffmpeg', [...sourceArgs, '-af', 'silencedetect=noise=-38dB:d=0.5', '-f', 'null', '-'], {signal});
  const result = {version: 3, key, interval, samples, shots: stabilizeShots(samples, media.duration),
    focusTrack: smoothFocusTrack(samples.filter(s => s.focus).map(s => ({t:s.t,...s.focus}))),
    silences: parseSilences(audio.stderr, media.duration), warnings};
  await writeJson(cache, result);
  return result;
}
