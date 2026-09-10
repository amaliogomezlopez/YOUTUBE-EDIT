import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
export default {id:'shorts-talking-head-approved-style',run(c) {
  if (c.workflow!=='talking-head' || c.budget?.styleId!=='talking-head-approved-v2') return [];
  const b=c.budget, s=c.captionStyle ?? {}, issues=[];
  if (!Number.isFinite(b.maxZoom) || !b.mediaTransition || !Number.isFinite(b.captionWords)) return notEvaluable('Falta presupuesto del estilo aprobado.');
  if (s.font!=='Schibsted Grotesk' || s.baseFontSize!==82 || s.outlineSize!==5 || s.uppercase!==true || s.primary!=='#FFFFFF' || s.emphasis!=='color' || s.mode!=='karaoke' || s.activeColor!==b.activeColor) issues.push({message:'Se ha alterado el estilo de subtitulos aprobado.'});
  for (const scene of c.scenes ?? []) {
    if (scene.layout!=='talking-head' || scene.camera!=='static') issues.push({sceneId:scene.id,message:'El estilo aprobado situa la cara abajo con camara estatica.'});
    for (const cue of scene.cues ?? []) if (cue.type==='broll' && (cue.mediaZoom>b.maxZoom+0.0001 || cue.mediaTransition!==b.mediaTransition)) issues.push({sceneId:scene.id,message:'Zoom o transicion fuera del perfil aprobado.'});
    for (const page of scene.captionPages ?? []) if ((page.words?.length??0)>b.captionWords) issues.push({sceneId:scene.id,message:'Pagina con demasiadas unidades de subtitulo.'});
  }
  if (c.soundSelectionStatus==='user-folder') {
    const allowed=Object.values(c.soundPalette ?? {}).flat();
    if (!allowed.length || (c.soundCues ?? []).some(s=>!allowed.includes(s.file))) issues.push({message:'Con sonidos de carpeta solo se usan esos archivos.'});
  }
  return issues;
}};
