import {compileCameraTrack, cameraCrop} from '../video-studio/camera-track.js';
import {validSourceBox} from '../video-studio/framing.js';

function fields(value, allowed, where) {
  if (!value || typeof value!=='object' || Array.isArray(value)
    || Object.keys(value).some(k=>!allowed.includes(k))) fail('Campos no soportados en '+where);
}

export const YOUTUBE_FORMAT = Object.freeze({width: 1920, height: 1080, fps: 30});
const fail = (message) => {throw new Error(message);};
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x+a.w <= b.x+b.w+.01 && a.y+a.h <= b.y+b.h+.01;

/** Compile word-anchored editorial decisions for the horizontal renderer. */
export function compileYoutubePlan({plan, clips, budget}) {
  fields(plan,['version','profile','scenes'],'plan');
  if (typeof plan.profile!=='string' || !plan.profile.trim()) fail('Falta perfil');
  if (plan?.version !== 1 || !Array.isArray(plan.scenes) || !plan.scenes.length) fail('Plan v1 con escenas requerido');
  if (!budget || !['silencePaddingSeconds','minHoldSeconds','maxCuesPerMinute','maxZoom','transitionSeconds']
    .every(k => Number.isFinite(budget[k]) && budget[k] >= 0) || budget.maxZoom < 1
    || budget.transitionSeconds <= 0 || budget.maxCuesPerMinute <= 0) fail('Perfil invalido');
  if (!Array.isArray(clips) || new Set(clips.map(c=>c.id)).size !== clips.length) fail('Clips invalidos o duplicados');
  const sources = new Map(clips.map(c=>[c.id,c]));
  const ids = new Set(), warnings = [], scenes = [];
  let cursor = 0;
  for (const scene of plan.scenes) {
    fields(scene,['id','clipId','selection','regions','cues'],'escena');
    fields(scene.selection,['fromWord','toWord'],'seleccion');
    if (typeof scene.id !== 'string' || !scene.id || ids.has(scene.id)) fail('ID de escena invalido o duplicado');
    ids.add(scene.id);
    const clip = sources.get(scene.clipId);
    if (!clip || !Number.isFinite(clip.durationSeconds) || clip.durationSeconds <= 0
      || !Number.isInteger(clip.width) || !Number.isInteger(clip.height) || clip.width <= 0 || clip.height <= 0
      || Math.abs(clip.width/clip.height-16/9) > .01) fail('El piloto requiere clips compuestos 16:9');
    const words = clip.words;
    if (!Array.isArray(words) || !words.length || words.some((w,i)=> !String(w.text??'').trim()
      || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start<0 || w.end<=w.start
      || w.end>clip.durationSeconds+.03 || (i>0 && (w.start<words[i-1].start || w.end<words[i-1].end)))) fail('Palabras invalidas');
    const {fromWord, toWord} = scene.selection ?? {};
    if (!Number.isInteger(fromWord) || !Number.isInteger(toWord) || fromWord<0 || toWord<fromWord
      || !words[toWord]) fail('Seleccion de palabras invalida');
    // Do not recover excluded words through the padding.
    const sourceIn = Math.max(0, words[fromWord].start-budget.silencePaddingSeconds,
      fromWord ? words[fromWord-1].end : 0);
    const sourceOut = Math.min(clip.durationSeconds, words[toWord].end+budget.silencePaddingSeconds,
      words[toWord+1]?.start ?? clip.durationSeconds);
    const duration = sourceOut-sourceIn;
    if (duration<=0 || sourceIn>words[fromWord].start || sourceOut<words[toWord].end) fail('Seleccion corta palabras solapadas');
    const full = {x:0,y:0,w:clip.width,h:clip.height};
    if (!Array.isArray(scene.cues)) fail('cues debe ser un array (vacio permite plano quieto)');
    let lastTime = -Infinity;
    const cues = scene.cues.map(cue => {
      fields(cue,['atWord','subject','intent','reason','sound','soundNote','targetId','zoom'],'cue');
      if (cue.subject==='context' && (cue.zoom!==undefined || cue.targetId!==undefined)) fail('Contexto no admite zoom ni targetId');
      if (!Number.isInteger(cue.atWord) || cue.atWord<fromWord || cue.atWord>toWord) fail('Cue fuera de seleccion');
      if (!['context','webcam','screen'].includes(cue.subject)
        || !['opinion','explanation','context'].includes(cue.intent)
        || typeof cue.reason !== 'string' || !cue.reason.trim()) fail('Cue requiere subject, intent y reason');
      if ((cue.subject==='webcam' && cue.intent!=='opinion') || (cue.subject==='screen' && cue.intent!=='explanation')
        || (cue.subject==='context' && cue.intent!=='context')) fail('Intencion incompatible con destino');
      if (cue.sound !== false && (!cue.sound || typeof cue.sound.family !== 'string' || !cue.sound.family.trim()
        || !Number.isFinite(cue.sound.intensity) || cue.sound.intensity<0 || cue.sound.intensity>1)) fail('Sonido por familia e intensidad 0..1 requerido');
      if (cue.sound===false && (typeof cue.soundNote!=='string' || !cue.soundNote.trim())) fail('Silencio requiere soundNote');
      const time = words[cue.atWord].start-sourceIn;
      if (time-lastTime < budget.transitionSeconds+budget.minHoldSeconds) fail('Movimiento demasiado seguido para el perfil');
      lastTime=time;
      let target={zoom:1,x:.5,y:.5};
      if (cue.subject!=='context') {
        const region=scene.regions?.[cue.targetId];
        if (!region || region.subject!==cue.subject || region.reviewed!==true
          || typeof region.evidence!=='string' || !region.evidence.trim()
          || !validSourceBox(region.box,{width:clip.width,height:clip.height})
          || !inside(region.box,full)
          || !Number.isFinite(region.fromSeconds) || !Number.isFinite(region.toSeconds)
          || region.fromSeconds>sourceIn || region.toSeconds<sourceOut
          || region.fromSeconds<0 || region.toSeconds>clip.durationSeconds+.03
          || !clip.sourceHash || region.sourceHash!==clip.sourceHash) fail('Region sin evidencia valida para toda la escena; dividir si cambia');
        const box=region.box;
        if (!Number.isFinite(cue.zoom) || cue.zoom<1 || cue.zoom>budget.maxZoom) fail('Zoom fuera del perfil');
        target={zoom:cue.zoom,x:(box.x+box.w/2)/clip.width,y:(box.y+box.h/2)/clip.height};
        if (!inside(box,cameraCrop(full,target))) fail('El zoom corta el elemento que debe mostrar');
        if (clip.width/target.zoom<YOUTUBE_FORMAT.width) warnings.push(scene.id+': zoom con ampliacion de pixeles; revisar nitidez');
      }
      return {...cue,target,sound:cue.sound===false?null:cue.sound};
    });
    if (cues.length>Math.max(1,Math.ceil(duration/60*budget.maxCuesPerMinute))) fail('Demasiados movimientos para el perfil');
    const track=compileCameraTrack({words,cues,sourceIn,duration,budget});
    const durationInFrames=Math.max(1,Math.round(duration*YOUTUBE_FORMAT.fps));
    scenes.push({id:scene.id,clipId:clip.id,sourceHash:clip.sourceHash??null,
      sourceIn,sourceOut,fromFrame:cursor,durationInFrames,track,
      selection:scene.selection,spokenText:words.slice(fromWord,toWord+1).map(w=>w.text).join(' ')});
    cursor+=durationInFrames;
  }
  return {version:1,surface:'youtube',format:YOUTUBE_FORMAT,profile:plan.profile,budget,
    durationInFrames:cursor,scenes,warnings:[...new Set(warnings)],
    review:{visual:'pending',audio:'pending',editorial:'pending'},
    capabilities:{compile:true,render:true,recordly:false,assetOverlays:false},
    note:'Plan horizontal renderizable mediante youtube:render; resolver sonidos de cues antes de exportar. No acredita calidad editorial.'};
}
