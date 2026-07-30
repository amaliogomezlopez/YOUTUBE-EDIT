const CHART_DEIXIS = /\b(observa|mira|f[ií]jate)\b[^.]{0,80}\b(gr[aá]fica|gr[aá]fico)\b/i;
const hasChart = (scene) =>
  (scene.chartData?.length ?? 0) >= 2 ||
  (scene.assets ?? []).some((asset) => asset.kind === "chart");

export default {
  id: "deictic-chart-presence",
  run(context) {
    const scenes = context.scenes ?? [];
    const issues = [];
    scenes.forEach((scene, index) => {
      if (!CHART_DEIXIS.test(scene.narrationText ?? "")) return;
      if (hasChart(scene) || hasChart(scenes[index + 1] ?? {})) return;
      issues.push({
        sceneId: scene.id,
        message:
          "La locución señala una gráfica, pero ni esta escena ni la siguiente " +
          "contienen una serie o asset gráfico visible.",
      });
    });
    return issues;
  },
};
