/**
 * Editable handoff: the render plan as FCPXML 1.9 (DaVinci Resolve, Final Cut),
 * and the way back: an edited FCPXML read into flat clips and diffed against the
 * plan, so the editor's corrections become examples without typing comments.
 *
 * Geometry: CapCut units (centre-normalised, y up, scale over contain) map to
 * FCPXML adjust-transform, whose position unit is a percent of frame height.
 */

const FPS = 30;
const round = (v) => Math.round(v * 1000) / 1000;
const t = (frames) => `${Math.round(frames)}/${FPS}s`;
const secondsToFrames = (s) => Math.round(s * FPS);
const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const fileUrl = (p) => 'file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/').replace(/^([A-Za-z])%3A/, '$1:');
const db = (gain) => (gain > 0 ? `${(20 * Math.log10(gain)).toFixed(2)}dB` : '-96dB');

function transformXml(layer, width, height) {
  const {x = 0, y = 0, scaleX = 1, scaleY = 1} = layer.transform ?? {};
  const pos = (px, py) => `${(px * width / 2 / height * 100).toFixed(4)} ${(py * height / 2 / height * 100).toFixed(4)}`;
  const curve = layer.curves?.scaleX;
  if (!curve?.length) {
    if (x === 0 && y === 0 && scaleX === 1 && scaleY === 1) return '';
    return `<adjust-transform position="${pos(x, y)}" scale="${scaleX} ${scaleY}"/>`;
  }
  const start = secondsToFrames(layer.sourceIn);
  const keys = (value) => curve.map((k, i) => `<keyframe time="${t(start + secondsToFrames(k.time))}" value="${value(k, i)}"/>`).join('');
  return `<adjust-transform><param name="position">${`<keyframeAnimation>${keys((k, i) => pos(layer.curves.x?.[i]?.value ?? x, layer.curves.y?.[i]?.value ?? y))}</keyframeAnimation>`}</param>` +
    `<param name="scale"><keyframeAnimation>${keys((k) => `${k.value} ${k.value}`)}</keyframeAnimation></param></adjust-transform>`;
}

/** resolveFile maps a layer's file (public-relative or absolute) to an absolute path on disk. */
export function toFcpxml(plan, {name = 'Shortsmith', resolveFile = (f) => f, durations = {}} = {}) {
  const {width, height} = plan.format;
  const assets = new Map();
  const assetOf = (layer) => {
    const src = resolveFile(layer.file);
    if (!assets.has(src)) assets.set(src, {id: `a${assets.size + 2}`, src, audio: layer.type !== 'image' && layer.type !== 'gif', video: layer.type !== 'audio',
      duration: durations[src] ?? Math.max(layer.sourceIn + layer.duration / FPS, 3600)});
    return assets.get(src);
  };
  const spineLayers = plan.layers.filter((l) => l.type === 'video' && (l.trackIndex === 0 || l.name === 'outro')).sort((a, b) => a.from - b.from);
  // Text layers need the editor's own title templates; they stay out of the handoff.
  const connected = plan.layers.filter((l) => !spineLayers.includes(l) && l.type !== 'text');
  const lanes = new Map();
  const laneOf = (l) => {
    const key = l.type === 'audio' ? `a${l.trackIndex}` : `v${l.trackIndex}`;
    if (!lanes.has(key)) lanes.set(key, l.type === 'audio' ? -1 - [...lanes.keys()].filter((k) => k.startsWith('a')).length : 1 + [...lanes.keys()].filter((k) => k.startsWith('v')).length);
    return lanes.get(key);
  };
  const clipXml = (l, offsetFrames, lane) => {
    const asset = assetOf(l);
    const volume = l.type === 'audio' || l.type === 'video' ? `<adjust-volume amount="${db(l.volume)}"/>` : '';
    return `<asset-clip ref="${asset.id}" name="${esc(l.name ?? l.id)}"${lane ? ` lane="${lane}"` : ''} offset="${t(offsetFrames)}" start="${t(secondsToFrames(l.sourceIn))}" duration="${t(l.duration)}"${asset.audio ? '' : ' audioRole=""'}>` +
      `${l.type === 'audio' ? '' : transformXml(l, width, height)}${volume}<note>${esc(l.id)}</note>`;
  };
  const spine = [];
  let cursor = 0;
  for (const s of spineLayers) {
    if (s.from > cursor) spine.push({gap: true, from: cursor, duration: s.from - cursor});
    spine.push({layer: s, from: s.from, duration: s.duration});
    cursor = s.from + s.duration;
  }
  if (cursor < plan.durationInFrames) spine.push({gap: true, from: cursor, duration: plan.durationInFrames - cursor});
  const children = new Map(spine.map((s) => [s, []]));
  for (const l of connected) {
    const parent = spine.find((s) => l.from >= s.from && l.from < s.from + s.duration) ?? spine.at(-1);
    children.get(parent).push(l);
  }
  const body = spine.map((s) => {
    const base = s.gap ? 0 : secondsToFrames(s.layer.sourceIn);
    const inner = children.get(s).map((l) => clipXml(l, base + (l.from - s.from), laneOf(l)) + '</asset-clip>').join('');
    return s.gap ? `<gap name="Gap" offset="${t(s.from)}" start="0s" duration="${t(s.duration)}">${inner}</gap>`
      : clipXml(s.layer, s.from, 0) + inner + '</asset-clip>';
  }).join('\n');
  const resources = [`<format id="r1" frameDuration="1/${FPS}s" width="${width}" height="${height}"/>`,
    ...[...assets.values()].map((a) => `<asset id="${a.id}" name="${esc(a.src.split(/[\\/]/).pop())}" start="0s" duration="${t(secondsToFrames(a.duration))}" hasVideo="${a.video ? 1 : 0}" hasAudio="${a.audio ? 1 : 0}" format="r1"><media-rep kind="original-media" src="${esc(fileUrl(a.src))}"/></asset>`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">\n<resources>\n${resources.join('\n')}\n</resources>\n` +
    `<library><event name="${esc(name)}"><project name="${esc(name)}"><sequence format="r1" duration="${t(plan.durationInFrames)}" tcStart="0s" tcFormat="NDF">\n<spine>\n${body}\n</spine>\n</sequence></project></event></library>\n</fcpxml>\n`;
}

/** Minimal element tree: FCPXML carries its data in attributes. */
export function parseXml(xml) {
  const root = {name: '#root', attrs: {}, children: []};
  const stack = [root];
  const re = /<(\/?)([\w:-]+)([^>]*?)(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/g;
  for (const m of xml.matchAll(re)) {
    if (!m[2]) continue;
    if (m[1]) {stack.pop(); continue;}
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const node = {name: m[2], attrs, children: []};
    stack.at(-1).children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

const seconds = (v) => {
  if (!v) return 0;
  const m = /^(-?\d+)(?:\/(\d+))?s$/.exec(v);
  return m ? Number(m[1]) / Number(m[2] ?? 1) : Number.NaN;
};

/** Flat clips on the sequence clock, whatever nesting the editor's export uses. */
export function readFcpxml(xml) {
  const root = parseXml(xml);
  const find = (node, name) => node.name === name ? node : node.children.map((c) => find(c, name)).find(Boolean);
  const assets = new Map();
  const walkAssets = (n) => {
    if (n.name === 'asset') assets.set(n.attrs.id, decodeURIComponent((n.attrs.src ?? find(n, 'media-rep')?.attrs.src ?? '').replace(/^file:\/\/\/?/, '')));
    n.children.forEach(walkAssets);
  };
  walkAssets(root);
  const spine = find(root, 'spine');
  if (!spine) throw Error('FCPXML sin spine');
  const clips = [];
  const visit = (node, parentAt, parentStart, lane) => {
    for (const c of node.children) {
      if (!['asset-clip', 'clip', 'gap', 'video', 'audio'].includes(c.name)) continue;
      const offset = seconds(c.attrs.offset), start = seconds(c.attrs.start), duration = seconds(c.attrs.duration);
      const at = parentAt + (offset - parentStart);
      const ownLane = c.attrs.lane != null ? Number(c.attrs.lane) : lane;
      if (c.name !== 'gap') {
        // Only this clip's own transform: connected clips nest inside it with theirs.
        const transform = c.children.find((x) => x.name === 'adjust-transform');
        const scale = transform?.attrs.scale ? Number(transform.attrs.scale.split(' ')[0]) : 1;
        clips.push({src: assets.get(c.attrs.ref) ?? c.attrs.ref, at: round(at), start: round(start), duration: round(duration), lane: ownLane,
          scale, name: c.attrs.name});
      }
      visit(c, at, start, ownLane);
    }
  };
  visit(spine, 0, 0, 0);
  return clips.sort((a, b) => a.at - b.at || a.lane - b.lane);
}


/**
 * Differences an editor introduced: moved, trimmed, rescaled, removed and added
 * clips, matched by media and time. Each becomes a correction pending review.
 */
export function diffTimelines(before, after, {tolerance = 0.05} = {}) {
  const used = new Set(), changes = [];
  const base = (src) => String(src).replace(/\\/g, '/').toLowerCase();
  for (const b of before) {
    const candidates = after.map((a, i) => ({a, i})).filter(({a, i}) => !used.has(i) && base(a.src) === base(b.src) && a.lane === b.lane
      && Math.abs(a.start - b.start) < Math.max(2, b.duration) && Math.abs(a.at - b.at) < Math.max(3, b.duration));
    const best = candidates.sort((x, y) => Math.abs(x.a.at - b.at) - Math.abs(y.a.at - b.at))[0];
    if (!best) {changes.push({type: 'removed', clip: b}); continue;}
    used.add(best.i);
    const a = best.a, deltas = {};
    if (Math.abs(a.at - b.at) > tolerance) deltas.at = round(a.at - b.at);
    if (Math.abs(a.start - b.start) > tolerance) deltas.start = round(a.start - b.start);
    if (Math.abs(a.duration - b.duration) > tolerance) deltas.duration = round(a.duration - b.duration);
    if (Math.abs(a.scale - b.scale) > 0.01) deltas.scale = round(a.scale - b.scale);
    if (Object.keys(deltas).length) changes.push({type: 'changed', clip: b, deltas});
  }
  after.forEach((a, i) => {if (!used.has(i)) changes.push({type: 'added', clip: a});});
  return changes;
}
