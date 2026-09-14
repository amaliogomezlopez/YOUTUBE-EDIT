import {validSourceBox} from '../../../video-studio/framing.js';

export default {
  id: 'shorts-screen-crop-excludes-webcam',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const region = scene.screenRegion;
      if (scene.layout !== 'pip' || region?.webcamPolicy !== 'exclude') continue;
      const box = scene.webcamBox?.sourceBox ?? scene.webcamBox;
      const source = {width: scene.sourceWidth, height: scene.sourceHeight};
      const valid = validSourceBox(region, source) && validSourceBox(box, source);
      const overlaps = valid && region.x < box.x + box.w && region.x + region.w > box.x &&
        region.y < box.y + box.h && region.y + region.h > box.y;
      if (!valid || overlaps || scene.pip?.mask?.visible) {
        issues.push({sceneId: scene.id, message: 'El recorte limpio debe excluir la webcam original y su mascara; revisar la region en la fuente.'});
      }
    }
    return issues;
  }
};
