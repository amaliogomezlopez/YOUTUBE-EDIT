/**
 * Binds each editing decision of a finished edit to the words spoken around it.
 * Words must share the edit clock (transcribe the exported MP4, not the takes:
 * recordings like VIDEOS_RECORDED/2.mkv are overwritten by later videos).
 * Quiet windows are kept as negative examples: when the editor chose to do nothing.
 */

const round = (v) => Math.round(v * 1000) / 1000;
const BEFORE = 4, AFTER = 3, QUIET_WINDOW = 8;

export function wordsBetween(words, from, to) {
  return words.filter((w) => w.end > from && w.start < to).map((w) => String(w.text ?? w.word ?? '').trim()).filter(Boolean).join(' ');
}

function context(words, at, until = at + AFTER) {
  return {before: wordsBetween(words, at - BEFORE, at), during: wordsBetween(words, at, until)};
}

export function buildDecisionExamples(edit, words, {project}) {
  const decisions = [];
  const soundAt = (at) => edit.sounds.find((s) => s.lead != null && Math.abs(s.at + s.lead - at) < 0.05);
  const transitionAt = (at) => edit.transitions.find((t) => Math.abs(t.at - at) < 0.05)?.name ?? null;
  for (const take of edit.takes.slice(1)) {
    const sound = soundAt(take.at);
    decisions.push({type: take.jumpCutGap != null ? 'jump-cut' : 'cut', at: take.at,
      params: {sound: sound?.family ?? null, soundLead: sound?.lead ?? null, transition: transitionAt(take.at), layout: take.layout, staticZoom: take.staticZoom}});
  }
  for (const move of edit.cameraMoves) {
    decisions.push({type: move.to > move.from ? 'zoom-in' : 'zoom-out', at: move.at, until: move.at + move.duration,
      params: {from: move.from, to: move.to, seconds: move.duration, easing: move.easing}});
  }
  for (const insert of edit.inserts) {
    const sound = soundAt(insert.at);
    decisions.push({type: insert.role === 'screen' ? 'screen' : insert.photo ? 'image' : 'video-insert', at: insert.at, until: insert.at + insert.duration,
      params: {seconds: insert.duration, layout: insert.layout, scale: insert.scale, muted: insert.volume === 0, asset: insert.name, sound: sound?.family ?? null}});
  }
  for (const sticker of edit.stickers) decisions.push({type: 'sticker', at: sticker.at, until: sticker.at + sticker.duration, params: {asset: sticker.name, seconds: sticker.duration, x: sticker.x, y: sticker.y}});
  for (const text of edit.texts) decisions.push({type: 'text', at: text.at, until: text.at + text.duration, params: {text: text.text, seconds: text.duration}});

  const examples = decisions.sort((a, b) => a.at - b.at).map((d, i) => ({
    id: `${project}#${i + 1}`, project, type: d.type, at: round(d.at), params: d.params,
    context: context(words, d.at, Math.min(d.until ?? d.at + AFTER, d.at + AFTER))
  })).filter((e) => e.context.before || e.context.during);

  // Negative examples: spans where no decision starts, sampled every QUIET_WINDOW seconds.
  const busy = decisions.map((d) => d.at).sort((a, b) => a - b);
  for (let at = QUIET_WINDOW; at < edit.duration - QUIET_WINDOW; at += QUIET_WINDOW) {
    if (busy.some((b) => Math.abs(b - at) < QUIET_WINDOW / 2)) continue;
    const ctx = context(words, at);
    if (ctx.during) examples.push({id: `${project}#quiet-${Math.round(at)}`, project, type: 'none', at: round(at), params: {}, context: ctx});
  }
  return examples.sort((a, b) => a.at - b.at);
}

/**
 * Seconds of air the editor leaves around speech at each cut, measured on the
 * exported audio: lead = speech onset - cut, tail = cut - speech offset of the
 * previous take. Audio, not word timestamps: transcribers stretch words over silence.
 */
export function cutPadding(edit, silences, window = 1.5) {
  const lead = [], tail = [];
  for (const take of edit.takes.slice(1)) {
    const cut = take.at;
    const before = silences.filter((s) => s.start < cut + 0.02 && s.start > cut - window).at(-1);
    if (before) tail.push(Math.round((cut - before.start) * 1000) / 1000);
    const after = silences.find((s) => s.end > cut - 0.02 && s.end < cut + window && s.start < cut + 0.3);
    if (after) lead.push(Math.round((after.end - cut) * 1000) / 1000);
  }
  return {lead, tail};
}
