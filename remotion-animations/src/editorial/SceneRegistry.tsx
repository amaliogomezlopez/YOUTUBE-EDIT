import {fitText} from "@remotion/layout-utils";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CHALK_FONT_FAMILY,
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY as MOTION_FONT_FAMILY,
} from "../motion/fonts";
import {ChalkBoard} from "../motion/ChalkBoard";
import {EDITORIAL_COLORS, EDITORIAL_RADIUS, alpha} from "./palette";
import {
  SOUND_FILES,
  SoundCue,
  Soundtrack,
} from "../motion/SoundDesign";
import {MarketNarrativeScene} from "./MarketNarrativeScene";
import {
  PATTERN_SCENES,
  PatternSceneProps,
  ROUTED_COMPOSITION_IDS,
} from "./PatternScenes";
import {
  assertRoutesInSync,
  recordKindFallback,
  resolvePattern,
} from "./patternRouting";
import {SecondMinuteNarrativeScene} from "./SecondMinuteNarrativeScene";
import {ThirdMinuteNarrativeScene} from "./ThirdMinuteNarrativeScene";
import {ConcentrationCycleScene} from "./ConcentrationCycleScene";
import {EarningsCapitalCycleScene} from "./EarningsCapitalCycleScene";
import {CurrentEarningsContrastScene} from "./CurrentEarningsContrastScene";
import {RecessionCreditScene} from "./RecessionCreditScene";
import {CreditCycleScene} from "./CreditCycleScene";
import {EditorialScene} from "./schemas";

const COLORS = EDITORIAL_COLORS;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const progress = (
  frame: number,
  fps: number,
  fromSeconds: number,
  toSeconds: number,
) =>
  interpolate(frame, [fromSeconds * fps, toSeconds * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const smoothPulse = (frame: number, fps: number, seconds = 1.8) =>
  0.5 + 0.5 * Math.sin((frame / fps / seconds) * Math.PI * 2);

const FrameBackground: React.FC<{accentColor: string}> = ({accentColor}) => (
  <ChalkBoard accentColor={accentColor} />
);

const SceneHeader: React.FC<{
  scene: EditorialScene;
}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = progress(frame, fps, 0.05, 0.55);
  const headlineSize = Math.max(
    42,
    Math.min(
      62,
      fitText({
        text: scene.headline,
        withinWidth: 1420,
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: "600",
      }).fontSize,
    ),
  );
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        left: 150,
        opacity: reveal,
        position: "absolute",
        right: 150,
        textAlign: "center",
        top: 48,
        transform: `translateY(${interpolate(reveal, [0, 1], [-16, 0])}px)`,
        zIndex: 5,
      }}
    >
      <div
        style={{
          color: COLORS.white,
          fontFamily: MOTION_FONT_FAMILY,
          fontOpticalSizing: "auto",
          fontSize: headlineSize,
          fontWeight: 650,
          letterSpacing: 0.15,
          lineHeight: 1.02,
          maxWidth: 1420,
        }}
      >
        {scene.headline}
      </div>
      <div
        style={{
          background: COLORS.gold,
          height: 3,
          marginTop: 14,
          opacity: 0.82,
          transform: "rotate(-0.35deg)",
          width: Math.min(220, Math.round(headlineSize * 3.2)),
        }}
      />
      <div
        style={{
          color: COLORS.muted,
          fontFamily: CHALK_FONT_FAMILY,
          fontSize: 28,
          fontWeight: 500,
          lineHeight: 1.2,
          marginTop: 10,
          maxWidth: 1180,
        }}
      >
        {scene.supportingText}
      </div>
    </div>
  );
};

const normalizeCompanyLabel = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const logoForLabel = (scene: EditorialScene, label: string) =>
  scene.assets.find(
    (asset) =>
      asset.kind === "logo" &&
      normalizeCompanyLabel(asset.label) === normalizeCompanyLabel(label),
  );

const CompanyMark: React.FC<{
  scene: EditorialScene;
  label: string;
  size: number;
}> = ({scene, label, size}) => {
  const asset = logoForLabel(scene, label);
  if (!asset) {
    return (
      <div
        style={{
          alignItems: "center",
          color: COLORS.white,
          display: "flex",
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: Math.round(size * 0.42),
          fontWeight: 900,
          height: size,
          justifyContent: "center",
          width: size,
        }}
      >
        {label.slice(0, 1)}
      </div>
    );
  }
  return (
    <Img
      src={staticFile(asset.path)}
      style={{
        height: size,
        objectFit: "contain",
        width: size,
      }}
    />
  );
};

const CompanyLogoRibbon: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const logos = scene.assets.filter((asset) => asset.kind === "logo").slice(0, 7);
  if (!logos.length) return null;
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 22,
        justifyContent: "center",
        left: 180,
        position: "absolute",
        right: 180,
        top: 174,
        zIndex: 4,
      }}
    >
      {logos.map((asset) => (
        <div
          key={asset.id}
          style={{
            alignItems: "center",
            background: alpha(COLORS.surface, 0.72),
            border: `1.5px solid ${alpha(COLORS.ink, 0.28)}`,
            borderRadius: EDITORIAL_RADIUS,
            display: "flex",
            height: 56,
            justifyContent: "center",
            width: 72,
          }}
        >
          <Img
            src={staticFile(asset.path)}
            style={{height: 34, objectFit: "contain", width: 42}}
          />
        </div>
      ))}
    </div>
  );
};

const AssetBackdrop: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const asset = scene.assets.find((candidate) => candidate.kind === "image");
  if (!asset) return null;
  const travel = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [0, 1],
    clamp,
  );
  return (
    <AbsoluteFill style={{overflow: "hidden", zIndex: 1}}>
      <Img
        src={staticFile(asset.path)}
        style={{
          height: "112%",
          left: `${-6 + travel * -2}%`,
          objectFit: "cover",
          opacity: 0.34,
          position: "absolute",
          top: "-6%",
          transform: `scale(${1.02 + travel * 0.06})`,
          width: "112%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(12,13,11,.42), rgba(12,13,11,.84) 55%, #0C0D0B 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const SourceFooter: React.FC<{
  label?: string;
}> = ({label}) => {
  const detail = label ?? "";
  if (!detail) return null;
  return (
    <div
      style={{
        alignItems: "center",
        bottom: 34,
        display: "grid",
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: 17,
        gap: 12,
        gridTemplateColumns: "auto minmax(0, 1fr)",
        left: 92,
        letterSpacing: 0.15,
        position: "absolute",
        right: 92,
        zIndex: 5,
      }}
    >
      {label ? (
        <span
          style={{
            color: COLORS.gold,
            flex: "0 0 auto",
            fontFamily: CHALK_FONT_FAMILY,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 0.4,
          }}
        >
          FUENTE
        </span>
      ) : null}
      <span
        style={{
          color: COLORS.muted,
          display: "block",
          fontWeight: 540,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {detail}
      </span>
    </div>
  );
};

const DATA_SOURCE_KINDS = new Set([
  "before-after",
  "claim-audit",
  "earnings-cards",
  "mag7-weights",
  "market-contrast",
  "market-health",
  "market-recovery",
  "market-seed",
  "market-xray",
  "sector-bars",
  "sloos-chart",
  "split-lines",
  "threshold-lanes",
]);

const MONTHS = [
  "ENE",
  "FEB",
  "MAR",
  "ABR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DIC",
];

const chartDateLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return `${MONTHS[month - 1]} ${year}`;
};

const formatIndex = (value: number) =>
  value.toLocaleString("es-ES", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

const SplitLines: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const primary = scene.chartData;
  const secondary = scene.secondaryChartData;
  const hasEvidence = primary.length >= 2 && secondary.length >= 2;
  const fallbackPrimary = [
    {label: "INICIO", value: 100},
    {label: "FINAL", value: 114},
  ];
  const fallbackSecondary = [
    {label: "INICIO", value: 100},
    {label: "FINAL", value: 92},
  ];
  const seriesA = hasEvidence ? primary : fallbackPrimary;
  const seriesB = hasEvidence ? secondary : fallbackSecondary;
  const values = [...seriesA, ...seriesB].map((datum) => datum.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const yMin = Math.floor((rawMin - 2) / 10) * 10;
  const yMax = Math.max(yMin + 20, Math.ceil((rawMax + 2) / 10) * 10);
  const yTicks = Array.from(
    {length: Math.round((yMax - yMin) / 10) + 1},
    (_, index) => yMin + index * 10,
  );
  const plot = {left: 184, right: 1746, top: 194, bottom: 864};
  const xFor = (index: number, length: number) =>
    plot.left + (index / Math.max(1, length - 1)) * (plot.right - plot.left);
  const yFor = (value: number) =>
    plot.bottom -
    ((value - yMin) / Math.max(1, yMax - yMin)) *
      (plot.bottom - plot.top);
  const pointsA = seriesA
    .map((datum, index) => `${xFor(index, seriesA.length)},${yFor(datum.value)}`)
    .join(" ");
  const pointsB = seriesB
    .map((datum, index) => `${xFor(index, seriesB.length)},${yFor(datum.value)}`)
    .join(" ");
  const durationSeconds = durationInFrames / fps;
  const draw = progress(
    frame,
    fps,
    0.18,
    Math.min(2.6, Math.max(1.2, durationSeconds * 0.34)),
  );
  const secondaryDraw = progress(
    frame,
    fps,
    0.48,
    Math.min(3.05, Math.max(1.5, durationSeconds * 0.41)),
  );
  const seconds = frame / fps;
  const stagedPrimary =
    scene.focusTarget === "both" && seconds >= 2.2 && seconds < 4.35;
  const stagedSecondary =
    scene.focusTarget === "both" && seconds >= 4.35;
  const focusPrimary =
    scene.focusTarget === "primary" || stagedPrimary;
  const focusSecondary =
    scene.focusTarget === "secondary" || stagedSecondary;
  const focusAmount = progress(
    frame,
    fps,
    scene.focusTarget === "both" ? (focusSecondary ? 4.35 : 2.2) : 0.85,
    scene.focusTarget === "both" ? (focusSecondary ? 5.0 : 2.85) : 1.55,
  );
  const focusActive = focusPrimary || focusSecondary;
  const primaryOpacity =
    focusActive && !focusPrimary ? 0.16 + (1 - focusAmount) * 0.84 : 1;
  const secondaryOpacity =
    focusActive && !focusSecondary ? 0.16 + (1 - focusAmount) * 0.84 : 1;
  const focusSeries = focusSecondary ? seriesB : seriesA;
  const focusPoint = focusSeries[focusSeries.length - 1] ?? focusSeries[0];
  const focusX = xFor(focusSeries.length - 1, focusSeries.length);
  const focusY = yFor(focusPoint.value);
  const cameraScale = 1 + (focusActive ? focusAmount * 0.11 : 0);
  const cameraTransform = `translate(${focusX * (1 - cameraScale)} ${
    focusY * (1 - cameraScale)
  }) scale(${cameraScale})`;
  const labelIndices = [
    0,
    Math.round((seriesA.length - 1) / 3),
    Math.round(((seriesA.length - 1) * 2) / 3),
    seriesA.length - 1,
  ];
  const primaryEnd = seriesA[seriesA.length - 1] ?? seriesA[0];
  const secondaryEnd = seriesB[seriesB.length - 1] ?? seriesB[0];
  const markerPulse = 1 + smoothPulse(frame, fps, 1.1) * 0.18;
  const metricVisible =
    hasEvidence && (focusSecondary || scene.focusTarget === "secondary");

  return (
    <svg
      height="100%"
      style={{inset: 0, position: "absolute"}}
      viewBox="0 0 1920 1080"
      width="100%"
    >
      <rect
        fill={alpha(COLORS.surface, 0.82)}
        height={plot.bottom - plot.top}
        rx={22}
        stroke={alpha(COLORS.white, 0.12)}
        width={plot.right - plot.left}
        x={plot.left}
        y={plot.top}
      />
      <g opacity={focusActive ? 0.48 : 0.9}>
        {yTicks.map((tick) => {
          const y = yFor(tick);
          return (
            <g key={tick}>
              <line
                stroke={tick === 100 ? alpha(COLORS.white, 0.46) : alpha(COLORS.grid, 0.78)}
                strokeDasharray={tick === 100 ? "8 8" : undefined}
                strokeWidth={tick === 100 ? 2.5 : 1.5}
                x1={plot.left}
                x2={plot.right}
                y1={y}
                y2={y}
              />
              <text
                fill={tick === 100 ? COLORS.white : COLORS.muted}
                fontFamily={DATA_FONT_FAMILY}
                fontSize={18}
                textAnchor="end"
                x={plot.left - 20}
                y={y + 6}
              >
                {tick}
              </text>
            </g>
          );
        })}
      </g>
      <text
        fill={COLORS.muted}
        fontFamily={DATA_FONT_FAMILY}
        fontSize={17}
        letterSpacing={1.1}
        transform={`rotate(-90 42 ${(plot.top + plot.bottom) / 2})`}
        x={42}
        y={(plot.top + plot.bottom) / 2}
      >
        ÍNDICE · BASE 100
      </text>
      {labelIndices.map((index) => (
        <g key={`${seriesA[index]?.label}-${index}`}>
          <line
            stroke={alpha(COLORS.grid, 0.72)}
            strokeWidth={1.5}
            x1={xFor(index, seriesA.length)}
            x2={xFor(index, seriesA.length)}
            y1={plot.bottom}
            y2={plot.bottom + 10}
          />
          <text
            fill={COLORS.muted}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            textAnchor={
              index === 0
                ? "start"
                : index === seriesA.length - 1
                  ? "end"
                  : "middle"
            }
            x={xFor(index, seriesA.length)}
            y={plot.bottom + 42}
          >
            {chartDateLabel(seriesA[index]?.label ?? "")}
          </text>
        </g>
      ))}
      <text
        fill={COLORS.muted}
        fontFamily={DATA_FONT_FAMILY}
        fontSize={15}
        letterSpacing={1}
        textAnchor="middle"
        x={(plot.left + plot.right) / 2}
        y={plot.bottom + 78}
      >
        FECHA DE CIERRE
      </text>
      <defs>
        <clipPath id="finance-lines-clip">
          <rect
            height={plot.bottom - plot.top}
            rx={22}
            width={plot.right - plot.left}
            x={plot.left}
            y={plot.top}
          />
        </clipPath>
      </defs>
      <g clipPath="url(#finance-lines-clip)">
        <g transform={cameraTransform}>
          {focusActive ? (
            <rect
              fill="rgba(90, 94, 108, 0.2)"
              height={plot.bottom - plot.top}
              opacity={focusAmount}
              width={plot.right - plot.left}
              x={plot.left}
              y={plot.top}
            />
          ) : null}
          <polyline
            fill="none"
            opacity={primaryOpacity}
            pathLength={1}
            points={pointsA}
            stroke={accentColor}
            strokeDasharray="1"
            strokeDashoffset={1 - draw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={focusPrimary ? 10 : 7}
          />
          <polyline
            fill="none"
            opacity={secondaryOpacity}
            pathLength={1}
            points={pointsB}
            stroke={COLORS.cyan}
            strokeDasharray="1"
            strokeDashoffset={1 - secondaryDraw}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={focusSecondary ? 10 : 7}
          />
          {draw > 0.96 ? (
            <circle
              cx={xFor(seriesA.length - 1, seriesA.length)}
              cy={yFor(primaryEnd.value)}
              fill={accentColor}
              opacity={primaryOpacity}
              r={(focusPrimary ? 9 : 6) * markerPulse}
              stroke={COLORS.background}
              strokeWidth={4}
            />
          ) : null}
          {secondaryDraw > 0.96 ? (
            <circle
              cx={xFor(seriesB.length - 1, seriesB.length)}
              cy={yFor(secondaryEnd.value)}
              fill={COLORS.cyan}
              opacity={secondaryOpacity}
              r={(focusSecondary ? 9 : 6) * markerPulse}
              stroke={COLORS.background}
              strokeWidth={4}
            />
          ) : null}
        </g>
      </g>
      <g>
        <rect
          fill={alpha(COLORS.surfaceRaised, 0.94)}
          height={88}
          rx={14}
          stroke={alpha(COLORS.white, 0.13)}
          width={1140}
          x={390}
          y={66}
        />
        <line
          stroke={accentColor}
          strokeWidth={7}
          x1={430}
          x2={485}
          y1={100}
          y2={100}
        />
        <text
          fill={COLORS.white}
          fontFamily={MOTION_FONT_FAMILY}
          fontSize={21}
          fontWeight={720}
          x={505}
          y={108}
        >
          {scene.labels[0] ?? "SPY · CIERRE, BASE 100"}
        </text>
        <line
          stroke={COLORS.cyan}
          strokeWidth={7}
          x1={960}
          x2={1015}
          y1={100}
          y2={100}
        />
        <text
          fill={COLORS.white}
          fontFamily={MOTION_FONT_FAMILY}
          fontSize={21}
          fontWeight={720}
          x={1035}
          y={108}
        >
          {scene.labels[1] ?? "MAGS / SPY · FUERZA RELATIVA"}
        </text>
      </g>
      {metricVisible && scene.metric ? (
        <g opacity={focusAmount}>
          <rect
            fill={alpha(COLORS.surfaceRaised, 0.96)}
            height={126}
            rx={16}
            stroke={COLORS.cyan}
            strokeWidth={2}
            width={440}
            x={1235}
            y={242}
          />
          <text
            fill={COLORS.cyan}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={39}
            fontWeight={800}
            x={1270}
            y={294}
          >
            {`${scene.metric.value.toLocaleString("es-ES", {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}${scene.metric.suffix}`}
          </text>
          <text
            fill={COLORS.white}
            fontFamily={MOTION_FONT_FAMILY}
            fontSize={17}
            fontWeight={680}
            x={1270}
            y={332}
          >
            {scene.metric.label}
          </text>
        </g>
      ) : null}
      {hasEvidence ? (
        <>
          <text
            fill={accentColor}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            textAnchor="end"
            x={plot.right - 14}
            y={Math.max(plot.top + 26, yFor(primaryEnd.value) - 18)}
          >
            {formatIndex(primaryEnd.value)}
          </text>
          <text
            fill={COLORS.cyan}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            textAnchor="end"
            x={plot.right - 14}
            y={Math.min(plot.bottom - 16, yFor(secondaryEnd.value) + 30)}
          >
            {formatIndex(secondaryEnd.value)}
          </text>
        </>
      ) : null}
    </svg>
  );
};

const KineticText: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const words = scene.headline.toUpperCase().split(/\s+/).slice(0, 5);
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        height: "100%",
        justifyContent: "center",
        padding: "140px 120px 40px",
      }}
    >
      {words.map((word, index) => {
        const reveal = progress(frame, fps, 0.3 + index * 0.24, 0.9 + index * 0.24);
        const beat = smoothPulse(frame + index * 12, fps, 1.7);
        return (
          <div
            key={`${word}-${index}`}
            style={{
              color: index === words.length - 1 ? accentColor : COLORS.white,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 92 + (index % 2) * 18,
              fontWeight: 900,
              letterSpacing: -3,
              opacity: reveal,
              transform: `scale(${0.92 + reveal * 0.08 + beat * 0.012}) translateY(${(1 - reveal) * 28}px)`,
            }}
          >
            {word}
          </div>
        );
      })}
    </div>
  );
};

const Orbit: React.FC<{
  scene: EditorialScene;
  accentColor: string;
  logoPath: string;
}> = ({scene, accentColor, logoPath}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = scene.labels.length
    ? scene.labels.slice(0, 8)
    : ["NVIDIA", "APPLE", "MICROSOFT", "AMAZON", "ALPHABET", "META", "TESLA"];
  const orbit = frame / fps * 0.17;
  return (
    <div
      style={{
        height: "100%",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: alpha(COLORS.surfaceRaised, 0.9),
          border: `2px solid ${alpha(accentColor, 0.55)}`,
          borderRadius: "50%",
          boxShadow: `0 0 80px ${alpha(accentColor, 0.14)}`,
          display: "flex",
          height: 260,
          justifyContent: "center",
          left: "50%",
          position: "absolute",
          top: "54%",
          transform: "translate(-50%, -50%)",
          width: 260,
        }}
      >
        <Img
          src={staticFile(logoPath)}
          style={{
            height: 178,
            objectFit: "contain",
            width: 178,
          }}
        />
      </div>
      {labels.map((label, index) => {
        const angle = (index / labels.length) * Math.PI * 2 - Math.PI / 2 + orbit;
        const radiusX = 520;
        const radiusY = 245;
        const x = 864 + Math.cos(angle) * radiusX;
        const y = 565 + Math.sin(angle) * radiusY;
        const reveal = progress(frame, fps, 0.2 + index * 0.16, 0.8 + index * 0.16);
        return (
          <div
            key={`${label}-${index}`}
            style={{
              background: alpha(COLORS.surface, 0.94),
              border: `1px solid ${alpha(accentColor, 0.42)}`,
              borderRadius: 10,
              color: COLORS.white,
              fontFamily: MOTION_FONT_FAMILY,
              fontSize: 18,
              fontWeight: 700,
              left: x,
              opacity: reveal,
              padding: "15px 22px",
              position: "absolute",
              top: y,
              transform: `translate(-50%, -50%) scale(${0.82 + reveal * 0.18})`,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <CompanyMark label={label} scene={scene} size={42} />
              <span>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MetricCards: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = scene.labels.length ? scene.labels : ["DATO", "CONTEXTO", "SEÑAL"];
  return (
    <div
      style={{
        alignItems: "center",
        display: "grid",
        gap: 30,
        gridTemplateColumns: `repeat(${Math.min(3, labels.length)}, 1fr)`,
        height: "100%",
        padding: "210px 100px 100px",
      }}
    >
      {labels.slice(0, 3).map((label, index) => {
        const reveal = progress(frame, fps, 0.3 + index * 0.35, 1.1 + index * 0.35);
        const value = scene.valueLabels[index] ??
          (scene.values[index] === undefined ? "—" : String(scene.values[index]));
        return (
          <div
            key={label}
            style={{
              background: `linear-gradient(145deg, ${alpha(
                COLORS.surfaceRaised,
                0.96,
              )}, ${alpha(COLORS.surface, 0.92)})`,
              border: `1px solid ${index === 0 ? alpha(accentColor, 0.7) : alpha(COLORS.grid, 0.9)}`,
              borderRadius: 18,
              boxShadow: `0 30px 80px ${alpha(COLORS.background, 0.48)}`,
              minHeight: 310,
              opacity: reveal,
              padding: "42px 36px",
              transform: `translateY(${(1 - reveal) * 38}px)`,
            }}
          >
            <div
              style={{
                color: COLORS.muted,
                fontFamily: MOTION_FONT_FAMILY,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1.3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                color: index === 0 ? accentColor : COLORS.white,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: 56,
                fontWeight: 900,
                letterSpacing: -2,
                marginTop: 68,
              }}
            >
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HistoricalTimeline: React.FC<{
  scene: EditorialScene;
  accentColor: string;
}> = ({scene, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = scene.labels.length ? scene.labels : ["1980s", "1999", "2000", "2008", "2022", "2026"];
  const x1 = 190;
  const x2 = 1730;
  const y = 560;
  const draw = progress(frame, fps, 0.2, 2.2);
  return (
    <svg
      height="100%"
      style={{inset: 0, position: "absolute"}}
      viewBox="0 0 1920 1080"
      width="100%"
    >
      <line
        pathLength={1}
        stroke={accentColor}
        strokeDasharray={`${draw} ${1 - draw}`}
        strokeWidth={6}
        x1={x1}
        x2={x2}
        y1={y}
        y2={y}
      />
      {labels.map((label, index) => {
        const x = x1 + (index / Math.max(1, labels.length - 1)) * (x2 - x1);
        const reveal = progress(frame, fps, 0.55 + index * 0.25, 1.2 + index * 0.25);
        const active = Math.floor(frame / (fps * 1.75)) % labels.length === index;
        return (
          <g key={label} opacity={reveal}>
            <circle
              cx={x}
              cy={y}
              fill={active ? accentColor : COLORS.surfaceRaised}
              r={active ? 20 : 14}
              stroke={accentColor}
              strokeWidth={4}
            />
            <text
              fill={active ? accentColor : COLORS.white}
              fontFamily={MOTION_FONT_FAMILY}
              fontSize={24}
              fontWeight={800}
              textAnchor="middle"
              x={x}
              y={y + (index % 2 === 0 ? -58 : 74)}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const SloosChart: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const data = scene.chartData;
  if (data.length < 2) {
    return <KineticText scene={scene} accentColor={accentColor} />;
  }
  const x1 = 150;
  const x2 = 1770;
  const y1 = 270;
  const y2 = 790;
  const min = -40;
  const max = 80;
  const xAt = (index: number) => x1 + (index / (data.length - 1)) * (x2 - x1);
  const yAt = (value: number) => y2 - ((value - min) / (max - min)) * (y2 - y1);
  const points = data.map((datum, index) => `${xAt(index)},${yAt(datum.value)}`).join(" ");
  const reveal = progress(
    frame,
    fps,
    0.35,
    Math.max(2.2, durationInFrames / fps - 1.2),
  );
  const peakIndex = data.findIndex((datum) => datum.label === "2023Q3");
  const latestIndex = data.findIndex((datum) => datum.label === "2026Q2");
  return (
    <svg
      height="100%"
      style={{inset: 0, position: "absolute"}}
      viewBox="0 0 1920 1080"
      width="100%"
    >
      {[-20, 0, 20, 40, 60, 80].map((tick) => (
        <g key={tick}>
          <line
            stroke={tick === 40 ? alpha(COLORS.negative, 0.6) : alpha(COLORS.grid, 0.72)}
            strokeDasharray={tick === 40 ? "10 10" : undefined}
            strokeWidth={tick === 40 ? 3 : 2}
            x1={x1}
            x2={x2}
            y1={yAt(tick)}
            y2={yAt(tick)}
          />
          <text
            fill={tick === 40 ? COLORS.negative : COLORS.muted}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            textAnchor="end"
            x={x1 - 20}
            y={yAt(tick) + 6}
          >
            {tick}%
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        pathLength={1}
        points={points}
        stroke={accentColor}
        strokeDasharray={`${reveal} ${1 - reveal}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={6}
      />
      {[peakIndex, latestIndex].filter((index) => index >= 0).map((index) => {
        const datum = data[index];
        const x = xAt(index);
        const y = yAt(datum.value);
        const marker = progress(frame, fps, 1.6, 2.3);
        return (
          <g key={datum.label} opacity={marker}>
            <circle cx={x} cy={y} fill={COLORS.background} r={13} stroke={accentColor} strokeWidth={5} />
            <rect
              fill={alpha(COLORS.surfaceRaised, 0.97)}
              height={66}
              rx={8}
              stroke={alpha(accentColor, 0.55)}
              width={176}
              x={Math.min(1700, Math.max(110, x - 88))}
              y={Math.max(220, y - 92)}
            />
            <text
              fill={COLORS.white}
              fontFamily={DATA_FONT_FAMILY}
              fontSize={18}
              fontWeight={800}
              textAnchor="middle"
              x={Math.min(1788, Math.max(198, x))}
              y={Math.max(258, y - 54)}
            >
              {datum.label} · {datum.value.toLocaleString("es-ES")}%
            </text>
          </g>
        );
      })}
      {["1990", "2000", "2010", "2020", "2026"].map((year) => {
        const index = data.findIndex((datum) => datum.label.startsWith(year));
        if (index < 0) return null;
        return (
          <text
            key={year}
            fill={COLORS.muted}
            fontFamily={DATA_FONT_FAMILY}
            fontSize={17}
            textAnchor="middle"
            x={xAt(index)}
            y={y2 + 38}
          >
            {year}
          </text>
        );
      })}
    </svg>
  );
};

const BeforeAfter: React.FC<{accentColor: string}> = ({accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wipe = progress(frame, fps, 0.6, 2.6);
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: 70,
        height: "100%",
        justifyContent: "center",
        paddingTop: 160,
      }}
    >
      {[
        {label: "2023Q3", value: "50,8 %", color: COLORS.negative},
        {label: "2026Q2", value: "8,1 %", color: accentColor},
      ].map((item, index) => (
        <div
          key={item.label}
          style={{
            background: alpha(COLORS.surfaceRaised, 0.96),
            border: `2px solid ${alpha(item.color, 0.72)}`,
            borderRadius: 22,
            minWidth: 530,
            opacity: index === 0 ? 1 : wipe,
            padding: "62px 70px",
            transform: index === 0 ? `translateX(${wipe * -28}px)` : `translateX(${(1 - wipe) * 90}px)`,
          }}
        >
          <div
            style={{
              color: COLORS.muted,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            {item.label}
          </div>
          <div
            style={{
              color: item.color,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 112,
              fontWeight: 900,
              letterSpacing: -5,
              marginTop: 24,
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
      <div
        style={{
          color: accentColor,
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: 62,
          fontWeight: 900,
          opacity: wipe,
          position: "absolute",
        }}
      >
        →
      </div>
    </div>
  );
};

const ConcentrationGrid: React.FC<{
  scene: EditorialScene;
  accentColor: string;
}> = ({scene, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const highlighted = scene.metric ? Math.round(scene.metric.value) : 0;
  const conceptualLane = Math.floor(frame / (fps * 1.6)) % 7;
  return (
    <div
      style={{
        alignContent: "center",
        display: "grid",
        gap: 8,
        gridTemplateColumns: "repeat(20, 1fr)",
        height: "100%",
        padding: "235px 150px 110px",
      }}
    >
      {Array.from({length: 100}, (_, index) => {
        const reveal = progress(frame, fps, 0.2 + (index % 20) * 0.025, 1 + (index % 20) * 0.025);
        const active = highlighted > 0
          ? index < highlighted
          : index % 7 === conceptualLane;
        const wave = Math.floor(frame / (fps * 1.6)) % 100 === index;
        return (
          <div
            key={index}
            style={{
              background: active ? accentColor : alpha(COLORS.muted, 0.16),
              borderRadius: 3,
              boxShadow: wave ? `0 0 22px ${accentColor}` : "none",
              height: 42,
              opacity: reveal * (active ? 0.9 : 0.65),
              transform: `scale(${wave ? 1.12 : 1})`,
            }}
          />
        );
      })}
      {scene.metric ? (
        <div
          style={{
            bottom: 142,
            color: accentColor,
            fontFamily: DATA_FONT_FAMILY,
            fontSize: 64,
            fontWeight: 900,
            position: "absolute",
            right: 155,
          }}
        >
          {scene.metric.value.toLocaleString("es-ES")}
          {scene.metric.suffix}
        </div>
      ) : null}
    </div>
  );
};

const BrandCta: React.FC<{
  accentColor: string;
  logoPath: string;
}> = ({accentColor, logoPath}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = progress(frame, fps, 0.1, 1.1);
  const ring = frame / fps * 18;
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "center",
        paddingTop: 90,
      }}
    >
      <div
        style={{
          alignItems: "center",
          border: `2px solid ${alpha(accentColor, 0.55)}`,
          borderRadius: "50%",
          boxShadow: `0 0 90px ${alpha(accentColor, 0.2)}`,
          display: "flex",
          height: 330,
          justifyContent: "center",
          opacity: reveal,
          position: "relative",
          transform: `scale(${0.86 + reveal * 0.14}) rotate(${ring * 0.01}deg)`,
          width: 330,
        }}
      >
        <Img
          src={staticFile(logoPath)}
          style={{height: 250, objectFit: "contain", width: 250}}
        />
      </div>
      <div
        style={{
          color: COLORS.white,
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: 66,
          fontWeight: 900,
          letterSpacing: -1.5,
          marginTop: 36,
          opacity: reveal,
        }}
      >
        FINANCE CAVALIERS
      </div>
      <div
        style={{
          color: accentColor,
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 2,
          marginTop: 14,
          opacity: reveal,
        }}
      >
        HISTORIA · DATOS · CRITERIO
      </div>
    </div>
  );
};

const EditorialGuard: React.FC<{
  scene: EditorialScene;
  previewMode: "editorial" | "clean";
}> = () => {
  // El estado editorial pertenece al manifiesto y a Review Studio. Nunca se
  // quema una instrucción interna de producción dentro del frame.
  return null;
};

const cue = (
  file: string,
  startSeconds: number,
  durationSeconds: number,
  volume: number,
): SoundCue => ({
  file,
  startSeconds,
  durationSeconds,
  volume,
  attackSeconds: 0.015,
  releaseSeconds: 0.12,
});

const cuesForEditorialScene = (
  scene: EditorialScene,
  durationSeconds: number,
): SoundCue[] => {
  // ANM-D04 — Si el director ya decidió la mezcla, el render la reproduce tal
  // cual. La capa de render dejó de elegir sonidos por tipo de acción.
  if (scene.soundPlan?.length) {
    return scene.soundPlan
      .filter((instance) => instance.startSeconds < durationSeconds - 0.05)
      .map((instance) => ({
        file: instance.file,
        startSeconds: instance.startSeconds,
        durationSeconds: instance.durationSeconds,
        volume: instance.volume,
        playbackRate: instance.playbackRate,
        attackSeconds: instance.role === "riser" ? 0.12 : 0.015,
        releaseSeconds: instance.role === "riser" ? 0.35 : 0.12,
      }));
  }
  const semanticSoundFiles = {
    "data-tick": {file: SOUND_FILES.dataTick, duration: 0.42, volume: 0.48},
    "rise-whoosh": {file: SOUND_FILES.riseWhoosh, duration: 0.78, volume: 0.5},
    "soft-impact": {file: SOUND_FILES.softImpact, duration: 0.58, volume: 0.56},
    "success-chime": {file: SOUND_FILES.successChime, duration: 0.52, volume: 0.46},
    "ui-pulse": {file: SOUND_FILES.uiPulse, duration: 0.22, volume: 0.48},
    "quick-whip": {file: SOUND_FILES.quickWhip, duration: 0.12, volume: 0.18},
    "smooth-whoosh": {file: SOUND_FILES.smoothWhoosh, duration: 1.1, volume: 0.11},
    "digital-count": {file: SOUND_FILES.digitalCount, duration: 0.51, volume: 0.18},
    processing: {file: SOUND_FILES.processing, duration: 1.2, volume: 0.1},
    pop: {file: SOUND_FILES.pop, duration: 0.42, volume: 0.12},
    // ANM-D03 — Material propio: el giro narrativo ya no suena igual que el
    // dato de cierre.
    "alert-sting": {file: SOUND_FILES.alertSting, duration: 0.76, volume: 0.6},
    "logo-shimmer": {
      file: SOUND_FILES.logoShimmer,
      duration: 0.34,
      volume: 0.36,
    },
    "tension-swell": {
      file: SOUND_FILES.tensionSwell,
      duration: 0.92,
      volume: 0.34,
    },
    "needle-strike": {
      file: SOUND_FILES.needleStrike,
      duration: 0.2,
      volume: 0.42,
    },
    "bubble-burst": {
      file: SOUND_FILES.bubbleBurst,
      duration: 0.68,
      volume: 0.54,
    },
    "rewind-sweep": {
      file: SOUND_FILES.rewindSweep,
      duration: 0.72,
      volume: 0.34,
    },
    keyboard: {
      file: SOUND_FILES.keyboard,
      duration: 1.55,
      volume: 0.12,
    },
    "data-loading": {
      file: SOUND_FILES.dataLoading,
      duration: 1.8,
      volume: 0.11,
    },
  } as const;
  const legacyCues = scene.semanticCues.filter(
    (semanticCue) => typeof semanticCue.sound === "string",
  );
  if (legacyCues.length) {
    return legacyCues
      .flatMap((semanticCue) => {
        const alias = semanticCue.sound as keyof typeof semanticSoundFiles;
        const config = semanticSoundFiles[alias];
        if (!config) return [];
        const emphasis =
          semanticCue.tone === "negative" || semanticCue.action === "verify"
            ? 1.12
            : 1;
        const primary = cue(
          config.file,
          semanticCue.atSeconds,
          config.duration,
          config.volume * emphasis,
        );
        // ANM-D04 — Se elimina el apilado automático de `quickWhip` +
        // `smoothWhoosh` sobre todo cue connect|focus|highlight|zoom|verify.
        // El sonido de cámara se decide por familia y presupuesto en el
        // director (`sound-director.js`), no por el tipo de acción.
        const eventCues =
          alias === "bubble-burst"
            ? [
                cue(
                  SOUND_FILES.needleStrike,
                  Math.max(0, semanticCue.atSeconds - 0.035),
                  0.2,
                  0.46,
                ),
              ]
            : [];
        return [...eventCues, primary];
      })
      .filter((soundCue) => soundCue.startSeconds < durationSeconds - 0.05);
  }
  const raw =
    scene.kind === "split-lines"
      ? [
          cue(SOUND_FILES.riseWhoosh, 0.05, 0.78, 0.58),
          cue(SOUND_FILES.dataTick, 0.72, 0.42, 0.48),
          cue(
            SOUND_FILES.uiPulse,
            scene.focusTarget === "both" ? 2.2 : 0.92,
            0.22,
            0.52,
          ),
          ...(scene.focusTarget === "both"
            ? [cue(SOUND_FILES.uiPulse, 4.35, 0.22, 0.56)]
            : []),
          ...(scene.focusTarget === "secondary"
            ? [cue(SOUND_FILES.softImpact, 2.15, 0.58, 0.55)]
            : []),
        ]
      : scene.kind === "mag7-weights" || scene.kind === "company-orbit"
        ? [
            cue(SOUND_FILES.riseWhoosh, 0.06, 0.78, 0.5),
            cue(SOUND_FILES.dataTick, 0.82, 0.42, 0.4),
            cue(SOUND_FILES.softImpact, 1.72, 0.58, 0.5),
          ]
        : scene.kind === "brand-cta"
          ? [
              cue(SOUND_FILES.riseWhoosh, 0.06, 0.78, 0.5),
              cue(SOUND_FILES.successChime, 1.05, 0.52, 0.46),
            ]
          : [
              cue(SOUND_FILES.riseWhoosh, 0.06, 0.78, 0.36),
              cue(SOUND_FILES.uiPulse, 0.92, 0.22, 0.34),
            ];
  return raw.filter((soundCue) => soundCue.startSeconds < durationSeconds - 0.05);
};

/**
 * Camino heredado: `kind → componente`.
 *
 * ANM-E03 — Esta tabla **es la deuda**. Cada entrada es un `kind` cuyo píxel
 * todavía no lo decide el patrón que el plan eligió, y cada una declara por qué
 * sigue aquí. El router prefiere siempre el patrón; solo cae aquí si el `kind`
 * aparece en esta tabla, y deja traza al hacerlo. Migrar un `kind` es borrar su
 * fila: no hay `default` silencioso que lo tape.
 */
type KindFallback = {
  reason: string;
  ownsFrame?: boolean;
  render: (props: PatternSceneProps) => React.ReactNode;
};

const KIND_FALLBACK: Partial<
  Record<EditorialScene["kind"], KindFallback>
> = {
  "market-seed": {
    reason:
      "La escena exige dos series, semillas y el área de divergencia; el adaptador line-trend genérico solo conserva una serie.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "market-xray": {
    reason:
      "La relación superficie/señal interna necesita dos planos, scanner y aislamiento semántico; common-baseline aplana esa jerarquía.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "market-health": {
    reason:
      "La escena necesita ejes, tramo de corrección y zoom sobre evidencia fechada; el adaptador genérico no conserva esos focos.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "market-recovery": {
    reason:
      "La recuperación combina flecha, métrica derivada y estado de mercado; hero-metric por sí solo pierde la transformación narrativa.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "market-contrast": {
    reason:
      "El giro compara dos líneas y atenúa la primera mientras revela el tramo reciente de la segunda; common-baseline no expresa el giro.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "mag7-relationship": {
    reason:
      "La escena dispone de siete logos gestionados y conectores hacia MAGS/SPY; signal-flow sustituye indebidamente las entidades por texto.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "claim-audit": {
    reason:
      "`comparison.before-after-wipe` exige dos capturas del mismo encuadre; la escena aporta cifras auditadas, no imágenes.",
    render: ({scene}) => <MarketNarrativeScene scene={scene} />,
  },
  "bubble-trigger": {
    reason:
      "`concept.scale-proportion` necesita una proporción declarada; la escena no aporta ni cifras ni etiquetas comparables.",
    render: ({scene}) => <SecondMinuteNarrativeScene scene={scene} />,
  },
  "market-gravity": {
    reason:
      "Misma carencia que bubble-trigger: la escena es una metáfora sin magnitudes que el patrón cuantitativo pueda representar.",
    render: ({scene}) => <SecondMinuteNarrativeScene scene={scene} />,
  },
  "history-rewind": {
    reason:
      "`time.timeline-milestones` exige hitos con etiqueta; la escena no declara ninguno.",
    render: ({scene}) => <SecondMinuteNarrativeScene scene={scene} />,
  },
  "historical-leaders": {
    reason:
      "La escena usa expedientes editoriales secuenciales para evitar repetir la órbita de marca ya aprobada.",
    render: ({scene}) => <ThirdMinuteNarrativeScene scene={scene} />,
  },
  "dominance-facade": {
    reason:
      "`data.part-to-whole` exige parte y total verificables; la escena solo aporta cuatro logos.",
    render: ({scene}) => <ThirdMinuteNarrativeScene scene={scene} />,
  },
  "leadership-lag": {
    reason:
      "`data.line-trend-zoom` exige una serie ordenada; la escena no lleva `chartData`.",
    render: ({scene}) => <ThirdMinuteNarrativeScene scene={scene} />,
  },
  "contagion-spread": {
    reason:
      "La escena muestra contagio lineal por sectores, no una red radial reutilizada.",
    render: ({scene}) => <ThirdMinuteNarrativeScene scene={scene} />,
  },
  "claim-evidence-gap": {
    reason:
      "Misma carencia que claim-audit: `comparison.before-after-wipe` sin las dos imágenes comparables.",
    render: ({scene}) => <ThirdMinuteNarrativeScene scene={scene} />,
  },
  "concentration-grid": {
    reason:
      "scene-022 recibe `data.part-to-whole` sin parte ni total; migrar solo las otras tres partiría el kind en dos caminos.",
    render: ({scene, accentColor}) => (
      <ConcentrationGrid accentColor={accentColor} scene={scene} />
    ),
  },
  "historical-timeline": {
    reason:
      "scene-024 recibe `data.line-trend-zoom` sin serie; el resto del kind sí podría migrar.",
    render: ({scene, accentColor}) => (
      <HistoricalTimeline accentColor={accentColor} scene={scene} />
    ),
  },
  "sloos-chart": {
    reason:
      "Recibe `data.part-to-whole` y `data.bar-focus`; la escena lleva 145 puntos de serie, ni proporción ni categorías.",
    render: ({scene, accentColor}) => (
      <SloosChart accentColor={accentColor} scene={scene} />
    ),
  },
  "before-after": {
    reason:
      "`comparison.before-after-wipe` exige dos imágenes; la escena aporta dos cifras sobre la misma serie.",
    render: ({accentColor}) => <BeforeAfter accentColor={accentColor} />,
  },
  "company-orbit": {
    reason:
      "Recibe `data.part-to-whole` y `concept.scale-proportion` sin cifra de proporción alguna.",
    render: ({scene, accentColor, logoPath}) => (
      <Orbit accentColor={accentColor} logoPath={logoPath} scene={scene} />
    ),
  },
  "brand-cta": {
    reason:
      "`asset.logo-ecosystem` ya está implementado, pero el cierre de marca no declara participantes ni logos: no es un ecosistema, es una firma. Su binding pide un patrón que la escena no puede alimentar.",
    ownsFrame: true,
    render: ({accentColor, logoPath}) => (
      <BrandCta accentColor={accentColor} logoPath={logoPath} />
    ),
  },
  "split-lines": {
    reason:
      "Ninguna escena del episodio 1 lo usa: migrarlo sería hacerlo a ciegas, sin still que compare el antes y el después.",
    render: ({scene, accentColor}) => (
      <SplitLines accentColor={accentColor} scene={scene} />
    ),
  },
  "market-ticker": {
    reason:
      "Ninguna escena del episodio 1 lo usa: migrarlo sería hacerlo a ciegas, sin still que compare el antes y el después.",
    render: ({scene, accentColor}) => (
      <MetricCards accentColor={accentColor} scene={scene} />
    ),
  },
};

assertRoutesInSync(ROUTED_COMPOSITION_IDS, Object.keys(KIND_FALLBACK));

/** Kinds cuyo cuadro lo dibuja el componente heredado, cabecera incluida. */
const LEGACY_FRAME_KINDS = new Set<string>([
  "market-seed",
  "market-xray",
  "market-health",
  "market-recovery",
  "market-contrast",
  "mag7-relationship",
  "claim-audit",
  "historical-leaders",
  "dominance-facade",
  "leadership-lag",
  "contagion-spread",
  "claim-evidence-gap",
  "brand-cta",
  "split-lines",
]);

export const FinanceEditorialScene: React.FC<{
  scene: EditorialScene;
  accentColor: string;
  logoPath: string;
  previewMode: "editorial" | "clean";
  soundEnabled: boolean;
  soundMix: number;
  duckWindows?: {startSeconds: number; endSeconds: number; gainDb: number}[];
}> = ({
  scene,
  accentColor,
  logoPath,
  previewMode,
  soundEnabled,
  soundMix,
  duckWindows,
}) => {
  const {durationInFrames, fps} = useVideoConfig();
  // ANM-E01 — La resolución es patternId → composición → componente. El camino
  // por `kind` sobrevive solo para lo que aún no ha migrado y deja traza.
  const sceneProps: PatternSceneProps = {scene, accentColor, logoPath};
  const fallback = KIND_FALLBACK[scene.kind];
  const route = resolvePattern(scene.patternId);
  let content: React.ReactNode;
  let ownsFrame: boolean;
  if (["scene-040", "scene-041", "scene-042", "scene-043", "scene-044", "scene-045", "scene-046", "scene-047", "scene-048", "scene-049", "scene-050", "scene-051", "scene-052", "scene-053", "scene-054", "scene-055", "scene-056", "scene-057", "scene-058"].includes(scene.id)) {
    content = <CreditCycleScene scene={scene} />;
    ownsFrame = true;
  } else if (["scene-035", "scene-036", "scene-037", "scene-038", "scene-039"].includes(scene.id)) {
    content = <RecessionCreditScene scene={scene} />;
    ownsFrame = true;
  } else if (["scene-030", "scene-031", "scene-032", "scene-033", "scene-034"].includes(scene.id)) {
    content = <CurrentEarningsContrastScene scene={scene} />;
    ownsFrame = true;
  } else if (["scene-024", "scene-025", "scene-026", "scene-027", "scene-028", "scene-029"].includes(scene.id)) {
    content = <EarningsCapitalCycleScene scene={scene} />;
    ownsFrame = true;
  } else if (["scene-019", "scene-020", "scene-021", "scene-022", "scene-023"].includes(scene.id)) {
    content = <ConcentrationCycleScene scene={scene} />;
    ownsFrame = true;
  } else if (fallback) {
    recordKindFallback(
      scene.kind,
      scene.id,
      scene.patternId ?? null,
      fallback.reason,
    );
    content = fallback.render(sceneProps);
    ownsFrame = fallback.ownsFrame ?? LEGACY_FRAME_KINDS.has(scene.kind);
  } else if (route.mode === "pattern") {
    const patternRoute = PATTERN_SCENES[route.compositionId];
    content = <patternRoute.Component {...sceneProps} />;
    ownsFrame = patternRoute.ownsFrame;
  } else {
    // Sin fila en la tabla heredada y sin patrón que pintar, no hay nada
    // honesto que dibujar: un panel vacío pasaría la validación y llegaría al
    // vídeo montado sin que nadie lo viera.
    throw new Error(
      `La escena ${scene.id} (${scene.kind}) no tiene componente: ` +
        `${route.reason}. Corrige el binding del patrón o devuelve el kind a ` +
        "la tabla heredada con su motivo.",
    );
  }
  const headerVisible = !ownsFrame;
  const footerVisible =
    Boolean(scene.sourceLabel) && DATA_SOURCE_KINDS.has(scene.kind);
  return (
    <AbsoluteFill
      style={{
        color: COLORS.white,
        fontFamily: MOTION_FONT_FAMILY,
        overflow: "hidden",
      }}
    >
      <FrameBackground accentColor={accentColor} />
      <AssetBackdrop scene={scene} />
      {headerVisible ? <SceneHeader scene={scene} /> : null}
      <AbsoluteFill style={{zIndex: 2}}>{content}</AbsoluteFill>
      {footerVisible ? (
        <SourceFooter label={scene.sourceLabel} />
      ) : null}
      {/* El ribete de logos es del camino heredado. Un patrón del catálogo
          decide él mismo qué hace con los assets de la escena; superponerle una
          fila de logos duplicaría lo que ya está pintando. */}
      {Boolean(fallback) &&
      headerVisible &&
      scene.assets.length > 0 &&
      ![
        "company-orbit",
        "mag7-weights",
        "sector-bars",
        "market-engine",
        "ai-core",
        "correction-alert",
        "bubble-trigger",
        "market-gravity",
        "history-rewind",
        "historical-leaders",
        "dominance-facade",
        "leadership-lag",
        "contagion-spread",
        "claim-evidence-gap",
      ].includes(scene.kind) ? (
        <CompanyLogoRibbon scene={scene} />
      ) : null}
      <Soundtrack
        cues={cuesForEditorialScene(scene, durationInFrames / fps)}
        duckOffsetSeconds={scene.startSeconds}
        duckWindows={duckWindows}
        enabled={soundEnabled}
        masterVolume={soundMix}
      />
      <EditorialGuard scene={scene} previewMode={previewMode} />
    </AbsoluteFill>
  );
};
