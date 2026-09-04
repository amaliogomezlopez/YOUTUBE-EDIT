import {validSourceBox} from './framing.js';

/** Bordes del panel alrededor de la cara, separados del recorte facial. */
export function webcamPanel(frame, face, media) {
  const sx=frame.width/media.width, sy=frame.height/media.height;
  const f={x:face.x*sx,y:face.y*sy,w:face.w*sx,h:face.h*sy};
  const pixel=(x,y)=>{const i=(Math.max(0,Math.min(frame.height-1,Math.round(y)))*frame.width+Math.max(0,Math.min(frame.width-1,Math.round(x))))*3; return (frame.data[i]+frame.data[i+1]+frame.data[i+2])/3;};
  const edge=(axis,lo,hi,spanStart,spanEnd)=>{
    let best=null;
    for(let p=Math.max(2,Math.round(lo));p<=Math.min(axis==='x'?frame.width-3:frame.height-3,Math.round(hi));p++){
      let sum=0,n=0;
      for(let q=spanStart;q<spanEnd;q+=2) {
        sum+=axis==='x'?Math.abs(pixel(p-2,q)-pixel(p+2,q)):Math.abs(pixel(q,p-2)-pixel(q,p+2)); n++;
      }
      const score=sum/Math.max(1,n);
      if(!best || score>best.score) best={p,score};
    }
    return best;
  };
  const left=edge('x',f.x-f.w*1.2,f.x-f.w*.12,f.y,f.y+f.h);
  const right=edge('x',f.x+f.w*1.12,f.x+f.w*2.2,f.y,f.y+f.h);
  const top=edge('y',f.y-f.h,f.y-f.h*.12,f.x,f.x+f.w);
  const bottom=edge('y',f.y+f.h*1.12,f.y+f.h*2.2,f.x,f.x+f.w);
  if([left,right,top,bottom].some(e=>!e || e.score<12)) return null;
  const box={x:Math.max(0,left.p/sx-8),y:Math.max(0,top.p/sy-8),w:(right.p-left.p)/sx+16,h:(bottom.p-top.p)/sy+16};
  box.w=Math.min(box.w,media.width-box.x);box.h=Math.min(box.h,media.height-box.y);
  return validSourceBox(box,media)?box:null;
}
