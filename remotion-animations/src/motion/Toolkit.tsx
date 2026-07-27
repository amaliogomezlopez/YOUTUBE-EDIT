import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {useId} from "react";

export const MOTION_COLORS = {
  background: "#07111F",
  backgroundRaised: "#0D1C2B",
  surface: "#12263A",
  grid: "#243B50",
  ink: "#F4F7FB",
  muted: "#A9B8C8",
  yellow: "#FFD43B",
  cyan: "#42C7F5",
  mint: "#45E1A4",
  coral: "#FF6B78",
} as const;

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const motionProgress = (
  frame: number,
  fps: number,
  startSeconds: number,
  endSeconds: number,
  easing = Easing.bezier(0.16, 1, 0.3, 1),
) =>
  interpolate(
    frame,
    [startSeconds * fps, endSeconds * fps],
    [0, 1],
    {...clamp, easing},
  );

export const rgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character.repeat(2))
          .join("")
      : normalized;
  if (!/^[\da-f]{6}$/i.test(expanded)) {
    return `rgba(255, 212, 59, ${alpha})`;
  }
  return `rgba(${Number.parseInt(expanded.slice(0, 2), 16)}, ${Number.parseInt(
    expanded.slice(2, 4),
    16,
  )}, ${Number.parseInt(expanded.slice(4, 6), 16)}, ${alpha})`;
};

export type MotionCanvasProps = {
  title: string;
  accentColor: string;
  children: React.ReactNode;
  showHeader?: boolean;
  supportingText?: string;
};

export const MotionCanvas: React.FC<MotionCanvasProps> = ({
  title,
  accentColor,
  children,
  showHeader = true,
  supportingText,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const hasHeader = showHeader && Boolean(title || supportingText);
  const intro = motionProgress(frame, fps, 0, 0.55);
  const outro = interpolate(
    frame,
    [durationInFrames - 0.5 * fps, durationInFrames - 1],
    [1, 0],
    {
      ...clamp,
      easing: Easing.in(Easing.cubic),
    },
  );

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 52%, ${rgba(
          accentColor,
          0.055,
        )}, transparent 48%), ${MOTION_COLORS.background}`,
        color: MOTION_COLORS.ink,
        fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
        opacity: outro,
        overflow: "hidden",
      }}
    >
      {hasHeader ? (
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            left: 140,
            opacity: intro,
            position: "absolute",
            right: 140,
            textAlign: "center",
            top: 58,
            transform: `translateY(${interpolate(
              intro,
              [0, 1],
              [-18, 0],
            )}px)`,
          }}
        >
          <div
            style={{
              fontSize: 54,
              fontWeight: 850,
              letterSpacing: -1.5,
              lineHeight: 1.04,
              maxWidth: 1500,
            }}
          >
            {title}
          </div>
          {supportingText ? (
            <div
              style={{
                color: MOTION_COLORS.muted,
                fontSize: 24,
                fontWeight: 520,
                marginTop: 10,
                maxWidth: 1260,
              }}
            >
              {supportingText}
            </div>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          bottom: 58,
          left: 96,
          position: "absolute",
          right: 96,
          top: hasHeader ? (supportingText ? 214 : 170) : 56,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

export type KineticNumberProps = {
  from?: number;
  to: number;
  startSeconds: number;
  endSeconds: number;
  accentColor: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  fontSize?: number;
  label?: string;
  pulseAtSeconds?: number;
};

export const KineticNumber: React.FC<KineticNumberProps> = ({
  from = 0,
  to,
  startSeconds,
  endSeconds,
  accentColor,
  decimals = 0,
  prefix = "",
  suffix = "",
  fontSize = 176,
  label,
  pulseAtSeconds = endSeconds,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = motionProgress(
    frame,
    fps,
    startSeconds,
    endSeconds,
    Easing.bezier(0.22, 1, 0.36, 1),
  );
  const value = from + (to - from) * progress;
  const rounded =
    Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const formatted = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(rounded);
  const pulse = interpolate(
    frame,
    [
      (pulseAtSeconds - 0.18) * fps,
      pulseAtSeconds * fps,
      (pulseAtSeconds + 0.32) * fps,
    ],
    [1, 1.09, 1],
    clamp,
  );

  return (
    <div
      style={{
        color: accentColor,
        fontSize,
        fontVariantNumeric: "tabular-nums",
        fontWeight: 900,
        letterSpacing: -Math.max(2, fontSize * 0.035),
        lineHeight: 0.92,
        textAlign: "center",
        transform: `scale(${pulse})`,
      }}
    >
      <div>
        {prefix}
        {formatted}
        {suffix}
      </div>
      {label ? (
        <div
          style={{
            color: MOTION_COLORS.muted,
            fontSize: Math.max(22, fontSize * 0.16),
            fontWeight: 750,
            letterSpacing: 0.2,
            marginTop: 20,
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

export type HistogramDatum = {
  label: string;
  value: number;
  color?: string;
};

export type RisingHistogramProps = {
  data: HistogramDatum[];
  width?: number;
  height?: number;
  maxValue?: number;
  startSeconds: number;
  endSeconds: number;
  accentColor: string;
  highlightIndex?: number;
  unit?: string;
};

export const RisingHistogram: React.FC<RisingHistogramProps> = ({
  data,
  width = 760,
  height = 560,
  maxValue,
  startSeconds,
  endSeconds,
  accentColor,
  highlightIndex = data.length - 1,
  unit = "",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safeValues = data.map((item) =>
    Number.isFinite(item.value) ? Math.max(0, item.value) : 0,
  );
  const resolvedMax = Math.max(maxValue ?? 0, ...safeValues, 1);
  const left = 54;
  const top = 28;
  const baseline = height - 74;
  const plotHeight = baseline - top;
  const gap = data.length <= 2 ? 82 : 34;
  const barWidth = Math.max(
    28,
    (width - left * 2 - gap * Math.max(0, data.length - 1)) /
      Math.max(1, data.length),
  );

  return (
    <svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = baseline - plotHeight * ratio;
        return (
          <line
            key={ratio}
            stroke={rgba(MOTION_COLORS.grid, 0.72)}
            strokeWidth={2}
            x1={left}
            x2={width - left}
            y1={y}
            y2={y}
          />
        );
      })}
      <line
        stroke={MOTION_COLORS.muted}
        strokeOpacity={0.45}
        strokeWidth={2}
        x1={left}
        x2={width - left}
        y1={baseline}
        y2={baseline}
      />
      {data.map((item, index) => {
        const itemStart =
          startSeconds +
          ((endSeconds - startSeconds) * index) /
            Math.max(1, data.length * 2.5);
        const progress = motionProgress(
          frame,
          fps,
          itemStart,
          endSeconds,
          Easing.bezier(0.22, 1, 0.36, 1),
        );
        const x = left + index * (barWidth + gap);
        const barHeight =
          (safeValues[index] / resolvedMax) * plotHeight * progress;
        const y = baseline - barHeight;
        const isHighlight = index === highlightIndex;
        const color =
          item.color ??
          (isHighlight ? accentColor : rgba(MOTION_COLORS.muted, 0.45));
        const numberScale = isHighlight
          ? interpolate(progress, [0.82, 1], [0.9, 1.08], clamp)
          : 1;
        const animatedValue = safeValues[index] * progress;
        const formatted = new Intl.NumberFormat("es-ES", {
          maximumFractionDigits: 0,
        }).format(Math.round(animatedValue));

        return (
          <g key={`${item.label}-${index}`}>
            <rect
              fill={color}
              height={barHeight}
              opacity={isHighlight ? 1 : 0.72}
              rx={10}
              width={barWidth}
              x={x}
              y={y}
            />
            <text
              fill={isHighlight ? accentColor : MOTION_COLORS.ink}
              fontFamily="Inter, Segoe UI, Arial, sans-serif"
              fontSize={isHighlight ? 48 : 36}
              fontWeight={850}
              style={{
                fontVariantNumeric: "tabular-nums",
                transform: `scale(${numberScale})`,
                transformBox: "fill-box",
                transformOrigin: "center bottom",
              }}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={Math.max(32, y - 18)}
            >
              {formatted}
              {unit}
            </text>
            <text
              fill={MOTION_COLORS.muted}
              fontFamily="Inter, Segoe UI, Arial, sans-serif"
              fontSize={24}
              fontWeight={700}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={baseline + 40}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export type LineChartDatum = {
  label: string;
  value: number;
};

export type LineChartZoomProps = {
  data: LineChartDatum[];
  width?: number;
  height?: number;
  accentColor: string;
  startSeconds: number;
  endSeconds: number;
  zoomStartSeconds: number;
  zoomEndSeconds: number;
  focusIndex?: number;
  unit?: string;
  zoomScale?: number;
};

export const LineChartZoom: React.FC<LineChartZoomProps> = ({
  data,
  width = 1320,
  height = 610,
  accentColor,
  startSeconds,
  endSeconds,
  zoomStartSeconds,
  zoomEndSeconds,
  focusIndex = data.length - 1,
  unit = "",
  zoomScale = 1.85,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const clipId = `line-chart-${useId().replace(/:/g, "")}`;
  const safeData =
    data.length >= 2
      ? data.map((item) => ({
          ...item,
          value: Number.isFinite(item.value) ? item.value : 0,
        }))
      : [
          {label: "A", value: 0},
          {label: "B", value: 0},
        ];
  const values = safeData.map((item) => item.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = Math.max(1, rawMax - rawMin);
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;
  const left = 76;
  const right = 64;
  const top = 54;
  const bottom = 76;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = safeData.map((item, index) => ({
    x: left + (index / (safeData.length - 1)) * plotWidth,
    y: top + ((max - item.value) / (max - min)) * plotHeight,
  }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const draw = motionProgress(
    frame,
    fps,
    startSeconds,
    endSeconds,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const zoom = motionProgress(
    frame,
    fps,
    zoomStartSeconds,
    zoomEndSeconds,
    Easing.bezier(0.16, 1, 0.3, 1),
  );
  const safeFocusIndex = Math.min(
    Math.max(0, focusIndex),
    safeData.length - 1,
  );
  const focus = points[safeFocusIndex];
  const cameraScale = interpolate(zoom, [0, 1], [1, zoomScale], clamp);
  const focusOpacity = motionProgress(
    frame,
    fps,
    zoomStartSeconds + 0.2,
    zoomEndSeconds,
  );
  const focusValue = safeData[safeFocusIndex].value;

  return (
    <svg height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <defs>
        <clipPath id={clipId}>
          <rect
            height={plotHeight + 32}
            width={plotWidth + 56}
            x={left - 28}
            y={top - 16}
          />
        </clipPath>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = top + ratio * plotHeight;
        return (
          <line
            key={ratio}
            opacity={interpolate(zoom, [0, 1], [0.7, 0.18], clamp)}
            stroke={MOTION_COLORS.grid}
            strokeWidth={2}
            x1={left}
            x2={width - right}
            y1={y}
            y2={y}
          />
        );
      })}
      <g clipPath={`url(#${clipId})`}>
        <g
          transform={`translate(${focus.x} ${focus.y}) scale(${cameraScale}) translate(${-focus.x} ${-focus.y})`}
        >
          <path
            d={path}
            fill="none"
            pathLength={1}
            stroke={accentColor}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={7}
          />
          {points.map((point, index) => {
            const threshold = index / Math.max(1, points.length - 1);
            const opacity = interpolate(
              draw,
              [threshold - 0.08, threshold],
              [0, 1],
              clamp,
            );
            return (
              <circle
                cx={point.x}
                cy={point.y}
                fill={MOTION_COLORS.background}
                key={safeData[index].label}
                opacity={opacity}
                r={index === safeFocusIndex ? 10 : 7}
                stroke={accentColor}
                strokeWidth={5}
              />
            );
          })}
        </g>
      </g>
      {safeData.map((item, index) => (
        <text
          fill={MOTION_COLORS.muted}
          fontFamily="Inter, Segoe UI, Arial, sans-serif"
          fontSize={21}
          fontWeight={650}
          key={item.label}
          opacity={interpolate(zoom, [0, 1], [1, 0.25], clamp)}
          textAnchor="middle"
          x={points[index].x}
          y={height - 30}
        >
          {item.label}
        </text>
      ))}
      <g
        opacity={focusOpacity}
        transform={`translate(120 82) scale(${interpolate(
          focusOpacity,
          [0, 1],
          [0.9, 1],
          clamp,
        )})`}
      >
        <rect
          fill={rgba(MOTION_COLORS.background, 0.92)}
          height={124}
          rx={16}
          width={284}
          x={-24}
          y={-34}
        />
        <text
          fill={MOTION_COLORS.muted}
          fontFamily="Inter, Segoe UI, Arial, sans-serif"
          fontSize={20}
          fontWeight={700}
          textAnchor="start"
          x={0}
          y={0}
        >
          {safeData[safeFocusIndex].label}
        </text>
        <text
          fill={accentColor}
          fontFamily="Inter, Segoe UI, Arial, sans-serif"
          fontSize={64}
          fontWeight={900}
          style={{fontVariantNumeric: "tabular-nums"}}
          textAnchor="start"
          x={0}
          y={66}
        >
          {new Intl.NumberFormat("es-ES", {
            maximumFractionDigits: 1,
          }).format(focusValue)}
          {unit}
        </text>
      </g>
    </svg>
  );
};

export type SignalPathProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bend?: number;
  color: string;
  drawProgress: number;
  dotProgress?: number;
  opacity?: number;
};

export const SignalPath: React.FC<SignalPathProps> = ({
  x1,
  y1,
  x2,
  y2,
  bend = 0,
  color,
  drawProgress,
  dotProgress,
  opacity = 1,
}) => {
  const controlX = (x1 + x2) / 2;
  const controlY = (y1 + y2) / 2 + bend;
  const path = `M ${x1} ${y1} Q ${controlX} ${controlY} ${x2} ${y2}`;
  const t = Math.min(1, Math.max(0, dotProgress ?? drawProgress));
  const oneMinus = 1 - t;
  const dotX =
    oneMinus * oneMinus * x1 +
    2 * oneMinus * t * controlX +
    t * t * x2;
  const dotY =
    oneMinus * oneMinus * y1 +
    2 * oneMinus * t * controlY +
    t * t * y2;

  return (
    <g opacity={opacity}>
      <path
        d={path}
        fill="none"
        pathLength={1}
        stroke={rgba(color, 0.62)}
        strokeDasharray={1}
        strokeDashoffset={1 - drawProgress}
        strokeLinecap="round"
        strokeWidth={4}
      />
      {dotProgress === undefined ? null : (
        <>
          <circle cx={dotX} cy={dotY} fill={rgba(color, 0.18)} r={18} />
          <circle cx={dotX} cy={dotY} fill={color} r={7} />
        </>
      )}
    </g>
  );
};
