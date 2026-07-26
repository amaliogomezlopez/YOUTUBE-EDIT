import { zColor } from "@remotion/zod-types";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

const barSchema = z.object({
  label: z.string(),
  value: z.number().min(0),
  color: zColor(),
});

export const chartHighlightSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  bars: z.array(barSchema).min(2).max(8),
  highlightIndex: z.number().int().min(0).max(7),
  unit: z.string(),
  accentColor: zColor(),
  backgroundColor: zColor(),
  source: z.string(),
  transparent: z.boolean(),
});

export type ChartHighlightProps = z.infer<typeof chartHighlightSchema>;

export const defaultChartHighlightProps = {
  title: "El dato que cambia la historia",
  subtitle: "La cuarta columna rompe claramente la tendencia",
  bars: [
    { label: "ENE", value: 18, color: "#4A6076" },
    { label: "FEB", value: 24, color: "#4A6076" },
    { label: "MAR", value: 31, color: "#4A6076" },
    { label: "ABR", value: 67, color: "#FFCA3A" },
    { label: "MAY", value: 45, color: "#4A6076" },
    { label: "JUN", value: 52, color: "#4A6076" },
  ],
  highlightIndex: 3,
  unit: "%",
  accentColor: "#FFCA3A",
  backgroundColor: "#07111F",
  source: "Datos de ejemplo · edita los parámetros en Remotion Studio",
  transparent: false,
} satisfies ChartHighlightProps;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-f]{6}$/i.test(value)) {
    return `rgba(255, 202, 58, ${alpha})`;
  }

  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${alpha})`;
};

export const ChartHighlight: React.FC<ChartHighlightProps> = ({
  title,
  subtitle,
  bars,
  highlightIndex,
  unit,
  accentColor,
  backgroundColor,
  source,
  transparent,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const safeHighlightIndex = Math.min(highlightIndex, bars.length - 1);
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  const intro = interpolate(frame, [0, 0.8 * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const highlight = interpolate(frame, [1.45 * fps, 2.15 * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const outro = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames - 1],
    [1, 0],
    {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    },
  );
  const pulse =
    0.92 + Math.sin((frame / fps) * Math.PI * 4) * 0.08 * highlight;
  const panelBackground = transparent
    ? "rgba(7, 17, 31, 0.86)"
    : "rgba(12, 27, 45, 0.92)";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: transparent ? "transparent" : backgroundColor,
        backgroundImage: transparent
          ? undefined
          : `radial-gradient(circle at 78% 16%, ${withAlpha(
              accentColor,
              0.2,
            )}, transparent 32%), linear-gradient(145deg, ${backgroundColor}, #0d2035)`,
        color: "#F8FAFC",
        opacity: outro,
        overflow: "hidden",
        padding: "72px 96px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 18,
          opacity: intro,
          transform: `translateY(${interpolate(intro, [0, 1], [32, 0])}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: accentColor,
            borderRadius: 999,
            height: 14,
            boxShadow: `0 0 ${28 * highlight}px ${withAlpha(
              accentColor,
              0.75,
            )}`,
            width: 58,
          }}
        />
        <span
          style={{
            color: "#9FB4C8",
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: 4,
          }}
        >
          GRÁFICA EN FOCO
        </span>
      </div>

      <div
        style={{
          fontSize: 66,
          fontWeight: 850,
          letterSpacing: -2.2,
          lineHeight: 1.05,
          marginTop: 26,
          opacity: intro,
          transform: `translateX(${interpolate(intro, [0, 1], [-42, 0])}px)`,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: "#AFC0D2",
          fontSize: 31,
          fontWeight: 500,
          marginTop: 13,
          opacity: intro,
        }}
      >
        {subtitle}
      </div>

      <div
        style={{
          backgroundColor: panelBackground,
          border: `1px solid ${withAlpha(accentColor, 0.18 + 0.22 * highlight)}`,
          borderRadius: 36,
          bottom: 88,
          boxShadow: `0 34px 90px rgba(0, 0, 0, 0.28), 0 0 ${
            56 * highlight
          }px ${withAlpha(accentColor, 0.12)}`,
          height: 635,
          left: 96,
          padding: "48px 54px 38px",
          position: "absolute",
          right: 96,
          transform: `scale(${0.97 + intro * 0.03})`,
          transformOrigin: "50% 70%",
        }}
      >
        <div
          style={{
            bottom: 86,
            left: 54,
            position: "absolute",
            right: 54,
            top: 50,
          }}
        >
          {[0, 1, 2, 3, 4].map((line) => (
            <div
              key={line}
              style={{
                backgroundColor: "rgba(169, 190, 211, 0.13)",
                height: 1,
                left: 0,
                position: "absolute",
                right: 0,
                top: `${line * 23}%`,
              }}
            />
          ))}

          <div
            style={{
              alignItems: "flex-end",
              bottom: 0,
              display: "flex",
              gap: 34,
              justifyContent: "space-evenly",
              left: 12,
              position: "absolute",
              right: 12,
              top: 0,
            }}
          >
            {bars.map((bar, index) => {
              const barProgress = interpolate(
                frame,
                [(0.38 + index * 0.09) * fps, (1.05 + index * 0.09) * fps],
                [0, 1],
                {
                  ...clamp,
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              );
              const isHighlighted = index === safeHighlightIndex;
              const barHeight = (bar.value / maxValue) * 390 * barProgress;
              const focusOpacity = isHighlighted ? 1 : 1 - highlight * 0.52;
              const numberPop = isHighlighted ? 0.78 + highlight * 0.22 : 1;

              return (
                <div
                  key={`${bar.label}-${index}`}
                  style={{
                    height: "100%",
                    maxWidth: 190,
                    minWidth: 105,
                    opacity: focusOpacity,
                    position: "relative",
                    width: `${100 / bars.length}%`,
                  }}
                >
                  <div
                    style={{
                      bottom: 64,
                      height: barHeight,
                      left: "12%",
                      position: "absolute",
                      right: "12%",
                      transform: isHighlighted
                        ? `scaleX(${1 + highlight * 0.08})`
                        : undefined,
                      transformOrigin: "bottom center",
                    }}
                  >
                    <div
                      style={{
                        background: isHighlighted
                          ? `linear-gradient(180deg, #FFF2A8 0%, ${accentColor} 45%, #F28B18 100%)`
                          : `linear-gradient(180deg, ${withAlpha(
                              bar.color,
                              1,
                            )}, ${withAlpha(bar.color, 0.62)})`,
                        borderRadius: "24px 24px 9px 9px",
                        boxShadow: isHighlighted
                          ? `0 0 ${72 * highlight * pulse}px ${withAlpha(
                              accentColor,
                              0.86,
                            )}, inset 0 2px 0 rgba(255,255,255,0.5)`
                          : "inset 0 2px 0 rgba(255,255,255,0.12)",
                        height: "100%",
                        width: "100%",
                      }}
                    />

                    <div
                      style={{
                        alignItems: "center",
                        backgroundColor: isHighlighted
                          ? accentColor
                          : "rgba(20, 39, 61, 0.96)",
                        border: isHighlighted
                          ? "2px solid rgba(255,255,255,0.7)"
                          : "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 18,
                        color: isHighlighted ? "#171B20" : "#D5E0EB",
                        display: "flex",
                        fontSize: isHighlighted ? 36 : 27,
                        fontWeight: 900,
                        height: isHighlighted ? 64 : 52,
                        justifyContent: "center",
                        left: "50%",
                        minWidth: isHighlighted ? 126 : 96,
                        opacity: barProgress,
                        padding: "0 16px",
                        position: "absolute",
                        top: isHighlighted ? -86 : -68,
                        transform: `translateX(-50%) scale(${numberPop})`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {Math.round(bar.value * barProgress)}
                      {unit}
                    </div>
                  </div>

                  <div
                    style={{
                      bottom: 12,
                      color: isHighlighted
                        ? accentColor
                        : "rgba(213, 224, 235, 0.78)",
                      fontSize: 25,
                      fontWeight: isHighlighted ? 900 : 700,
                      left: 0,
                      letterSpacing: 2.5,
                      position: "absolute",
                      right: 0,
                      textAlign: "center",
                    }}
                  >
                    {bar.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            bottom: 22,
            color: "#7890A6",
            display: "flex",
            fontSize: 19,
            fontWeight: 600,
            justifyContent: "space-between",
            left: 54,
            letterSpacing: 0.6,
            position: "absolute",
            right: 54,
          }}
        >
          <span>{source}</span>
          <span style={{ color: withAlpha(accentColor, 0.88) }}>
            SHORTSMITH · REMOTION
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
