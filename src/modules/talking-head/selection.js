import {speechEdits} from '../video-studio/timeline.js';

/** Shared by the shot schedule and the actual cut; never estimate timings twice. */
export function selectionRanges(selection, manifest, transcripts, silences, budget) {
  const clip = manifest.clips.find(c => c.id === selection.clipId);
  const words = transcripts[selection.clipId]?.words;
  const {fromWord, toWord} = selection;
  if (!clip || !words?.length || !Number.isInteger(fromWord) || !Number.isInteger(toWord) || fromWord < 0 || toWord < fromWord || toWord >= words.length) throw new Error('Seleccion de palabras invalida');
  if (!selection.reason?.trim()) throw new Error('Cada seleccion necesita reason');
  const raw = speechEdits(words.slice(fromWord, toWord + 1), clip.durationSeconds, silences[clip.id] ?? [], budget);
  const ranges = raw.map((r, i) => {
    const start = Math.max(r.start, fromWord > 0 ? words[fromWord - 1].end : 0);
    const end = Math.min(r.end, toWord + 1 < words.length ? words[toWord + 1].start : clip.durationSeconds);
    if (end <= start || (i === 0 && start > words[fromWord].start) || (i === raw.length - 1 && end < words[toWord].end)) throw new Error('Palabras solapadas: revisar transcripcion antes de recortar');
    return {start, end};
  });
  return {clip, words, ranges};
}
