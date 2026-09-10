export default {id:'shorts-talking-head-karaoke',run(c) {
 if(c.workflow!=='talking-head') return [];
 const s=c.captionStyle ?? {},issues=[];
 if(!(s.mode==='karaoke' && s.emphasis==='color' && s.activeColor===c.budget?.activeColor && s.activeColor!==s.primary)) issues.push({message:'Activar karaoke con relleno verde de la palabra pronunciada.'});
 for(const scene of c.scenes ?? []) for(const [i,page] of (scene.captionPages ?? []).entries()){
  const next=scene.captionPages[i+1];
  if(next && page.fromFrame+page.durationInFrames>next.fromFrame) issues.push({sceneId:scene.id,message:'Dos paginas de subtitulos se solapan.'});
 }
 return issues;
}};
