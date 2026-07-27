import {z} from "zod";

export const motionThemeSchema = z.enum([
  "ink-lime",
  "editorial-ivory",
  "signal-cobalt",
  "oxide-documentary",
]);

export type MotionThemeId = z.infer<typeof motionThemeSchema>;

export type MotionTheme = {
  id: MotionThemeId;
  label: string;
  background: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  muted: string;
  grid: string;
  accent: string;
  danger: string;
  positive: string;
  borderRadius: number;
};

export const MOTION_THEMES: Record<MotionThemeId, MotionTheme> = {
  "ink-lime": {
    id: "ink-lime",
    label: "Ink + Lime",
    background: "#07110F",
    surface: "#0E1D19",
    surfaceRaised: "#142820",
    ink: "#F2F7F3",
    muted: "#9EAEA5",
    grid: "#294037",
    accent: "#C6FF4A",
    danger: "#FF6B62",
    positive: "#49DEA2",
    borderRadius: 6,
  },
  "editorial-ivory": {
    id: "editorial-ivory",
    label: "Editorial Ivory",
    background: "#F1EEE6",
    surface: "#E5E0D5",
    surfaceRaised: "#FAF8F2",
    ink: "#171713",
    muted: "#68675F",
    grid: "#C8C1B4",
    accent: "#1D55C5",
    danger: "#B64032",
    positive: "#26785F",
    borderRadius: 2,
  },
  "signal-cobalt": {
    id: "signal-cobalt",
    label: "Signal Cobalt",
    background: "#071322",
    surface: "#0D213A",
    surfaceRaised: "#122D4F",
    ink: "#EEF5FF",
    muted: "#91A7C1",
    grid: "#254566",
    accent: "#4DD4FF",
    danger: "#FF6577",
    positive: "#48DFB0",
    borderRadius: 8,
  },
  "oxide-documentary": {
    id: "oxide-documentary",
    label: "Oxide Documentary",
    background: "#15110F",
    surface: "#241B17",
    surfaceRaised: "#30231D",
    ink: "#F2E9DE",
    muted: "#B7A99B",
    grid: "#4A3930",
    accent: "#E57246",
    danger: "#DF544F",
    positive: "#91B884",
    borderRadius: 1,
  },
};

export const motionProfileSchema = z.enum([
  "restrained",
  "editorial",
  "kinetic",
  "technical",
  "cinematic",
]);

export type MotionProfileId = z.infer<typeof motionProfileSchema>;

export type MotionProfile = {
  id: MotionProfileId;
  label: string;
  tempo: number;
  staggerSeconds: number;
  travel: number;
  scale: number;
  overshoot: number;
};

export const MOTION_PROFILES: Record<MotionProfileId, MotionProfile> = {
  restrained: {
    id: "restrained",
    label: "Restrained",
    tempo: 0.82,
    staggerSeconds: 0.18,
    travel: 18,
    scale: 1.025,
    overshoot: 0,
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    tempo: 1,
    staggerSeconds: 0.14,
    travel: 28,
    scale: 1.04,
    overshoot: 0.015,
  },
  kinetic: {
    id: "kinetic",
    label: "Kinetic",
    tempo: 1.22,
    staggerSeconds: 0.1,
    travel: 48,
    scale: 1.08,
    overshoot: 0.04,
  },
  technical: {
    id: "technical",
    label: "Technical",
    tempo: 1.08,
    staggerSeconds: 0.09,
    travel: 20,
    scale: 1.02,
    overshoot: 0,
  },
  cinematic: {
    id: "cinematic",
    label: "Cinematic",
    tempo: 0.72,
    staggerSeconds: 0.22,
    travel: 36,
    scale: 1.12,
    overshoot: 0.01,
  },
};

export const motionFormatSchema = z.enum([
  "landscape",
  "vertical",
  "square",
  "portrait",
]);

export type MotionFormat = z.infer<typeof motionFormatSchema>;

export const MOTION_FORMATS: Record<
  MotionFormat,
  {label: string; width: number; height: number}
> = {
  landscape: {label: "16:9", width: 1920, height: 1080},
  vertical: {label: "9:16", width: 1080, height: 1920},
  square: {label: "1:1", width: 1080, height: 1080},
  portrait: {label: "4:5", width: 1080, height: 1350},
};

export const getMotionTheme = (
  themeId: MotionThemeId = "ink-lime",
): MotionTheme => MOTION_THEMES[themeId];

export const getMotionProfile = (
  profileId: MotionProfileId = "editorial",
): MotionProfile => MOTION_PROFILES[profileId];

export const getMotionFormat = (
  format: MotionFormat = "landscape",
) => MOTION_FORMATS[format];

export const getResponsiveLayout = (width: number, height: number) => {
  const portrait = height > width * 1.15;
  const square = Math.abs(width - height) < width * 0.08;
  const safeX = Math.round(width * (portrait ? 0.064 : 0.05));
  const safeY = Math.round(height * (portrait ? 0.045 : 0.052));
  return {
    portrait,
    square,
    safeX,
    safeY,
    gap: Math.round(Math.min(width, height) * 0.025),
    headlineSize: portrait
      ? Math.round(width * 0.075)
      : Math.round(Math.min(68, width * 0.036)),
    bodySize: portrait
      ? Math.round(width * 0.036)
      : Math.round(Math.min(28, width * 0.017)),
    contentTop: portrait
      ? Math.round(height * 0.2)
      : Math.round(height * 0.19),
  };
};
