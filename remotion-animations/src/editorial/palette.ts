export const EDITORIAL_COLORS = {
  background: "#0C0D0B",
  bg: "#0C0D0B",
  surface: "#171814",
  panel: "#171814",
  surfaceRaised: "#21221C",
  raised: "#21221C",
  ink: "#F3E6C0",
  white: "#F7F1DC",
  muted: "#A39474",
  grid: "#2C2E24",
  gold: "#E8C04A",
  amber: "#C49A3C",
  cyan: "#7EAEB8",
  ice: "#A9C4C8",
  positive: "#7FB56E",
  green: "#7FB56E",
  negative: "#D07068",
  red: "#D07068",
} as const;

export const EDITORIAL_RADIUS = 2;

export const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  const expanded =
    value.length === 3
      ? value
          .split("")
          .map((character) => character.repeat(2))
          .join("")
      : value;
  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(
    expanded.slice(2, 4),
    16,
  )}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${opacity})`;
};
