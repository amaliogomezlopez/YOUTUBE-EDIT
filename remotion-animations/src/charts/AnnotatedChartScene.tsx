import {zColor} from "@remotion/zod-types";
import React, {useId} from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {z} from "zod";
import {FocusZoom} from "../motion/Effects";
import {
  SOUND_FILES,
  SoundCue,
  Soundtrack,
} from "../motion/SoundDesign";
import {
  MOTION_COLORS,
  MotionCanvas,
  clamp,
  motionProgress,
  rgba,
} from "../motion/Toolkit";
import {ManagedImage} from "../visuals/ManagedImage";
import {
  artDirectionSchema,
  getArtDirectionProfile,
} from "../motion/ArtDirection";
import {DATA_FONT_FAMILY, MOTION_FONT_FAMILY} from "../motion/fonts";
import {
  createLinePath,
  exactSeriesDatum,
  interpolateIsoDate,
  interpolateSeriesValue,
  mapChartPoint,
  mapDateToX,
  mapSeriesToPoints,
  nearestSeriesDatum,
  parseIsoDate,
  percentageChange,
} from "./chart-geometry.mjs";

const plotRegionSchema = z.object({
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
});

const chartImageSchema = z.object({
  publicPath: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  plotRegion: plotRegionSchema,
});

const dateAxisSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const valueAxisSchema = z.object({
  min: z.number(),
  max: z.number(),
  unit: z.string(),
  decimals: z.number().int().min(0).max(4),
});

const seriesDatumSchema = z.object({
  date: z.string(),
  value: z.number(),
});

const timedAnnotation = {
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  hideAtSeconds: z.number().positive().optional(),
};

const lineRetraceAnnotationSchema = z.object({
  type: z.literal("line-retrace"),
  label: z.string().optional(),
  ...timedAnnotation,
});

const rangeHighlightAnnotationSchema = z.object({
  type: z.literal("range-highlight"),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  color: zColor().optional(),
  ...timedAnnotation,
});

const cursorJourneyAnnotationSchema = z.object({
  type: z.literal("cursor-journey"),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  ...timedAnnotation,
});

const peakToTroughAnnotationSchema = z.object({
  type: z.literal("peak-to-trough"),
  peakDate: z.string(),
  troughDate: z.string(),
  label: z.string().optional(),
  ...timedAnnotation,
});

const beforeAfterAnnotationSchema = z.object({
  type: z.literal("before-after"),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  ...timedAnnotation,
});

const eventMarkerAnnotationSchema = z.object({
  type: z.literal("event-marker"),
  date: z.string(),
  value: z.number().optional(),
  label: z.string(),
  color: zColor().optional(),
  ...timedAnnotation,
});

export const chartAnnotationSchema = z.discriminatedUnion("type", [
  lineRetraceAnnotationSchema,
  rangeHighlightAnnotationSchema,
  cursorJourneyAnnotationSchema,
  peakToTroughAnnotationSchema,
  beforeAfterAnnotationSchema,
  eventMarkerAnnotationSchema,
]);

const chartCameraSchema = z.object({
  enabled: z.boolean(),
  focusDate: z.string(),
  focusValue: z.number(),
  startSeconds: z.number().min(0),
  endSeconds: z.number().positive(),
  zoomScale: z.number().min(1).max(3),
});

export const annotatedChartSchema = z.object({
  title: z.string(),
  supportingText: z.string().optional(),
  showHeader: z.boolean().optional(),
  source: z.string(),
  image: chartImageSchema,
  xAxis: dateAxisSchema,
  yAxis: valueAxisSchema,
  series: z.array(seriesDatumSchema),
  annotations: z.array(chartAnnotationSchema).min(1).max(12),
  camera: chartCameraSchema,
  accentColor: zColor(),
  dangerColor: zColor(),
  soundEnabled: z.boolean(),
  soundMix: z.number().min(0).max(1),
  artDirection: artDirectionSchema.optional(),
});

export type ChartAnnotation = z.infer<typeof chartAnnotationSchema>;
export type AnnotatedChartProps = z.infer<typeof annotatedChartSchema>;

const annotationNeedsSeries = (annotation: ChartAnnotation) =>
  annotation.type === "line-retrace" ||
  annotation.type === "cursor-journey" ||
  annotation.type === "peak-to-trough" ||
  annotation.type === "before-after" ||
  (annotation.type === "event-marker" && annotation.value === undefined);

const sampleSeries = [
  {date: "2025-01-02", value: 100},
  {date: "2025-02-03", value: 104.2},
  {date: "2025-03-03", value: 108.1},
  {date: "2025-04-01", value: 111.8},
  {date: "2025-05-01", value: 103.6},
  {date: "2025-06-02", value: 105.8},
  {date: "2025-07-01", value: 109.2},
  {date: "2025-08-01", value: 114.7},
  {date: "2025-09-02", value: 118.3},
  {date: "2025-10-01", value: 116.5},
  {date: "2025-11-03", value: 122.8},
  {date: "2025-12-01", value: 126.4},
];

const sampleImage = {
  publicPath: "assets/library/chart-samples/demo-index-2025.png",
  alt: "Gráfica sintética de un índice de demostración durante 2025",
  width: 1700,
  height: 760,
  plotRegion: {x: 120, y: 70, width: 1460, height: 570},
};

const sampleXAxis = {
  start: "2025-01-01",
  end: "2025-12-31",
};

const sampleYAxis = {
  min: 95,
  max: 130,
  unit: "",
  decimals: 1,
};

export const defaultAnnotatedChartProps = {
  title: "Dos meses concentran toda la caída",
  supportingText:
    "La imagen conserva su estilo; la serie fija fechas y valores exactos.",
  showHeader: true,
  source: "SERIE SINTÉTICA PARA QA · NO USAR COMO DATO EDITORIAL",
  image: sampleImage,
  xAxis: sampleXAxis,
  yAxis: sampleYAxis,
  series: sampleSeries,
  annotations: [
    {
      type: "line-retrace",
      label: "Recorrido anual",
      startSeconds: 0.25,
      endSeconds: 2.2,
    },
    {
      type: "range-highlight",
      from: "2025-04-01",
      to: "2025-05-01",
      label: "ABR → MAY",
      startSeconds: 1.8,
      endSeconds: 2.8,
    },
    {
      type: "cursor-journey",
      from: "2025-04-01",
      to: "2025-05-01",
      label: "Caída",
      startSeconds: 2.5,
      endSeconds: 4.9,
      hideAtSeconds: 5.45,
    },
    {
      type: "peak-to-trough",
      peakDate: "2025-04-01",
      troughDate: "2025-05-01",
      label: "Máximo → mínimo",
      startSeconds: 4.7,
      endSeconds: 5.9,
    },
  ],
  camera: {
    enabled: true,
    focusDate: "2025-04-16",
    focusValue: 107.5,
    startSeconds: 5.7,
    endSeconds: 6.8,
    zoomScale: 1.85,
  },
  accentColor: "#42C7F5",
  dangerColor: "#FF6B78",
  soundEnabled: false,
  soundMix: 0.65,
  artDirection: "diagrammatic-system",
} satisfies AnnotatedChartProps;

export const eventAnnotatedChartProps = {
  ...defaultAnnotatedChartProps,
  title: "El año termina por encima del punto de partida",
  supportingText:
    "Eventos, comparación y variación se calculan sobre la misma calibración.",
  annotations: [
    {
      type: "line-retrace",
      startSeconds: 0.25,
      endSeconds: 2.4,
    },
    {
      type: "event-marker",
      date: "2025-04-01",
      value: 111.8,
      label: "Máximo local",
      startSeconds: 1.8,
      endSeconds: 2.7,
    },
    {
      type: "event-marker",
      date: "2025-05-01",
      value: 103.6,
      label: "Corrección",
      color: "#FF6B78",
      startSeconds: 2.6,
      endSeconds: 3.5,
    },
    {
      type: "before-after",
      from: "2025-01-02",
      to: "2025-12-01",
      label: "Balance anual",
      startSeconds: 3.7,
      endSeconds: 5.8,
      hideAtSeconds: 5.7,
    },
    {
      type: "event-marker",
      date: "2025-12-01",
      value: 126.4,
      label: "Cierre anual",
      color: "#45E1A4",
      startSeconds: 5.65,
      endSeconds: 6.55,
    },
  ],
  camera: {
    enabled: true,
    focusDate: "2025-11-18",
    focusValue: 124.5,
    startSeconds: 5.8,
    endSeconds: 7,
    zoomScale: 1.55,
  },
  soundEnabled: false,
  artDirection: "market-data",
} satisfies AnnotatedChartProps;

export const imageOnlyAnnotatedChartProps = {
  ...defaultAnnotatedChartProps,
  title: "",
  supportingText: undefined,
  showHeader: false,
  series: [],
  annotations: [
    {
      type: "range-highlight",
      from: "2025-04-01",
      to: "2025-05-01",
      label: "ABR → MAY",
      startSeconds: 0.35,
      endSeconds: 1.4,
    },
  ],
  camera: {
    enabled: true,
    focusDate: "2025-04-16",
    focusValue: 107.5,
    startSeconds: 2.7,
    endSeconds: 3.8,
    zoomScale: 1.85,
  },
  soundEnabled: false,
  artDirection: "documentary-evidence",
} satisfies AnnotatedChartProps;

export const editorialAnnotatedChartProps = {
  ...defaultAnnotatedChartProps,
  artDirection: "editorial-report",
  title: "La corrección se concentra en un solo tramo",
  supportingText: "Lectura editorial sobre datos observados.",
} satisfies AnnotatedChartProps;

export const documentaryAnnotatedChartProps = {
  ...defaultAnnotatedChartProps,
  artDirection: "documentary-evidence",
  title: "El tramo observado",
  supportingText: undefined,
} satisfies AnnotatedChartProps;

export const marketAnnotatedChartProps = {
  ...eventAnnotatedChartProps,
  artDirection: "market-data",
  title: "Balance anual del índice",
  supportingText: "DATOS OBSERVADOS · 2025",
} satisfies AnnotatedChartProps;

const formatValue = (
  value: number,
  yAxis: AnnotatedChartProps["yAxis"],
) =>
  `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: yAxis.decimals,
    minimumFractionDigits: yAxis.decimals,
  }).format(value)}${yAxis.unit}`;

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(parseIsoDate(date)))
    .replace(".", "")
    .toUpperCase();

const annotationState = (
  annotation: ChartAnnotation,
  frame: number,
  fps: number,
) => {
  const progress = motionProgress(
    frame,
    fps,
    annotation.startSeconds,
    annotation.endSeconds,
    Easing.bezier(0.16, 1, 0.3, 1),
  );
  const exit = annotation.hideAtSeconds
    ? motionProgress(
        frame,
        fps,
        annotation.hideAtSeconds,
        annotation.hideAtSeconds + 0.35,
        Easing.in(Easing.cubic),
      )
    : 0;
  return {progress, opacity: progress * (1 - exit)};
};

const chartSoundCues = (
  annotations: ChartAnnotation[],
): SoundCue[] => {
  const firstLine = annotations.find(
    (annotation) => annotation.type === "line-retrace",
  );
  const range = annotations.find(
    (annotation) => annotation.type === "range-highlight",
  );
  const cursor = annotations.find(
    (annotation) => annotation.type === "cursor-journey",
  );
  const conclusion = annotations.find(
    (annotation) =>
      annotation.type === "peak-to-trough" ||
      annotation.type === "before-after",
  );
  const cues: SoundCue[] = [];
  if (firstLine) {
    cues.push({
      file: SOUND_FILES.riseWhoosh,
      startSeconds: firstLine.startSeconds,
      durationSeconds: 0.78,
      volume: 0.86,
      attackSeconds: 0.03,
      releaseSeconds: 0.2,
    });
  }
  if (range) {
    cues.push({
      file: SOUND_FILES.uiPulse,
      startSeconds: range.endSeconds - 0.08,
      durationSeconds: 0.22,
      volume: 0.92,
    });
  }
  if (cursor) {
    cues.push({
      file: SOUND_FILES.dataTick,
      startSeconds: cursor.endSeconds - 0.05,
      durationSeconds: 0.18,
      volume: 0.88,
    });
  }
  if (conclusion) {
    cues.push({
      file: SOUND_FILES.softImpact,
      startSeconds: conclusion.endSeconds - 0.1,
      durationSeconds: 0.58,
      volume: 0.94,
    });
  }
  return cues;
};

const SvgLabel: React.FC<{
  x: number;
  y: number;
  width: number;
  label: string;
  value?: string;
  color: string;
  opacity: number;
  align?: "start" | "middle" | "end";
  styleVariant: "leader" | "evidence" | "terminal";
}> = ({
  x,
  y,
  width,
  label,
  value,
  color,
  opacity,
  align = "middle",
  styleVariant,
}) => {
  const left = align === "middle" ? x - width / 2 : align === "end" ? x - width : x;
  const isLeader = styleVariant === "leader";
  const isTerminal = styleVariant === "terminal";
  return (
    <g opacity={opacity} transform={`translate(${left} ${y})`}>
      <rect
        fill={isLeader ? "rgba(5, 17, 29, .84)" : "rgba(5, 17, 29, .94)"}
        height={value ? 76 : 48}
        rx={isLeader || isTerminal ? 0 : 4}
        stroke={isLeader ? "none" : rgba(color, isTerminal ? 0.45 : 0.64)}
        strokeWidth={isLeader ? 0 : 2}
        width={width}
      />
      {isLeader ? (
        <rect fill={color} height={value ? 76 : 48} width="4" />
      ) : null}
      <text
        fill={value ? MOTION_COLORS.muted : MOTION_COLORS.ink}
        fontFamily={isTerminal ? DATA_FONT_FAMILY : MOTION_FONT_FAMILY}
        fontSize={value ? 17 : 18}
        fontWeight="750"
        textAnchor="middle"
        x={width / 2}
        y={value ? 25 : 30}
      >
        {label}
      </text>
      {value ? (
        <text
          fill={color}
          fontFamily={DATA_FONT_FAMILY}
          fontSize="28"
          fontWeight="900"
          style={{fontVariantNumeric: "tabular-nums"}}
          textAnchor="middle"
          x={width / 2}
          y="59"
        >
          {value}
        </text>
      ) : null}
    </g>
  );
};

const ChartAnnotationLayer: React.FC<
  Pick<
    AnnotatedChartProps,
    | "image"
    | "xAxis"
    | "yAxis"
    | "series"
    | "annotations"
    | "accentColor"
    | "dangerColor"
    | "artDirection"
  >
> = ({
  image,
  xAxis,
  yAxis,
  series,
  annotations,
  accentColor,
  dangerColor,
  artDirection = "diagrammatic-system",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const maskId = `chart-mask-${useId().replace(/:/g, "")}`;
  const profile = getArtDirectionProfile(artDirection);
  const points =
    series.length >= 2
      ? mapSeriesToPoints(series, xAxis, yAxis, image.plotRegion)
      : [];
  const linePath = points.length >= 2 ? createLinePath(points) : "";
  const range = annotations.find(
    (annotation) => annotation.type === "range-highlight",
  );
  const rangeState = range ? annotationState(range, frame, fps) : null;
  const rangeStartX = range
    ? mapDateToX(range.from, xAxis, image.plotRegion)
    : 0;
  const rangeEndX = range
    ? mapDateToX(range.to, xAxis, image.plotRegion)
    : 0;
  const visibleRangeWidth =
    Math.max(0, rangeEndX - rangeStartX) * (rangeState?.progress ?? 0);

  return (
    <svg
      height={image.height}
      viewBox={`0 0 ${image.width} ${image.height}`}
      width={image.width}
      style={{left: 0, overflow: "visible", position: "absolute", top: 0}}
    >
      <defs>
        <mask id={maskId}>
          <rect fill="white" height={image.height} width={image.width} />
          {range ? (
            <rect
              fill="black"
              height={image.plotRegion.height + 26}
              rx="10"
              width={visibleRangeWidth}
              x={rangeStartX}
              y={image.plotRegion.y - 13}
            />
          ) : null}
        </mask>
      </defs>

      {annotations
        .filter((annotation) => annotation.type === "line-retrace")
        .map((annotation, index) => {
          const state = annotationState(annotation, frame, fps);
          return (
            <g key={`${annotation.type}-${index}`} opacity={state.opacity}>
              <path
                d={linePath}
                fill="none"
                pathLength={1}
                stroke={rgba(accentColor, 0.2)}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="18"
              />
              <path
                d={linePath}
                fill="none"
                pathLength={1}
                stroke={accentColor}
                strokeDasharray={1}
                strokeDashoffset={1 - state.progress}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="7"
              />
            </g>
          );
        })}

      {range && rangeState ? (
        <>
          <rect
            fill="rgba(2, 9, 17, .58)"
            height={image.height}
            mask={`url(#${maskId})`}
            opacity={rangeState.opacity}
            width={image.width}
          />
          <rect
            fill={rgba(range.color ?? accentColor, 0.09)}
            height={image.plotRegion.height + 26}
            opacity={rangeState.opacity}
            rx="10"
            stroke={range.color ?? accentColor}
            strokeWidth="4"
            width={visibleRangeWidth}
            x={rangeStartX}
            y={image.plotRegion.y - 13}
          />
          <SvgLabel
            color={range.color ?? accentColor}
            label={range.label}
            opacity={rangeState.opacity}
            width={152}
            x={rangeStartX + visibleRangeWidth / 2}
            y={image.plotRegion.y + 16}
            styleVariant={profile.labelStyle}
          />
        </>
      ) : null}

      {annotations.map((annotation, index) => {
        const state = annotationState(annotation, frame, fps);
        if (annotation.type === "line-retrace") {
          return null;
        }

        if (annotation.type === "cursor-journey") {
          const motionDate = interpolateIsoDate(
            annotation.from,
            annotation.to,
            state.progress,
          );
          const motionValue = interpolateSeriesValue(series, motionDate);
          const observed = nearestSeriesDatum(series, motionDate);
          const point = mapChartPoint(
            {date: motionDate, value: motionValue},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const labelWidth = 188;
          const labelOnLeft = point.x > image.width - labelWidth - 70;
          return (
            <g key={`${annotation.type}-${index}`} opacity={state.opacity}>
              <line
                stroke={rgba(accentColor, 0.6)}
                strokeDasharray="8 8"
                strokeWidth="3"
                x1={point.x}
                x2={point.x}
                y1={image.plotRegion.y}
                y2={image.plotRegion.y + image.plotRegion.height}
              />
              <circle
                cx={point.x}
                cy={point.y}
                fill={rgba(accentColor, 0.16)}
                r="24"
              />
              <circle
                cx={point.x}
                cy={point.y}
                fill="#07111F"
                r="11"
                stroke={accentColor}
                strokeWidth="5"
              />
              <SvgLabel
                align={labelOnLeft ? "end" : "start"}
                color={accentColor}
                label={`${annotation.label ?? "Dato"} · ${formatDate(observed.date)}`}
                opacity={state.opacity}
                value={formatValue(observed.value, yAxis)}
                width={labelWidth}
                x={point.x + (labelOnLeft ? -24 : 24)}
                y={Math.max(90, point.y - 104)}
                styleVariant={profile.labelStyle}
              />
            </g>
          );
        }

        if (annotation.type === "peak-to-trough") {
          const peakValue = exactSeriesDatum(series, annotation.peakDate).value;
          const troughValue = exactSeriesDatum(
            series,
            annotation.troughDate,
          ).value;
          const peak = mapChartPoint(
            {date: annotation.peakDate, value: peakValue},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const trough = mapChartPoint(
            {date: annotation.troughDate, value: troughValue},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const change = percentageChange(peakValue, troughValue);
          const lineX = peak.x + (trough.x - peak.x) * state.progress;
          const lineY = peak.y + (trough.y - peak.y) * state.progress;
          return (
            <g key={`${annotation.type}-${index}`} opacity={state.opacity}>
              <line
                stroke={dangerColor}
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeWidth="5"
                x1={peak.x}
                x2={lineX}
                y1={peak.y}
                y2={lineY}
              />
              {[peak, trough].map((point, pointIndex) => (
                <circle
                  cx={point.x}
                  cy={point.y}
                  fill="#07111F"
                  key={point.date}
                  opacity={pointIndex === 0 ? 1 : state.progress}
                  r="10"
                  stroke={dangerColor}
                  strokeWidth="5"
                />
              ))}
              <SvgLabel
                color={dangerColor}
                label={annotation.label ?? "Variación"}
                opacity={state.opacity}
                value={`${change > 0 ? "+" : ""}${change.toFixed(1)} %`}
                width={190}
                x={(peak.x + trough.x) / 2}
                y={Math.min(
                  image.height - 96,
                  Math.max(130, (peak.y + trough.y) / 2 + 52),
                )}
                styleVariant={profile.labelStyle}
              />
            </g>
          );
        }

        if (annotation.type === "before-after") {
          const fromValue = exactSeriesDatum(series, annotation.from).value;
          const toValue = exactSeriesDatum(series, annotation.to).value;
          const from = mapChartPoint(
            {date: annotation.from, value: fromValue},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const to = mapChartPoint(
            {date: annotation.to, value: toValue},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const change = percentageChange(fromValue, toValue);
          const currentX = from.x + (to.x - from.x) * state.progress;
          const currentY = from.y + (to.y - from.y) * state.progress;
          return (
            <g key={`${annotation.type}-${index}`} opacity={state.opacity}>
              <line
                stroke={accentColor}
                strokeLinecap="round"
                strokeWidth="5"
                x1={from.x}
                x2={currentX}
                y1={from.y}
                y2={currentY}
              />
              <circle
                cx={from.x}
                cy={from.y}
                fill="#07111F"
                r="10"
                stroke={accentColor}
                strokeWidth="5"
              />
              <circle
                cx={to.x}
                cy={to.y}
                fill="#07111F"
                opacity={state.progress}
                r="10"
                stroke={accentColor}
                strokeWidth="5"
              />
              <SvgLabel
                color={change >= 0 ? "#45E1A4" : dangerColor}
                label={annotation.label ?? "Antes → después"}
                opacity={state.opacity}
                value={`${change >= 0 ? "+" : ""}${change.toFixed(1)} %`}
                width={196}
                x={(from.x + to.x) / 2}
                y={image.plotRegion.y + 72}
                styleVariant={profile.labelStyle}
              />
            </g>
          );
        }

        if (annotation.type === "event-marker") {
          const value =
            annotation.value ??
            exactSeriesDatum(series, annotation.date).value;
          const point = mapChartPoint(
            {date: annotation.date, value},
            xAxis,
            yAxis,
            image.plotRegion,
          );
          const color = annotation.color ?? accentColor;
          return (
            <g key={`${annotation.type}-${index}`} opacity={state.opacity}>
              <line
                stroke={rgba(color, 0.65)}
                strokeDasharray="7 7"
                strokeWidth="3"
                x1={point.x}
                x2={point.x}
                y1={point.y}
                y2={image.plotRegion.y + image.plotRegion.height}
              />
              <circle
                cx={point.x}
                cy={point.y}
                fill="#07111F"
                r="10"
                stroke={color}
                strokeWidth="5"
              />
              <SvgLabel
                color={color}
                label={annotation.label}
                opacity={state.opacity}
                value={formatValue(value, yAxis)}
                width={174}
                x={point.x}
                y={Math.max(82, point.y - 98)}
                styleVariant={profile.labelStyle}
              />
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
};

export const AnnotatedChartScene: React.FC<AnnotatedChartProps> = ({
  title,
  supportingText,
  showHeader,
  source,
  image,
  xAxis,
  yAxis,
  series,
  annotations,
  camera,
  accentColor,
  dangerColor,
  soundEnabled,
  soundMix,
  artDirection = "diagrammatic-system",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const profile = getArtDirectionProfile(artDirection);
  const missingSeriesAnnotation = annotations.find(annotationNeedsSeries);

  if (missingSeriesAnnotation && series.length < 2) {
    throw new Error(
      `Annotation "${missingSeriesAnnotation.type}" requires at least two series points.`,
    );
  }

  const chartEnter = motionProgress(
    frame,
    fps,
    0,
    0.55,
    Easing.bezier(0.16, 1, 0.3, 1),
  );
  const cameraFocus = mapChartPoint(
    {date: camera.focusDate, value: camera.focusValue},
    xAxis,
    yAxis,
    image.plotRegion,
  );
  const cameraProgress = camera.enabled
    ? motionProgress(
        frame,
        fps,
        camera.startSeconds,
        camera.endSeconds,
        Easing.bezier(0.16, 1, 0.3, 1),
      )
    : 0;
  const chartBody = (
    <>
      <ManagedImage
        alt={image.alt}
        borderRadius={profile.chartFrame === "none" ? 0 : 2}
        fit="contain"
        publicPath={image.publicPath}
        style={{
          height: image.height,
          inset: 0,
          position: "absolute",
          width: image.width,
        }}
      />
      <ChartAnnotationLayer
        accentColor={accentColor}
        annotations={annotations}
        dangerColor={dangerColor}
        artDirection={artDirection}
        image={image}
        series={series}
        xAxis={xAxis}
        yAxis={yAxis}
      />
    </>
  );

  return (
    <>
      <MotionCanvas
        accentColor={accentColor}
        showHeader={showHeader}
        supportingText={supportingText}
        title={title}
        artDirection={artDirection}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: "100%",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              border:
                profile.chartFrame === "evidence"
                  ? `1px solid ${rgba(MOTION_COLORS.ink, 0.22)}`
                  : "none",
              borderTop:
                profile.chartFrame === "rule"
                  ? `3px solid ${accentColor}`
                  : undefined,
              borderBottom:
                profile.chartFrame === "rule"
                  ? `1px solid ${rgba(MOTION_COLORS.ink, 0.22)}`
                  : undefined,
              borderRadius: profile.chartFrame === "evidence" ? 2 : 0,
              clipPath:
                profile.chartFrame === "evidence"
                  ? "inset(0 round 2px)"
                  : "inset(0)",
              height: image.height,
              opacity: 0.2 + chartEnter * 0.8,
              overflow: "hidden",
              position: "relative",
              transform: `translateY(${interpolate(
                chartEnter,
                [0, 1],
                [20, 0],
                clamp,
              )}px) scale(${interpolate(
                chartEnter,
                [0, 1],
                [0.985, 1],
                clamp,
              )})`,
              width: image.width,
            }}
          >
            {camera.enabled ? (
              <FocusZoom
                anchorX={0.5}
                anchorY={0.52}
                canvasHeight={image.height}
                canvasWidth={image.width}
                endSeconds={camera.endSeconds}
                focusX={cameraFocus.x / image.width}
                focusY={cameraFocus.y / image.height}
                startSeconds={camera.startSeconds}
                zoomScale={camera.zoomScale}
              >
                {chartBody}
              </FocusZoom>
            ) : (
              chartBody
            )}
            {camera.enabled ? (
              <>
                <div
                  style={{
                    background:
                      "linear-gradient(90deg, rgba(5,17,29,1) 0%, rgba(5,17,29,1) 78%, transparent 100%)",
                    bottom: 0,
                    left: 0,
                    opacity: cameraProgress,
                    pointerEvents: "none",
                    position: "absolute",
                    top: 0,
                    width: Math.max(150, image.plotRegion.x + 40),
                  }}
                />
                <div
                  style={{
                    background:
                      "linear-gradient(270deg, rgba(5,17,29,.98) 0%, transparent 100%)",
                    bottom: 0,
                    opacity: cameraProgress * 0.75,
                    pointerEvents: "none",
                    position: "absolute",
                    right: 0,
                    top: 0,
                    width: Math.max(
                      44,
                      (image.width -
                        image.plotRegion.x -
                        image.plotRegion.width) *
                        0.55,
                    ),
                  }}
                />
              </>
            ) : null}
            <div
              style={{
                background:
                  profile.sourceStyle === "ticker"
                    ? "rgba(3, 11, 18, .96)"
                    : profile.sourceStyle === "rail"
                      ? "linear-gradient(90deg, rgba(5,17,29,.98), rgba(5,17,29,.5))"
                      : "rgba(5,17,29,.86)",
                bottom: 0,
                color: MOTION_COLORS.muted,
                fontSize: 14,
                fontFamily:
                  profile.sourceStyle === "ticker"
                    ? DATA_FONT_FAMILY
                    : MOTION_FONT_FAMILY,
                fontWeight: 700,
                left: 0,
                letterSpacing: 0.6,
                padding: "10px 16px",
                position: "absolute",
                right: 0,
              }}
            >
              {source}
            </div>
          </div>
        </div>
      </MotionCanvas>
      <Soundtrack
        cues={chartSoundCues(annotations)}
        enabled={soundEnabled}
        masterVolume={soundMix}
      />
    </>
  );
};

export const AnnotatedChartSilent: React.FC<AnnotatedChartProps> = (props) => (
  <AnnotatedChartScene {...props} soundEnabled={false} />
);

export const AnnotatedChartWithAudio: React.FC<AnnotatedChartProps> = (
  props,
) => <AnnotatedChartScene {...props} soundEnabled />;
