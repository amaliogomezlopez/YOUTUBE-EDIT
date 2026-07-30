export default {
  id: 'part-whole-camera-sequence',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (scene.cameraSequence && scene.cameraSequence.join('>') !== 'part>overview>whole') {
        issues.push({sceneId: scene.id, message: 'La cámara debe recorrer part>overview>whole.'});
      }
    }
    return issues;
  }
};
