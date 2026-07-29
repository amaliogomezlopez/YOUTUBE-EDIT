import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY as MOTION_FONT_FAMILY,
} from "../motion/fonts";
import {resolveSafeOverlayRect} from "./layoutSafety";
import type {LayoutRect} from "./layoutSafety";
import {EditorialScene} from "./schemas";

const COLORS = {
  background: "#050817",
  surface: "#0C1226",
  raised: "#121B34",
  white: "#FFF9E8",
  muted: "#A9A9B8",
  grid: "#28324B",
  gold: "#FFC83D",
  cyan: "#6ED4FF",
  positive: "#49C98A",
  negative: "#FF5F6D",
} as const;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

type CueTone = EditorialScene["semanticCues"][number]["tone"];

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
};

const toneColor = (tone: CueTone) => {
  if (tone === "gold") return COLORS.gold;
  if (tone === "cyan") return COLORS.cyan;
  if (tone === "positive") return COLORS.positive;
  if (tone === "negative") return COLORS.negative;
  return COLORS.white;
};

const cueFor = (scene: EditorialScene, id: string) =>
  scene.semanticCues.find((cue) => cue.id === id);

const cueAmount = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const cue = cueFor(scene, id);
  if (!cue) return 0;
  const start = cue.atSeconds * fps;
  const enterEnd = start + Math.min(0.36, cue.durationSeconds * 0.35) * fps;
  const enter = interpolate(frame, [start, enterEnd], [0, 1], clamp);
  if (cue.persist) return enter;
  const end = (cue.atSeconds + cue.durationSeconds) * fps;
  const exitStart = Math.max(enterEnd, end - Math.min(0.28, cue.durationSeconds * 0.28) * fps);
  const exit = interpolate(frame, [exitStart, end], [1, 0], clamp);
  return Math.min(enter, exit);
};

const cueEntered = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const cue = cueFor(scene, id);
  if (!cue) return 0;
  return interpolate(
    frame,
    [cue.atSeconds * fps, (cue.atSeconds + 0.42) * fps],
    [0, 1],
    clamp,
  );
};

const PhraseBadge: React.FC<{
  scene: EditorialScene;
  cueId: string;
  fallback: string;
  x?: number;
  y?: number;
  align?: "left" | "center" | "right";
  size?: number;
  avoidRects?: readonly LayoutRect[];
}> = ({
  scene,
  cueId,
  fallback,
  x = 960,
  y = 90,
  align = "center",
  size = 38,
  avoidRects = [],
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cue = cueFor(scene, cueId);
  const amount = cueAmount(scene, cueId, frame, fps);
  const color = toneColor(cue?.tone ?? "neutral");
  const label = cue?.label ?? fallback;
  const estimatedWidth = Math.max(132, label.length * size * 0.59 + 44);
  const estimatedHeight = size + 34;
  const preferredLeft =
    align === "center"
      ? x - estimatedWidth / 2
      : align === "right"
        ? x - estimatedWidth
        : x;
  const placement = resolveSafeOverlayRect({
    preferred: {
      left: preferredLeft,
      right: preferredLeft + estimatedWidth,
      top: y,
      bottom: y + estimatedHeight,
    },
    avoid: avoidRects,
  });
  return (
    <div
      style={{
        background: alpha(color, cue?.tone === "negative" ? 0.94 : 0.18),
        border: `1px solid ${alpha(color, 0.72)}`,
        borderRadius: 10,
        boxShadow: `0 0 34px ${alpha(color, amount * 0.22)}`,
        color: cue?.tone === "negative" ? COLORS.white : color,
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: size,
        fontWeight: 850,
        left: placement.left,
        letterSpacing: -1,
        opacity: amount,
        padding: "12px 22px 14px",
        position: "absolute",
        textAlign: align,
        top: placement.top,
        transform: `scale(${0.94 + amount * 0.06})`,
        transformOrigin: align,
        whiteSpace: "nowrap",
        zIndex: 8,
      }}
    >
      {label}
    </div>
  );
};

const SectionTitle: React.FC<{
  title: string;
  subtitle: string;
  tone?: string;
}> = ({title, subtitle, tone = COLORS.white}) => (
  <div
    style={{
      left: 150,
      position: "absolute",
      right: 150,
      textAlign: "center",
      top: 54,
      zIndex: 4,
    }}
  >
    <div
      style={{
        color: tone,
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: 44,
        fontWeight: 850,
        letterSpacing: -1.5,
      }}
    >
      {title}
    </div>
    <div
      style={{
        color: COLORS.muted,
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: 20,
        fontWeight: 560,
        marginTop: 8,
      }}
    >
      {subtitle}
    </div>
  </div>
);

const ClaimAudit: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loss = cueEntered(scene, "lost", frame, fps);
  const twenty = cueEntered(scene, "twenty", frame, fps);
  const verified = cueEntered(scene, "verified", frame, fps);
  const strange = cueAmount(scene, "strange", frame, fps);
  const verifiedValue = scene.metric?.value ?? -10.4;
  const verifiedCue = cueFor(scene, "verified");
  const scanCycle = verifiedCue
    ? Math.max(0, ((frame / fps - verifiedCue.atSeconds) % 2.2) / 2.2)
    : 0;
  return (
    <>
      <SectionTitle
        subtitle="La locución y la métrica deben definir el mismo universo y periodo"
        title="CONTROL DE COHERENCIA"
        tone={COLORS.negative}
      />
      <div
        style={{
          alignItems: "stretch",
          display: "grid",
          gap: 42,
          gridTemplateColumns: "1fr 1fr",
          left: 190,
          position: "absolute",
          right: 190,
          top: 250,
        }}
      >
        <div
          style={{
            background: alpha(COLORS.negative, 0.17),
            border: `2px solid ${alpha(COLORS.negative, 0.82)}`,
            borderRadius: 26,
            minHeight: 430,
            opacity: loss,
            padding: "38px 46px",
          }}
        >
          <div
            style={{
              color: COLORS.muted,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 20,
              fontWeight: 760,
            }}
          >
            LOCUCIÓN
          </div>
          <div
            style={{
              background: COLORS.negative,
              borderRadius: 16,
              color: COLORS.white,
              display: "inline-block",
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 126,
              fontWeight: 800,
              letterSpacing: -8,
              lineHeight: 1,
              marginTop: 42,
              opacity: twenty,
              padding: "18px 28px 24px",
            }}
          >
            −20%
          </div>
          <div
            style={{
              color: COLORS.white,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 22,
              fontWeight: 650,
              lineHeight: 1.35,
              marginTop: 30,
            }}
          >
            “cerca de un 20% de su valor relativo”
          </div>
        </div>
        <div
          style={{
            background: alpha(COLORS.cyan, 0.13),
            border: `2px solid ${alpha(COLORS.cyan, 0.82)}`,
            borderRadius: 26,
            minHeight: 430,
            opacity: verified,
            overflow: "hidden",
            padding: "38px 46px",
            position: "relative",
            transform: `scale(${0.94 + verified * 0.06})`,
          }}
        >
          <div
            style={{
              background: `linear-gradient(90deg, transparent, ${alpha(
                COLORS.cyan,
                0.18,
              )}, transparent)`,
              bottom: 0,
              left: `${scanCycle * 110 - 10}%`,
              opacity: verified,
              position: "absolute",
              top: 0,
              width: "18%",
            }}
          />
          <div
            style={{
              color: COLORS.muted,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 20,
              fontWeight: 760,
              position: "relative",
            }}
          >
            SERIE REPRODUCIBLE ACTUAL
          </div>
          <div
            style={{
              color: COLORS.cyan,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 126,
              fontWeight: 800,
              letterSpacing: -8,
              lineHeight: 1,
              marginTop: 58,
              position: "relative",
            }}
          >
            {verifiedValue.toFixed(1).replace(".", ",")}%
          </div>
          <div
            style={{
              color: COLORS.white,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 20,
              fontWeight: 650,
              lineHeight: 1.42,
              marginTop: 32,
              position: "relative",
            }}
          >
            MAGS/SPY · desde el máximo relativo del 29 OCT 2025 al 17 JUL
            2026
          </div>
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          background: alpha(COLORS.negative, 0.94),
          borderRadius: 14,
          bottom: 115,
          color: COLORS.white,
          display: "flex",
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: 26,
          fontWeight: 850,
          gap: 18,
          justifyContent: "center",
          left: 420,
          opacity: verified,
          padding: "18px 28px",
          position: "absolute",
          right: 420,
        }}
      >
        <span style={{fontFamily: DATA_FONT_FAMILY, fontSize: 34}}>≠</span>
        REGRABAR O CONSEGUIR LA SERIE EXACTA
      </div>
      <PhraseBadge
        cueId="lost"
        fallback="HAN PERDIDO"
        scene={scene}
        x={960}
        y={180}
        size={31}
      />
      <PhraseBadge
        cueId="twenty"
        fallback="20% EN LA LOCUCIÓN"
        scene={scene}
        x={960}
        y={180}
        size={34}
      />
      <PhraseBadge
        cueId="strange"
        fallback="SUMAMENTE EXTRAÑO"
        scene={scene}
        x={960}
        y={180}
        size={38}
      />
      <div
        style={{
          border: `4px solid ${COLORS.negative}`,
          borderRadius: 34,
          inset: 24,
          opacity: strange,
          position: "absolute",
        }}
      />
    </>
  );
};

export const MarketNarrativeScene: React.FC<{
  scene: EditorialScene;
}> = ({scene}) => {
  // Único kind que sigue aquí: FC-R `comparison.before-after-wipe` exige dos
  // capturas comparables y la escena solo aporta cifras auditadas.
  return <ClaimAudit scene={scene} />;
};
