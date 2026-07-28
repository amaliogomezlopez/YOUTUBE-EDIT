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
import {DATA_FONT_FAMILY, MOTION_FONT_FAMILY} from "../motion/fonts";
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
  accentColor: string;
}> = ({scene, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = progress(frame, fps, 0.05, 0.55);
  const headlineSize = Math.max(
    44,
    Math.min(
      66,
      fitText({
        text: scene.headline,
        withinWidth: 1180,
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: "800",
      }).fontSize,
    ),
  );
  return (
    <>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 14,
          left: 92,
          opacity: reveal,
          position: "absolute",
          top: 48,
          zIndex: 5,
        }}
      >
        <div
          style={{
            background: accentColor,
            height: 5,
            width: 54 * reveal,
          }}
        />
        <div
          style={{
            color: accentColor,
            fontFamily: MOTION_FONT_FAMILY,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2.2,
          }}
        >
          FINANCE CAVALIERS · EVIDENCIA
        </div>
      </div>
      <div
        style={{
          left: 92,
          opacity: reveal,
          position: "absolute",
          top: 92,
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
            maxWidth: 1260,
          }}
        >
          {scene.headline}
        </div>
        <div
          style={{
            color: COLORS.muted,
            fontFamily: MOTION_FONT_FAMILY,
            fontSize: 23,
            fontWeight: 540,
            marginTop: 12,
            maxWidth: 1100,
          }}
        >
          {scene.supportingText}
        </div>
      </div>
    </>
  );
};

const SourceFooter: React.FC<{
  label?: string;
  conceptual?: boolean;
}> = ({label, conceptual}) => (
  <div
    style={{
      bottom: 38,
      color: COLORS.muted,
      fontFamily: MOTION_FONT_FAMILY,
      fontSize: 16,
      left: 92,
      letterSpacing: 0.3,
      position: "absolute",
      right: 92,
      zIndex: 5,
    }}
  >
    {label ? `FUENTE · ${label}` : conceptual ? "ILUSTRACIÓN CONCEPTUAL · SIN ESCALA" : ""}
  </div>
);

const SplitLines: React.FC<{scene: EditorialScene; accentColor: string}> = ({
  scene,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const draw = progress(
    frame,
    fps,
    0.25,
    Math.max(1.5, durationInFrames / fps - 1.2),
  );
  const focus = smoothPulse(frame, fps, 1.9);
  const pointsA = "110,520 330,472 550,495 770,390 990,410 1210,302 1430,336 1650,235";
  const pointsB = "110,590 330,534 550,552 770,505 990,548 1210,585 1430,620 1650,676";
  return (
    <svg
      height="100%"
      style={{inset: 0, position: "absolute"}}
      viewBox="0 0 1920 1080"
      width="100%"
    >
      {[300, 430, 560, 690].map((y) => (
        <line
          key={y}
          stroke={alpha(COLORS.grid, 0.64)}
          strokeWidth={2}
          x1={110}
          x2={1780}
          y1={y}
          y2={y}
        />
      ))}
      <polyline
        fill="none"
        pathLength={1}
        points={pointsA}
        stroke={accentColor}
        strokeDasharray={`${draw} ${1 - draw}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={9}
      />
      <polyline
        fill="none"
        opacity={0.72 + focus * 0.28}
        pathLength={1}
        points={pointsB}
        stroke={COLORS.cyan}
        strokeDasharray={`${Math.max(0, draw - 0.12)} ${1 - Math.max(0, draw - 0.12)}`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={7}
      />
      {[scene.labels[0] ?? "ÍNDICE", scene.labels[1] ?? "LIDERAZGO"].map(
        (label, index) => (
          <g key={label}>
            <rect
              fill={index === 0 ? alpha(accentColor, 0.16) : alpha(COLORS.cyan, 0.13)}
              height={54}
              rx={8}
              stroke={index === 0 ? accentColor : COLORS.cyan}
              width={250}
              x={1415}
              y={index === 0 ? 220 : 665}
            />
            <text
              fill={COLORS.white}
              fontFamily={DATA_FONT_FAMILY}
              fontSize={20}
              fontWeight={700}
              textAnchor="middle"
              x={1540}
              y={index === 0 ? 254 : 699}
            >
              {label}
            </text>
          </g>
        ),
      )}
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
        const radiusY = 260;
        const x = 864 + Math.cos(angle) * radiusX;
        const y = 410 + Math.sin(angle) * radiusY;
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
            {label}
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
        padding: "210px 110px 90px",
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
                color: COLORS.muted,
                fontFamily: MOTION_FONT_FAMILY,
                fontSize: compact ? 14 : 17,
                fontWeight: 700,
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
        right: 84,
        top: 48,
        zIndex: 20,
      }}
    >
      <span>{blocked ? "TOMA PENDIENTE" : "INTERPRETACIÓN"}</span>
      <span style={{opacity: 0.72}}>· NO PUBLICAR ESTA PREVIEW</span>
    </div>
  );
};

export const FinanceEditorialScene: React.FC<{
  scene: EditorialScene;
  accentColor: string;
  logoPath: string;
  previewMode: "editorial" | "clean";
}> = ({scene, accentColor, logoPath, previewMode}) => {
  const conceptual = [
    "split-lines",
    "market-ticker",
    "kinetic-text",
    "company-orbit",
    "concentration-grid",
    "historical-timeline",
    "earnings-flow",
    "credit-flow",
  ].includes(scene.kind);
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
  const headerVisible = scene.kind !== "brand-cta";
  return (
    <AbsoluteFill
      style={{
        color: COLORS.white,
        fontFamily: MOTION_FONT_FAMILY,
        overflow: "hidden",
      }}
    >
      <FrameBackground accentColor={accentColor} />
      {headerVisible ? <SceneHeader scene={scene} accentColor={accentColor} /> : null}
      <AbsoluteFill style={{zIndex: 2}}>{content}</AbsoluteFill>
      {headerVisible ? (
        <SourceFooter label={scene.sourceLabel} conceptual={conceptual} />
      ) : null}
      <EditorialGuard scene={scene} previewMode={previewMode} />
    </AbsoluteFill>
  );
};
