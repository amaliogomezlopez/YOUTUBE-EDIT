import {readFileSync} from 'node:fs';
import {round} from '../../lib/utils.js';
import {validSourceBox} from '../video-studio/framing.js';

export const EDITING_PROFILES = JSON.parse(readFileSync(new URL('./editing-profiles.json', import.meta.url), 'utf8'));
export function editingBudget(profile = 'dinamico') {
  if (!EDITING_PROFILES[profile]) throw new Error('Perfil de montaje desconocido: ' + profile);
  return {...EDITING_PROFILES[profile]};
}
const DETAIL = /\b(resultado|mira|aqu[ií]|bot[oó]n|pantalla|precio|comparar|tabla|gr[aá]fica|por ciento|tokens|segundos)\b/i;
const VERDICT = /\b(prefiero|recomiendo|conclusi[oó]n|por eso|me quedo|merece la pena|en resumen)\b/i;

/** Solo se eliminan pausas confirmadas por audio y transcripcion. Nunca palabras. */
export function speechEdits(words, duration, silences, budget) {
  if (!words.length) return [{start: 0, end: duration}];
  const padding = budget.silencePaddingSeconds;
  const start = Math.max(0, words[0].start - padding);
  const end = Math.min(duration, words.at(-1).end + padding);
  const removals = [];
  for (let i = 1; i < words.length; i++) {
    const left = words[i - 1].end;
    const right = words[i].start;
    if (right - left <= budget.maxSilenceSeconds) continue;
    const silence = silences.find((s) => s.start <= left + padding && s.end >= right - padding);
    if (silence) removals.push({start: left + padding, end: right - padding});
  }
  const ranges = [];
  let cursor = start;
  for (const removal of removals) {
    if (removal.start > cursor) ranges.push({start: round(cursor, 3), end: round(removal.start, 3)});
    cursor = removal.end;
  }
  if (end > cursor) ranges.push({start: round(cursor, 3), end: round(end, 3)});
  return ranges;
}
function observationAt(analysis, t) {
  return [...(analysis?.shots ?? [])].reverse().find((shot) => shot.start <= t) ?? {};
}
/** Palabras como anclas, imagenes como evidencia y cortes reversibles. */
export function planAdaptiveShort({words, duration, analysis, renderMode, webcamBox, source, profile = 'dinamico', effects = true, tighten = true}) {
  const budget = editingBudget(profile);
  const ranges = tighten ? speechEdits(words, duration, analysis?.silences ?? [], budget) : [{start: 0, end: duration}];
  const scenes = [];
  let lastEffect = -Infinity;
  let editedClock = 0;
  const cuts = [];
  for (const range of ranges) {
    const boundaries = [range.start];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (word.start <= range.start || word.start >= range.end - budget.minSceneSeconds) continue;
      const last = boundaries.at(-1);
      const phrase = /[.!?:,;]$/.test(words[i - 1].text) || word.start - words[i - 1].end > 0.28;
      const visualCut = (analysis?.shots ?? []).some((shot) => shot.start > last + 0.1 && Math.abs(shot.start - word.start) < 0.7);
      if (word.start - last >= budget.minSceneSeconds && (visualCut || (phrase && word.start - last >= budget.maxSceneSeconds * 0.65))) {
        boundaries.push(Math.max(words[i - 1].end, word.start - 0.04));
      }
    }
    boundaries.push(range.end);
    for (let j = 0; j < boundaries.length - 1; j++) {
      const start = boundaries[j], end = boundaries[j + 1];
      const inside = words.filter((w) => w.start >= start && w.start < end);
      const text = inside.map((w) => w.text).join(' ');
      const observation = observationAt(analysis, (start + end) / 2);
      const mode = renderMode ?? observation.mode ?? (webcamBox ? 'pip' : 'fit');
      const box = renderMode ? webcamBox : observation.webcamBox ?? webcamBox;
      const detail = DETAIL.test(text), verdict = VERDICT.test(text);
      const region = observation.region ?? (analysis?.samples ?? [])
        .filter(s => s.t >= start && s.t <= end && s.region?.confidence >= .55)
        .sort((a,b) => b.region.confidence-a.region.confidence || Math.abs(a.t-start)-Math.abs(b.t-start))[0]?.region;
      let layout = mode === 'crop' ? 'full' : mode;
      if (layout === 'pip' && !validSourceBox(box, source)) layout = 'fit';
      const scene = {
        id: 'scene-' + (scenes.length + 1), clipId: '01', trim: {start: round(start, 3), end: round(end, 3)},
        layout, camera: 'static', transitionIn: 'cut', transitionSound: false, cameraSound: false,
        atWord: inside[0]?.index ?? null,
        intent: detail ? 'detail' : verdict ? 'verdict' : scenes.length ? 'explanation' : 'hook',
        reason: detail ? 'Detalle de la demostracion.' : verdict ? 'Cierre u opinion del presentador.' : 'Continuidad del plano y de la frase.',
        ...(layout === 'pip' ? {webcamBox: box} : {}),
        ...(observation.focus && layout === 'full' ? {focusTrack: (analysis.samples ?? []).filter(s => s.t >= start && s.t <= end && s.mode === 'crop' && s.focus).map(s => ({t:s.t,x:s.focus.x,y:s.focus.y}))} : {}),
        ...(layout !== 'full' ? {screenRegion: {x:0,y:0,w:source.width,h:source.height,confidence:1,method:'contexto-completo'}} : {}),
        cues: []
      };
      if (observation.comparison && /compar|diferencia|derecha|izquierda|versus/i.test(text)) {
        scene.comparison = observation.comparison;
        scene.reason = 'Comparacion visual identificada por sus etiquetas.';
      }
      if (detail && region?.confidence >= 0.55 && validSourceBox(region, source) && layout !== 'full') {
        scene.screenRegion = region;
        scene.screenEmphasis = true;
        scene.reason += ' Region basada en ' + (region.method ?? 'revision') + '.';
      }
      if (effects && editedClock - lastEffect >= budget.minEffectGapSeconds && (detail || verdict || !scenes.length)) {
        if (layout === 'full') {
          scene.camera = verdict ? 'push-out' : 'punch-in';
          scene.cameraIntensity = (budget.maxZoom - 1) / 0.1;
          scene.cameraSound = 'camera';
          scene.cameraSoundIntensity = 0.35;
        } else if (scene.screenEmphasis) {
          scene.transitionSound = 'ui';
          scene.transitionSoundIntensity = 0.45;
        }
        if (scene.camera !== 'static' || scene.screenEmphasis) lastEffect = editedClock;
      }
      if (!effects) { scene.camera = 'static'; scene.transitionSound = false; }
      cuts.push({sourceStart: start, sourceEnd: end, outputStart: round(editedClock, 3), outputEnd: round(editedClock + end - start, 3)});
      editedClock += end - start;
      scenes.push(scene);
    }
  }
  return {scenes, budget, editingProfile: profile, sourceMap: cuts, silencePaddingSeconds: budget.silencePaddingSeconds,
    sound: {enabled: effects, mix: budget.soundMix}, warnings: analysis?.warnings ?? []};
}
export function applySceneEdits(plan, edits = []) {
  if (!Array.isArray(edits) || edits.length > 100) throw new Error('Ediciones de escenas invalidas.');
  for (const edit of edits) {
    const scene = plan.scenes.find((s) => s.id === edit.id);
    if (!scene) throw new Error('Escena desconocida: ' + edit.id);
    for (const key of ['layout', 'focus', 'webcamBox', 'screenRegion', 'screenEmphasis', 'camera', 'label', 'comparison']) {
      if (Object.hasOwn(edit, key)) scene[key] = edit[key];
    }
    if (edit.effects === false) {
      scene.camera = 'static'; scene.cameraSound = false; scene.transitionIn = 'cut'; scene.transitionSound = false; scene.cues = [];
    }
    scene.reason = 'Encuadre revisado por el usuario.';
  }
  return plan;
}
