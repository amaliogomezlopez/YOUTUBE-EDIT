const INTERNAL_COPY =
  /\b(regrabar|conseguir (?:la )?(?:serie|fuente|captura|material)|completar (?:la )?(?:fuente|serie)|pendiente de|sustituir asset|todo|fixme)\b/i;

export default {
  id: "no-production-copy-in-frame",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const visible = scene.onScreenText ?? scene.props?.onScreenText ?? [];
      for (const text of visible) {
        if (!INTERNAL_COPY.test(String(text))) continue;
        issues.push({
          sceneId: scene.id,
          message:
            `«${text}» es una instrucción interna de producción y no puede ` +
            "aparecer en un frame publicable."
        });
      }
    }
    return issues;
  }
};
