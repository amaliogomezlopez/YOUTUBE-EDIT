import {z} from "zod";

/**
 * Contrato de `montage-build.<formato>.json`, el build que compila
 * `npm run montage -- build`. Todo llega resuelto en frames: el renderer no decide
 * nada, solo interpola.
 */
const rectSchema = z.object({left: z.number(), top: z.number(), width: z.number(), height: z.number()});

const cameraKeySchema = z.object({t: z.number(), scale: z.number(), x: z.number(), y: z.number()});

export const montageBeatSchema = z.object({
  id: z.string(),
  atWord: z.number(),
  fromFrame: z.number(),
  durationInFrames: z.number(),
  emphasis: z.boolean().optional(),
  visual: z.object({
    assetId: z.string(),
    src: z.string(),
    kind: z.enum(["image", "video"]),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    trimSeconds: z.number().default(0),
    loop: z.boolean().default(false),
    fit: z.enum(["cover", "contain-blur"]),
    focus: z.object({x: z.number(), y: z.number()}),
  }),
  camera: z.object({
    move: z.string(),
    easing: z.string(),
    shake: z.number().default(0),
    keys: z.array(cameraKeySchema),
  }),
  transitionIn: z.object({kind: z.string(), frames: z.number()}),
  overlays: z.array(z.object({
    id: z.string(),
    kind: z.enum(["pop", "stat"]),
    text: z.string(),
    fromFrame: z.number(),
    durationInFrames: z.number(),
  })),
});

const soundCueSchema = z.object({
  file: z.string(),
  startSeconds: z.number(),
  durationSeconds: z.number(),
  volume: z.number(),
  attackSeconds: z.number().optional(),
  releaseSeconds: z.number().optional(),
  playbackRate: z.number().optional(),
});

const captionPageSchema = z.object({
  fromFrame: z.number(),
  durationInFrames: z.number(),
  heroIndex: z.number().optional(),
  words: z.array(z.object({text: z.string(), fromFrame: z.number(), toFrame: z.number()})),
});

export const montageVideoSchema = z.object({
  slug: z.string(),
  format: z.object({id: z.string(), width: z.number(), height: z.number(), fps: z.number()}),
  durationInFrames: z.number(),
  voiceover: z.object({src: z.string(), trimStartSeconds: z.number(), volume: z.number()}),
  music: z.object({src: z.string(), volume: z.number(), durationSeconds: z.number().optional()}).nullable(),
  duckWindows: z.array(z.object({startSeconds: z.number(), endSeconds: z.number(), gainDb: z.number().optional()})),
  soundEnabled: z.boolean(),
  soundMix: z.number(),
  soundCues: z.array(soundCueSchema),
  accentColor: z.string(),
  geometry: z.object({safeBottom: z.number(), captionRect: rectSchema, popRect: rectSchema}),
  beats: z.array(montageBeatSchema),
  hitEffects: z.array(z.object({
    id: z.string(),
    effect: z.string(),
    intensity: z.number(),
    fromFrame: z.number(),
    durationInFrames: z.number(),
  })),
  captions: z.object({
    pages: z.array(captionPageSchema),
    mode: z.string(),
    rect: rectSchema,
    appearance: z.object({
      uppercase: z.boolean().optional(),
      baseFontSize: z.number().optional(),
      activeColor: z.string().optional(),
      outlineSize: z.number().optional(),
      shadow: z.number().optional(),
    }),
  }),
});

export type MontageVideoProps = z.infer<typeof montageVideoSchema>;
export type MontageBeat = z.infer<typeof montageBeatSchema>;
