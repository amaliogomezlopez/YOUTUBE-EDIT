import {zColor} from "@remotion/zod-types";
import {z} from "zod";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FocusZoom,
  NarrativeCamera,
  ProgressiveText,
  TrackingZoom,
} from "./Effects";
import {
  MOTION_COLORS,
  clamp,
  motionProgress,
  rgba,
} from "./Toolkit";

export const transversalEffectsDemoSchema = z.object({
  longText: z.string(),
  shortText: z.string(),
  accentColor: zColor(),
  zoomScale: z.number().min(1).max(3),
  zoomMode: z.enum(["path-track", "final-punch"]),
});

export type TransversalEffectsDemoProps = z.infer<
  typeof transversalEffectsDemoSchema
>;

export const textFocusJourneySchema = z.object({
  firstText: z.string(),
  secondText: z.string(),
  accentColor: zColor(),
  maxZoomScale: z.number().min(1).max(1.6),
});

export type TextFocusJourneyProps = z.infer<
  typeof textFocusJourneySchema
>;

const DATA_POINTS = [
  {x: 270, y: 710, label: "ENE"},
  {x: 650, y: 635, label: "FEB"},
  {x: 1030, y: 510, label: "MAR"},
  {x: 1450, y: 340, label: "ABR"},
] as const;
const FOCUS_POINT = DATA_POINTS[DATA_POINTS.length - 1];

const DemoPoint: React.FC<{
  index: number;
  accentColor: string;
  drawProgress: number;
}> = ({index, accentColor, drawProgress}) => {
  const threshold = index / Math.max(1, DATA_POINTS.length - 1);
  const progress =
    index === 0
      ? interpolate(drawProgress, [0, 0.08], [0, 1], clamp)
      : interpolate(
          drawProgress,
          [Math.max(0, threshold - 0.1), threshold],
          [0, 1],
          clamp,
        );
  const point = DATA_POINTS[index];
  const isFocus = index === DATA_POINTS.length - 1;

  return (
    <g opacity={progress}>
      <circle
        cx={point.x}
        cy={point.y}
        fill={MOTION_COLORS.background}
        r={isFocus ? 18 : 13}
        stroke={isFocus ? accentColor : MOTION_COLORS.muted}
        strokeWidth={isFocus ? 8 : 5}
      />
      <text
        fill={isFocus ? accentColor : MOTION_COLORS.muted}
        fontFamily="Schibsted Grotesk"
        fontSize={25}
        fontWeight={750}
        textAnchor="middle"
        x={point.x}
        y={point.y + 58}
      >
        {point.label}
      </text>
    </g>
  );
};

export const TransversalEffectsDemo: React.FC<
  TransversalEffectsDemoProps
> = ({longText, shortText, accentColor, zoomScale, zoomMode}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = motionProgress(
    frame,
    fps,
    0.8,
    4.25,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const focus = motionProgress(frame, fps, 4.25, 5.35);
  const peersOpacity = interpolate(focus, [0, 1], [1, 0.24], clamp);
  const chartLayer = (
    <AbsoluteFill>
      <svg
        height={1080}
        style={{position: "absolute"}}
        viewBox="0 0 1920 1080"
        width={1920}
      >
        <path
          d={DATA_POINTS.map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
          ).join(" ")}
          fill="none"
          opacity={interpolate(focus, [0, 1], [1, 0.58], clamp)}
          pathLength={1}
          stroke={accentColor}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={9}
        />
        {DATA_POINTS.map((_, index) => (
          <g
            key={DATA_POINTS[index].label}
            opacity={
              index === DATA_POINTS.length - 1 ? 1 : peersOpacity
            }
          >
            <DemoPoint
              accentColor={accentColor}
              drawProgress={draw}
              index={index}
            />
          </g>
        ))}
      </svg>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 76% 45%, ${rgba(
          accentColor,
          0.09,
        )}, transparent 34%), ${MOTION_COLORS.background}`,
        color: MOTION_COLORS.ink,
        fontFamily: "Schibsted Grotesk",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          left: 96,
          position: "absolute",
          right: 96,
          top: 60,
          zIndex: 4,
        }}
      >
        <ProgressiveText
          endSeconds={2.15}
          mode="words"
          revealStyle="fade-words"
          startSeconds={0.12}
          style={{
            fontSize: 58,
            fontWeight: 850,
            letterSpacing: -1.8,
            lineHeight: 1.05,
            maxWidth: 1250,
          }}
          text={longText}
          wordFadeSeconds={0.28}
          wordOffsetY={16}
        />
      </div>

      {zoomMode === "path-track" ? (
        <TrackingZoom
          anchorX={0.53}
          anchorY={0.59}
          endScale={zoomScale}
          endSeconds={4.55}
          points={DATA_POINTS.map((point) => ({
            x: point.x / 1920,
            y: point.y / 1080,
          }))}
          startScale={1.08}
          startSeconds={0.72}
        >
          {chartLayer}
        </TrackingZoom>
      ) : (
        <FocusZoom
          anchorX={0.53}
          anchorY={0.59}
          endSeconds={5.25}
          focusX={FOCUS_POINT.x / 1920}
          focusY={FOCUS_POINT.y / 1080}
          startSeconds={4.25}
          zoomScale={zoomScale}
        >
          {chartLayer}
        </FocusZoom>
      )}

      <ProgressiveText
        endSeconds={5.5}
        mode="letters"
        startSeconds={4.65}
        style={{
          bottom: 94,
          color: accentColor,
          fontSize: 86,
          fontWeight: 920,
          letterSpacing: -2.6,
          position: "absolute",
          right: 112,
          textAlign: "right",
          zIndex: 5,
        }}
        text={shortText}
      />
    </AbsoluteFill>
  );
};

export const TextFocusJourneyDemo: React.FC<
  TextFocusJourneyProps
> = ({firstText, secondText, accentColor, maxZoomScale}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const firstTextOpacity = interpolate(
    motionProgress(frame, fps, 1.85, 2.55),
    [0, 1],
    [1, 0],
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 54%, ${rgba(
          accentColor,
          0.08,
        )}, transparent 31%), ${MOTION_COLORS.background}`,
        color: MOTION_COLORS.ink,
        fontFamily: "Schibsted Grotesk",
        overflow: "hidden",
      }}
    >
      <NarrativeCamera
        cues={[
          {
            atSeconds: 0,
            focusX: 0.28,
            focusY: 0.21,
            scale: 1,
            anchorX: 0.28,
            anchorY: 0.21,
          },
          {
            atSeconds: 0.65,
            focusX: 0.28,
            focusY: 0.21,
            scale: 1.18,
            anchorX: 0.28,
            anchorY: 0.21,
          },
          {
            atSeconds: 1.85,
            focusX: 0.28,
            focusY: 0.21,
            scale: 1.18,
            anchorX: 0.28,
            anchorY: 0.21,
          },
          {
            atSeconds: 3.15,
            focusX: 0.5,
            focusY: 0.55,
            scale: maxZoomScale,
            anchorX: 0.5,
            anchorY: 0.52,
          },
          {
            atSeconds: 5.75,
            focusX: 0.5,
            focusY: 0.55,
            scale: maxZoomScale,
            anchorX: 0.5,
            anchorY: 0.52,
          },
        ]}
      >
        <AbsoluteFill>
          <div
            style={{
              left: 132,
              maxWidth: 760,
              opacity: firstTextOpacity,
              position: "absolute",
              top: 148,
            }}
          >
            <ProgressiveText
              endSeconds={1.6}
              mode="words"
              revealStyle="fade-words"
              startSeconds={0.12}
              style={{
                fontSize: 72,
                fontWeight: 880,
                letterSpacing: -2.4,
                lineHeight: 1.03,
              }}
              text={firstText}
              wordFadeSeconds={0.3}
              wordOffsetY={18}
            />
          </div>

          <div
            style={{
              left: "50%",
              maxWidth: 860,
              position: "absolute",
              textAlign: "center",
              top: "55%",
              transform: "translate(-50%, -50%)",
              width: 860,
            }}
          >
            <ProgressiveText
              endSeconds={4.2}
              mode="words"
              revealStyle="fade-words"
              startSeconds={2.55}
              style={{
                color: accentColor,
                fontSize: 68,
                fontWeight: 900,
                letterSpacing: -2.2,
                lineHeight: 1.04,
              }}
              text={secondText}
              wordFadeSeconds={0.3}
              wordOffsetY={18}
            />
          </div>
        </AbsoluteFill>
      </NarrativeCamera>
    </AbsoluteFill>
  );
};
