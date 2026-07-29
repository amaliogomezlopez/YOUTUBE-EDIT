import {Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY as MOTION_FONT_FAMILY,
} from "../motion/fonts";
import {
  connectorEndpointAtRect,
  resolveSafeOverlayRect,
} from "./layoutSafety";
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
type ChartDatum = EditorialScene["chartData"][number];

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

const cueTimeline = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const cue = cueFor(scene, id);
  if (!cue) return 0;
  return interpolate(
    frame,
    [cue.atSeconds * fps, (cue.atSeconds + cue.durationSeconds) * fps],
    [0, 1],
    clamp,
  );
};

const pulse = (frame: number, fps: number, seconds = 1.5) =>
  0.5 + Math.sin((frame / fps / seconds) * Math.PI * 2) * 0.5;

const chartRange = (series: ChartDatum[]) => {
  const values = series.map((datum) => datum.value);
  if (!values.length) return {min: 0, max: 1};
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(1, (max - min) * 0.1);
  return {min: min - padding, max: max + padding};
};

const pointsFor = (
  series: ChartDatum[],
  plot: {left: number; right: number; top: number; bottom: number},
  range = chartRange(series),
) =>
  series
    .map((datum, index) => {
      const x =
        plot.left +
        (index / Math.max(1, series.length - 1)) * (plot.right - plot.left);
      const y =
        plot.bottom -
        ((datum.value - range.min) / Math.max(1, range.max - range.min)) *
          (plot.bottom - plot.top);
      return `${x},${y}`;
    })
    .join(" ");

const pointAt = (
  series: ChartDatum[],
  index: number,
  plot: {left: number; right: number; top: number; bottom: number},
  range = chartRange(series),
) => ({
  x:
    plot.left +
    (index / Math.max(1, series.length - 1)) * (plot.right - plot.left),
  y:
    plot.bottom -
    ((series[index]?.value ?? range.min) - range.min) /
      Math.max(1, range.max - range.min) *
      (plot.bottom - plot.top),
});

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

const AlertSignal: React.FC<{amount: number}> = ({amount}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = 1 + pulse(frame, fps, 0.62) * 0.06 * amount;
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: 112,
        justifyContent: "center",
        left: 72,
        opacity: amount,
        position: "absolute",
        top: 2,
        transform: `scale(${(0.72 + amount * 0.28) * beat})`,
        width: 112,
        zIndex: 7,
      }}
    >
      <svg height="104" viewBox="0 0 104 104" width="104">
        <circle
          cx="52"
          cy="52"
          fill="none"
          opacity={0.24 + pulse(frame, fps, 0.8) * 0.24}
          r={42 + pulse(frame, fps, 0.8) * 7}
          stroke={COLORS.white}
          strokeWidth="3"
        />
        <path
          d="M52 8 L98 91 H6 Z"
          fill={COLORS.white}
          stroke={alpha(COLORS.background, 0.28)}
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <rect
          fill={COLORS.negative}
          height="39"
          rx="5"
          width="10"
          x="47"
          y="33"
        />
        <circle cx="52" cy="81" fill={COLORS.negative} r="6" />
      </svg>
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

const MarketSeed: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const primary = scene.chartData;
  const secondary = scene.secondaryChartData;
  const combined = [...primary, ...secondary];
  const plot = {left: 190, right: 1730, top: 244, bottom: 844};
  const range = chartRange(combined);
  const reveal = cueTimeline(scene, "lines-reveal", frame, fps);
  const dots = cueEntered(scene, "two-lines", frame, fps);
  const separation = cueAmount(scene, "separation", frame, fps);
  const clipWidth = (plot.right - plot.left) * reveal;
  const clipX = (plot.left + plot.right) / 2 - clipWidth / 2;
  const middle = Math.round(primary.length * 0.5);
  const areaPoints = [
    ...primary.slice(middle).map((_, offset) => {
      const point = pointAt(primary, middle + offset, plot, range);
      return `${point.x},${point.y}`;
    }),
    ...secondary.slice(middle).reverse().map((_, reverseOffset) => {
      const index = secondary.length - 1 - reverseOffset;
      const point = pointAt(secondary, index, plot, range);
      return `${point.x},${point.y}`;
    }),
  ].join(" ");
  const seedA = pointAt(primary, middle, plot, range);
  const seedB = pointAt(secondary, middle, plot, range);

  return (
    <>
      <SectionTitle
        subtitle="Dos señales reales, normalizadas para poder compararlas"
        title="EL MERCADO EMPIEZA A SEPARARSE"
      />
      <svg height="100%" viewBox="0 0 1920 1080" width="100%">
        <defs>
          <clipPath id="seeded-lines-clip">
            <rect
              height={plot.bottom - plot.top}
              width={clipWidth}
              x={clipX}
              y={plot.top}
            />
          </clipPath>
          <filter id="seed-glow">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          fill={alpha(COLORS.surface, 0.6)}
          height={plot.bottom - plot.top}
          rx={30}
          stroke={alpha(COLORS.white, 0.1)}
          width={plot.right - plot.left}
          x={plot.left}
          y={plot.top}
        />
        <polygon
          fill={alpha(COLORS.negative, 0.22)}
          opacity={separation}
          points={areaPoints}
        />
        <g clipPath="url(#seeded-lines-clip)" filter="url(#seed-glow)">
          <polyline
            fill="none"
            points={pointsFor(primary, plot, range)}
            stroke={COLORS.gold}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={8}
          />
          <polyline
            fill="none"
            points={pointsFor(secondary, plot, range)}
            stroke={COLORS.cyan}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={8}
          />
        </g>
        {[seedA, seedB].map((point, index) => (
          <circle
            cx={point.x}
            cy={point.y}
            fill={index === 0 ? COLORS.gold : COLORS.cyan}
            key={index}
            opacity={dots}
            r={(10 + pulse(frame, fps) * 3) * dots}
            stroke={COLORS.background}
            strokeWidth={4}
          />
        ))}
        <text
          fill={COLORS.gold}
          fontFamily={DATA_FONT_FAMILY}
          fontSize={19}
          fontWeight={700}
          opacity={reveal}
          x={plot.left + 34}
          y={plot.top + 46}
        >
          S&P 500 · PRECIO
        </text>
        <text
          fill={COLORS.cyan}
          fontFamily={DATA_FONT_FAMILY}
          fontSize={19}
          fontWeight={700}
          opacity={reveal}
          x={plot.left + 34}
          y={plot.top + 78}
        >
          MAGS / SPY · FUERZA RELATIVA
        </text>
      </svg>
      <PhraseBadge
        cueId="decade"
        fallback="MÁS DE UNA DÉCADA"
        scene={scene}
        x={960}
        y={170}
        size={27}
      />
      <PhraseBadge
        cueId="two-lines"
        fallback="DOS LÍNEAS"
        scene={scene}
        x={960}
        y={830}
        size={31}
      />
      <PhraseBadge
        cueId="drastic"
        fallback="SEPARACIÓN DRÁSTICA"
        scene={scene}
        x={960}
        y={830}
        size={42}
      />
    </>
  );
};

const MiniSeries: React.FC<{
  data: ChartDatum[];
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
}> = ({data, color, x, y, width, height, opacity = 1}) => {
  const plot = {left: x, right: x + width, top: y, bottom: y + height};
  return (
    <polyline
      fill="none"
      opacity={opacity}
      points={pointsFor(data, plot)}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={7}
    />
  );
};

const MarketXray: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scan = cueTimeline(scene, "reveal", frame, fps);
  const below = cueEntered(scene, "below-surface", frame, fps);
  const first = cueEntered(scene, "first-line", frame, fps);
  const scannerX = interpolate(scan, [0, 1], [250, 1670], clamp);
  const topScale = 1 + first * 0.08;
  return (
    <>
      <SectionTitle
        subtitle="La misma pantalla cuenta dos historias distintas"
        title="SUPERFICIE / SEÑAL INTERNA"
      />
      <svg height="100%" viewBox="0 0 1920 1080" width="100%">
        <g
          transform={`translate(${960 * (1 - topScale)} ${
            380 * (1 - topScale)
          }) scale(${topScale})`}
        >
          <rect
            fill={alpha(COLORS.raised, 0.94)}
            height={250}
            rx={24}
            stroke={first ? COLORS.gold : alpha(COLORS.white, 0.14)}
            strokeWidth={first ? 3 : 1.5}
            width={1420}
            x={250}
            y={210}
          />
          <text
            fill={COLORS.gold}
            fontFamily={MOTION_FONT_FAMILY}
            fontSize={24}
            fontWeight={800}
            x={300}
            y={264}
          >
            SUPERFICIE · PRECIO S&P 500
          </text>
          <MiniSeries
            color={COLORS.gold}
            data={scene.chartData}
            height={126}
            width={1300}
            x={310}
            y={292}
          />
        </g>
        <g opacity={0.12 + below * 0.88}>
          <rect
            fill={alpha(COLORS.surface, 0.96)}
            height={286}
            rx={24}
            stroke={alpha(COLORS.cyan, 0.55)}
            strokeWidth={2}
            width={1420}
            x={250}
            y={558}
          />
          <rect
            fill={alpha(COLORS.negative, 0.12)}
            height={286}
            rx={24}
            width={1420}
            x={250}
            y={558}
          />
          <text
            fill={COLORS.cyan}
            fontFamily={MOTION_FONT_FAMILY}
            fontSize={24}
            fontWeight={800}
            x={300}
            y={612}
          >
            BAJO LA SUPERFICIE · LIDERAZGO RELATIVO
          </text>
          <MiniSeries
            color={COLORS.cyan}
            data={scene.secondaryChartData}
            height={148}
            width={1300}
            x={310}
            y={646}
          />
        </g>
        <line
          opacity={scan}
          stroke={COLORS.white}
          strokeWidth={3}
          x1={scannerX}
          x2={scannerX}
          y1={190}
          y2={870}
        />
        <rect
          fill={alpha(COLORS.white, 0.12)}
          height={680}
          opacity={scan}
          width={70}
          x={scannerX - 35}
          y={190}
        />
      </svg>
      <PhraseBadge
        cueId="reveal"
        fallback="LO QUE REVELA"
        scene={scene}
        x={960}
        y={870}
        size={30}
      />
      <PhraseBadge
        cueId="below-surface"
        fallback="BAJO LA SUPERFICIE"
        scene={scene}
        x={960}
        y={870}
        size={34}
      />
      <PhraseBadge
        cueId="first-line"
        fallback="PRIMERA LÍNEA"
        scene={scene}
        x={960}
        y={870}
        size={34}
      />
    </>
  );
};

const MarketHealth: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = scene.chartData;
  const plot = {left: 210, right: 1710, top: 226, bottom: 838};
  const range = chartRange(data);
  const correctionStart = Math.max(
    0,
    data.findIndex((datum) => datum.label >= "2026-05-28"),
  );
  const correctionEndCandidate = data.findIndex(
    (datum) => datum.label >= "2026-06-26",
  );
  const correctionEnd =
    correctionEndCandidate < 0 ? data.length - 1 : correctionEndCandidate;
  const startPoint = pointAt(data, correctionStart, plot, range);
  const endPoint = pointAt(data, correctionEnd, plot, range);
  const correction = cueEntered(scene, "corrections", frame, fps);
  const healthy = cueAmount(scene, "healthy", frame, fps);
  const firstView = cueAmount(scene, "first-view", frame, fps);
  const lineDraw = interpolate(frame, [0.2 * fps, 2.6 * fps], [0, 1], clamp);
  const cameraScale = 1 + correction * 0.18;
  const focusX = (startPoint.x + endPoint.x) / 2;
  const focusY = (startPoint.y + endPoint.y) / 2;
  const high = data[correctionStart]?.value ?? 0;
  const low = data[correctionEnd]?.value ?? high;
  const loss = high ? ((low / high - 1) * 100).toFixed(1).replace(".", ",") : "0,0";
  const yTicks = Array.from({length: 5}, (_, index) =>
    range.min + (index / 4) * (range.max - range.min),
  );
  const axisSafeZone: LayoutRect = {
    left: plot.left - 92,
    right: plot.right + 30,
    top: plot.bottom,
    bottom: plot.bottom + 76,
  };
  return (
    <>
      <SectionTitle
        subtitle="Cierre de SPY normalizado a base 100"
        title="EL PRECIO PARECE SALUDABLE"
        tone={healthy > 0.2 ? COLORS.positive : COLORS.white}
      />
      <svg height="100%" viewBox="0 0 1920 1080" width="100%">
        <defs>
          <clipPath id="health-chart-clip">
            <rect
              height={plot.bottom - plot.top}
              rx={24}
              width={plot.right - plot.left}
              x={plot.left}
              y={plot.top}
            />
          </clipPath>
        </defs>
        <rect
          fill={alpha(COLORS.surface, 0.9)}
          height={plot.bottom - plot.top}
          rx={24}
          stroke={alpha(COLORS.white, 0.14)}
          width={plot.right - plot.left}
          x={plot.left}
          y={plot.top}
        />
        {yTicks.map((tick) => {
          const y =
            plot.bottom -
            ((tick - range.min) / (range.max - range.min)) *
              (plot.bottom - plot.top);
          return (
            <g key={tick}>
              <line
                stroke={alpha(COLORS.grid, 0.8)}
                strokeWidth={1.5}
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
              />
              <text
                fill={COLORS.muted}
                fontFamily={DATA_FONT_FAMILY}
                fontSize={17}
                textAnchor="end"
                x={plot.left - 18}
                y={y + 6}
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}
        <g clipPath="url(#health-chart-clip)">
          <rect
            fill={alpha(COLORS.positive, 0.12)}
            height={plot.bottom - plot.top}
            opacity={healthy}
            width={plot.right - plot.left}
            x={plot.left}
            y={plot.top}
          />
          <g
            transform={`translate(${focusX * (1 - cameraScale)} ${
              focusY * (1 - cameraScale)
            }) scale(${cameraScale})`}
          >
            <rect
              fill={alpha(COLORS.negative, 0.2)}
              height={plot.bottom - plot.top}
              opacity={correction}
              width={Math.max(36, endPoint.x - startPoint.x)}
              x={startPoint.x}
              y={plot.top}
            />
            <polyline
              fill="none"
              pathLength={1}
              points={pointsFor(data, plot, range)}
              stroke={COLORS.gold}
              strokeDasharray="1"
              strokeDashoffset={1 - lineDraw}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={8}
            />
            <polyline
              fill="none"
              opacity={correction}
              points={pointsFor(data.slice(correctionStart, correctionEnd + 1), {
                left: startPoint.x,
                right: endPoint.x,
                top: plot.top,
                bottom: plot.bottom,
              }, range)}
              stroke={COLORS.negative}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={13}
            />
          </g>
        </g>
        {[
          {index: 0, anchor: "start" as const},
          {index: Math.round((data.length - 1) / 2), anchor: "middle" as const},
          {index: data.length - 1, anchor: "end" as const},
        ].map(({index, anchor}) => (
          <text
            fill={COLORS.muted}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            key={index}
            textAnchor={anchor}
            x={pointAt(data, index, plot, range).x}
            y={plot.bottom + 38}
          >
            {data[index]?.label.slice(0, 7)}
          </text>
        ))}
        <g opacity={correction}>
          <rect
            fill={alpha(COLORS.negative, 0.96)}
            height={82}
            rx={12}
            width={330}
            x={1265}
            y={260}
          />
          <text
            fill={COLORS.white}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={31}
            fontWeight={800}
            x={1298}
            y={310}
          >
            {loss} %
          </text>
          <text
            fill={COLORS.white}
            fontFamily={MOTION_FONT_FAMILY}
            fontSize={15}
            fontWeight={700}
            x={1452}
            y={310}
          >
            TRAMO SEÑALADO
          </text>
        </g>
      </svg>
      <PhraseBadge
        cueId="price"
        fallback="PRECIO DEL S&P 500"
        scene={scene}
        x={270}
        y={156}
        align="left"
        size={24}
      />
      <PhraseBadge
        cueId="first-view"
        avoidRects={[axisSafeZone]}
        fallback="A PRIMERA VISTA"
        scene={scene}
        x={960}
        y={830}
        size={30}
      />
      <PhraseBadge
        cueId="healthy"
        avoidRects={[axisSafeZone]}
        fallback="SALUDABLE"
        scene={scene}
        x={960}
        y={830}
        size={36}
      />
      <PhraseBadge
        cueId="corrections"
        avoidRects={[axisSafeZone]}
        fallback="CORRECCIÓN RECIENTE"
        scene={scene}
        x={960}
        y={830}
        size={36}
      />
      <div
        style={{
          background: alpha(COLORS.positive, 0.13),
          inset: 0,
          opacity: firstView * 0.35,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
    </>
  );
};

const MarketRecovery: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const data = scene.chartData;
  const end = data[data.length - 1]?.value ?? 100;
  const gain = end - 100;
  const revalued = cueEntered(scene, "revalued", frame, fps);
  const recovered = cueEntered(scene, "recovered", frame, fps);
  const highs = cueEntered(scene, "highs", frame, fps);
  const celebrate = cueAmount(scene, "celebrate", frame, fps);
  const count = interpolate(recovered, [0, 1], [0, gain], clamp);
  const arrowHeight = interpolate(revalued, [0, 1], [40, 510], clamp);
  const zoom = 1 + highs * 0.14;
  return (
    <>
      <SectionTitle
        subtitle="Cambio desde la base inicial de la serie"
        title="RECUPERACIÓN DEL ÍNDICE"
        tone={COLORS.positive}
      />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 110,
          inset: "160px 230px 90px",
          position: "absolute",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flex: 1,
            height: 620,
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              background: alpha(COLORS.positive, 0.13),
              border: `1px solid ${alpha(COLORS.positive, 0.4)}`,
              borderRadius: 30,
              height: 610,
              position: "relative",
              width: 310,
            }}
          >
            <div
              style={{
                background: `linear-gradient(180deg, ${COLORS.positive}, ${alpha(
                  COLORS.positive,
                  0.22,
                )})`,
                borderRadius: 18,
                bottom: 48,
                boxShadow: `0 0 48px ${alpha(COLORS.positive, 0.25)}`,
                height: arrowHeight,
                left: 112,
                position: "absolute",
                width: 86,
              }}
            />
            <div
              style={{
                borderBottom: `64px solid ${COLORS.positive}`,
                borderLeft: "82px solid transparent",
                borderRight: "82px solid transparent",
                left: 73,
                opacity: revalued,
                position: "absolute",
                top: 20,
              }}
            />
            <div
              style={{
                bottom: 18,
                color: COLORS.muted,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: 17,
                left: 0,
                position: "absolute",
                textAlign: "center",
                width: "100%",
              }}
            >
              BASE 100
            </div>
          </div>
        </div>
        <div style={{flex: 1.25}}>
          <div
            style={{
              color: COLORS.positive,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 132,
              fontWeight: 800,
              letterSpacing: -8,
              lineHeight: 0.9,
              transform: `scale(${zoom})`,
              transformOrigin: "left center",
            }}
          >
            +{count.toFixed(1).replace(".", ",")}%
          </div>
          <div
            style={{
              color: COLORS.white,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 42,
              fontWeight: 820,
              marginTop: 30,
            }}
          >
            {highs > 0.3 ? "ROZANDO MÁXIMOS" : "TERRENO RECUPERADO"}
          </div>
          <div
            style={{
              color: COLORS.muted,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 23,
              lineHeight: 1.45,
              marginTop: 18,
              maxWidth: 660,
            }}
          >
            SPY termina la serie en {end.toFixed(2).replace(".", ",")} puntos
            normalizados. La cifra visible procede de la misma curva.
          </div>
        </div>
      </div>
      <PhraseBadge
        cueId="revalued"
        fallback="REVALORIZADO"
        scene={scene}
        x={960}
        y={805}
        size={34}
      />
      <PhraseBadge
        cueId="recovered"
        fallback="RECUPERANDO TERRENO"
        scene={scene}
        x={960}
        y={805}
        size={34}
      />
      <PhraseBadge
        cueId="highs"
        fallback="MÁXIMOS"
        scene={scene}
        x={960}
        y={805}
        size={38}
      />
      <div
        style={{
          background: `radial-gradient(circle at 69% 50%, ${alpha(
            COLORS.positive,
            0.3,
          )}, transparent 34%)`,
          inset: 0,
          opacity: celebrate,
          position: "absolute",
        }}
      />
      <PhraseBadge
        cueId="celebrate"
        fallback="EL MERCADO LO CELEBRA"
        scene={scene}
        x={960}
        y={805}
        size={36}
      />
    </>
  );
};

const MarketContrast: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const however = cueEntered(scene, "however", frame, fps);
  const second = cueEntered(scene, "second-line", frame, fps);
  const distinct = cueAmount(scene, "distinct", frame, fps);
  const primary = scene.chartData;
  const secondary = scene.secondaryChartData;
  const primaryOpacity = 1 - second * 0.75;
  const recentIndex = Math.max(0, Math.round(secondary.length * 0.66));
  const alertActive = however > 0.08;
  return (
    <>
      <div
        style={{
          background: COLORS.negative,
          height: 116,
          left: 0,
          opacity: however,
          position: "absolute",
          right: 0,
          top: 0,
          transform: `translateY(${interpolate(however, [0, 1], [-116, 0])}px)`,
          zIndex: 4,
        }}
      />
      <AlertSignal amount={however} />
      <SectionTitle
        subtitle={
          alertActive
            ? "La fuerza relativa cuenta una historia distinta"
            : "El precio sigue cerca de máximos"
        }
        title={alertActive ? "SIN EMBARGO" : "TODO EL MUNDO LO CELEBRA"}
        tone={alertActive ? COLORS.white : COLORS.positive}
      />
      <div
        style={{
          display: "grid",
          gap: 34,
          gridTemplateColumns: "1fr 1fr",
          inset: "220px 150px 120px",
          position: "absolute",
        }}
      >
        <div
          style={{
            background: alpha(COLORS.raised, 0.94),
            border: `2px solid ${alpha(COLORS.gold, 0.45)}`,
            borderRadius: 24,
            opacity: primaryOpacity,
            padding: "34px 42px",
          }}
        >
          <div
            style={{
              color: COLORS.gold,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 26,
              fontWeight: 820,
            }}
          >
            PRIMERA LÍNEA
          </div>
          <svg height="440" viewBox="0 0 690 440" width="100%">
            <MiniSeries
              color={COLORS.gold}
              data={primary}
              height={330}
              width={610}
              x={40}
              y={55}
            />
          </svg>
        </div>
        <div
          style={{
            background: `linear-gradient(150deg, ${alpha(
              COLORS.cyan,
              0.14 + distinct * 0.11,
            )}, ${alpha(COLORS.surface, 0.96)})`,
            border: `2px solid ${alpha(COLORS.cyan, 0.55 + distinct * 0.35)}`,
            borderRadius: 24,
            boxShadow: `0 0 ${40 + distinct * 40}px ${alpha(
              COLORS.cyan,
              0.12 + distinct * 0.14,
            )}`,
            opacity: 0.2 + second * 0.8,
            padding: "34px 42px",
            transform: `scale(${0.96 + second * 0.04})`,
          }}
        >
          <div
            style={{
              color: COLORS.cyan,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 26,
              fontWeight: 820,
            }}
          >
            SEGUNDA LÍNEA
          </div>
          <svg height="440" viewBox="0 0 690 440" width="100%">
            <MiniSeries
              color={alpha(COLORS.muted, 0.55)}
              data={secondary}
              height={330}
              width={610}
              x={40}
              y={55}
            />
            <MiniSeries
              color={COLORS.negative}
              data={secondary.slice(recentIndex)}
              height={330}
              opacity={distinct}
              width={610 * (1 - recentIndex / Math.max(1, secondary.length - 1))}
              x={40 + 610 * (recentIndex / Math.max(1, secondary.length - 1))}
              y={55}
            />
          </svg>
        </div>
      </div>
      <PhraseBadge
        cueId="second-line"
        fallback="SEGUNDA LÍNEA"
        scene={scene}
        x={960}
        y={830}
        size={34}
      />
      <PhraseBadge
        cueId="distinct"
        fallback="ALGO MUY DISTINTO"
        scene={scene}
        x={960}
        y={830}
        size={38}
      />
    </>
  );
};

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const Mag7Relationship: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const logos = cueEntered(scene, "seven", frame, fps);
  const relation = cueEntered(scene, "relationship", frame, fps);
  const labels = scene.labels.slice(0, 7);
  const cardScale = 0.9 + relation * 0.1;
  const targetRect: LayoutRect = {
    left: 960 - 250 * cardScale,
    right: 960 + 250 * cardScale,
    top: 585 - 85 * cardScale,
    bottom: 585 + 85 * cardScale,
  };
  return (
    <>
      <SectionTitle
        subtitle="Las siete compañías se comparan como grupo frente al índice"
        title="LOS SIETE MAGNÍFICOS"
      />
      <div
        style={{
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(7, 1fr)",
          left: 110,
          position: "absolute",
          right: 110,
          top: 190,
        }}
      >
        {labels.map((label, index) => {
          const asset = scene.assets.find(
            (candidate) =>
              candidate.kind === "logo" &&
              normalize(candidate.label) === normalize(label),
          );
          const itemReveal = interpolate(
            logos,
            [Math.min(0.82, index * 0.1), Math.min(1, 0.34 + index * 0.1)],
            [0, 1],
            clamp,
          );
          return (
            <div
              key={label}
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: itemReveal,
                transform: `translateY(${(1 - itemReveal) * -34}px)`,
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  background: alpha(COLORS.raised, 0.96),
                  border: `1px solid ${alpha(COLORS.white, 0.16)}`,
                  borderRadius: 18,
                  display: "flex",
                  height: 102,
                  justifyContent: "center",
                  width: 118,
                }}
              >
                {asset ? (
                  <Img
                    src={staticFile(asset.path)}
                    style={{height: 68, objectFit: "contain", width: 78}}
                  />
                ) : (
                  <span
                    style={{
                      color: COLORS.white,
                      fontFamily: MOTION_FONT_FAMILY,
                      fontSize: 42,
                      fontWeight: 900,
                    }}
                  >
                    {label.slice(0, 1)}
                  </span>
                )}
              </div>
              <span
                style={{
                  color: COLORS.white,
                  fontFamily: MOTION_FONT_FAMILY,
                  fontSize: 16,
                  fontWeight: 760,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <svg
        height="100%"
        style={{inset: 0, position: "absolute"}}
        viewBox="0 0 1920 1080"
        width="100%"
      >
        {labels.map((label, index) => {
          const x = 169 + index * 263.5;
          const source = {x, y: 350};
          const endpoint = connectorEndpointAtRect({
            source,
            target: targetRect,
            gap: 5,
          });
          return (
            <line
              key={label}
              opacity={relation}
              stroke={alpha(COLORS.cyan, 0.66)}
              strokeDasharray="8 8"
              strokeWidth={2.5}
              x1={source.x}
              x2={endpoint.x}
              y1={source.y}
              y2={endpoint.y}
            />
          );
        })}
      </svg>
      <div
        style={{
          alignItems: "center",
          background: alpha(COLORS.cyan, 0.15),
          border: `2px solid ${COLORS.cyan}`,
          borderRadius: 22,
          display: "flex",
          flexDirection: "column",
          height: 170,
          justifyContent: "center",
          left: 710,
          opacity: relation,
          position: "absolute",
          top: 500,
          transform: `scale(${0.9 + relation * 0.1})`,
          width: 500,
        }}
      >
        <div
          style={{
            color: COLORS.cyan,
            fontFamily: DATA_FONT_FAMILY,
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          MAGS / SPY
        </div>
        <div
          style={{
            color: COLORS.white,
            fontFamily: MOTION_FONT_FAMILY,
            fontSize: 19,
            fontWeight: 700,
            marginTop: 8,
          }}
        >
          RELACIÓN DE RENDIMIENTO · BASE 100
        </div>
      </div>
      <div
        style={{
          bottom: 274,
          color: COLORS.muted,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 16,
          left: 300,
          letterSpacing: 1,
          opacity: relation,
          position: "absolute",
        }}
      >
        S&P 500 · UNIVERSO DE REFERENCIA
      </div>
      <div
        style={{
          background: alpha(COLORS.surface, 0.92),
          border: `1px solid ${alpha(COLORS.white, 0.14)}`,
          borderRadius: 24,
          bottom: 112,
          display: "grid",
          gap: 7,
          gridTemplateColumns: "repeat(25, 1fr)",
          height: 150,
          left: 300,
          opacity: relation,
          padding: 24,
          position: "absolute",
          right: 300,
        }}
      >
        {Array.from({length: 100}, (_, index) => (
          <div
            key={index}
            style={{
              background: alpha(COLORS.muted, 0.36),
              borderRadius: 3,
            }}
          />
        ))}
      </div>
      <PhraseBadge
        cueId="seven"
        fallback="SIETE EMPRESAS"
        scene={scene}
        x={960}
        y={390}
        size={31}
      />
      <PhraseBadge
        cueId="relationship"
        fallback="EN RELACIÓN CON EL MERCADO"
        scene={scene}
        x={960}
        y={690}
        size={31}
      />
    </>
  );
};

const ClaimAudit: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loss = cueEntered(scene, "lost", frame, fps);
  const verified = cueEntered(scene, "verified", frame, fps);
  const strange = cueAmount(scene, "strange", frame, fps);
  const verifiedValue = scene.metric?.value ?? -10.4;
  const narratedReference = -20;
  const percentagePointGap = Math.abs(
    narratedReference - verifiedValue,
  ).toFixed(1).replace(".", ",");
  const verifiedCue = cueFor(scene, "verified");
  const scanCycle = verifiedCue
    ? Math.max(0, ((frame / fps - verifiedCue.atSeconds) % 2.2) / 2.2)
    : 0;
  return (
    <>
      <SectionTitle
        subtitle="Mismo cociente, mismo máximo de referencia y misma fecha de cierre"
        title="LA SERIE DISPONIBLE NO CONFIRMA LA CIFRA"
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
            MÉTODO DE COMPARACIÓN
          </div>
          <div
            style={{
              color: COLORS.gold,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 92,
              fontWeight: 800,
              letterSpacing: -5,
              lineHeight: 1,
              marginTop: 42,
              opacity: loss,
            }}
          >
            MAGS ÷ SPY
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
            Rendimiento relativo del grupo frente al índice, no caída del
            precio aislado.
          </div>
          <div
            style={{
              borderTop: `1px solid ${alpha(COLORS.white, 0.18)}`,
              color: COLORS.muted,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 18,
              lineHeight: 1.5,
              marginTop: 34,
              opacity: loss,
              paddingTop: 24,
            }}
          >
            VENTANA AUDITADA
            <br />
            <span style={{color: COLORS.white}}>
              29 OCT 2025 → 17 JUL 2026
            </span>
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
            RESULTADO REPRODUCIBLE
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
          background: alpha(COLORS.cyan, 0.17),
          border: `1px solid ${alpha(COLORS.cyan, 0.72)}`,
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
          opacity: strange,
          padding: "18px 28px",
          position: "absolute",
          right: 420,
        }}
      >
        <span style={{fontFamily: DATA_FONT_FAMILY, fontSize: 34}}>Δ</span>
        DESVÍO FRENTE AL 20 % CITADO: {percentagePointGap} PUNTOS PORCENTUALES
      </div>
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
  if (scene.kind === "market-seed") return <MarketSeed scene={scene} />;
  if (scene.kind === "market-xray") return <MarketXray scene={scene} />;
  if (scene.kind === "market-health") return <MarketHealth scene={scene} />;
  if (scene.kind === "market-recovery") return <MarketRecovery scene={scene} />;
  if (scene.kind === "market-contrast") return <MarketContrast scene={scene} />;
  if (scene.kind === "mag7-relationship") {
    return <Mag7Relationship scene={scene} />;
  }
  return <ClaimAudit scene={scene} />;
};
