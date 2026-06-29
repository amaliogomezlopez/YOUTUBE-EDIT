import path from 'node:path';
import {ensureDir, run} from './utils.js';

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const SCALE_FLAGS = 'lanczos+accurate_rnd+full_chroma_int+full_chroma_inp';

export async function ffprobe(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file
  ]);
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

export async function extractAudio(videoFile, outputFile) {
  await ensureDir(path.dirname(outputFile));
  await run('ffmpeg', [
    '-y',
    '-i', videoFile,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-c:a', 'pcm_s16le',
    outputFile
  ]);
  return outputFile;
}

function scaleExpr(width, height, extra = '') {
  return `scale=${width}:${height}${extra}:flags=${SCALE_FLAGS}`;
}

function even(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function pipLayoutForWebcamBox(box) {
  const maxCamWidth = 650;
  const minCamWidth = 360;
  const maxUpscale = 2.5;
  const camWidth = even(Math.min(maxCamWidth, Math.max(minCamWidth, box.w * maxUpscale)));
  const camHeightWithPad = even((camWidth * box.h) / box.w) + 12;
  const camY = 42;
  const screenY = Math.max(520, Math.round(camY + camHeightWithPad + 42));
  const camSharpness = camWidth / box.w > 3 ? '0.35:3:3:0.15' : '0.45:3:3:0.18';
  return {camWidth, camY, screenY, camSharpness};
}

function buildVerticalFilter({subtitleFile = null, mode = 'crop', webcamBox = null}) {
  const subtitle = subtitleFile ? `subtitles=${path.basename(subtitleFile).replace(/\\/g, '/')}` : null;
  if (mode === 'pip' && webcamBox) {
    const x = Math.max(0, Math.round(webcamBox.x));
    const y = Math.max(0, Math.round(webcamBox.y));
    const w = Math.max(24, Math.round(webcamBox.w));
    const h = Math.max(24, Math.round(webcamBox.h));
    const maskX = Math.max(0, x - 24);
    const maskY = Math.max(0, y - 18);
    const maskW = w + 54;
    const maskH = h + 42;
    const layout = pipLayoutForWebcamBox({w, h});
    return [
      '[0:v]split=3[bg][screen][cam]',
      `[bg]${scaleExpr(TARGET_WIDTH, TARGET_HEIGHT, ':force_original_aspect_ratio=increase')},crop=${TARGET_WIDTH}:${TARGET_HEIGHT},boxblur=28:2,eq=brightness=-0.18:saturation=0.7[base]`,
      `[screen]drawbox=x=${maskX}:y=${maskY}:w=${maskW}:h=${maskH}:color=black@1:t=fill,${scaleExpr(1600, -2)},setsar=1,unsharp=5:5:0.45:3:3:0.2[screenfit]`,
      `[cam]crop=${w}:${h}:${x}:${y},${scaleExpr(layout.camWidth, -2)},unsharp=5:5:${layout.camSharpness},pad=iw+12:ih+12:6:6:black,setsar=1[camfit]`,
      `[base][camfit]overlay=(W-w)/2:${layout.camY}[top]`,
      `[top][screenfit]overlay=-130:${layout.screenY}${subtitle ? `,${subtitle}` : ''}`
    ].join(';');
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
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
    'setsar=1',
    subtitle
  ].filter(Boolean).join(',');
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

export async function renderVerticalClip({videoFile, outputFile, start, end, subtitleFile = null, cwd = process.cwd(), mode = 'crop', webcamBox = null, quality = 'high'}) {
  await ensureDir(path.dirname(outputFile));
  const duration = Math.max(0.5, end - start);
  const filter = buildVerticalFilter({subtitleFile, mode, webcamBox});
  const args = [
    '-y',
    '-ss', String(start),
    '-i', videoFile,
    '-t', String(duration),
    '-vf', filter,
    ...videoEncodeArgs(quality),
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    outputFile
  ];
  await run('ffmpeg', args, {cwd});
  return outputFile;
}
