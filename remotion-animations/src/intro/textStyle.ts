import {z} from "zod";

/**
 * Tokens de texto de la intro. Los resuelve `src/modules/intro-studio/text-styles.js`
 * desde `text-styles.json` y viajan en el build; aqui solo se validan y se completan
 * con la v3 aprobada, para que un build sin estilo se vea exactamente como antes.
 */
const fontSchema = z.object({
  family: z.string(),
  weight: z.number(),
  variation: z.string().nullable().optional(),
  letterSpacingEm: z.number(),
  lineHeight: z.number().optional(),
  uppercase: z.boolean().optional(),
});

export const introTextStyleSchema = z.object({
  id: z.string(),
  display: fontSchema,
  label: fontSchema.omit({lineHeight: true, variation: true}),
  sizes: z.object({
    keyword: z.number(),
    keywordLong: z.number(),
    stat: z.number(),
    statLong: z.number(),
    title: z.number(),
    note: z.number(),
    statNote: z.number(),
    kicker: z.number(),
    /** Puntos de la agenda (lista numerada). */
    list: z.number().optional(),
  }),
  color: z.object({ink: z.string(), accentMode: z.enum(["writing", "highlight", "ink"])}),
  highlight: z.object({underline: z.boolean(), italic: z.boolean()}),
  reveal: z.enum(["letters", "words", "mask", "fade"]),
  keywordAlign: z.enum(["left", "center"]),
  stat: z.object({
    presentation: z.enum(["column", "floating"]),
    counter: z.boolean(),
    family: z.string().nullable().optional(),
  }),
  title: z.object({family: z.string().optional(), uppercase: z.boolean().optional()}).optional(),
});

export type IntroTextStyle = z.infer<typeof introTextStyleSchema>;

export const DEFAULT_TEXT_STYLE: IntroTextStyle = {
  id: "v3-fraunces",
  display: {family: "Fraunces", weight: 600, variation: "'opsz' 144, 'SOFT' 30, 'WONK' 0", letterSpacingEm: -0.016, lineHeight: 1.02, uppercase: false},
  label: {family: "Instrument Sans", weight: 600, letterSpacingEm: 0.23, uppercase: true},
  sizes: {keyword: 92, keywordLong: 74, stat: 210, statLong: 150, title: 112, note: 26, statNote: 34, kicker: 28, list: 60},
  color: {ink: "#FFFFFF", accentMode: "writing"},
  highlight: {underline: false, italic: false},
  reveal: "letters",
  keywordAlign: "left",
  stat: {presentation: "column", counter: false, family: null},
};
