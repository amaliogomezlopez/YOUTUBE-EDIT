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
  FINANCE_FONT_FAMILY,
} from "../motion/fonts";
import {EditorialScene} from "./schemas";

const C = {
  bg: "#050817",
  panel: "#0B1327",
  white: "#FFF9E8",
  muted: "#99A4BA",
  gold: "#FFC83D",
  cyan: "#62D4FF",
  red: "#FF5F6D",
  green: "#52D69B",
} as const;

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
};

const ease = (
  frame: number,
  fps: number,
  fromSeconds: number,
  toSeconds: number,
) =>
  interpolate(frame, [fromSeconds * fps, toSeconds * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const cuePulse = (
  scene: EditorialScene,
  cueId: string,
  frame: number,
  fps: number,
) => {
  const cue = scene.semanticCues.find((candidate) => candidate.id === cueId);
  if (!cue) return 0;
  const start = cue.atSeconds * fps;
  const duration = Math.max(0.65, cue.durationSeconds) * fps;
  return interpolate(
    frame,
    [start, start + 0.2 * fps, start + duration * 0.72, start + duration],
    [0, 1, 1, cue.persist ? 1 : 0],
    clamp,
  );
};

const cueLatch = (
  scene: EditorialScene,
  cueId: string,
  frame: number,
  fps: number,
) => {
  const cue = scene.semanticCues.find((candidate) => candidate.id === cueId);
  if (!cue) return 0;
  return interpolate(
    frame,
    [cue.atSeconds * fps, (cue.atSeconds + 0.32) * fps],
    [0, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );
};

const Header: React.FC<{title: string; eyebrow: string}> = ({
  title,
  eyebrow,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = ease(frame, fps, 0.04, 0.55);
  return (
    <>
      <div
        style={{
          color: C.gold,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 18,
          fontWeight: 850,
          left: 112,
          letterSpacing: 3,
          opacity: enter,
          position: "absolute",
          top: 62,
          transform: `translateY(${(1 - enter) * -15}px)`,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 56,
          fontWeight: 900,
          left: 112,
          letterSpacing: -1.8,
          lineHeight: 1,
          opacity: enter,
          position: "absolute",
          top: 98,
        }}
      >
        {title}
      </div>
    </>
  );
};

const MarketContagion: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sectors = cuePulse(scene, "non-tech-sectors", frame, fps);
  const technology = cuePulse(scene, "technology-origin", frame, fps);
  const falling = cueLatch(scene, "market-falling", frame, fps);
  const fear = cueLatch(scene, "fear-spread", frame, fps);
  const reveal = ease(frame, fps, 0.2, 1.2);
  const nodes = [
    ["CONSUMO", 620, 320, "◈"],
    ["INDUSTRIA", 930, 245, "⚙"],
    ["FINANZAS", 1250, 315, "¤"],
    ["ENERGÍA", 1380, 615, "ϟ"],
    ["SALUD", 1040, 765, "✚"],
    ["SERVICIOS", 680, 690, "⌁"],
  ] as const;
  return (
    <>
      <Header
        eyebrow="CONTAGIO FUERA DEL SECTOR"
        title="El miedo cruza las fronteras"
      />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920">
        <defs>
          <radialGradient id="contagion-wave">
            <stop offset="0" stopColor={alpha(C.red, 0.42 + fear * 0.22)} />
            <stop offset="1" stopColor={alpha(C.red, 0)} />
          </radialGradient>
          <filter id="contagion-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur result="blur" stdDeviation="11" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 1, 2].map((ring) => {
          const travel = Math.max(
            0,
            Math.min(1, sectors * 1.6 + fear * 0.7 - ring * 0.22),
          );
          return (
            <circle
              key={ring}
              cx="355"
              cy="550"
              fill="none"
              opacity={(1 - travel) * 0.8}
              r={110 + travel * (530 + ring * 75)}
              stroke={ring === 2 ? C.red : alpha(C.red, 0.72)}
              strokeDasharray={ring === 1 ? "18 16" : undefined}
              strokeWidth={7 - ring}
            />
          );
        })}
        <circle
          cx="355"
          cy="550"
          fill={alpha(C.cyan, 0.16)}
          filter={technology > 0.02 ? "url(#contagion-glow)" : undefined}
          r={118 + technology * 14}
          stroke={technology > 0.02 ? C.cyan : alpha(C.cyan, 0.7)}
          strokeWidth="4"
        />
        <text
          fill={C.cyan}
          fontFamily={FINANCE_FONT_FAMILY}
          fontSize="31"
          fontWeight="900"
          textAnchor="middle"
          x="355"
          y="542"
        >
          TECNOLOGÍA
        </text>
        <text
          fill={C.muted}
          fontFamily={DATA_FONT_FAMILY}
          fontSize="16"
          letterSpacing="2"
          textAnchor="middle"
          x="355"
          y="578"
        >
          ORIGEN DEL DETERIORO
        </text>
        {nodes.map(([label, x, y, icon], index) => {
          const arrival = Math.max(
            0,
            Math.min(1, sectors * 2.1 + falling * 0.7 - index * 0.15),
          );
          const infected = arrival > 0.48;
          return (
            <g
              key={label}
              opacity={reveal}
              transform={`translate(${x} ${y + falling * (infected ? 32 : 0)})`}
            >
              <circle
                fill={infected ? alpha(C.red, 0.22) : alpha(C.panel, 0.94)}
                r="76"
                stroke={infected ? C.red : alpha(C.cyan, 0.55)}
                strokeWidth={infected ? 4 : 2}
              />
              <text
                fill={infected ? C.red : C.cyan}
                fontFamily={FINANCE_FONT_FAMILY}
                fontSize="42"
                fontWeight="900"
                textAnchor="middle"
                y="-5"
              >
                {icon}
              </text>
              <text
                fill={C.white}
                fontFamily={DATA_FONT_FAMILY}
                fontSize="17"
                fontWeight="800"
                textAnchor="middle"
                y="32"
              >
                {label}
              </text>
            </g>
          );
        })}
        <circle
          cx="925"
          cy="535"
          fill="url(#contagion-wave)"
          opacity={fear}
          r={300 + fear * 410}
        />
      </svg>
      <div
        style={{
          bottom: 76,
          color: fear > 0.05 ? C.red : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 34,
          fontWeight: 900,
          left: 112,
          position: "absolute",
        }}
      >
        {fear > 0.05
          ? "EL SENTIMIENTO CONECTA LO QUE EL NEGOCIO NO CONECTABA"
          : "SECTORES DISTINTOS · UNA MISMA ONDA DE VENTA"}
      </div>
    </>
  );
};

const EnergyConcentration: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const period = Math.max(
    cuePulse(scene, "period-finales-477", frame, fps),
    cuePulse(scene, "number-80-481", frame, fps),
  );
  const turn = cuePulse(scene, "turn-pero-482", frame, fps);
  const energy = cueLatch(scene, "energy-sector", frame, fps);
  const third = cueLatch(scene, "energy-third", frame, fps);
  const build = ease(frame, fps, 0.25, 2.2);
  return (
    <>
      <Header eyebrow="ARCHIVO · FINALES DE LOS 80" title="Antes fue la energía" />
      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          gap: 14,
          height: 500,
          left: 135,
          position: "absolute",
          top: 260,
          width: 990,
        }}
      >
        {Array.from({length: 15}, (_, index) => {
          const local = Math.max(0, Math.min(1, build * 1.7 - index * 0.07));
          const isEnergy = index < 5;
          return (
            <div
              key={index}
              style={{
                background: isEnergy
                  ? `linear-gradient(180deg,${C.gold},#805A08)`
                  : `linear-gradient(180deg,${alpha(C.cyan, 0.78)},${alpha(C.cyan, 0.18)})`,
                borderRadius: "12px 12px 5px 5px",
                boxShadow:
                  isEnergy && (energy > 0.03 || third > 0.03)
                    ? `0 0 30px ${alpha(C.gold, 0.52)}`
                    : "none",
                height: 90 + ((index * 53) % 170) * local,
                opacity: 0.22 + local * 0.78,
                transform: `translateY(${(1 - local) * 90}px)`,
                width: 52,
              }}
            />
          );
        })}
        <div
          style={{
            borderBottom: `3px solid ${C.gold}`,
            bottom: -54,
            color: C.gold,
            fontFamily: DATA_FONT_FAMILY,
            fontSize: 20,
            fontWeight: 900,
            left: 0,
            paddingBottom: 8,
            position: "absolute",
            textAlign: "center",
            width: 5 * 66 - 14,
          }}
        >
          ENERGÍA
        </div>
      </div>
      <div
        style={{
          color: C.gold,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 190,
          fontWeight: 950,
          letterSpacing: -10,
          position: "absolute",
          right: 120,
          top: 310,
          transform: `scale(${0.9 + third * 0.1})`,
        }}
      >
        ≈⅓
      </div>
      <div
        style={{
          color: C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 37,
          fontWeight: 850,
          position: "absolute",
          right: 125,
          textAlign: "right",
          top: 520,
          width: 550,
        }}
      >
        del índice concentrado
        <br />
        en un solo sector
      </div>
      <div
        style={{
          background: turn > 0.04 ? C.red : C.gold,
          height: 10,
          left: 135,
          position: "absolute",
          top: 855,
          transform: `scaleX(${0.2 + period * 0.8})`,
          transformOrigin: "left",
          width: 1630,
        }}
      />
      <div
        style={{
          color: C.muted,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 20,
          left: 135,
          letterSpacing: 2,
          position: "absolute",
          top: 885,
        }}
      >
        CONCENTRACIÓN → DESARME → ARRASTRE DEL ÍNDICE
      </div>
    </>
  );
};

const UnwindToPresent: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const concentration = cuePulse(scene, "massive-concentration", frame, fps);
  const unwind = cueLatch(scene, "concentration-unwinds", frame, fps);
  const marketDown = cueLatch(scene, "market-follows-down", frame, fps);
  const present = cueLatch(scene, "turn-ahora-518", frame, fps);
  const logos = scene.assets.slice(0, 7);
  return (
    <>
      <Header
        eyebrow={present > 0.04 ? "CORTE AL PRESENTE" : "MECÁNICA DEL DESARME"}
        title={present > 0.04 ? "La concentración vuelve" : "Cuando el núcleo se rompe"}
      />
      <div
        style={{
          display: "flex",
          gap: 18,
          left: 105,
          position: "absolute",
          right: 105,
          top: 310,
        }}
      >
        {logos.map((asset, index) => {
          const stagger = Math.max(
            0,
            Math.min(1, concentration * 1.6 - index * 0.08),
          );
          const collapse = Math.max(
            0,
            Math.min(1, unwind * 1.8 + marketDown * 0.55 - index * 0.09),
          );
          return (
            <div
              key={asset.id}
              style={{
                alignItems: "center",
                background:
                  present > 0.05
                    ? alpha(C.cyan, 0.12)
                    : alpha(C.gold, 0.14),
                border: `2px solid ${
                  collapse > 0.35 ? C.red : present > 0.05 ? C.cyan : C.gold
                }`,
                display: "flex",
                height: 360,
                justifyContent: "center",
                opacity: 0.3 + stagger * 0.7,
                transform: `translateY(${collapse * (125 + index * 10)}px) rotate(${collapse * (index % 2 ? 5 : -5)}deg)`,
                width: 220,
              }}
            >
              <Img
                src={staticFile(asset.path)}
                style={{height: 82, objectFit: "contain", width: 125}}
              />
            </div>
          );
        })}
      </div>
      <svg
        height="1080"
        style={{inset: 0, position: "absolute"}}
        viewBox="0 0 1920 1080"
        width="1920"
      >
        <path
          d="M120 760 C460 720 700 790 980 815 C1290 845 1510 830 1790 910"
          fill="none"
          opacity={marketDown}
          pathLength={1}
          stroke={C.red}
          strokeDasharray={`${marketDown} ${1 - marketDown}`}
          strokeLinecap="round"
          strokeWidth="14"
        />
        <polygon
          fill={C.red}
          opacity={marketDown}
          points="1785,865 1840,920 1762,930"
        />
      </svg>
      <div
        style={{
          background: C.cyan,
          bottom: 0,
          left: 0,
          opacity: present,
          position: "absolute",
          top: 0,
          transform: `translateX(${interpolate(present, [0, 1], [-1920, 1920])}px)`,
          width: 18,
        }}
      />
      <div
        style={{
          bottom: 80,
          color: marketDown > 0.05 ? C.red : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 35,
          fontWeight: 900,
          left: 108,
          position: "absolute",
        }}
      >
        {present > 0.05
          ? "MISMA MECÁNICA · MAYOR ESCALA"
          : "EL MERCADO GENERAL SIGUE AL BLOQUE DOMINANTE"}
      </div>
    </>
  );
};

const FortyPercentField: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const weakening = cueLatch(scene, "leaders-weakening", frame, fps);
  const forty = Math.max(
    cuePulse(scene, "number-40-544", frame, fps),
    cuePulse(scene, "percent-545-545", frame, fps),
  );
  const critical = cueLatch(scene, "critical-meaning", frame, fps);
  const enter = ease(frame, fps, 0.2, 1.3);
  return (
    <>
      <Header eyebrow="CONCENTRACIÓN ACTUAL NARRADA" title="40 de cada 100 piezas" />
      <div
        style={{
          display: "grid",
          gap: 9,
          gridTemplateColumns: "repeat(10, 58px)",
          left: 155,
          position: "absolute",
          top: 260,
        }}
      >
        {Array.from({length: 100}, (_, index) => {
          const active = index < 40;
          const local = Math.max(0, Math.min(1, enter * 1.8 - index * 0.011));
          return (
            <div
              key={index}
              style={{
                background: active
                  ? weakening > 0.05
                    ? C.red
                    : C.gold
                  : alpha(C.cyan, 0.12),
                border: `1px solid ${
                  active
                    ? weakening > 0.05
                      ? C.red
                      : C.gold
                    : alpha(C.cyan, 0.32)
                }`,
                boxShadow:
                  active && forty > 0.04
                    ? `0 0 18px ${alpha(C.gold, 0.55)}`
                    : "none",
                height: 49,
                opacity: 0.15 + local * 0.85,
                transform: `scale(${0.72 + local * 0.28})`,
                width: 58,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          color: weakening > 0.05 ? C.red : C.gold,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 205,
          fontWeight: 950,
          letterSpacing: -11,
          position: "absolute",
          right: 125,
          top: 325,
          transform: `scale(${0.92 + forty * 0.08})`,
        }}
      >
        40%
      </div>
      <div
        style={{
          color: C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 38,
          fontWeight: 850,
          lineHeight: 1.2,
          position: "absolute",
          right: 130,
          top: 555,
          width: 570,
        }}
      >
        bloque tecnológico
        <br />
        dentro del mercado
      </div>
      <div
        style={{
          background: critical > 0.04 ? alpha(C.red, 0.18) : alpha(C.gold, 0.13),
          borderLeft: `8px solid ${critical > 0.04 ? C.red : C.gold}`,
          bottom: 75,
          color: critical > 0.04 ? C.red : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 32,
          fontWeight: 900,
          left: 155,
          padding: "22px 30px",
          position: "absolute",
          right: 155,
        }}
      >
        {critical > 0.04
          ? "SI EL BLOQUE SE DEBILITA, EL PROBLEMA DEJA DE SER LOCAL"
          : "UNA MINORÍA DE EMPRESAS CONDICIONA EL CONJUNTO"}
      </div>
    </>
  );
};

const HistoricalConvergence: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const unwind = cueLatch(scene, "new-unwind-risk", frame, fps);
  const y2000 = cueLatch(scene, "date-2000-570", frame, fps);
  const y80 = cueLatch(scene, "number-80-574", frame, fps);
  const fall = cueLatch(scene, "investor-fall", frame, fps);
  const investor = cueLatch(scene, "common-investor", frame, fps);
  return (
    <>
      <Header eyebrow="DOS PRECEDENTES · UN MISMO RIESGO" title="Las ondas llegan al inversor" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920">
        <defs>
          <marker
            id="convergence-arrow"
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={C.red} />
          </marker>
        </defs>
        <g transform={`translate(330 ${470 + y80 * -18})`}>
          <circle
            fill={alpha(C.gold, 0.14)}
            r={126 + y80 * 10}
            stroke={y80 > 0.03 ? C.gold : alpha(C.gold, 0.55)}
            strokeWidth="5"
          />
          <text
            fill={C.gold}
            fontFamily={DATA_FONT_FAMILY}
            fontSize="54"
            fontWeight="950"
            textAnchor="middle"
            y="-8"
          >
            1980s
          </text>
          <text
            fill={C.white}
            fontFamily={FINANCE_FONT_FAMILY}
            fontSize="27"
            fontWeight="850"
            textAnchor="middle"
            y="42"
          >
            ENERGÍA
          </text>
        </g>
        <g transform={`translate(830 ${330 + y2000 * -18})`}>
          <rect
            fill={alpha(C.cyan, 0.13)}
            height="250"
            rx="16"
            stroke={y2000 > 0.03 ? C.cyan : alpha(C.cyan, 0.55)}
            strokeWidth="5"
            width="290"
            x="-145"
            y="-125"
          />
          <text
            fill={C.cyan}
            fontFamily={DATA_FONT_FAMILY}
            fontSize="58"
            fontWeight="950"
            textAnchor="middle"
            y="-10"
          >
            2000
          </text>
          <text
            fill={C.white}
            fontFamily={FINANCE_FONT_FAMILY}
            fontSize="26"
            fontWeight="850"
            textAnchor="middle"
            y="40"
          >
            PUNTOCOM
          </text>
        </g>
        <path
          d="M450 500 C760 540 1070 650 1410 690"
          fill="none"
          markerEnd="url(#convergence-arrow)"
          opacity={Math.max(y80, unwind, fall)}
          pathLength={1}
          stroke={C.red}
          strokeDasharray={`${Math.max(y80, unwind, fall)} ${1 - Math.max(y80, unwind, fall)}`}
          strokeWidth={7 + fall * 5}
        />
        <path
          d="M970 390 C1120 460 1260 570 1410 690"
          fill="none"
          markerEnd="url(#convergence-arrow)"
          opacity={Math.max(y2000, unwind, fall)}
          pathLength={1}
          stroke={C.red}
          strokeDasharray={`${Math.max(y2000, unwind, fall)} ${1 - Math.max(y2000, unwind, fall)}`}
          strokeWidth={7 + fall * 5}
        />
        <g
          opacity={0.45 + investor * 0.55}
          transform={`translate(1510 ${620 + fall * 30}) scale(${1 + investor * 0.08})`}
        >
          <circle
            cx="0"
            cy="0"
            fill={investor > 0.03 ? C.white : C.muted}
            r="46"
          />
          <path
            d="M-88 180 C-72 75 72 75 88 180 Z"
            fill={investor > 0.03 ? C.white : C.muted}
          />
          <rect
            fill={C.bg}
            height="68"
            rx="8"
            stroke={C.red}
            strokeWidth="4"
            width="128"
            x="-64"
            y="92"
          />
          <text
            fill={C.red}
            fontFamily={DATA_FONT_FAMILY}
            fontSize="18"
            fontWeight="900"
            textAnchor="middle"
            x="0"
            y="134"
          >
            CARTERA
          </text>
        </g>
      </svg>
      <div
        style={{
          bottom: 80,
          color: fall > 0.04 ? C.red : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 35,
          fontWeight: 900,
          left: 112,
          position: "absolute",
        }}
      >
        {fall > 0.04
          ? "MÁS CONCENTRACIÓN · MAYOR ONDA POTENCIAL"
          : "LOS LÍDERES CAMBIAN; LA MECÁNICA SE REPITE"}
      </div>
    </>
  );
};

export const ConcentrationCycleScene: React.FC<{scene: EditorialScene}> = ({
  scene,
}) => {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 68% 42%, rgba(44,93,135,.16), transparent 35%), linear-gradient(145deg,#050817,#070C1C 58%,#03050E)",
        overflow: "hidden",
      }}
    >
      {scene.id === "scene-019" ? <MarketContagion scene={scene} /> : null}
      {scene.id === "scene-020" ? <EnergyConcentration scene={scene} /> : null}
      {scene.id === "scene-021" ? <UnwindToPresent scene={scene} /> : null}
      {scene.id === "scene-022" ? <FortyPercentField scene={scene} /> : null}
      {scene.id === "scene-023" ? <HistoricalConvergence scene={scene} /> : null}
    </AbsoluteFill>
  );
};
