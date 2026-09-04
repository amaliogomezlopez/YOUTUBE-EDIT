import {loadFont} from "@remotion/fonts";
import {staticFile} from "remotion";

export const MOTION_FONT_FAMILY = "Schibsted Grotesk";
export const FINANCE_FONT_FAMILY = "Fraunces";
export const DATA_FONT_FAMILY = "Fragment Mono";
export const CHALK_FONT_FAMILY = "Caveat";

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
  loadFont({
    family: DATA_FONT_FAMILY,
    url: staticFile("fonts/fragment-mono-latin-ext-400.woff2"),
    weight: "400",
    display: "block",
  }),
]);
