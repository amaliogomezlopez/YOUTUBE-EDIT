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
  "market-engine",
  "ai-core",
  "correction-alert",
  "bubble-trigger",
  "market-gravity",
  "history-rewind",
  "historical-leaders",
  "dominance-facade",
  "leadership-lag",
  "contagion-spread",
  "claim-evidence-gap",
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

/**
 * ANM-D01 — Familias sonoras del catálogo (`catalog/sound/sfx.json`).
 * Un cue pide una familia; el director elige la variante concreta.
 */
export const soundFamilySchema = z.enum([
  "interface",
  "data",
  "camera",
  "tension",
  "impact",
  "break",
  "rewind",
  "reveal",
  "confirm",
  "texture",
]);

/** Alias históricos del episodio 1. El director los traduce a familia+variante. */
export const legacySoundAliasSchema = z.enum([
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
  "logo-shimmer",
  "tension-swell",
  "needle-strike",
  "bubble-burst",
  "rewind-sweep",
  "keyboard",
  "data-loading",
]);

/** ANM-A05 — El cue pide familia e intensidad, nunca un fichero. */
export const cueSoundSchema = z.object({
  family: soundFamilySchema,
  intensity: z.number().min(0).max(1.4).default(0.6),
  variantHint: z.string().optional(),
});

/** ANM-D05/D06 — Instancia ya resuelta por el director: file, volumen y tono. */
const soundInstanceSchema = z.object({
  cueId: z.string(),
  family: z.string(),
  variantId: z.string(),
  file: z.string(),
  startSeconds: z.number().min(0),
  durationSeconds: z.number().positive().max(30),
  volume: z.number().min(0).max(1),
  playbackRate: z.number().min(0.5).max(2).default(1),
  role: z.enum(["cue", "riser", "resolution", "bed"]).default("cue"),
});

const semanticCueSchema = z.object({
  id: z.string(),
  /** ANM-A01 — Fuente de verdad temporal. `atSeconds` es un derivado. */
  anchorWordIndex: z.number().int().min(0).optional(),
  anchorText: z.string().optional(),
  anchorOccurrence: z.number().int().min(1).default(1),
  offsetSeconds: z.number().min(-2).max(2).default(0),
  absoluteSeconds: z.number().min(0).optional(),
  kind: z.enum([
    "number",
    "percent",
    "currency",
    "magnitude",
    "entity",
    "date",
    "period",
    "turn",
    "verb",
    "comparison",
  ]).optional(),
  metaphor: z.string().optional(),
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
  sound: z.union([legacySoundAliasSchema, cueSoundSchema]).optional(),
});

export const editorialSceneSchema = z.object({
  id: z.string(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  kind: editorialSceneKindSchema,
  headline: z.string(),
  supportingText: z.string(),
  narrationText: z.string(),
  onScreenText: z.array(z.string()).max(30).default([]),
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
  /** ANM-E01 — Patrón del catálogo que resuelve la escena. */
  patternId: z.string().optional(),
  /** ANM-A04 — Objetos enfocables declarados; `cue.target` debe pertenecer aquí. */
  focusTargets: z.array(z.string()).max(40).default([]),
  /** ANM-C04 — Acto narrativo: ajusta la densidad objetivo. */
  act: z.enum(["hook", "desarrollo", "giro", "cierre"]).default("desarrollo"),
  /** ANM-C02 — Un silencio visual solo es legítimo si está declarado. */
  intent: z.enum(["inform", "breath"]).default("inform"),
  /** ANM-F03 — Mecanismo de énfasis asignado por rotación. */
  emphasis: z.string().optional(),
  /**
   * ANM-D04 — Mezcla ya decidida por el director.
   * Si viene, el render la reproduce tal cual: la capa de render no elige
   * sonidos ni apila whooshes por tipo de acción.
   */
  soundPlan: z.array(soundInstanceSchema).max(80).default([]),
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
  /** ANM-D07 — Lecho continuo por acto: el silencio total deja de ser un hueco. */
  bedTrack: z.array(z.object({
    act: z.string(),
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    file: z.string(),
    volume: z.number().min(0).max(1).default(0.13),
    fadeSeconds: z.number().min(0).max(6).default(1.2),
  })).max(60).default([]),
  /** ANM-D09 — Ventanas de ducking derivadas de las palabras de la locución. */
  duckWindows: z.array(z.object({
    startSeconds: z.number().min(0),
    endSeconds: z.number().positive(),
    gainDb: z.number().min(-24).max(0).default(-5),
  })).max(20_000).default([]),
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
  bedTrack: [],
  duckWindows: [],
  scenes: [
    {
      id: "scene-demo-001",
      startSeconds: 0,
      endSeconds: 6,
      kind: "split-lines",
      headline: "Dos líneas. Dos historias.",
      supportingText: "Una ilustración conceptual separa precio y liderazgo.",
      narrationText: "",
      onScreenText: [],
      factualStatus: "review",
      labels: ["ÍNDICE", "LIDERAZGO RELATIVO"],
      values: [],
      valueLabels: [],
      chartData: [],
      secondaryChartData: [],
      focusTarget: "both",
      assets: [],
      semanticCues: [],
      focusTargets: [],
      act: "hook",
      intent: "inform",
      soundPlan: [],
    },
    {
      id: "scene-demo-002",
      startSeconds: 6,
      endSeconds: 12,
      kind: "brand-cta",
      headline: "La historia detrás de los datos",
      supportingText: "Finance Cavaliers",
      narrationText: "",
      onScreenText: [],
      factualStatus: "supported",
      labels: [],
      values: [],
      valueLabels: [],
      chartData: [],
      secondaryChartData: [],
      focusTarget: "both",
      assets: [],
      semanticCues: [],
      focusTargets: [],
      act: "cierre",
      intent: "inform",
      soundPlan: [],
    },
  ],
};
