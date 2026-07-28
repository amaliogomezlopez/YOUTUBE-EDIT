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
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY as MOTION_FONT_FAMILY,
} from "../motion/fonts";
import {
  SOUND_FILES,
  SoundCue,
  Soundtrack,
} from "../motion/SoundDesign";
import {EditorialScene} from "./schemas";

const COLORS = {
  background: "#050817",
  surface: "#0C1226",
  surfaceRaised: "#121B34",
  ink: "#F8E7B0",
  white: "#FFF9E8",
  muted: "#A9A9B8",
  grid: "#28324B",
  gold: "#FFC83D",
  amber: "#D89A12",
  positive: "#49C98A",
  negative: "#FF5F6D",
  cyan: "#6ED4FF",
} as const;

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

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
};

const smoothPulse = (frame: number, fps: number, seconds = 1.8) =>
  0.5 + 0.5 * Math.sin((frame / fps / seconds) * Math.PI * 2);

const FrameBackground: React.FC<{accentColor: string}> = ({accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drift = (frame / fps) * 9;
  const pulse = smoothPulse(frame, fps, 3.2);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${64 + pulse * 4}% 42%, ${alpha(
          accentColor,
          0.09,
        )}, transparent 35%), linear-gradient(135deg, #050817 0%, #080D1F 55%, #030510 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${alpha(
            COLORS.grid,
            0.24,
          )} 1px, transparent 1px), linear-gradient(90deg, ${alpha(
            COLORS.grid,
            0.24,
          )} 1px, transparent 1px)`,
          backgroundPosition: `${drift}px ${drift * 0.45}px`,
          backgroundSize: "80px 80px",
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,.72), rgba(0,0,0,.12) 82%, transparent)",
          opacity: 0.7,
        }}
      />
      {Array.from({length: 18}, (_, index) => {
        const x = (index * 137 + 83) % 1840;
        const y = (index * 211 + 71) % 980;
        const radius = index % 4 === 0 ? 3 : 1.5;
        return (
          <div
            key={index}
            style={{
              background: index % 5 === 0 ? accentColor : COLORS.muted,
              borderRadius: "50%",
              height: radius * 2,
              left: x + Math.sin(frame / fps + index) * 12,
              opacity: 0.12 + pulse * 0.18,
              position: "absolute",
              top: y + Math.cos(frame / fps / 2 + index) * 8,
              width: radius * 2,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

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
        fontWeight: "800",
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
          fontSize: headlineSize,
          fontWeight: 840,
          letterSpacing: -1.7,
          lineHeight: 1,
          maxWidth: 1420,
        }}
      >
        {scene.headline}
      </div>
      <div
        style={{
          color: COLORS.muted,
          fontFamily: MOTION_FONT_FAMILY,
          fontSize: 22,
          fontWeight: 540,
          lineHeight: 1.25,
          marginTop: 12,
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
            background: alpha(COLORS.surface, 0.9),
            border: `1px solid ${alpha(COLORS.white, 0.12)}`,
            borderRadius: 12,
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
            "linear-gradient(180deg, rgba(5,8,23,.42), rgba(5,8,23,.82) 55%, #050817 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const SourceFooter: React.FC<{
  label?: string;
  conceptual?: boolean;
}> = ({label, conceptual}) => {
  const detail = label ?? (conceptual ? "ILUSTRACIÓN CONCEPTUAL · SIN ESCALA" : "");
  if (!detail) return null;
  return (
    <div
      style={{
        alignItems: "center",
        bottom: 34,
        display: "flex",
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: 17,
        gap: 12,
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
            fontWeight: 800,
            letterSpacing: 0.8,
          }}
        >
          FUENTE
        </span>
      ) : null}
      <span
        style={{
          color: COLORS.muted,
          fontWeight: 540,
          whiteSpace: "nowrap",
        }}
      >
        {detail}
      </span>
    </div>
  );
};

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

const BarPanel: React.FC<{
  scene: EditorialScene;
  accentColor: string;
  compact?: boolean;
}> = ({scene, accentColor, compact}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const values = scene.values.length ? scene.values : [38, 22, 17, 12];
  const labels = scene.labels.length ? scene.labels : values.map((_, index) => `GRUPO ${index + 1}`);
  const max = Math.max(...values, 1);
  return (
    <div
      style={{
        alignItems: "flex-end",
        display: "flex",
        gap: compact ? 20 : 34,
        height: "100%",
        justifyContent: "center",
        padding: "230px 110px 86px",
      }}
    >
      {values.map((value, index) => {
        const reveal = progress(frame, fps, 0.25 + index * 0.13, 1.1 + index * 0.13);
        const height = 410 * (value / max) * reveal;
        const valueLabel = scene.valueLabels[index] ?? `${value.toLocaleString("es-ES")}%`;
        return (
          <div
            key={`${labels[index]}-${index}`}
            style={{
              alignItems: "center",
              display: "flex",
              flex: 1,
              flexDirection: "column",
              justifyContent: "flex-end",
              maxWidth: compact ? 185 : 280,
            }}
          >
            {logoForLabel(scene, labels[index]) ? (
              <div
                style={{
                  alignItems: "center",
                  background: alpha(COLORS.surfaceRaised, 0.94),
                  border: `1px solid ${alpha(COLORS.white, 0.14)}`,
                  borderRadius: 14,
                  display: "flex",
                  height: compact ? 68 : 78,
                  justifyContent: "center",
                  marginBottom: 14,
                  opacity: reveal,
                  width: compact ? 78 : 88,
                }}
              >
                <CompanyMark
                  label={labels[index]}
                  scene={scene}
                  size={compact ? 46 : 54}
                />
              </div>
            ) : null}
            <div
              style={{
                color: index === 0 ? accentColor : COLORS.white,
                fontFamily: MOTION_FONT_FAMILY,
                fontSize: compact ? 24 : 30,
                fontWeight: 800,
                marginBottom: 12,
                opacity: reveal,
              }}
            >
              {valueLabel}
            </div>
            <div
              style={{
                background:
                  index === 0
                    ? `linear-gradient(180deg, ${accentColor}, ${alpha(accentColor, 0.42)})`
                    : `linear-gradient(180deg, ${alpha(COLORS.cyan, 0.78)}, ${alpha(COLORS.cyan, 0.18)})`,
                borderRadius: "10px 10px 2px 2px",
                boxShadow: index === 0 ? `0 0 36px ${alpha(accentColor, 0.15)}` : "none",
                height,
                minHeight: 4,
                width: "100%",
              }}
            />
            <div
              style={{
                alignItems: "center",
                color: COLORS.muted,
                display: "flex",
                flexDirection: "column",
                fontFamily: MOTION_FONT_FAMILY,
                fontSize: compact ? 14 : 17,
                fontWeight: 700,
                gap: 8,
                lineHeight: 1.2,
                marginTop: 16,
                minHeight: 42,
                textAlign: "center",
              }}
            >
              {labels[index]}
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

const Flow: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = scene.labels.length
    ? scene.labels.slice(0, 6)
    : ["ORIGEN", "SEÑAL", "TRANSMISIÓN", "RESULTADO"];
  const count = labels.length;
  const width = 1480;
  const startX = 220;
  const step = width / Math.max(1, count - 1);
  const y = 560;
  return (
    <svg
      height="100%"
      style={{inset: 0, position: "absolute"}}
      viewBox="0 0 1920 1080"
      width="100%"
    >
      {labels.slice(0, -1).map((_, index) => {
        const draw = progress(frame, fps, 0.5 + index * 0.32, 1.25 + index * 0.32);
        const x1 = startX + index * step + 72;
        const x2 = startX + (index + 1) * step - 72;
        return (
          <g key={`path-${index}`}>
            <line
              pathLength={1}
              stroke={alpha(accentColor, 0.8)}
              strokeDasharray={`${draw} ${1 - draw}`}
              strokeWidth={5}
              x1={x1}
              x2={x2}
              y1={y}
              y2={y}
            />
            <circle
              cx={x1 + (x2 - x1) * ((frame / fps / 1.7 + index * 0.2) % 1)}
              cy={y}
              fill={accentColor}
              opacity={draw}
              r={7}
            />
          </g>
        );
      })}
      {labels.map((label, index) => {
        const reveal = progress(frame, fps, 0.25 + index * 0.3, 0.9 + index * 0.3);
        const x = startX + index * step;
        const active = Math.floor(frame / (fps * 1.8)) % count === index;
        return (
          <g key={label} opacity={reveal}>
            <circle
              cx={x}
              cy={y}
              fill={active ? alpha(accentColor, 0.22) : alpha(COLORS.surfaceRaised, 0.94)}
              r={86 + (active ? 6 : 0)}
              stroke={active ? accentColor : alpha(COLORS.muted, 0.4)}
              strokeWidth={3}
            />
            <text
              fill={active ? accentColor : COLORS.white}
              fontFamily={MOTION_FONT_FAMILY}
              fontSize={count > 4 ? 16 : 20}
              fontWeight={800}
              textAnchor="middle"
              x={x}
              y={y + 6}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
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
}> = ({scene, previewMode}) => {
  if (previewMode !== "editorial" || scene.factualStatus === "supported") {
    return null;
  }
  const blocked = scene.factualStatus === "blocked";
  return (
    <div
      style={{
        alignItems: "center",
        background: blocked ? alpha(COLORS.negative, 0.94) : alpha(COLORS.amber, 0.95),
        color: blocked ? COLORS.white : COLORS.background,
        display: "flex",
        fontFamily: MOTION_FONT_FAMILY,
        fontSize: 17,
        fontWeight: 900,
        gap: 12,
        letterSpacing: 1.2,
        padding: "12px 18px",
        position: "absolute",
        bottom: 28,
        right: 58,
        zIndex: 20,
      }}
    >
      <span>{blocked ? "TOMA PENDIENTE" : "INTERPRETACIÓN"}</span>
      <span style={{opacity: 0.72}}>· NO PUBLICAR ESTA PREVIEW</span>
    </div>
  );
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

export const FinanceEditorialScene: React.FC<{
  scene: EditorialScene;
  accentColor: string;
  logoPath: string;
  previewMode: "editorial" | "clean";
  soundEnabled: boolean;
  soundMix: number;
}> = ({
  scene,
  accentColor,
  logoPath,
  previewMode,
  soundEnabled,
  soundMix,
}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const conceptual = [
    "market-ticker",
    "kinetic-text",
    "company-orbit",
    "concentration-grid",
    "historical-timeline",
    "earnings-flow",
    "credit-flow",
  ].includes(scene.kind) ||
    (scene.kind === "split-lines" &&
      (scene.chartData.length < 2 || scene.secondaryChartData.length < 2));
  let content: React.ReactNode;
  switch (scene.kind) {
    case "split-lines":
      content = <SplitLines scene={scene} accentColor={accentColor} />;
      break;
    case "company-orbit":
      content = <Orbit scene={scene} accentColor={accentColor} logoPath={logoPath} />;
      break;
    case "mag7-weights":
    case "sector-bars":
      content = <BarPanel scene={scene} accentColor={accentColor} compact={scene.values.length > 5} />;
      break;
    case "earnings-cards":
    case "market-ticker":
      content = <MetricCards scene={scene} accentColor={accentColor} />;
      break;
    case "credit-flow":
    case "earnings-flow":
      content = <Flow scene={scene} accentColor={accentColor} />;
      break;
    case "historical-timeline":
    case "threshold-lanes":
      content = <HistoricalTimeline scene={scene} accentColor={accentColor} />;
      break;
    case "sloos-chart":
      content = <SloosChart scene={scene} accentColor={accentColor} />;
      break;
    case "before-after":
      content = <BeforeAfter accentColor={accentColor} />;
      break;
    case "concentration-grid":
    case "portfolio-grid":
      content = <ConcentrationGrid scene={scene} accentColor={accentColor} />;
      break;
    case "brand-cta":
      content = <BrandCta accentColor={accentColor} logoPath={logoPath} />;
      break;
    default:
      content = <KineticText scene={scene} accentColor={accentColor} />;
  }
  const headerVisible = !["brand-cta", "split-lines", "kinetic-text"].includes(
    scene.kind,
  );
  const footerVisible = scene.kind !== "brand-cta";
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
        <SourceFooter label={scene.sourceLabel} conceptual={conceptual} />
      ) : null}
      {headerVisible &&
      scene.assets.length > 0 &&
      !["company-orbit", "mag7-weights", "sector-bars"].includes(scene.kind) ? (
        <CompanyLogoRibbon scene={scene} />
      ) : null}
      <Soundtrack
        cues={cuesForEditorialScene(scene, durationInFrames / fps)}
        enabled={soundEnabled}
        masterVolume={soundMix}
      />
      <EditorialGuard scene={scene} previewMode={previewMode} />
    </AbsoluteFill>
  );
};
