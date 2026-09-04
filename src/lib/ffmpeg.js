import path from 'node:path';
import {ensureDir, run} from './utils.js';
import {pipLayout} from './pip-layout.js';
import {smoothFocusTrack} from '../modules/video-studio/framing.js';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const SCALE_FLAGS = 'lanczos+accurate_rnd+full_chroma_int+full_chroma_inp';

export async function ffprobe(file, options = {}) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file
  ], {signal: options.signal});
  const json = JSON.parse(stdout);
  const video = json.streams.find((stream) => stream.codec_type === 'video') ?? {};
  return {
    duration: Number(json.format?.duration ?? video.duration ?? 0),
    width: Number(video.width ?? 0),
    height: Number(video.height ?? 0),
    fps: parseFps(video.avg_frame_rate ?? video.r_frame_rate),
    raw: json
  };
}

function parseFps(value) {
  if (!value || value === '0/0') return 30;
  if (value.includes('/')) {
    const [a, b] = value.split('/').map(Number);
    return b ? a / b : 30;
  }
  return Number(value) || 30;
}

export async function extractAudio(videoFile, outputFile, options = {}) {
  await ensureDir(path.dirname(outputFile));
  await run('ffmpeg', [
    '-y',
    '-i', videoFile,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outputFile
  ], {signal: options.signal});
  return outputFile;
}

function scaleExpr(width, height, extra = '') {
  return `scale=${width}:${height}${extra}:flags=${SCALE_FLAGS}`;
}

function even(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function roundedAlpha(radius) {
  const r = Math.max(4, Math.round(radius));
  return `if(gt(pow(max(0\\,abs(W/2-X)-(W/2-${r}))\\,2)+pow(max(0\\,abs(H/2-Y)-(H/2-${r}))\\,2)\\,${r * r})\\,0\\,255)`;
}

function filterPath(value) {
  return String(value).replace(/\\/g, '/').replace(/'/g, "\\'").replace(/:/g, '\\:');
}

export function buildVerticalFilter({
  subtitleFile = null,
  fontDir = null,
  cwd = process.cwd(),
  mode = 'crop',
  webcamBox = null,
  sourceWidth = 1920,
  sourceHeight = 1080,
  focus = null,
  focusTrack = null
} = {}) {
  const subtitleName = subtitleFile ? filterPath(path.basename(subtitleFile)) : null;
  const relativeFontDir = fontDir ? filterPath(path.relative(cwd, fontDir) || '.') : null;
  const subtitle = subtitleName
    ? `subtitles='${subtitleName}'${relativeFontDir ? `:fontsdir='${relativeFontDir}'` : ''}`
    : null;
  if (mode === 'pip' && webcamBox) {
    const x = Math.max(0, Math.round(webcamBox.x));
    const y = Math.max(0, Math.round(webcamBox.y));
    const w = Math.max(24, Math.round(webcamBox.w));
    const h = Math.max(24, Math.round(webcamBox.h));
    const layout = pipLayout({...webcamBox, x, y, w, h}, {sourceWidth, sourceHeight});
    const stroke = layout.camCard.stroke;
    const radius = layout.camCard.radius;
    const camRound = `format=rgba,geq=lum='p(X\\,Y)':cb='p(X\\,Y)':cr='p(X\\,Y)':a='${roundedAlpha(radius)}'`;
    const screenLabel = layout.mask.visible ? 'screenmasked' : 'screenfit';
    const parts = [
      '[0:v]split=3[bg][screen][cam]',
      `[bg]${scaleExpr(TARGET_WIDTH, TARGET_HEIGHT, ':force_original_aspect_ratio=increase')},crop=${TARGET_WIDTH}:${TARGET_HEIGHT},boxblur=28:2,eq=brightness=-0.18:saturation=0.7[base]`,
      `[screen]${scaleExpr(layout.screen.width, layout.screen.height, ':force_original_aspect_ratio=increase')},crop=${layout.screen.width}:${layout.screen.height},setsar=1[screenfit]`
    ];
    if (layout.mask.visible) {
      const mx = Math.max(0, Math.round(layout.mask.localLeft));
      const my = Math.max(0, Math.round(layout.mask.localTop));
      const mw = Math.min(layout.screen.width - mx, even(Math.max(8, layout.mask.width)));
      const mh = Math.min(layout.screen.height - my, even(Math.max(8, layout.mask.height)));
      const blurR = Math.max(2, Math.min(12, Math.floor(Math.min(mw, mh) / 4)));
      parts.push(`[screenfit]split[skeep][sblur]`);
      parts.push(`[sblur]crop=${mw}:${mh}:${mx}:${my},boxblur=${blurR}:1[blurredcam]`);
      parts.push(`[skeep][blurredcam]overlay=${mx}:${my}[screenmasked]`);
    }
    parts.push(`[cam]crop=${w}:${h}:${x}:${y},${scaleExpr(layout.camWidth, layout.camHeight)},unsharp=5:5:${layout.camSharpness},pad=iw+${stroke * 2}:ih+${stroke * 2}:${stroke}:${stroke}:white,${camRound}[camrgba]`);
    parts.push('[camrgba]split[camv][camshsrc]');
    parts.push('[camshsrc]colorchannelmixer=aa=0.35,boxblur=16:4[camsh]');
    parts.push(`[base][camsh]overlay=(W-w)/2:${layout.camCard.top + 10}[withsh]`);
    parts.push(`[withsh][camv]overlay=(W-w)/2:${layout.camCard.top}[top]`);
    parts.push(`[top][${screenLabel}]overlay=${layout.screen.left}:${layout.screen.top}${subtitle ? `,${subtitle}` : ''}`);
    return parts.join(';');
  }
  if (mode === 'fit') {
    const filter = [
      '[0:v]split=2[bg][fg]',
      `[bg]${scaleExpr(TARGET_WIDTH, TARGET_HEIGHT, ':force_original_aspect_ratio=increase')},crop=${TARGET_WIDTH}:${TARGET_HEIGHT},boxblur=24:2,eq=brightness=-0.08:saturation=0.75[base]`,
      `[fg]${scaleExpr(TARGET_WIDTH, -2, ':force_original_aspect_ratio=decrease')},setsar=1[main]`,
      `[base][main]overlay=(W-w)/2:(H-h)/2${subtitle ? `,${subtitle}` : ''}`
    ];
    return filter.join(';');
  }
  return [
    scaleExpr(TARGET_WIDTH, TARGET_HEIGHT, ':force_original_aspect_ratio=increase'),
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}:x='max(0,min(iw-ow,iw*(${focusExpression(focusTrack, 'x', focus?.x ?? 0.5)})-ow/2))':y='max(0,min(ih-oh,ih*(${focusExpression(focusTrack, 'y', focus?.y ?? 0.5)})-oh/2))'`,
    'setsar=1',
    subtitle
  ].filter(Boolean).join(',');
}

export function focusExpression(track, axis, fallback) {
  const points = smoothFocusTrack(track);
  const safe = Math.min(1, Math.max(0, Number.isFinite(fallback) ? fallback : 0.5));
  if (!points.length) return String(safe);
  let expression = String(points.at(-1)[axis]);
  for (let i = points.length - 2; i >= 0; i--) {
    const a = points[i], b = points[i + 1];
    const value = a[axis] + '+(' + (b[axis]-a[axis]) + ')*(t-' + a.t + ')/' + (b.t-a.t);
    expression = 'if(lt(t,' + b.t + '),' + value + ',' + expression + ')';
  }
  return 'if(lt(t,' + points[0].t + '),' + points[0][axis] + ',' + expression + ')';
}

function videoEncodeArgs(quality) {
  const settings = {
    draft: {preset: 'veryfast', crf: '23', maxrate: '8M', bufsize: '16M'},
    standard: {preset: 'medium', crf: '19', maxrate: '12M', bufsize: '24M'},
    high: {preset: 'slow', crf: '17', maxrate: '16M', bufsize: '32M'}
  }[quality] ?? {preset: 'slow', crf: '17', maxrate: '16M', bufsize: '32M'};

  return [
    '-c:v', 'libx264',
    '-preset', settings.preset,
    '-crf', settings.crf,
    '-maxrate', settings.maxrate,
    '-bufsize', settings.bufsize,
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p'
  ];
}

export async function renderVerticalClip({videoFile, outputFile, start, end, subtitleFile = null, fontDir = null, cwd = process.cwd(), mode = 'crop', webcamBox = null, quality = 'high', signal = null, media = null, focus = null, focusTrack = null}) {
  await ensureDir(path.dirname(outputFile));
  const duration = Math.max(0.5, end - start);
  const source = media?.width && media?.height ? media : await ffprobe(videoFile, {signal});
  const filter = buildVerticalFilter({
    subtitleFile,
    fontDir,
    cwd,
    mode,
    webcamBox,
    sourceWidth: source.width,
    sourceHeight: source.height,
    focus,
    focusTrack
  });
  const args = [
    '-y',
    '-ss', String(start),
    '-i', videoFile,
    '-t', String(duration),
    '-vf', filter,
    ...videoEncodeArgs(quality),
    '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputFile
  ];
  await run('ffmpeg', args, {cwd, signal});
  return outputFile;
}
