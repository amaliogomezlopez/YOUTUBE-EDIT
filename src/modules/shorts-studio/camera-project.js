import Ajv from 'ajv';
import {createHash} from 'node:crypto';
import {compileCameraTrack, cameraCrop, cameraAt} from '../video-studio/camera-track.js';
import {validSourceBox} from '../video-studio/framing.js';
import {compactCaptionCompounds} from '../video-studio/captions.js';
import {buildSubtitleDocument} from '../../lib/subtitles.js';

export const CAMERA_PROFILES = Object.freeze({
 'screen-smooth': Object.freeze({maxZoom:1.9,transitionSeconds:1.15,soundIntensity:.25}),
 'screen-dynamic': Object.freeze({maxZoom:1.98,transitionSeconds:.65,soundIntensity:.25})
});
export const CAMERA_LAYOUT = Object.freeze({width:1080,height:1920,fps:60,
 screen:{x:36,y:880,w:1008,h:672},face:{x:180,y:80,w:720,h:702},captionY:1640,safeBottom:1748});
export const CAMERA_PLAN_SCHEMA = {
 type:'object',additionalProperties:false,required:['version','profile','selection','cues'],properties:{
  version:{const:1},profile:{enum:Object.keys(CAMERA_PROFILES)},
  selection:{type:'object',additionalProperties:false,required:['fromWord','toWord'],properties:{fromWord:{type:'integer',minimum:0},toWord:{type:'integer',minimum:0}}},
  captions:{type:'boolean',default:true},sound:{type:'boolean',default:true},
  cues:{type:'array',maxItems:24,items:{type:'object',additionalProperties:false,required:['atWord','targetId','sound'],properties:{atWord:{type:'integer',minimum:0},targetId:{type:'string',pattern:'^[a-z0-9-]+$'},sound:{enum:['camera','none']},soundNote:{type:'string',minLength:8,maxLength:500}}}}
 }
};
const validate = new Ajv({allErrors:true}).compile(CAMERA_PLAN_SCHEMA);
export const contentHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const inside=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w+.01&&a.y+a.h<=b.y+b.h+.01;
function reviewed(region,where,media){
 if(!region||region.reviewed!==true||typeof region.evidence!=='string'||region.evidence.trim().length<8)throw Error(where+': falta revision visual y evidence');
 if(!validSourceBox(region.box,media))throw Error(where+': caja fuera de la fuente');
 if(!['x','y','w','h'].every(k=>Number.isInteger(region.box[k]))||region.box.x+region.box.w>media.width||region.box.y+region.box.h>media.height)throw Error(where+': se requieren pixeles enteros dentro de la fuente');
}
export function compileScreenCamera({plan,manifest,transcript,regions}){
 if(!manifest||!['width','height'].every(k=>Number.isInteger(manifest[k])&&manifest[k]>0)||!Number.isFinite(manifest.duration)||manifest.duration<=0||typeof manifest.sourceHash!=='string'||!manifest.sourceHash)throw Error('Manifest de fuente invalido');
 if(!Array.isArray(transcript)||transcript.some(s=>!s||!Array.isArray(s.words)))throw Error('Transcripcion invalida: se requieren segmentos con palabras');
 if(!validate(plan))throw Error('plan.json: '+JSON.stringify(validate.errors));
 const words=transcript.flatMap(s=>s.words??[]);
 if(!words.length||words.some((w,i)=>!w||!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end>manifest.duration+.03||w.end<=w.start||!String(w.text??'').trim()||(i>0&&(w.start<words[i-1].start||w.end<words[i-1].end))))throw Error('Se requieren palabras ordenadas con tiempos reales');
 const {fromWord,toWord}=plan.selection;
 if(fromWord>toWord||!words[fromWord]||!words[toWord])throw Error('selection: rango de palabras invalido');
 if(!regions||regions.sourceHash!==manifest.sourceHash)throw Error('Las regiones pertenecen a otra fuente');
 reviewed(regions.screen,'screen',manifest);reviewed(regions.webcam,'webcam',manifest);
 const screen=regions.screen.box,webcam=regions.webcam.box;
 if(overlaps(screen,webcam))throw Error('La pantalla contiene la webcam duplicada');
 if(Math.abs(screen.w/screen.h-1.5)>.005)throw Error('screen: este perfil requiere una region 3:2, sin estirar');
 const targets=new Map();
 for(const target of regions.targets??[]){
  if(!/^[a-z0-9-]+$/.test(target.id)||targets.has(target.id)||target.id==='context')throw Error('Target id invalido o duplicado');
  reviewed(target,'target '+target.id,manifest);if(!inside(target.box,screen))throw Error('Target fuera de screen');targets.set(target.id,target.box);
 }
 const sourceIn=words[fromWord].start,sourceOut=words[toWord].end,duration=sourceOut-sourceIn;
 if(duration<=0||duration>120||sourceOut>manifest.duration+.03)throw Error('Recorte invalido: maximo 120 s por pieza');
 const budget=CAMERA_PROFILES[plan.profile];
 const cues=plan.cues.map(cue=>{
  if(cue.atWord<fromWord||cue.atWord>toWord)throw Error('Cue fuera de selection');
  if(cue.sound==='none'&&(!cue.soundNote||cue.soundNote.trim().length<8))throw Error('Cue silencioso sin soundNote');
  let target={zoom:1,x:.5,y:.5};
  if(cue.targetId!=='context'){
   const box=targets.get(cue.targetId);if(!box)throw Error('Target desconocido: '+cue.targetId);
   target={zoom:Math.min(budget.maxZoom,screen.w/box.w,screen.h/box.h),x:(box.x+box.w/2-screen.x)/screen.w,y:(box.y+box.h/2-screen.y)/screen.h};
   if(!inside(box,cameraCrop(screen,target)))throw Error('El encuadre corta el target '+cue.targetId);
  }
  return {...cue,target,sound:cue.sound==='camera'?{family:'camera',intensity:budget.soundIntensity}:null,soundNote:cue.soundNote};
 });
 const track=compileCameraTrack({words,cues,sourceIn,duration,budget});
 // Caption engine already used by Shorts. Preserve source word indices above;
 // compound joining only changes caption display, never camera anchors.
 const captionWords=compactCaptionCompounds(words.slice(fromWord,toWord+1).map((w,i)=>({...w,id:'word-'+(fromWord+i),start:w.start-sourceIn,end:w.end-sourceIn})));
 const caption=buildSubtitleDocument([{id:'camera',start:0,end:duration,text:captionWords.map(w=>w.text).join(' '),words:captionWords}],{mode:'karaoke',preset:'talking-head-green',baseFontSize:68,anchorY:CAMERA_LAYOUT.captionY,maxWords:3,emphasis:'off'});
 if(caption.plan.pages.some(p=>p.lines.some(l=>l.y+l.fontSize*1.3>CAMERA_LAYOUT.safeBottom||l.y<CAMERA_LAYOUT.screen.y+CAMERA_LAYOUT.screen.h+12)))throw Error('Subtitulos fuera de la zona segura');
 for(let frame=0;frame<Math.ceil(duration*60);frame++)if(!inside(cameraCrop(screen,cameraAt(track,frame/60)),screen))throw Error('Camara fuera de pantalla');
 return {version:1,workflow:'shorts-screen-camera',renderer:'ffmpeg',profile:plan.profile,sourceIn,sourceOut,duration,layout:CAMERA_LAYOUT,screen,webcam,track,
 captions:plan.captions!==false?caption:null,soundEnabled:plan.sound!==false,
 fingerprint:contentHash({compilerVersion:1,plan,manifest,transcript,regions,budget,layout:CAMERA_LAYOUT,track,caption:plan.captions!==false?caption:null}),sourceHash:manifest.sourceHash,
 provenance:{regions:'reviewed-source-bound',timing:'word',visualApproval:'pending'}};
}
