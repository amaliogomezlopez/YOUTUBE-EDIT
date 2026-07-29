/**
 * Validador generado por `npm run channel:feedback`.
 *
 * Regla: Un adaptador de patrón no puede simplificar la evidencia narrativa de una escena: si la locución y el plan exigen dos series debe renderizar ambas y su relación; si nombra entidades con logos disponibles debe usar esos assets y conservar los cues de foco.
 *
 * Rellena `run` con la comprobación real. Mientras devuelva la incidencia
 * TODO, el fixture de regresión falla y la regla no se puede dar por cerrada.
 */
export default {
  id: "pattern-evidence-preserved",
  run(context, rule) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const componentKey = scene.componentKey ?? scene.kind;
      const rendersByPattern =
        scene.renderMode === "pattern" ||
        context.registry?.rendersByPattern?.(componentKey, scene.patternId);
      if (!rendersByPattern) continue;

      if ((scene.secondaryChartData?.length ?? 0) >= 2) {
        issues.push({
          sceneId: scene.id,
          message:
            `«${componentKey}» contiene una segunda serie, pero se resolvería ` +
            `por el patrón ${scene.patternId ?? "(sin patrón)"} sin contrato ` +
            "explícito para conservarla y mostrar su relación."
        });
      }

      const logoCount = (scene.assets ?? []).filter(
        (asset) => asset.kind === "logo"
      ).length;
      const entityFocus =
        (scene.focusTargets ?? []).some((target) => /logo|compan|entit/i.test(target)) ||
        (scene.cues ?? scene.semanticCues ?? []).some(
          (cue) => cue.kind === "entity" || /logo|compan|entit/i.test(cue.target ?? "")
        );
      if (
        logoCount >= 3 &&
        entityFocus &&
        scene.patternId !== "asset.logo-ecosystem"
      ) {
        issues.push({
          sceneId: scene.id,
          message:
            `«${componentKey}» dispone de ${logoCount} logos y foco de entidad, ` +
            `pero el patrón ${scene.patternId ?? "(sin patrón)"} no garantiza ` +
            "que los assets sustituyan a las tarjetas de texto."
        });
      }
    }
    void rule;
    return issues;
  }
};
