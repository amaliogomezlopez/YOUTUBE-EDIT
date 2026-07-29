const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}%]+/gu, " ")
    .trim();

export default {
  id: "screen-text-adds-information",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const narration = normalize(scene.narrationText);
      const visible = scene.onScreenText ?? scene.props?.onScreenText ?? [];
      for (const text of visible) {
        const normalized = normalize(text);
        const wordCount = normalized.split(/\s+/).filter(Boolean).length;
        if (wordCount >= 2 && narration.includes(normalized)) {
          issues.push({
            sceneId: scene.id,
            message:
              `El texto visible «${text}» repite literalmente la locución ` +
              "en vez de añadir evidencia o contexto."
          });
        }
      }
    }
    return issues;
  }
};
