import {z} from "zod";
import {motionThemeSchema} from "../motion/DesignSystem";

export const shortFocusSchema = z.object({
  x: z.number(),
  y: z.number(),
  faceHeightRatio: z.number().optional(),
});

export const shortCueSchema = z.object({
  id: z.string(),
  type: z.enum(["logo", "screenshot", "stat", "chip", "label", "brand"]),
  assetId: z.string().nullable().optional(),
  src: z.string().nullable().optional(),
  slot: z.string().nullable().optional(),
  /**
   * `card` envuelve la imagen en una tarjeta oscura con borde y halo: sirve para
   * logos claros sobre transparencia. `plate` usa una placa clara, obligatoria
   * cuando el arte del logo es negro sobre alfa (sobre tarjeta oscura no se ve).
   * `plain` la deja desnuda, para capturas que ya traen su propio fondo. `blend`
   * suma la imagen sobre el video con `screen`, que hace desaparecer un fondo
   * negro solido: es lo que necesita un wordmark exportado en JPG sin alfa.
   */
  presentation: z.enum(["card", "plate", "plain", "blend"]).default("card"),
  text: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  tone: z.enum(["neutral", "accent", "warning", "danger", "positive"]).default("neutral"),
  atWord: z.number().nullable().optional(),
  atSeconds: z.number(),
  fromFrame: z.number(),
  durationInFrames: z.number(),
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

export const shortSceneSchema = z.object({
  id: z.string(),
  clipId: z.string(),
  src: z.string(),
  from: z.number(),
  durationInFrames: z.number(),
  trimStartSeconds: z.number(),
  layout: z.enum(["full", "split", "stage"]),
  camera: z.enum(["static", "punch-in", "push-out", "drift-left", "drift-right"]),
  cameraIntensity: z.number().default(1),
  focus: shortFocusSchema,
  transitionIn: z.enum(["cut", "fade", "whip", "slide-up", "zoom-blur"]),
  label: z.string().nullable().optional(),
  cues: z.array(shortCueSchema),
  captionPages: z.array(captionPageSchema),
});

export const soundCueSchema = z.object({
  file: z.string(),
  startSeconds: z.number(),
  durationSeconds: z.number(),
  volume: z.number(),
  attackSeconds: z.number().optional(),
  releaseSeconds: z.number().optional(),
});

export const shortVideoSchema = z.object({
  slug: z.string(),
  format: z.object({width: z.number(), height: z.number(), fps: z.number()}),
  durationInFrames: z.number(),
  themeId: motionThemeSchema,
  accentColor: z.string().nullable().optional(),
  dangerColor: z.string().nullable().optional(),
  backgroundImage: z.string().nullable().optional(),
  captionStyle: z
    .object({
      position: z.enum(["auto", "lower", "center"]).optional(),
      uppercase: z.boolean().optional(),
    })
    .default({}),
  soundEnabled: z.boolean().default(true),
  soundMix: z.number().default(0.55),
  clipVolume: z.number().default(1),
  scenes: z.array(shortSceneSchema),
  soundCues: z.array(soundCueSchema),
  /** Tramos con locucion: los efectos bajan de nivel mientras se habla. */
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

export type ShortVideoProps = z.infer<typeof shortVideoSchema>;
export type ShortScene = z.infer<typeof shortSceneSchema>;
export type ShortCue = z.infer<typeof shortCueSchema>;
export type CaptionPage = z.infer<typeof captionPageSchema>;
