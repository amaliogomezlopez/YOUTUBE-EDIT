import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
export default {
  id:'shorts-editing-budget',
  run(context) {
    const budget=context.budget;
    if (!budget) return notEvaluable('El montaje no declara perfil de ritmo.');
    const issues=[];
    const fps=context.format?.fps ?? 60;
    const scenes=context.scenes ?? [];
    for (const scene of scenes) {
      if (scene.durationInFrames/fps > budget.maxSceneSeconds + .5) issues.push({sceneId:scene.id,message:'Plano sin cambio visible mas largo que el perfil; revisar si la lectura lo necesita.'});
      const cuts=scenes.filter(s=>s.from>=scene.from && s.from<scene.from+10*fps);
      if (cuts.length>budget.maxCutsPerTenSeconds) issues.push({sceneId:scene.id,message:'Demasiados cortes en diez segundos para el perfil.'});
    }
    const sounds=context.soundCues ?? [];
    if (sounds.length > Math.ceil((context.durationSeconds ?? 0)/60*budget.maxEffectsPerMinute)) issues.push({message:'Densidad sonora superior al perfil de estilo.'});
    return issues;
  }
};
