import {z} from "zod";
import {motionThemeSchema} from "../motion/DesignSystem";

export const introFocusSchema = z.object({
  x: z.number(),
  y: z.number(),
  faceHeightRatio: z.number().optional(),
});

/** Rectangulo en pixeles de la composicion; lo calcula el build, no el plan. */
export const introRectSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

export const introLayoutSchema = z.enum(["hero", "hero-left", "hero-right", "frame", "insert"]);

export const introCameraSchema = z.enum([
  "static",
  "punch-in",
  "push-out",
  "drift-left",
  "drift-right",
  /** Temblor sutil de camara en mano: da vida a un plano estatico sin moverlo. */
  "handheld",
  /** Zoom escalonado: salta de golpe y se queda. Pensado para caer en un beat. */
  "snap-zoom",
]);

export const introTransitionSchema = z.enum([
  "cut",
  "fade",
  "whip",
  "slide-up",
  "zoom-blur",
  /** Corte tapado por un fotograma blanco: el corte mas duro que no molesta. */
  "flash-cut",
  "glitch-cut",
]);

export const introEffectSchema = z.enum([
  "flash",
  "rgb-split",
  "shake",
  "zoom-punch",
  "glitch",
  "light-leak",
  "grain",
  "scanlines",
  "vignette-pulse",
  "letterbox-snap",
  "speed-blur",
]);

export const introCueSchema = z.object({
  id: z.string(),
  type: z.enum(["logo", "screenshot", "stat", "chip", "label", "brand"]),
  assetId: z.string().nullable().optional(),
  src: z.string().nullable().optional(),
  slot: z.string().nullable().optional(),
  /**
   * `back` dibuja el arte detras del sujeto, reducido y desenfocado; `front`
   * delante. La profundidad no es decorativa: es lo que hace legible un logo que
   * "sale por detras" sin recortar la silueta de la persona.
   */
  depth: z.enum(["back", "front"]).default("front"),
  presentation: z.enum(["card", "plate", "plain", "blend"]).default("card"),
  text: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  tone: z.enum(["neutral", "accent", "warning", "danger", "positive"]).default("neutral"),
  /** Escala respecto al rectangulo del slot. Un cue de fondo entra por debajo de 1. */
  scale: z.number().default(1),
  blurPx: z.number().default(0),
  /** Rectangulo ya resuelto: lo usa el renderer y lo miden las reglas. */
  rect: introRectSchema,
  atBeat: z.number().nullable().optional(),
  atWord: z.number().nullable().optional(),
  atSeconds: z.number(),
  fromFrame: z.number(),
  durationInFrames: z.number(),
});

export const introEffectCueSchema = z.object({
  id: z.string(),
  effect: introEffectSchema,
  intensity: z.number().default(1),
  atBeat: z.number().nullable().optional(),
  atSeconds: z.number(),
  fromFrame: z.number(),
  durationInFrames: z.number(),
  /** Si el golpe no cae en un beat, el plan tiene que explicar por que. */
  offBeatNote: z.string().nullable().optional(),
});

export const introBackdropSchema = z.object({
  src: z.string(),
  kind: z.enum(["image", "video"]),
  motion: z.enum(["static", "parallax-left", "parallax-right", "slow-zoom"]).default("slow-zoom"),
  opacity: z.number().default(0.5),
});

export const captionWordSchema = z.object({
  text: z.string(),
  fromFrame: z.number(),
  toFrame: z.number(),
});

export const captionPageSchema = z.object({
  fromFrame: z.number(),
  durationInFrames: z.number(),
  words: z.array(captionWordSchema),
});

export const introSceneSchema = z.object({
  id: z.string(),
  clipId: z.string(),
  src: z.string(),
  from: z.number(),
  durationInFrames: z.number(),
  trimStartSeconds: z.number(),
  trimEndSeconds: z.number().optional(),
  silenceTrimmedSeconds: z.number().optional(),
  layout: introLayoutSchema,
  camera: introCameraSchema,
  cameraIntensity: z.number().default(1),
  focus: introFocusSchema,
  /** Donde cae la cara en la composicion. Ningun cue de primer plano la tapa. */
  faceRect: introRectSchema.nullable().optional(),
  transitionIn: introTransitionSchema,
  label: z.string().nullable().optional(),
  backdrop: introBackdropSchema.nullable().optional(),
  cues: z.array(introCueSchema),
  effects: z.array(introEffectCueSchema),
  captionPages: z.array(captionPageSchema),
});

export const soundCueSchema = z.object({
  file: z.string(),
  startSeconds: z.number(),
  durationSeconds: z.number(),
  volume: z.number(),
  attackSeconds: z.number().optional(),
  releaseSeconds: z.number().optional(),
  playbackRate: z.number().optional(),
});

export const introMusicSchema = z.object({
  file: z.string(),
  bpm: z.number(),
  offsetSeconds: z.number(),
  beatSeconds: z.array(z.number()),
  gainDb: z.number().default(-8),
  confidence: z.number().nullable().optional(),
});

export const introTitleSchema = z.object({
  text: z.string(),
  kicker: z.string().nullable().optional(),
  atSeconds: z.number(),
  fromFrame: z.number(),
  durationInFrames: z.number(),
});

export const introVideoSchema = z.object({
  slug: z.string(),
  format: z.object({width: z.number(), height: z.number(), fps: z.number()}),
  durationInFrames: z.number(),
  profileId: z.string(),
  themeId: motionThemeSchema,
  accentColor: z.string().nullable().optional(),
  dangerColor: z.string().nullable().optional(),
  titleCard: introTitleSchema.nullable().optional(),
  music: introMusicSchema.nullable().optional(),
  soundEnabled: z.boolean().default(true),
  soundMix: z.number().default(0.6),
  clipVolume: z.number().default(1),
  scenes: z.array(introSceneSchema),
  soundCues: z.array(soundCueSchema),
  duckWindows: z
    .array(
      z.object({
        startSeconds: z.number(),
        endSeconds: z.number(),
        gainDb: z.number().optional(),
      }),
    )
    .default([]),
});

export type IntroVideoProps = z.infer<typeof introVideoSchema>;
export type IntroScene = z.infer<typeof introSceneSchema>;
export type IntroCue = z.infer<typeof introCueSchema>;
export type IntroEffectCue = z.infer<typeof introEffectCueSchema>;
export type IntroBackdrop = z.infer<typeof introBackdropSchema>;
export type CaptionPage = z.infer<typeof captionPageSchema>;
