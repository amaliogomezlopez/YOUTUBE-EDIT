import {createHash} from 'node:crypto';
import {selectionRanges} from './selection.js';
import {partitionAtAnchors} from '../video-studio/shot-schedule.js';

export function scheduleFingerprint({manifest, transcripts, selections, silences, budget}) {
  return createHash('sha256').update(JSON.stringify({clips:manifest.clips, transcripts, selections, silences, budget})).digest('hex');
}

/** Partition the edited clock at word anchors, including across take/silence cuts. */
export function scheduleShots({manifest, transcripts, selections, silences = {}, budget, fps = 60}) {
  if (!selections?.length) throw new Error('Faltan selecciones');
  const nodes = [], ranges = [];
  let cursor = 0;
  selections.forEach((selection, selectionIndex) => {
    const result = selectionRanges(selection, manifest, transcripts, silences, budget);
    for (const range of result.ranges) {
      const inside = result.words.map((w, atWord) => ({...w, atWord})).filter(w => w.atWord >= selection.fromWord && w.atWord <= selection.toWord && w.end > range.start && w.start < range.end);
      const frames = Math.round((range.end - range.start) * fps);
      const base = {selectionIndex, clipId:selection.clipId};
      for (const [i,w] of inside.entries()) {
        const frame = cursor + (i === 0 ? 0 : Math.round((w.start-range.start)*fps));
        if (frame >= cursor+frames || nodes.at(-1)?.frame === frame) continue;
        nodes.push({...base, atWord:w.atWord, frame, text:w.text});
      }
      ranges.push({...base, ...range, fromFrame:cursor, durationInFrames:frames});
      cursor += frames;
    }
  });
  const segments = partitionAtAnchors(nodes, cursor, budget, fps);
  if (!segments) throw new Error('No se puede repartir este recorte en visuales de '+budget.minVisualSeconds+'-'+budget.maxVisualSeconds+' s ancladas a palabras. Revisar seleccion o tiempos de transcripcion.');
  const shots = segments.map(({start, endFrame}, index) => ({id:'visual-'+String(index+1).padStart(2,'0'), ...start, endFrame,
    durationSeconds:(endFrame-start.frame)/fps,
    spokenText:nodes.filter(n=>n.frame>=start.frame && n.frame<endFrame).map(n=>n.text).join(' ')}));
  return {fps, durationInFrames:cursor, ranges, shots};
}

/** Convert filled requests to the existing planner's word-based editorial input. */
export function scheduleSelections(selections, schedule, resources) {
  return selections.map((selection, selectionIndex) => {
    const first = schedule.ranges.find(r=>r.selectionIndex===selectionIndex).fromFrame;
    const own = schedule.shots.filter(s=>s.selectionIndex===selectionIndex);
    const active = [...schedule.shots].reverse().find(s=>s.frame<=first);
    const shots = own[0]?.frame===first ? own : [active,...own];
    return {...selection, visuals:shots.map(s=>{
      const asset = resources[s.id];
      if (!asset) throw new Error('Falta recurso '+s.id);
      const continuing = s.frame < first;
      return {atWord:continuing?selection.fromWord:s.atWord, assetId:asset.assetId,
        reason:asset.reason, soundUse:asset.soundUse, soundNote:asset.soundNote, fit:asset.fit, zoom:asset.zoom, transition:asset.transition,
        trimSeconds:(asset.trimSeconds??0)+(continuing?(first-s.frame)/schedule.fps:0),
        ...(continuing?{sound:false,soundNote:'Continuidad de la misma visual entre tomas.'}:{})};
    })};
  });
}
