export default {id:'shorts-reel-sound-sync',run(c) {
 if(c.workflow!=='talking-head' || !c.soundUses)return [];
 const fps=c.format?.fps??60,issues=[];
 const visuals=(c.scenes??[]).flatMap(s=>(s.cues??[]).filter(q=>q.type==='broll').map((q,i)=>({id:q.id,asset:q.assetId,frame:s.from+(i===0?0:q.fromFrame)})));
 for(const sound of c.soundCues??[]) {
  if(!sound.cueId)continue;
  const i=visuals.findIndex(v=>v.id===sound.cueId),visual=visuals[i];
  if(!visual)continue;
  const start=Math.round(sound.startSeconds*fps),end=start+Math.max(1,Math.round(sound.durationSeconds*fps));
  if(sound.soundUse==='intro') {
   const next=visuals.slice(i+1).find(v=>v.asset!==visual.asset);
   if(!next || end!==next.frame)issues.push({message:'El final del riser no coincide con el cambio de visual.'});
  }else if(start!==visual.frame)issues.push({message:'El efecto no empieza en el corte visual.'});
 }
 return issues;
}};
