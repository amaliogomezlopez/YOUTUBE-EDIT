export default {id:'shorts-reel-semantic-sounds',run(c) {
 if(c.workflow!=='talking-head' || !c.soundUses) return [];
 const issues=[]; let sounding=0;
 for(const scene of c.scenes??[]) for(const cue of scene.cues??[]) {
   if(!cue.sound) continue;
   const use=cue.soundUse??'transition';
   if(c.soundUses[use]!==cue.sound.family) issues.push({message:'Familia incompatible con soundUse '+use});
   if(use==='intro' && sounding>0) issues.push({message:'Riser fuera del arranque.'});
   if(['money','message'].includes(use) && !cue.soundNote?.trim()) issues.push({message:'El sonido especializado requiere contexto en soundNote.'});
   sounding++;
 }
 return issues;
}};
