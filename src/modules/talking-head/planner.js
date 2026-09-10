import {readFileSync} from 'node:fs';
import {chooseReelSound} from './sound-usage.js';
import {selectionRanges} from './selection.js';
export const profiles = JSON.parse(readFileSync(new URL('./profiles.json', import.meta.url)));

/** Editorial selection is explicit; silence edits reuse the shared timeline. */
export function planTalkingHead({manifest, transcripts, selections, silences = {}, profile = 'editorial', captionWords, soundSelection}) {
  const budget = profiles[profile];
  if (!budget) throw new Error('Perfil talking-head desconocido');
  const count = captionWords ?? budget.captionWords;
  if (![1, 2, 3].includes(count)) throw new Error('captionWords debe ser 1, 2 o 3');
  let visualNumber = 0;
  const soundFamilies = soundSelection?.families ?? ['whoosh','ui','shutter','tick'];
  if (!selections?.length) throw new Error('Falta seleccion editorial por palabras');
  const scenes = [];
  for (const [index, selection] of selections.entries()) {
    const clip = manifest.clips.find(c => c.id === selection.clipId);
    const words = transcripts[selection.clipId]?.words;
    const {fromWord, toWord} = selection;
    if (!clip || !words?.length || !Number.isInteger(fromWord) || !Number.isInteger(toWord) || fromWord < 0 || toWord < fromWord || toWord >= words.length) throw new Error('Seleccion de palabras invalida');
    if (!selection.reason?.trim()) throw new Error('Cada seleccion necesita reason');
    const visuals = selection.visuals ?? [];
    if (!visuals.length || visuals[0].atWord !== fromWord) throw new Error('El primer recurso debe anclarse a fromWord');
    for (const [v, visual] of visuals.entries()) {
      if (!Number.isInteger(visual.atWord) || visual.atWord < fromWord || visual.atWord > toWord || (v && visual.atWord <= visuals[v-1].atWord)) throw new Error('Anclas visuales desordenadas o fuera de seleccion');
      const asset = manifest.assets.find(a => a.id === visual.assetId);
      if (!asset) throw new Error('Asset desconocido: ' + visual.assetId);
      if (!visual.reason?.trim()) throw new Error('Falta motivo editorial del recurso');
      if (!asset.provenance?.source || !asset.provenance?.license) throw new Error('Falta procedencia/licencia del asset: ' + asset.id);
    }
    const {ranges} = selectionRanges(selection, manifest, transcripts, silences, budget);
    const retainedBefore = (t) => ranges.reduce((sum, r) => sum + Math.max(0, Math.min(t, r.end)-r.start), 0);
    for (const range of ranges) {
      const inside = words.map((word, i) => ({...word, i})).filter(w => w.i >= fromWord && w.i <= toWord && w.end > range.start && w.start < range.end);
      const first = inside[0];
      const current = [...visuals].reverse().find(v => v.atWord <= first.i);
      const active = [{...current, atWord:first.i}, ...visuals.filter(v => v.atWord > first.i && words[v.atWord].start < range.end)];
      const cues = active.map((v, i) => {
        const start = Math.max(range.start, words[v.atWord].start);
        const end = i+1 < active.length ? words[active[i+1].atWord].start : range.end;
        const continuing = v.atWord !== current.atWord && i === 0;
        const silent = continuing || v.sound === false;
        const semantic = silent ? null : chooseReelSound(soundSelection,{use:v.soundUse,first:index===0 && range===ranges[0] && i===0,note:v.soundNote});
        return {type:'broll',assetId:v.assetId,slot:'broll-panel',atWord:v.atWord,holdSeconds:end-start,
          presentation:'plain',dense:false,mediaFit:v.fit ?? budget.mediaFit,mediaZoom:v.zoom ?? budget.maxZoom,
          mediaTrimSeconds:(v.trimSeconds ?? 0) + (continuing ? Math.max(0, retainedBefore(start)-retainedBefore(words[current.atWord].start)) : 0),
          mediaTransition:i===0?'cut':v.transition ?? budget.mediaTransition,
          soundUse:semantic?.use,sound: silent ? false : semantic?.family ?? v.sound ?? soundFamilies[visualNumber++ % soundFamilies.length],soundNote:continuing?'Continuidad del recurso tras retirar silencio.':v.soundNote,
          soundIntensity:0.45,note:v.reason};
      });
      scenes.push({id:`take-${index+1}-${scenes.length+1}`,clipId:clip.id,layout:'talking-head',trim:range,
        ...(selection.focus?{focus:selection.focus}:{}),camera:'static',cameraSound:false,transitionIn:'cut',transitionSound:false,reason:selection.reason,cues});
    }
  }
  return {workflow:'talking-head',profile,budget:{...budget},themeId:'oxide-documentary',silencePaddingSeconds:budget.silencePaddingSeconds,
    captions:{mode:'karaoke',maxWords:count,maxPageSeconds:1.5,strictMaxWords:true},
    captionStyle:{renderer:'styled',mode:'karaoke',font:'Schibsted Grotesk',primary:'#FFFFFF',activeColor:budget.activeColor,outlineSize:5,baseFontSize:82,uppercase:true,emphasis:'color'},
    sound:{enabled:true,mix:budget.soundMix,clipVolume:1,palette:soundSelection?.palette,metadata:soundSelection?.metadata,uses:soundSelection?.uses,selectionStatus:soundSelection?.status ?? 'provisional'},scenes};
}
