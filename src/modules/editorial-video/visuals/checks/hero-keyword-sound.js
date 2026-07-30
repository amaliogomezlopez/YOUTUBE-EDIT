export default {
  id: "hero-keyword-sound",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (!scene.heroKeyword) continue;
      const cue = (scene.semanticCues ?? []).find(
        (item) =>
          item.target === "hero-keyword" &&
          ["zoom", "highlight"].includes(item.action) &&
          item.sound,
      );
      if (!cue) {
        issues.push({
          sceneId: scene.id,
          message:
            `La palabra crítica «${scene.heroKeyword}» debe tener cue de zoom o ` +
            "highlight central y sonido sincronizado.",
        });
      }
    }
    return issues;
  },
};
