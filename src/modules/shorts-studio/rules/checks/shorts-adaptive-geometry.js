import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
export default {
  id:'shorts-adaptive-geometry',
  run(context) {
    const scenes=(context.scenes ?? []).filter(s=>s.captionRect);
    if (!scenes.length) return notEvaluable('Sin geometria adaptativa.');
    const issues=[];
    for(const s of scenes) {
      const r=s.captionRect;
      if (![r.left,r.top,r.width,r.height].every(Number.isFinite) || r.left<0 || r.width<1 || r.top<0 || r.top+r.height>1748 || r.left+r.width>1000) issues.push({sceneId:s.id,message:'Subtitulos fuera de la zona segura de la edicion adaptativa.'});
      const face=s.pip?.camCard;
      if(face && r.top<face.top+face.height && r.top+r.height>face.top && r.left<face.left+face.width && r.left+r.width>face.left) issues.push({sceneId:s.id,message:'El subtitulo tapa la webcam.'});
    }
    return issues;
  }
};
