import {Video} from '@remotion/media';
import {staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ShortScene} from './schemas';
// The pure evaluator is also used by FFmpeg; no second easing implementation.
// @ts-expect-error shared JavaScript module
import {cameraAt,cameraCrop} from '../../../src/modules/video-studio/camera-track.js';
export const ScreenCameraStage:React.FC<{scene:ShortScene}>=({scene})=>{
 const frame=useCurrentFrame(),{fps}=useVideoConfig(),c=scene.screenCamera;
 if(!c)return null;
 const crop=cameraCrop(c.screen,cameraAt(c.track,frame/fps));
 const view=(box:{x:number;y:number;w:number;h:number},slot:{x:number;y:number;w:number;h:number},key:string)=>{
  const scale=Math.max(slot.w/box.w,slot.h/box.h);
  return <div key={key} style={{position:'absolute',left:slot.x,top:slot.y,width:slot.w,height:slot.h,overflow:'hidden',outline:'3px solid #344252'}}><Video muted src={staticFile(scene.src)} trimBefore={Math.round(scene.trimStartSeconds*fps)} style={{position:'absolute',width:scene.sourceWidth!*scale,height:scene.sourceHeight!*scale,left:-box.x*scale+(slot.w-box.w*scale)/2,top:-box.y*scale+(slot.h-box.h*scale)/2}}/></div>;
 };
 return <div style={{position:'absolute',inset:0,background:'#0b1420'}}>{view(crop,c.layout.screen,'screen')}{view(c.webcam,c.layout.face,'face')}</div>;
};
