/** Pure camera evaluator shared by Canvas preview and FFmpeg export. */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const smooth=x=>x*x*(3-2*x);
/**
 * Zoom curve measured frame by frame on a screen-recording reference (OpenAI
 * 'ChatGPT for Word', 0:03.3): 1x -> 3.46x in ~1.1 s, gentle start and soft
 * landing, cubic-bezier(0.1, 0, 0.6, 1) on the zoom value.
 */
export const GLIDE=Object.freeze([0.1,0,0.6,1]);
export function cubicBezier([x1,y1,x2,y2],x){
 if(x<=0)return 0;if(x>=1)return 1;
 let lo=0,hi=1;
 for(let i=0;i<48;i++){const t=(lo+hi)/2,bx=3*(1-t)**2*t*x1+3*(1-t)*t*t*x2+t**3;if(bx<x)lo=t;else hi=t;}
 const t=(lo+hi)/2;return 3*(1-t)**2*t*y1+3*(1-t)*t*t*y2+t**3;
}
const EASES={smooth,linear:x=>x,glide:x=>cubicBezier(GLIDE,x)};
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
  const a=keys[i-1],b=keys[i],ease=EASES[b.ease??'smooth'];
  if(!ease)throw Error('Unknown camera ease: '+b.ease);
  const t=ease(clamp((time-a.time)/(b.time-a.time),0,1));
  if(b.ease!=='glide')return {time,...Object.fromEntries(['zoom','x','y'].map(k=>[k,a[k]+(b[k]-a[k])*t]))};
  // Glide keeps the zoom's fixed point still: centre*zoom is linear, so nothing slides sideways.
  const zoom=a.zoom+(b.zoom-a.zoom)*t;
  return {time,zoom,...Object.fromEntries(['x','y'].map(k=>[k,(a[k]*a.zoom+(b[k]*b.zoom-a[k]*a.zoom)*t)/zoom]))};
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
 const keys=track.keys;if(keys.some(k=>(k.ease??'smooth')!=='smooth'))throw Error('FFmpeg camera supports smooth keys only');let expression=String(n(keys.at(-1)[axis]));
 for(let i=keys.length-1;i>0;i--){
  const a=keys[i-1],b=keys[i];if(b.time<=a.time)throw Error('Unordered keys');
  const p=`max(0,min(1,(${clock}-${n(a.time)})/${n(b.time-a.time)}))`;
  const curve=a[axis]===b[axis]?`${n(a[axis])}`:`${n(a[axis])}+(${n(b[axis]-a[axis])})*(${p})*(${p})*(3-2*(${p}))`;
  expression=`if(lt(${clock},${n(b.time)}),${curve},${expression})`;
 }
 return expression;
}
