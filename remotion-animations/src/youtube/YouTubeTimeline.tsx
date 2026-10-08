import {Video, Audio} from '@remotion/media';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, CalculateMetadataFunction} from 'remotion';
import {Gif} from '@remotion/gif';
import {z} from 'zod';
// @ts-expect-error Shared pure evaluator with the Node planner.
import {sampleCurve} from '../../../src/modules/video-studio/timeline-curves.js';
// @ts-expect-error Shared camera evaluator used by all editing surfaces.
import {cameraAt, cameraCrop, cubicBezier, GLIDE} from '../../../src/modules/video-studio/camera-track.js';

const scalar=z.number().finite();
const key=z.object({time:scalar,value:scalar,easing:z.enum(['linear','smooth','bezier']),inControl:z.object({time:scalar,value:scalar}).optional(),outControl:z.object({time:scalar,value:scalar}).optional()});
const transform=z.object({x:scalar,y:scalar,scaleX:scalar.positive(),scaleY:scalar.positive(),rotation:scalar,opacity:scalar.min(0).max(1)});
const cameraKey=z.object({time:scalar,zoom:scalar.min(1),x:scalar,y:scalar,ease:z.enum(['smooth','linear','glide']).optional()});
const box=z.object({x:scalar,y:scalar,w:scalar.positive(),h:scalar.positive()});
const layerSchema=z.object({id:z.string(),type:z.enum(['video','image','gif','audio','text']),src:z.string().refine(s=>s===''||(s.startsWith('projects/youtube/')&&!s.includes('..'))),
  from:z.number().int().nonnegative(),duration:z.number().int().positive(),sourceIn:scalar.nonnegative(),volume:scalar.nonnegative(),
  width:scalar.positive(),height:scalar.positive(),transform,curves:z.object({x:z.array(key).optional(),y:z.array(key).optional(),scaleX:z.array(key).optional(),scaleY:z.array(key).optional(),rotation:z.array(key).optional(),opacity:z.array(key).optional()}),
  mask:z.object({left:scalar,right:scalar,top:scalar,bottom:scalar,round:scalar,feather:scalar}).optional(),text:z.object({value:z.string(),fontSize:scalar.positive(),color:z.string()}).optional(),
  camera:z.object({keys:z.array(cameraKey).min(1)}).optional(),
  // Canvas-pixel placement: the (cropped) media fitted in rect, with a rounded frame and solid patches in source pixels.
  rect:box.optional(),fit:z.enum(['cover','contain']).optional(),crop:box.optional(),stage:z.boolean().optional(),
  frame:z.object({radius:scalar.nonnegative(),shadow:scalar.nonnegative(),border:scalar.nonnegative().optional(),borderColor:z.string().optional(),background:z.string().optional()}).optional(),
  patches:z.array(box.extend({color:z.string()})).optional(),
  // Entrance with the glide curve: from another rect (face full screen -> bubble) and/or fading in.
  enter:z.object({seconds:scalar.positive(),from:box.optional(),fade:z.boolean().optional()}).optional(),
  // Outside the stage (the webcam bubble): shrink towards origin while the stage is zoomed in.
  stageShrink:z.object({scale:scalar.positive().max(1),originX:scalar.min(0).max(1),originY:scalar.min(0).max(1),fullAtZoom:scalar.min(1)}).optional()});
export const youtubeTimelineSchema=z.object({version:z.literal(1),format:z.object({width:z.literal(1920),height:z.literal(1080),fps:z.literal(30)}),durationInFrames:z.number().int().positive(),layers:z.array(layerSchema),soundEnabled:z.boolean(),soundMix:scalar.min(0).max(1),
  // Stage camera on the edit clock: moves every stage layer together (wallpaper and cards), never the bubble.
  stage:z.object({camera:z.object({keys:z.array(cameraKey).min(1)})}).optional()});
type Props=z.infer<typeof youtubeTimelineSchema>;
type Layer=z.infer<typeof layerSchema>;
export const youtubeDefault:Props={version:1,format:{width:1920,height:1080,fps:30},durationInFrames:30,layers:[],soundEnabled:true,soundMix:1};
export const youtubeMetadata:CalculateMetadataFunction<Props>=({props})=>{
 const validated=youtubeTimelineSchema.parse(props);
 return {...validated.format,durationInFrames:validated.durationInFrames};
};
type Camera={keys:{time:number;zoom:number;x:number;y:number;ease?:'smooth'|'linear'|'glide'}[]};
const RectLayer:React.FC<{layer:Layer;rect:NonNullable<Layer['rect']>;camera?:Camera}>=({layer:l,rect:target,camera})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig();
 const p=l.enter?cubicBezier(GLIDE,Math.min(1,frame/(l.enter.seconds*fps))):1;
 const from=l.enter?.from;
 const rect=from&&p<1?{x:from.x+(target.x-from.x)*p,y:from.y+(target.y-from.y)*p,w:from.w+(target.w-from.w)*p,h:from.h+(target.h-from.h)*p}:target;
 const opacity=l.enter?.fade?p:1;
 const k=l.stageShrink&&camera?Math.min(1,Math.max(0,(cameraAt(camera,(frame+l.from)/fps).zoom-1)/(l.stageShrink.fullAtZoom-1))):0;
 const shrink=l.stageShrink?1-(1-l.stageShrink.scale)*k*k*(3-2*k):1;
 const crop=l.crop??{x:0,y:0,w:l.width,h:l.height};
 const s=(l.fit==='contain'?Math.min:Math.max)(rect.w/crop.w,rect.h/crop.h);
 const left=(rect.w-crop.w*s)/2-crop.x*s,top=(rect.h-crop.h*s)/2-crop.y*s;
 const f=l.frame;
 const shadows=[f?.border?`0 0 0 ${f.border}px ${f.borderColor??'#fff'}`:'',f?.shadow?`0 ${f.shadow*0.35}px ${f.shadow}px rgba(0,0,0,0.42)`:''].filter(Boolean).join(', ');
 const media:React.CSSProperties={position:'absolute',left,top,width:l.width*s,height:l.height*s,maxWidth:'none'};
 return <div style={{position:'absolute',left:rect.x,top:rect.y,width:rect.w,height:rect.h,overflow:'hidden',borderRadius:f?.radius??0,boxShadow:shadows||undefined,background:f?.background,opacity,
  ...(shrink<1?{transform:`scale(${shrink})`,transformOrigin:`${(l.stageShrink!.originX*100)}% ${(l.stageShrink!.originY*100)}%`}:{})}}>
  {l.type==='image'?<Img src={staticFile(l.src)} style={media}/>:<Video src={staticFile(l.src)} trimBefore={Math.round(l.sourceIn*fps)} volume={()=>l.volume} style={media}/>}
  {(l.patches??[]).map((p,i)=><div key={i} style={{position:'absolute',left:left+p.x*s,top:top+p.y*s,width:p.w*s,height:p.h*s,background:p.color}}/>)}
 </div>;
};
const MediaLayer:React.FC<{layer:Layer;soundEnabled:boolean;soundMix:number;camera?:Camera}>=({layer:l,soundEnabled,soundMix,camera})=>{
 const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();
 const trimBefore=Math.round(l.sourceIn*fps);
 if(l.type==='audio')return soundEnabled?<Audio src={staticFile(l.src)} trimBefore={trimBefore} volume={()=>l.volume*soundMix}/>:null;
 if(l.rect&&(l.type==='video'||l.type==='image'))return <RectLayer layer={l} rect={l.rect} camera={camera}/>;
 const t=Object.fromEntries(Object.entries(l.transform).map(([k,v])=>[k,sampleCurve(l.curves[k as keyof typeof l.curves],frame/fps,v)])) as Layer['transform'];
  if(l.type==='text'&&l.text)return <div style={{position:'absolute',left:(t.x+1)*width/2,top:(1-t.y)*height/2,transform:`translate(-50%,-50%) scale(${t.scaleX}, ${t.scaleY})`,fontFamily:'Arial, sans-serif',fontSize:l.text.fontSize,fontWeight:700,color:l.text.color,whiteSpace:'nowrap',textShadow:'0 6px 8px black',lineHeight:1}}>{l.text.value}</div>;
 const fit=Math.min(width/l.width,height/l.height);
 let style:React.CSSProperties={position:'absolute',width:l.width*fit,height:l.height*fit,left:(width-l.width*fit)/2,top:(height-l.height*fit)/2,
   transform:`translate(${t.x*width/2}px, ${-t.y*height/2}px) rotate(${-t.rotation}deg) scale(${t.scaleX}, ${t.scaleY})`,transformOrigin:'center',opacity:t.opacity,clipPath:l.mask?`inset(${l.mask.top*100}% ${l.mask.right*100}% ${l.mask.bottom*100}% ${l.mask.left*100}% round ${l.mask.round*20}px)`:undefined};
 if(l.camera){
   const crop=cameraCrop({x:0,y:0,w:l.width,h:l.height},cameraAt(l.camera,frame/fps));
   const scale=width/crop.w;
   style={position:'absolute',width:l.width*scale,height:l.height*scale,left:-crop.x*scale,top:-crop.y*scale};
 }
 if(l.type==='gif')return <div style={style}><Gif src={staticFile(l.src)} width={Number(style.width)} height={Number(style.height)} fit='fill' loopBehavior='loop'/></div>;
 return l.type==='image'?<Img src={staticFile(l.src)} style={style}/>:<Video src={staticFile(l.src)} trimBefore={trimBefore} volume={()=>l.volume} style={style}/>;
};
const layerNode=(l:Layer,props:Props)=><Sequence key={l.id} from={l.from} durationInFrames={l.duration} name={l.id}><MediaLayer layer={l} soundEnabled={props.soundEnabled} soundMix={props.soundMix} camera={props.stage?.camera}/></Sequence>;
const Stage:React.FC<{props:Props;camera:NonNullable<Props['stage']>['camera']}>=({props,camera})=>{
 const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();
 const crop=cameraCrop({x:0,y:0,w:width,h:height},cameraAt(camera,frame/fps));
 return <AbsoluteFill style={{transformOrigin:'0 0',transform:`scale(${width/crop.w}) translate(${-crop.x}px, ${-crop.y}px)`}}>{props.layers.filter(l=>l.stage).map(l=>layerNode(l,props))}</AbsoluteFill>;
};
export const YouTubeTimeline:React.FC<Props>=(props)=><AbsoluteFill style={{background:'#000',overflow:'hidden'}}>
 {props.stage?<Stage props={props} camera={props.stage.camera}/>:null}
 {props.layers.filter(l=>!props.stage||!l.stage).map(l=>layerNode(l,props))}
</AbsoluteFill>;
