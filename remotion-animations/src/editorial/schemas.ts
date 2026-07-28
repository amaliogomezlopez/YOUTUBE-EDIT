import {zColor} from "@remotion/zod-types";
import {z} from "zod";

export const factualStatusSchema = z.enum([
  "supported",
  "review",
  "blocked",
]);

export const editorialSceneKindSchema = z.enum([
  "split-lines",
  "market-seed",
  "market-xray",
  "market-health",
  "market-recovery",
  "market-contrast",
  "mag7-relationship",
  "claim-audit",
  "market-ticker",
  "kinetic-text",
  "company-orbit",
  "mag7-weights",
  "concentration-grid",
  "historical-timeline",
  "earnings-flow",
  "sector-bars",
  "earnings-cards",
  "credit-flow",
  "sloos-chart",
  "threshold-lanes",
  "before-after",
  "portfolio-grid",
  "brand-cta",
]);

const metricSchema = z.object({
  value: z.number(),
  suffix: z.string(),
  label: z.string(),
});

const chartDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

const sceneAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "logo", "video"]),
  label: z.string(),
  path: z.string(),
});

const semanticCueSchema = z.object({
  id: z.string(),
  atSeconds: z.number().min(0),
  durationSeconds: z.number().positive().max(12).default(1),
  action: z.enum([
    "reveal",
    "focus",
    "highlight",
    "zoom",
    "shade",
    "scan",
    "connect",
    "verify",
  ]),
  target: z.string(),
  label: z.string().optional(),
  tone: z.enum(["neutral", "gold", "cyan", "positive", "negative"]).default("neutral"),
  persist: z.boolean().default(false),
  sound: z.enum([
    "data-tick",
    "rise-whoosh",
    "soft-impact",
    "success-chime",
    "ui-pulse",
    "quick-whip",
    "smooth-whoosh",
    "digital-count",
    "processing",
    "pop",
    "alert-sting",
  ]).optional(),
});

export const editorialSceneSchema = z.object({
  id: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  kind: editorialSceneKindSchema,
  headline: z.string(),
  supportingText: z.string(),
  narrationText: z.string(),
  factualStatus: factualStatusSchema,
  sourceLabel: z.string().optional(),
  labels: z.array(z.string()).max(20),
  values: z.array(z.number()).max(20),
  valueLabels: z.array(z.string()).max(20),
  metric: metricSchema.optional(),
  chartData: z.array(chartDatumSchema).max(500),
  secondaryChartData: z.array(chartDatumSchema).max(500).default([]),
  focusTarget: z.enum(["both", "primary", "secondary"]).default("both"),
  assets: z.array(sceneAssetSchema).max(20).default([]),
  semanticCues: z.array(semanticCueSchema).max(30).default([]),
});

export const editorialEpisodeSchema = z.object({
  episodeId: z.string(),
  channelName: z.string(),
  title: z.string(),
  durationSeconds: z.number().positive().max(14_400),
  audioPath: z.string(),
  logoPath: z.string(),
  accentColor: zColor(),
  previewMode: z.enum(["editorial", "clean"]),
  narrationVolume: z.number().min(0).max(1.5),
  soundEnabled: z.boolean().default(true),
  soundMix: z.number().min(0).max(1).default(0.5),
  scenes: z.array(editorialSceneSchema).min(1).max(1000),
});

export type EditorialScene = z.infer<typeof editorialSceneSchema>;
export type EditorialEpisodeProps = z.infer<typeof editorialEpisodeSchema>;

export const defaultEditorialEpisodeProps: EditorialEpisodeProps = {
  episodeId: "episode-finance-cavaliers-demo",
  channelName: "Finance Cavaliers",
  title: "La historia detrás de los datos",
  durationSeconds: 12,
  audioPath: "",
  logoPath: "assets/library/finance-cavaliers/episodes/1/logo-primary.png",
  accentColor: "#FFC83D",
  previewMode: "editorial",
  narrationVolume: 1,
  soundEnabled: true,
  soundMix: 0.5,
  scenes: [
    {
      id: "scene-demo-001",
      startSeconds: 0,
      endSeconds: 6,
      kind: "split-lines",
      headline: "Dos líneas. Dos historias.",
      supportingText: "Una ilustración conceptual separa precio y liderazgo.",
      narrationText: "",
      factualStatus: "review",
      labels: ["ÍNDICE", "LIDERAZGO RELATIVO"],
      values: [],
      valueLabels: [],
      chartData: [],
      secondaryChartData: [],
      focusTarget: "both",
      assets: [],
      semanticCues: [],
    },
    {
      id: "scene-demo-002",
      startSeconds: 6,
      endSeconds: 12,
      kind: "brand-cta",
      headline: "La historia detrás de los datos",
      supportingText: "Finance Cavaliers",
      narrationText: "",
      factualStatus: "supported",
      labels: [],
      values: [],
      valueLabels: [],
      chartData: [],
      secondaryChartData: [],
      focusTarget: "both",
      assets: [],
      semanticCues: [],
    },
  ],
};
