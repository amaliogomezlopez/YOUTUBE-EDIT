export default {id:'shorts-talking-head-karaoke',run(c) {
 const green=c.captionStyle?.preset==='talking-head-green';
 if(c.workflow!=='talking-head' && !green) return [];
 const s=c.captionStyle ?? {},issues=[];
 if(!(s.mode==='karaoke' && s.emphasis==='color' && s.activeColor===(green?'#43F56C':c.budget?.activeColor) && s.activeColor!==s.primary)) issues.push({message:'Activar karaoke con relleno verde de la palabra pronunciada.'});
 if(green && (s.font!=='Schibsted Grotesk' || s.primary!=='#FFFFFF' || s.outlineSize!==5)) issues.push({message:'Conservar Schibsted Grotesk blanca con contorno de 5 px.'});
 for(const scene of c.scenes ?? []) for(const [i,page] of (scene.captionPages ?? []).entries()){
  if(green && page.words?.length>3) issues.push({sceneId:scene.id,message:'El karaoke verde admite hasta tres unidades por pagina.'});
  const next=scene.captionPages[i+1];
  if(next && page.fromFrame+page.durationInFrames>next.fromFrame) issues.push({sceneId:scene.id,message:'Dos paginas de subtitulos se solapan.'});
 }
 return issues;
}};
