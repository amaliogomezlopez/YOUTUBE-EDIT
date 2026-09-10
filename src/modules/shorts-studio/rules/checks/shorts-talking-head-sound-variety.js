import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
export default {id:'shorts-talking-head-sound-variety',run(c) {
 if(c.workflow!=='talking-head') return [];
 const limit=c.budget?.maxConsecutiveSoundRepeats;
 if(!Number.isFinite(limit)) return notEvaluable('Falta presupuesto de repeticion sonora.');
 const sounds=c.soundCues ?? [], issues=[], allowed=c.soundPalette?Object.values(c.soundPalette).flat():null;
 let streak=0,last;
 for(const s of sounds){streak=s.file===last?streak+1:1;last=s.file;
  if(streak>limit) issues.push({message:'Sonido repetido de forma consecutiva; revisar seleccion.'});
  if(allowed && !allowed.includes(s.file)) issues.push({message:'Sonido fuera de la seleccion guardada.'});
 }
 return issues;
}};
