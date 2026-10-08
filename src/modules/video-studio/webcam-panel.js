/**
 * Webcam panel of a screen recording (OBS overlay): the rectangle around the face,
 * which is often flush with two frame edges, so only its inner edges show up.
 *
 * An edge counts when a straight line of strong contrast crosses the panel's span
 * in most frames; screen text makes short, scattered edges and moves between
 * frames, the panel border does not.
 */
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const exec = promisify(execFile);

const EDGE = 14;
const MIN_SCORE = 0.45;
// Objects in the room (a chair, a lamp) also draw lines inside the panel; an outer side
// only moves off the frame edge when its border is almost perfect.
const OUTER_SCORE = 0.92;

/** frames: [{width, height, data}] in 8-bit gray; face in source pixels. */
export function panelFromFrames(frames, face, media) {
  const {width: W, height: H} = frames[0];
  const sx = W / media.width, sy = H / media.height;
  const f = {x: face.x * sx, y: face.y * sy, w: face.w * sx, h: face.h * sy};
  const at = (fr, x, y) => fr.data[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))];
  // Share of the span where the line at p separates two different tones, averaged over frames.
  const score = (axis, p, from, to) => {
    let total = 0;
    for (const fr of frames) {
      let hit = 0, n = 0;
      for (let q = Math.round(from); q < Math.round(to); q++, n++) {
        const d = axis === 'x' ? Math.abs(at(fr, p - 2, q) - at(fr, p + 2, q)) : Math.abs(at(fr, q, p - 2) - at(fr, q, p + 2));
        if (d > EDGE) hit++;
      }
      total += n ? hit / n : 0;
    }
    return total / frames.length;
  };
  const best = (axis, lo, hi, from, to) => {
    let top = {p: null, s: 0};
    for (let p = Math.max(2, Math.round(lo)); p <= Math.min((axis === 'x' ? W : H) - 3, Math.round(hi)); p++) {
      const s = score(axis, p, from, to);
      if (s > top.s) top = {p, s};
    }
    return top;
  };
  const right = f.x + f.w / 2 > W / 2, bottom = f.y + f.h / 2 > H / 2;
  const band = {y0: f.y, y1: f.y + f.h, x0: f.x, x1: f.x + f.w};
  // Inner vertical edge first (between screen and panel), on the face rows.
  const inner = right ? best('x', f.x - 2.4 * f.w, f.x - 0.25 * f.w, band.y0, band.y1) : best('x', f.x + 1.25 * f.w, f.x + 3.4 * f.w, band.y0, band.y1);
  const outer = right ? best('x', f.x + 1.25 * f.w, W - 3, band.y0, band.y1) : best('x', 2, f.x - 0.25 * f.w, band.y0, band.y1);
  if (inner.s < MIN_SCORE) return null;
  const x0 = right ? inner.p : (outer.s >= OUTER_SCORE ? outer.p : 0);
  const x1 = right ? (outer.s >= OUTER_SCORE ? outer.p : W) : inner.p;
  const innerY = bottom ? best('y', f.y - 2.4 * f.h, f.y - 0.2 * f.h, x0 + 4, x1 - 4) : best('y', f.y + 1.2 * f.h, f.y + 3.4 * f.h, x0 + 4, x1 - 4);
  const outerY = bottom ? best('y', f.y + 1.2 * f.h, H - 3, x0 + 4, x1 - 4) : best('y', 2, f.y - 0.2 * f.h, x0 + 4, x1 - 4);
  if (innerY.s < MIN_SCORE) return null;
  const y0 = bottom ? innerY.p : (outerY.s >= OUTER_SCORE ? outerY.p : 0);
  const y1 = bottom ? (outerY.s >= OUTER_SCORE ? outerY.p : H) : innerY.p;
  const box = {x: Math.round(x0 / sx), y: Math.round(y0 / sy), w: Math.round((x1 - x0) / sx), h: Math.round((y1 - y0) / sy)};
  const contains = box.x <= face.x && box.y <= face.y && box.x + box.w >= face.x + face.w && box.y + box.h >= face.y + face.h;
  if (!contains || box.w * box.h > media.width * media.height * 0.4) return null;
  return {...box, confidence: Math.round(Math.min(inner.s, innerY.s) * 100) / 100, method: 'panel-edges'};
}

export async function detectWebcamPanel(file, media, face, {samples = 6, width = 640} = {}) {
  const height = Math.round(width * media.height / media.width / 2) * 2;
  const frames = [];
  for (let i = 0; i < samples; i++) {
    const t = media.duration * (0.1 + 0.8 * i / Math.max(1, samples - 1));
    const {stdout} = await exec('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:${height},format=gray`, '-f', 'rawvideo', '-'], {encoding: 'buffer', maxBuffer: width * height * 2, windowsHide: true});
    if (stdout.length === width * height) frames.push({width, height, data: stdout});
  }
  if (!frames.length) return null;
  return panelFromFrames(frames, face, media);
}

/**
 * The takes of one video share the OBS scene: a panel far from the median of the
 * others is a misreading, and a take without a reading borrows the median.
 * A reading close to the median is widened to cover it.
 */
export function consensusPanels(panels, faces, media, tolerance = 0.06) {
  const found = Object.values(panels).filter(Boolean);
  if (found.length < 3) return panels;
  const med = (k) => found.map((p) => p[k]).sort((a, b) => a - b)[found.length >> 1];
  const c = {x: med('x'), y: med('y'), w: med('w'), h: med('h')};
  const far = (p) => ['x', 'y'].some((k) => Math.abs(p[k] - c[k]) > tolerance * media.width) || Math.abs(p.x + p.w - c.x - c.w) > tolerance * media.width || Math.abs(p.y + p.h - c.y - c.h) > tolerance * media.width;
  const inside = (face) => face && face.x >= c.x && face.y >= c.y && face.x + face.w <= c.x + c.w && face.y + face.h <= c.y + c.h;
  // A panel read too small would leave a sliver of face beside the bubble: never shrink below the median.
  const union = (p) => {
    const x = Math.min(p.x, c.x), y = Math.min(p.y, c.y);
    return {...p, x, y, w: Math.max(p.x + p.w, c.x + c.w) - x, h: Math.max(p.y + p.h, c.y + c.h) - y};
  };
  return Object.fromEntries(Object.entries(panels).map(([id, p]) => [id, (!p || far(p)) ? (inside(faces[id]) ? {...c, method: 'consensus', replaced: p ? 'outlier' : 'missing'} : p) : union(p)]));
}
