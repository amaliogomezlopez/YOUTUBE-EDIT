// Color de la palabra pronunciada de cada preset karaoke de tres unidades.
const KARAOKE_PRESETS = {'talking-head-green': '#43F56C', 'talking-head-yellow': '#FFD60A'};

export default {id:'shorts-talking-head-karaoke',run(c) {
 const presetColor=KARAOKE_PRESETS[c.captionStyle?.preset];
 const karaoke=Boolean(presetColor);
 if(c.workflow!=='talking-head' && !karaoke) return [];
 const s=c.captionStyle ?? {},issues=[];
 if(!(s.mode==='karaoke' && s.emphasis==='color' && s.activeColor===(karaoke?presetColor:c.budget?.activeColor) && s.activeColor!==s.primary)) issues.push({message:'Activar karaoke con relleno de color en la palabra pronunciada.'});
 if(karaoke && (s.font!=='Schibsted Grotesk' || s.primary!=='#FFFFFF' || s.outlineSize!==5)) issues.push({message:'Conservar Schibsted Grotesk blanca con contorno de 5 px.'});
 for(const scene of c.scenes ?? []) for(const [i,page] of (scene.captionPages ?? []).entries()){
  if(karaoke && page.words?.length>3) issues.push({sceneId:scene.id,message:'El karaoke admite hasta tres unidades por pagina.'});
  const next=scene.captionPages[i+1];
  if(next && page.fromFrame+page.durationInFrames>next.fromFrame) issues.push({sceneId:scene.id,message:'Dos paginas de subtitulos se solapan.'});
 }
 return issues;
}};
