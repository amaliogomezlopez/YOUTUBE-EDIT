/** Pure camera evaluator shared by Canvas preview and FFmpeg export. */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=x=>x*x*(3-2*x);
export function compileCameraTrack({words,cues,sourceIn,duration,budget}) {
 if(!Number.isFinite(sourceIn)||sourceIn<0||!Number.isFinite(duration)||duration<=0)throw Error('Invalid camera time range');
 if(!Number.isFinite(budget?.maxZoom)||budget.maxZoom<1||!Number.isFinite(budget?.transitionSeconds)||budget.transitionSeconds<=0)throw Error('Camera budget required');
 const keys=[{time:0,zoom:1,x:.5,y:.5}],events=[];
 for(const cue of cues){
  const word=words[cue.atWord];
  if(!Number.isInteger(cue.atWord)||!Number.isFinite(word?.start))throw Error('Camera cue requires existing word anchor');
  const time=word.start-sourceIn;
  if(time<0||time>=duration)throw Error('Camera anchor outside clip');
  if(!cue.soundNote&&!cue.sound?.family)throw Error('Sound decision required');
  if(!cue.target||!['zoom','x','y'].every(k=>Number.isFinite(cue.target[k])))throw Error('Invalid camera target');
  if(cue.target.zoom<1||cue.target.zoom>budget.maxZoom||cue.target.x<0||cue.target.x>1||cue.target.y<0||cue.target.y>1)throw Error('Camera target outside budget');
  const previous=keys.at(-1),end=Math.min(duration,time+budget.transitionSeconds);
  if(time<previous.time)throw Error('Camera transitions overlap');
  if(time>previous.time)keys.push({...previous,time});
  keys.push({time:end,...cue.target});events.push({...cue,time,end});
 }
 return {version:1,duration,keys,events};
}
export function cameraAt(track,time){
 if(!Number.isFinite(time))throw Error('Invalid sample time');
 const keys=track.keys;
 if(time<=keys[0].time)return {...keys[0]};
 for(let i=1;i<keys.length;i++){
  if(time>keys[i].time)continue;
  const a=keys[i-1],b=keys[i],t=smooth(clamp((time-a.time)/(b.time-a.time),0,1));
  return {time,...Object.fromEntries(['zoom','x','y'].map(k=>[k,a[k]+(b[k]-a[k])*t]))};
 }
 return {...keys.at(-1)};
}
export function cameraCrop(region,camera){
 const w=region.w/camera.zoom,h=region.h/camera.zoom;
 return {x:region.x+clamp(camera.x*region.w-w/2,0,region.w-w),y:region.y+clamp(camera.y*region.h-h/2,0,region.h-h),w,h};
}
export function cameraExpression(track,axis,clock='on/60'){
 if(!['zoom','x','y'].includes(axis)||!/^on\/[1-9][0-9]*$/.test(clock))throw Error('Invalid expression');
 const n=v=>{if(!Number.isFinite(v))throw Error('Nonfinite key');return Number(v.toFixed(8));};
 const keys=track.keys;let expression=String(n(keys.at(-1)[axis]));
 for(let i=keys.length-1;i>0;i--){
  const a=keys[i-1],b=keys[i];if(b.time<=a.time)throw Error('Unordered keys');
  const p=`max(0,min(1,(${clock}-${n(a.time)})/${n(b.time-a.time)}))`;
  const curve=a[axis]===b[axis]?`${n(a[axis])}`:`${n(a[axis])}+(${n(b[axis]-a[axis])})*(${p})*(${p})*(3-2*(${p}))`;
  expression=`if(lt(${clock},${n(b.time)}),${curve},${expression})`;
 }
 return expression;
}
