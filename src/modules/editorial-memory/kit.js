import {existsSync} from 'node:fs';
import {resolveStickerGif} from './capcut.js';

/**
 * The editor's own material, taken from what the corpus actually used and still
 * exists on disk: sound files per family, music bed, closing asset and opening
 * sticker with its usual placement. Frequency decides the order of options.
 */
export async function resolveBrandKit(edits, {probe, readFile, exists = existsSync}) {
  const count = (items, key) => {
    const map = new Map();
    for (const item of items) {
      const k = key(item);
      if (k) map.set(k, [...(map.get(k) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  };
  const median = (values) => {
    const list = values.filter(Number.isFinite).sort((a, b) => a - b);
    return list.length ? list[Math.floor((list.length - 1) / 2)] : null;
  };
  const kit = {sounds: {}, music: null, outro: null, sticker: null, sources: {}};

  for (const [file, uses] of count(edits.flatMap((e) => e.sounds), (s) => s.file)) {
    const family = uses[0].family;
    if (family === 'unmapped' || !exists(file)) continue;
    const {duration} = await probe(file);
    (kit.sounds[family] ??= []).push({file, duration, volume: median(uses.map((u) => u.volume)) ?? 1, uses: uses.length});
  }
  for (const [file, uses] of count(edits.flatMap((e) => e.music), (m) => m.file)) {
    if (!exists(file)) continue;
    kit.music = {file, duration: (await probe(file)).duration, uses: uses.length};
    break;
  }
  const closing = edits.map((e) => [...e.takes, ...e.inserts].sort((a, b) => (b.at + b.duration) - (a.at + a.duration))[0])
    .filter((x) => x && x.duration < 15);
  for (const [file, uses] of count(closing, (x) => x.file)) {
    if (!exists(file)) continue;
    const {duration, width, height} = await probe(file);
    kit.outro = {file, duration, width, height, uses: uses.length};
    break;
  }
  // Backdrop behind composed layouts: a still the editor put on the main track.
  for (const [file] of count(edits.flatMap((e) => e.takes.filter((t) => t.photo)), (t) => t.file)) {
    if (!exists(file)) continue;
    const {width, height} = await probe(file);
    kit.background = {file, width, height};
    break;
  }
  const opening = edits.flatMap((e) => e.stickers.filter((s) => s.at < 5));
  for (const [dir, uses] of count(opening, (s) => s.file)) {
    const file = await resolveStickerGif(dir, {readFile});
    if (!file || !exists(file)) continue;
    const {width, height} = await probe(file);
    const u = uses[0];
    kit.sticker = {file, width, height, seconds: median(uses.map((x) => x.duration)), name: u.name,
      // CapCut scales stickers from a smaller base than contain (see render-plan CAPCUT_STICKER_BASE).
      capcut: {x: u.x, y: u.y, scale: u.scale}};
    break;
  }
  kit.sources = {videos: edits.map((e) => e.project)};
  return kit;
}
