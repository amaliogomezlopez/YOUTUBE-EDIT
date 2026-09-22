import {run} from '../../lib/utils.js';

/** Parse ffmpeg silencedetect output into closed {start, end} intervals. */
export function parseSilences(stderr, duration = Infinity) {
  const silences = [];
  let start = null;
  for (const line of String(stderr).split(/\r?\n/)) {
    const opened = /silence_start: (-?[\d.]+)/.exec(line);
    const closed = /silence_end: ([\d.]+)/.exec(line);
    if (opened) start = Math.max(0, Number(opened[1]));
    if (closed && start != null) {silences.push({start, end: Number(closed[1])}); start = null;}
  }
  if (start != null && Number.isFinite(duration)) silences.push({start, end: duration});
  return silences;
}

export async function detectSilences(file, {noise = -35, minSeconds = 0.25, duration, signal} = {}) {
  const {stderr} = await run('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', `silencedetect=noise=${noise}dB:d=${minSeconds}`, '-f', 'null', '-'], {signal});
  return parseSilences(stderr, duration);
}
