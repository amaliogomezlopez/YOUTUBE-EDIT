const cubic=(a,b,c,d,t)=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;};
export function sampleCurve(keys,time,fallback) {
 if(!keys?.length)return fallback;
 if(time<=keys[0].time)return keys[0].value;
 for(let i=1;i<keys.length;i++)if(time<=keys[i].time){
  const a=keys[i-1],b=keys[i],t=(time-a.time)/(b.time-a.time);
  if(a.easing==='bezier'||b.easing==='bezier'){
   const x1=a.time+(a.outControl?.time??0),x2=b.time+(b.inControl?.time??0);
   let lo=0,hi=1;for(let n=0;n<40;n++){const mid=(lo+hi)/2;if(cubic(a.time,x1,x2,b.time,mid)<time)lo=mid;else hi=mid;}
   return cubic(a.value,a.value+(a.outControl?.value??0),b.value+(b.inControl?.value??0),b.value,(lo+hi)/2);
  }
  return a.value+(b.value-a.value)*(b.easing==='smooth'?t*t*(3-2*t):t);
 }
 return keys.at(-1).value;
}