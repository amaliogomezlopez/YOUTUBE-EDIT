/** Resolve sounds against the frame actually displayed, not padding before speech. */
export function syncReelSoundTiming({scenes,soundCues,fps}) {
 const visuals=scenes.flatMap(scene=>scene.cues.filter(c=>c.type==='broll').map((cue,i)=>({cue,frame:scene.from+(i===0?0:cue.fromFrame)})));
 for(const [i,visual] of visuals.entries()) {
  const sound=soundCues.find(s=>s.cueId===visual.cue.id);
  if(!sound) continue;
  sound.soundUse=visual.cue.soundUse??'transition';
  if(sound.soundUse==='intro' || visual.cue.sound?.family==='riser') {
   const next=visuals.slice(i+1).find(v=>v.cue.assetId!==visual.cue.assetId);
   if(!next)throw new Error('El riser necesita un cambio de visual posterior; usa soundUse transition en una pieza sin cambio.');
   const frames=Math.max(1,Math.round(sound.durationSeconds*fps));
   if(frames>next.frame-visual.frame)throw new Error('El riser no cabe antes del cambio de visual: elegir uno mas corto.');
   sound.startSeconds=(next.frame-frames)/fps;
   sound.releaseSeconds=Math.min(1/fps,sound.durationSeconds*.1);
   sound.sync={mode:'end-at-cut',targetFrame:next.frame};
  } else {
   sound.startSeconds=visual.frame/fps;
   sound.sync={mode:'start-at-cut',targetFrame:visual.frame};
  }
 }
}
