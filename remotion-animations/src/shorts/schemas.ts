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
  decoration: z.enum(["none", "frame", "blend"]).nullable().optional(),
  displayScale: z.number().optional(),
  offsetY: z.number().optional(),
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

const rectSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

export const captionPageSchema = z.object({
  fromFrame: z.number(),
  durationInFrames: z.number(),
  /**
   * Indice de la palabra hero dentro de `words` en modo `progressive`
   * (lead/hero/tail apilados). Ausente o -1 cuando la pagina no tiene hero:
   * opcional para que los builds karaoke ya compilados sigan validando.
   */
  heroIndex: z.number().optional(),
  words: z.array(captionWordSchema),
});

export const shortSceneSchema = z.object({
  id: z.string(),
  clipId: z.string(),
  src: z.string(),
  from: z.number(),
  durationInFrames: z.number(),
  trimStartSeconds: z.number(),
  trimEndSeconds: z.number().optional(),
  silenceTrimmedSeconds: z.number().optional(),
  layout: z.enum(["full", "split", "stage", "pip", "fit"]),
  camera: z.enum(["static", "punch-in", "push-out", "drift-left", "drift-right"]),
  cameraIntensity: z.number().default(1),
  focus: shortFocusSchema,
  /**
   * Muestras del punto focal a lo largo del clip ({t en segundos dentro del
   * clip, x/y normalizados}). El build lo emite cuando el plan no fija `focus`:
   * ClipStage interpola el encuadre en vez de quedarse estatico.
   */
  focusTrack: z
    .array(z.object({t: z.number(), x: z.number(), y: z.number()}))
    .nullable()
    .optional(),
  /** Caja de la webcam en pixeles fuente; exigida por el layout `pip`. */
  webcamBox: z
    .object({x: z.number(), y: z.number(), w: z.number(), h: z.number()})
    .nullable()
    .optional(),
  transitionIn: z.enum(["cut", "fade", "whip", "slide-up", "zoom-blur"]),
  label: z.string().nullable().optional(),
  cues: z.array(shortCueSchema),
  captionPages: z.array(captionPageSchema),
  /** Rectangulos precalculados del layout `pip` (src/modules/shorts-studio/pip-layout.js). */
  pip: z
    .object({
      camCard: rectSchema.extend({
        radius: z.number().optional(),
        stroke: z.number().optional(),
      }),
      camCrop: z.object({
        scale: z.number(),
        offsetX: z.number(),
        offsetY: z.number(),
        videoWidth: z.number(),
        videoHeight: z.number(),
      }),
      screen: rectSchema,
      mask: rectSchema.extend({
        localLeft: z.number().optional(),
        localTop: z.number().optional(),
        visible: z.boolean().optional(),
      }),
    })
    .nullable()
    .optional(),
  /** Rectangulos precalculados del layout `fit`. */
  fit: z
    .object({screen: rectSchema})
    .nullable()
    .optional(),
});

export const soundCueSchema = z.object({
  file: z.string(),
  startSeconds: z.number(),
  durationSeconds: z.number(),
  volume: z.number(),
  attackSeconds: z.number().optional(),
  releaseSeconds: z.number().optional(),
  /** Jitter de tono con el que rotan las tomas de una misma familia. */
  playbackRate: z.number().optional(),
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
      /**
       * `karaoke` ilumina la palabra que suena dentro de la pagina visible;
       * `progressive` oculta las futuras y apila lead/hero/tail cuando la
       * pagina trae `heroIndex`.
       */
      mode: z.enum(["karaoke", "progressive"]).optional(),
    })
    .default({}),
  soundEnabled: z.boolean().default(true),
  soundMix: z.number().default(0.55),
  clipVolume: z.number().default(1),
  scenes: z.array(shortSceneSchema),
  soundCues: z.array(soundCueSchema),
  /**
   * Cama musical opcional: suena en bucle todo el short y baja a
   * `volume * duckGainDb` mientras hay locucion (mismas rampas que Soundtrack).
   */
  music: z
    .object({
      file: z.string(),
      volume: z.number(),
      duckGainDb: z.number().optional(),
    })
    .nullable()
    .optional(),
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
