import path from 'node:path';
import {existsSync} from 'node:fs';
import {readdir, readFile, stat} from 'node:fs/promises';
import {extractCapcutReference} from './capcut.js';

/**
 * Normalizes finished CapCut edits into Shortsmith's editing vocabulary:
 * takes, layouts, camera moves, inserts, sounds, music, stickers, texts and effects.
 * Evidence only: it describes what the editor did, never approves a rule.
 */

const us = (v) => (v ?? 0) / 1e6;
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const SFX_MAX_SECONDS = 4;
const INSERT_MAX_SECONDS = 15;
const SIDE_OFFSET = 0.1;
const PIP_SCALE = 0.6;

// Library names -> Shortsmith sound families (video-studio/sound-families.js).
const FAMILY_PATTERNS = [
  ['whip', /short whip|quick whip|whip/i],
  ['whoosh', /whoosh|woosh|swoosh|whsh|swish|swing|transition/i],
  ['shutter', /shutter|camera|click/i],
  ['riser', /riser|buildup|build-up|rise/i],
  ['chime', /bell|ding|coin|cash|money|chime/i],
  ['ui', /processing|interface|glitch|message/i]
];

export function soundFamilyOf(name) {
  return FAMILY_PATTERNS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'unmapped';
}

export async function discoverCapcutProjects(root) {
  const projects = [];
  async function walk(dir, depth) {
    if (depth > 3) return;
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (existsSync(path.join(full, 'draft_meta_info.json'))) projects.push(full);
      else await walk(full, depth + 1);
    }
  }
  await walk(root, 0);
  return projects.map((dir) => ({id: path.relative(root, dir).split(path.sep).join('/'), dir}));
}

/** The edit lives in the timeline with most segments; wrappers only hold a compound clip. */
export async function loadEditTimeline(projectDir) {
  const files = [path.join(projectDir, 'draft_content.json')];
  const subdrafts = path.join(projectDir, 'subdraft');
  if (existsSync(subdrafts)) {
    for (const id of await readdir(subdrafts)) files.push(path.join(subdrafts, id, 'draft_content.json'));
  }
  let canvas = null, best = null;
  for (const file of files.filter((f) => existsSync(f))) {
    const bytes = await readFile(file);
    let reference;
    try {reference = extractCapcutReference(bytes);} catch {continue;}
    if (file === files[0]) canvas = reference.timelines[0]?.canvas_config ?? null;
    for (const timeline of reference.timelines) {
      const segments = timeline.tracks.reduce((sum, track) => sum + track.segments.length, 0);
      if (!best || segments > best.segments) best = {timeline, segments, file, sourceSha256: reference.sourceSha256};
    }
  }
  if (!best) throw Error('Proyecto sin timeline legible: ' + projectDir);
  const {mtimeMs} = await stat(best.file);
  return {...best, canvas, modifiedAt: new Date(mtimeMs).toISOString()};
}

function scaleKeys(segment) {
  const channel = (segment.common_keyframes ?? []).find((c) => c.property_type === 'KFTypeScaleX');
  const sourceStart = us(segment.source_timerange?.start);
  const targetStart = us(segment.target_timerange.start);
  return (channel?.keyframe_list ?? []).map((k) => ({
    at: targetStart + us(k.time_offset) - sourceStart,
    value: k.values?.[0],
    easing: k.curveType === 'Line' ? 'linear' : 'curve'
  })).filter((k) => Number.isFinite(k.value)).sort((a, b) => a.at - b.at);
}

function placement(segment) {
  const clip = segment.clip ?? {};
  const x = clip.transform?.x ?? 0, y = clip.transform?.y ?? 0, scale = clip.scale?.x ?? 1;
  let layout = 'full';
  if (scale < PIP_SCALE) layout = 'pip';
  else if (x > SIDE_OFFSET) layout = 'right';
  else if (x < -SIDE_OFFSET) layout = 'left';
  return {x: round(x), y: round(y), scale: round(scale), layout};
}

export function normalizeEdit(timeline, {canvas = null} = {}) {
  const materials = new Map();
  for (const [kind, items] of Object.entries(timeline.materials)) {
    for (const {native} of items) materials.set(native.id, {kind, ...native});
  }
  const name = (m) => String(m?.name || m?.material_name || m?.path || '').split(/[\\/]/).pop();
  const extras = (segment, kinds) => (segment.extra_material_refs ?? [])
    .map((id) => materials.get(id)).filter((m) => m && kinds.includes(m.kind) && name(m)).map(name);
  const duration = us(timeline.duration);
  const width = canvas?.width || 1920, height = canvas?.height || 1080;
  const edit = {
    duration: round(duration),
    format: width >= height ? 'horizontal' : 'vertical',
    takes: [], inserts: [], cameraMoves: [], stickers: [], texts: [], sounds: [], music: [], effects: [], transitions: []
  };
  const videoTracks = timeline.tracks.map((track, index) => ({track, index})).filter(({track}) => track.type === 'video');
  const mainIndex = videoTracks[0]?.index;

  for (const [index, track] of timeline.tracks.entries()) {
    for (const {native: s} of track.segments) {
      const m = materials.get(s.material_id);
      const at = us(s.target_timerange.start), length = us(s.target_timerange.duration);
      const base = {at: round(at), duration: round(length), name: name(m), file: m?.path ?? null, track: index};
      if (track.type === 'video') {
        const keys = scaleKeys(s);
        for (let i = 1; i < keys.length; i++) {
          const a = keys[i - 1], b = keys[i];
          if (Math.abs(b.value - a.value) < 0.005) continue;
          edit.cameraMoves.push({at: round(a.at), duration: round(b.at - a.at), from: round(a.value), to: round(b.value), easing: b.easing === 'curve' || a.easing === 'curve' ? 'curve' : 'linear', track: index});
        }
        for (const t of extras(s, ['transitions'])) edit.transitions.push({at: round(at), name: t});
        const item = {...base, sourceIn: round(us(s.source_timerange?.start)), volume: round(s.volume ?? 1), ...placement(s),
          staticZoom: keys.length ? null : round(s.clip?.scale?.x ?? 1), photo: m?.type === 'photo',
          effects: extras(s, ['effects', 'video_effects'])};
        if (index === mainIndex) edit.takes.push(item);
        else edit.inserts.push({...item, role: length > INSERT_MAX_SECONDS && item.volume === 0 ? 'screen' : 'insert'});
      } else if (track.type === 'audio') {
        const item = {...base, volume: round(s.volume ?? 1)};
        if (length <= SFX_MAX_SECONDS) edit.sounds.push({...item, family: soundFamilyOf(item.name)});
        else edit.music.push(item);
      } else if (track.type === 'sticker') {
        edit.stickers.push({...base, ...placement(s)});
      } else if (track.type === 'text') {
        let text = '';
        try {text = JSON.parse(m?.content ?? '{}').text ?? '';} catch {}
        edit.texts.push({...base, text: String(text).slice(0, 120), ...placement(s)});
      } else if (track.type === 'effect') {
        edit.effects.push(base);
      }
    }
  }
  edit.takes.sort((a, b) => a.at - b.at);
  for (let i = 1; i < edit.takes.length; i++) {
    const prev = edit.takes[i - 1], take = edit.takes[i];
    // Same source continued after a gap: an internal jump cut.
    if (take.name === prev.name) take.jumpCutGap = round(take.sourceIn - (prev.sourceIn + prev.duration));
  }
  for (const sound of edit.sounds) Object.assign(sound, nearestEvent(edit, sound.at));
  return edit;
}

/**
 * Visual event a sound effect lands on. Whooshes start before the cut so their
 * peak hits it, so the window looks further ahead than behind; lead is event - sound.
 */
export function nearestEvent(edit, at, {before = 0.25, after = 1} = {}) {
  const events = [
    ...(at < 0.05 ? [{type: 'start', at: 0}] : []),
    ...edit.takes.slice(1).map((t) => ({type: t.jumpCutGap != null ? 'jump-cut' : 'take-change', at: t.at})),
    ...edit.inserts.map((t) => ({type: t.role === 'screen' ? 'screen-in' : t.photo ? 'image-in' : 'insert-in', at: t.at})),
    ...edit.inserts.map((t) => ({type: 'insert-out', at: t.at + t.duration})),
    ...edit.cameraMoves.map((m) => ({type: m.to > m.from ? 'zoom-in' : 'zoom-out', at: m.at})),
    ...edit.stickers.map((s) => ({type: 'sticker-in', at: s.at})),
    ...edit.texts.map((s) => ({type: 'text-in', at: s.at}))
  ];
  let best = null;
  for (const event of events) {
    const lead = event.at - at;
    if (lead >= -before && lead <= after && (!best || Math.abs(lead) < Math.abs(best.lead))) best = {type: event.type, lead};
  }
  return best ? {event: best.type, lead: round(best.lead)} : {event: 'none', lead: null};
}
