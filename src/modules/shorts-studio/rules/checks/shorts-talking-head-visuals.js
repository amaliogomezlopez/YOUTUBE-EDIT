import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
export default {id:'shorts-talking-head-visuals',run(context) {
 if(context.workflow!=='talking-head') return [];
 const b=context.budget;
 if(!Number.isFinite(b?.minVisualSeconds)||!Number.isFinite(b?.maxVisualSeconds)) return notEvaluable('Falta presupuesto de duracion visual.');
 const fps=context.format?.fps ?? 60, windows=[], issues=[];
 for(const s of context.scenes ?? []) for(const [i,c] of (s.cues ?? []).entries()) {
  if(c.type!=='broll') continue;
  const start=(s.from+(i===0?0:c.fromFrame))/fps;
  const end=(s.from+c.fromFrame+c.durationInFrames)/fps;
  const last=windows.at(-1);
  if(last && last.assetId===c.assetId && Math.abs(last.end-start)<2/fps) last.end=end;
  else windows.push({start,end,assetId:c.assetId});
  if(b.visualSourcePolicy==='real' && (!['web-capture','source-image','source-video'].includes(c.provenance?.kind)||!c.provenance?.source?.startsWith('https://'))) issues.push({sceneId:s.id,message:'El recurso necesita una fuente real verificable; no tarjetas editoriales genericas.'});
 }
 for(const w of windows) if(w.end-w.start>b.maxVisualSeconds+2/fps || w.end-w.start<b.minVisualSeconds-2/fps) issues.push({message:'Duracion de visual fuera del presupuesto: '+(w.end-w.start).toFixed(2)+' s'});
 return issues;
}};
