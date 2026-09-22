import {Video, Audio} from '@remotion/media';
import {AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig, CalculateMetadataFunction} from 'remotion';
import {Gif} from '@remotion/gif';
import {z} from 'zod';
// @ts-expect-error Shared pure evaluator with the Node planner.
import {sampleCurve} from '../../../src/modules/video-studio/timeline-curves.js';
// @ts-expect-error Shared camera evaluator used by all editing surfaces.
import {cameraAt, cameraCrop} from '../../../src/modules/video-studio/camera-track.js';

const scalar=z.number().finite();
const key=z.object({time:scalar,value:scalar,easing:z.enum(['linear','smooth','bezier']),inControl:z.object({time:scalar,value:scalar}).optional(),outControl:z.object({time:scalar,value:scalar}).optional()});
const transform=z.object({x:scalar,y:scalar,scaleX:scalar.positive(),scaleY:scalar.positive(),rotation:scalar,opacity:scalar.min(0).max(1)});
const cameraKey=z.object({time:scalar,zoom:scalar.min(1),x:scalar,y:scalar});
const layerSchema=z.object({id:z.string(),type:z.enum(['video','image','gif','audio','text']),src:z.string().refine(s=>s===''||(s.startsWith('projects/youtube/')&&!s.includes('..'))),
  from:z.number().int().nonnegative(),duration:z.number().int().positive(),sourceIn:scalar.nonnegative(),volume:scalar.nonnegative(),
  width:scalar.positive(),height:scalar.positive(),transform,curves:z.object({x:z.array(key).optional(),y:z.array(key).optional(),scaleX:z.array(key).optional(),scaleY:z.array(key).optional(),rotation:z.array(key).optional(),opacity:z.array(key).optional()}),
  mask:z.object({left:scalar,right:scalar,top:scalar,bottom:scalar,round:scalar,feather:scalar}).optional(),text:z.object({value:z.string(),fontSize:scalar.positive(),color:z.string()}).optional(),
  camera:z.object({keys:z.array(cameraKey).min(1)}).optional()});
export const youtubeTimelineSchema=z.object({version:z.literal(1),format:z.object({width:z.literal(1920),height:z.literal(1080),fps:z.literal(30)}),durationInFrames:z.number().int().positive(),layers:z.array(layerSchema),soundEnabled:z.boolean(),soundMix:scalar.min(0).max(1)});
type Props=z.infer<typeof youtubeTimelineSchema>;
type Layer=z.infer<typeof layerSchema>;
export const youtubeDefault:Props={version:1,format:{width:1920,height:1080,fps:30},durationInFrames:30,layers:[],soundEnabled:true,soundMix:1};
export const youtubeMetadata:CalculateMetadataFunction<Props>=({props})=>{
 const validated=youtubeTimelineSchema.parse(props);
 return {...validated.format,durationInFrames:validated.durationInFrames};
};
const MediaLayer:React.FC<{layer:Layer;soundEnabled:boolean;soundMix:number}>=({layer:l,soundEnabled,soundMix})=>{
 const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();
 const trimBefore=Math.round(l.sourceIn*fps);
 if(l.type==='audio')return soundEnabled?<Audio src={staticFile(l.src)} trimBefore={trimBefore} volume={()=>l.volume*soundMix}/>:null;
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
export const YouTubeTimeline:React.FC<Props>=(props)=><AbsoluteFill style={{background:'#000',overflow:'hidden'}}>{props.layers.map(l=><Sequence key={l.id} from={l.from} durationInFrames={l.duration} name={l.id}><MediaLayer layer={l} soundEnabled={props.soundEnabled} soundMix={props.soundMix}/></Sequence>)}</AbsoluteFill>;