import {loadFont} from "@remotion/fonts";
import {staticFile} from "remotion";

export const MOTION_FONT_FAMILY = "Schibsted Grotesk";
export const FINANCE_FONT_FAMILY = "Fraunces";
export const DATA_FONT_FAMILY = "Fragment Mono";
export const CHALK_FONT_FAMILY = "Caveat";
/** Grotesca de apoyo para antetitulos y notas bajo una serif de titular. */
export const SANS_FONT_FAMILY = "Instrument Sans";
/** Fuentes de los estilos de texto de la intro (text-styles.json). */
export const SERIF_FONT_FAMILY = "Instrument Serif";
export const DISPLAY_GROTESK_FAMILY = "Bricolage Grotesque";
export const CONDENSED_FONT_FAMILY = "Anton";

const editorialFontUrl = staticFile(
  "fonts/schibsted-grotesk-latin-ext-variable.woff2",
);

void Promise.all([
  ...["400", "500", "600", "700", "800", "900"].map((weight) =>
    loadFont({
      family: MOTION_FONT_FAMILY,
      url: editorialFontUrl,
      weight,
      display: "block",
    }),
  ),
  ...["400", "500", "600", "700", "800", "900"].map((weight) =>
    loadFont({
      family: FINANCE_FONT_FAMILY,
      url: staticFile("fonts/fraunces-latin-ext-variable.woff2"),
      weight,
      display: "block",
    }),
  ),
  ...["400", "500", "600", "700"].map((weight) =>
    loadFont({
      family: CHALK_FONT_FAMILY,
      url: staticFile("fonts/caveat-latin-ext-variable.woff2"),
      weight,
      display: "block",
    }),
  ),
  ...["400", "500", "600", "700"].map((weight) =>
    loadFont({
      family: SANS_FONT_FAMILY,
      url: staticFile("fonts/instrument-sans-latin-ext-variable.woff2"),
      weight,
      display: "block",
    }),
  ),
  loadFont({
    family: DATA_FONT_FAMILY,
    url: staticFile("fonts/fragment-mono-latin-ext-400.woff2"),
    weight: "400",
    display: "block",
  }),
  loadFont({
    family: SERIF_FONT_FAMILY,
    url: staticFile("fonts/instrument-serif-latin-400.woff2"),
    weight: "400",
    display: "block",
  }),
  loadFont({
    family: SERIF_FONT_FAMILY,
    url: staticFile("fonts/instrument-serif-latin-400-italic.woff2"),
    weight: "400",
    style: "italic",
    display: "block",
  }),
  ...["400", "500", "600", "700", "800"].map((weight) =>
    loadFont({
      family: DISPLAY_GROTESK_FAMILY,
      url: staticFile("fonts/bricolage-grotesque-latin-variable.woff2"),
      weight,
      display: "block",
    }),
  ),
  loadFont({
    family: CONDENSED_FONT_FAMILY,
    url: staticFile("fonts/anton-latin-400.woff2"),
    weight: "400",
    display: "block",
  }),
]);
