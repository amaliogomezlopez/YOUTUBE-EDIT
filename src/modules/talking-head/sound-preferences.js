import {readFileSync} from 'node:fs';
export const candidates=JSON.parse(readFileSync(new URL('./sound-candidates.json',import.meta.url)));
export function validateSoundRatings(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('Valoraciones invalidas');
  for (const [id,score] of Object.entries(input)) if (!candidates.some(c=>c.id===id) || !Number.isInteger(score) || score<0 || score>5) throw new Error('Valoracion o sonido desconocido');
  return {...input};
}
export function selectTalkingHeadSounds(preferences) {
  const ratings=validateSoundRatings(preferences?.ratings ?? {});
  const ranked=candidates.filter(c=>(ratings[c.id] ?? 0)>0).sort((a,b)=>ratings[b.id]-ratings[a.id]);
  const selected=ranked.length ? ranked : candidates.filter(c=>c.provisional);
  const palette={};
  for (const c of selected) (palette[c.family] ??= []).push(c.file);
  return {status:ranked.length?'user-ranked':'provisional',families:Object.keys(palette),palette};
}
