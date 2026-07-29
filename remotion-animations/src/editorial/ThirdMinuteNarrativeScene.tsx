import {
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {DATA_FONT_FAMILY, FINANCE_FONT_FAMILY} from "../motion/fonts";
import {EditorialScene} from "./schemas";

const C = {
  bg: "#050817",
  panel: "#111A31",
  white: "#FFF9E8",
  muted: "#9299AD",
  gold: "#FFC83D",
  cyan: "#6ED4FF",
  green: "#49C98A",
  red: "#FF5F6D",
} as const;
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(
    value.slice(2, 4),
    16,
  )},${Number.parseInt(value.slice(4, 6), 16)},${opacity})`;
};
const cue = (scene: EditorialScene, id: string) =>
  scene.semanticCues.find((item) => item.id === id);
const pulse = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const item = cue(scene, id);
  if (!item) return 0;
  const start = item.atSeconds * fps;
  const end = (item.atSeconds + item.durationSeconds) * fps;
  return Math.min(
    interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp),
    interpolate(frame, [end - 0.22 * fps, end], [1, 0], clamp),
  );
};
const enter = (frame: number, fps: number, from: number, to: number) =>
  interpolate(frame, [from * fps, to * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const TARGETS: Record<string, [number, number, number]> = {
  "dotcom-era": [50, 34, 0.11],
  "dotcom-company-row": [50, 60, 0.08],
  "dotcom-company-cisco": [24, 60, 0.14],
  "dotcom-company-microsoft": [41, 60, 0.14],
  "dotcom-company-intel": [59, 60, 0.14],
  "dotcom-company-dell": [76, 60, 0.14],
  "dominant-core": [50, 58, 0.12],
  "unstoppable-ring": [50, 58, 0.09],
  "competition-lock": [50, 72, 0.11],
  "peak-warning": [72, 41, 0.14],
  "market-peak": [76, 37, 0.15],
  "early-window": [56, 54, 0.13],
  "leaders-drop": [70, 66, 0.16],
  "weak-leaders": [30, 50, 0.12],
  "leader-pulse": [38, 50, 0.11],
  "contagion-wave": [55, 54, 0.15],
  "whole-market-grid": [73, 54, 0.13],
  "claim-companies": [50, 30, 0.09],
  "unsupported-thirty": [50, 57, 0.17],
  "index-risk": [72, 69, 0.14],
};

const Camera: React.FC<{scene: EditorialScene; children: React.ReactNode}> = ({
  scene,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const active = scene.semanticCues
    .filter((item) =>
      ["focus", "highlight", "zoom", "verify", "connect"].includes(item.action),
    )
    .map((item) => ({item, amount: pulse(scene, item.id, frame, fps)}))
    .sort((a, b) => b.amount - a.amount)[0];
  const amount = active?.amount ?? 0;
  const [x, y, zoom] = TARGETS[active?.item.target ?? ""] ?? [50, 50, 0.08];
  return (
    <div
      style={{
        height: "100%",
        position: "absolute",
        transform: `scale(${1 + amount * zoom})`,
        transformOrigin: `${x}% ${y}%`,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
};

const Header: React.FC<{scene: EditorialScene}> = ({scene}) => (
  <div
    style={{
      left: 210,
      position: "absolute",
      right: 210,
      textAlign: "center",
      top: 54,
      zIndex: 5,
    }}
  >
    <div
      style={{
        color: C.white,
        fontFamily: FINANCE_FONT_FAMILY,
        fontSize: 52,
        fontWeight: 850,
        letterSpacing: -1.8,
      }}
    >
      {scene.headline}
    </div>
    <div
      style={{
        color: C.muted,
        fontFamily: FINANCE_FONT_FAMILY,
        fontSize: 18,
        marginTop: 7,
      }}
    >
      {scene.supportingText}
    </div>
  </div>
);

const logoFor = (scene: EditorialScene, label: string) =>
  scene.assets.find(
    (asset) =>
      asset.kind === "logo" &&
      asset.label.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
        label.replace(/[^a-z0-9]/gi, "").toLowerCase(),
  );

const DotcomCards: React.FC<{
  scene: EditorialScene;
  top?: number;
  compact?: boolean;
}> = ({scene, top = 420, compact = false}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = ["CISCO", "MICROSOFT", "INTEL", "DELL"];
  const focuses = labels.map((label) =>
    pulse(scene, `company-${label.toLowerCase()}`, frame, fps),
  );
  const anyFocus = Math.max(0, ...focuses);
  return (
    <div
      style={{
        display: "flex",
        gap: compact ? 24 : 42,
        justifyContent: "center",
        left: 150,
        position: "absolute",
        right: 150,
        top,
      }}
    >
      {labels.map((label, index) => {
        const reveal = enter(frame, fps, 0.45 + index * 0.12, 1 + index * 0.12);
        const focus = focuses[index];
        const asset = logoFor(scene, label);
        return (
          <div
            key={label}
            style={{
              alignItems: "center",
              background: `linear-gradient(150deg,${alpha(C.panel, 0.98)},${alpha(C.bg, 0.95)})`,
              border: `2px solid ${alpha(focus > 0.05 ? C.cyan : C.white, 0.18 + focus * 0.8)}`,
              borderRadius: 20,
              boxShadow: `0 0 ${20 + focus * 55}px ${alpha(C.cyan, focus * 0.42)}`,
              display: "flex",
              flexDirection: "column",
              height: compact ? 130 : 190,
              justifyContent: "center",
              opacity: reveal * (anyFocus > 0.08 ? 0.4 + focus * 0.6 : 1),
              transform: `translateY(${(1 - reveal) * 34 - focus * 20}px) scale(${0.9 + reveal * 0.1 + focus * 0.16})`,
              width: compact ? 170 : 250,
            }}
          >
            {asset ? (
              <Img
                src={staticFile(asset.path)}
                style={{
                  height: compact ? 58 : 88,
                  objectFit: "contain",
                  width: compact ? 92 : 136,
                }}
              />
            ) : null}
            <div
              style={{
                color: C.white,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: compact ? 14 : 19,
                fontWeight: 800,
                marginTop: 12,
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const HistoricalLeaders: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const era = pulse(scene, "dotcom-era", frame, fps);
  return (
    <>
      <div
        style={{
          color: era ? C.gold : C.muted,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 30 + era * 6,
          fontWeight: 900,
          left: 0,
          letterSpacing: 2,
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: 265,
        }}
      >
        1995 ━━━━━ FINALES DE LOS 90 ━━━━━ 2000
      </div>
      <DotcomCards scene={scene} />
      <div
        style={{
          color: C.cyan,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 22,
          fontWeight: 800,
          left: 0,
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: 690,
        }}
      >
        LOS CUATRO JINETES
      </div>
    </>
  );
};

const DominanceFacade: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dominant = pulse(scene, "dominant-force", frame, fps);
  const unstoppable = pulse(scene, "unstoppable", frame, fps);
  const locked = pulse(scene, "no-competition", frame, fps);
  const peak = pulse(scene, "approaching-peak", frame, fps);
  const cutaway = pulse(scene, "institution-cutaway", frame, fps);
  const nyse = scene.assets.find(
    (asset) => asset.id === "finance-cavaliers-nyse-facade",
  );
  return (
    <>
      <DotcomCards scene={scene} top={210} compact />
      <div
        style={{
          alignItems: "center",
          border: `4px solid ${peak > 0.05 ? C.red : C.gold}`,
          borderRadius: "50%",
          boxShadow: `0 0 ${50 + dominant * 55}px ${alpha(peak > 0.05 ? C.red : C.gold, 0.18 + dominant * 0.18)}`,
          display: "flex",
          height: 310,
          justifyContent: "center",
          left: 805,
          position: "absolute",
          top: 500,
          transform: `scale(${1 + unstoppable * 0.08 + peak * 0.035})`,
          width: 310,
        }}
      >
        <div style={{textAlign: "center"}}>
          <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 18}}>NARRATIVA</div>
          <div style={{color: C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 38, fontWeight: 900}}>DOMINIO</div>
          <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 16, marginTop: 8}}>TECNOLOGÍA → ECONOMÍA</div>
        </div>
      </div>
      <div
        style={{
          background: locked ? alpha(C.cyan, 0.16) : alpha(C.panel, 0.9),
          border: `1px solid ${alpha(C.cyan, 0.6)}`,
          borderRadius: 10,
          color: C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 22,
          fontWeight: 850,
          left: 710,
          padding: "14px 28px",
          position: "absolute",
          top: 850,
        }}
      >
        {peak > 0.08 ? "⚠ CERCA DEL TECHO" : locked > 0.08 ? "🔒 NADIE PODÍA COMPETIR" : "IMPARABLES"}
      </div>
      {nyse && cutaway > 0.01 ? (
        <div
          style={{
            inset: 0,
            opacity: cutaway,
            overflow: "hidden",
            position: "absolute",
            zIndex: 8,
          }}
        >
          <Img
            src={staticFile(nyse.path)}
            style={{
              filter: "brightness(0.48) contrast(1.08) saturate(0.72)",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.04 + cutaway * 0.035})`,
              width: "100%",
            }}
          />
          <div
            style={{
              background:
                "linear-gradient(180deg,rgba(5,8,23,.18),rgba(5,8,23,.9))",
              inset: 0,
              position: "absolute",
            }}
          />
          <div
            style={{
              bottom: 115,
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 54,
              fontWeight: 900,
              left: 140,
              position: "absolute",
            }}
          >
            WALL STREET
            <div
              style={{
                color: C.gold,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: 18,
                letterSpacing: 2,
                marginTop: 10,
              }}
            >
              LA NARRATIVA LLEGA A TODA LA ECONOMÍA
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const LeadershipLag: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = enter(frame, fps, 0.25, 1.8);
  const lag = pulse(scene, "leaders-lag", frame, fps);
  const early = pulse(scene, "months-before", frame, fps);
  return (
    <svg height="100%" viewBox="0 0 1920 1080" width="100%">
      <defs>
        <linearGradient id="early-zone" x1="0" x2="1">
          <stop offset="0" stopColor={alpha(C.cyan, 0)} />
          <stop offset="1" stopColor={alpha(C.cyan, 0.22 + early * 0.22)} />
        </linearGradient>
      </defs>
      <rect fill="url(#early-zone)" height="510" rx="16" width="470" x="890" y="270" />
      <line stroke={alpha(C.muted, 0.35)} strokeWidth="3" x1="180" x2="1740" y1="800" y2="800" />
      <path
        d="M180 710 C420 650 600 580 820 500 C1040 420 1260 310 1450 265 C1560 290 1640 355 1740 430"
        fill="none"
        pathLength={1}
        stroke={C.gold}
        strokeDasharray={`${draw} ${1 - draw}`}
        strokeLinecap="round"
        strokeWidth="8"
      />
      <path
        d="M180 720 C450 660 700 570 930 470 C1080 430 1190 455 1320 540 C1460 625 1580 680 1740 720"
        fill="none"
        pathLength={1}
        stroke={lag > 0.05 ? C.red : C.cyan}
        strokeDasharray={`${draw} ${1 - draw}`}
        strokeLinecap="round"
        strokeWidth={8 + lag * 4}
      />
      <line stroke={C.red} strokeDasharray="12 10" strokeWidth="4" x1="1450" x2="1450" y1="235" y2="800" />
      <text fill={C.gold} fontFamily={DATA_FONT_FAMILY} fontSize="23" fontWeight="800" x="1430" y="205">TECHO GENERAL</text>
      <text fill={C.cyan} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="800" x="960" y="835">MESES ANTES</text>
      <text fill={C.red} fontFamily={FINANCE_FONT_FAMILY} fontSize="31" fontWeight="900" x="1370" y="670">LÍDERES ↓</text>
      <text fill={C.gold} fontFamily={FINANCE_FONT_FAMILY} fontSize="25" fontWeight="850" x="1540" y="390">MERCADO</text>
    </svg>
  );
};

const ContagionSpread: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const contagion = pulse(scene, "contagion", frame, fps);
  const whole = pulse(scene, "whole-market", frame, fps);
  const sectors = ["FINANZAS", "INDUSTRIA", "CONSUMO", "SALUD", "ENERGÍA", "MERCADO"];
  const coreX = 960;
  const coreY = 540;
  const coreRadius = 72;
  return (
    <>
      <DotcomCards scene={scene} top={225} compact />
      <svg height="100%" viewBox="0 0 1920 1080" width="100%">
        {sectors.map((label, index) => {
          const angle = (Math.PI * 2 * index) / sectors.length;
          const baseX = 960 + Math.cos(angle) * 560;
          const baseY = 720 + Math.sin(angle) * 155;
          const infected = Math.max(0, Math.min(1, contagion * 1.7 - index * 0.12));
          const drift = infected * 22;
          const x = baseX + Math.cos(angle) * drift;
          const y = baseY + Math.sin(angle) * drift;
          const dx = x - coreX;
          const dy = y - coreY;
          const length = Math.max(1, Math.hypot(dx, dy));
          const unitX = dx / length;
          const unitY = dy / length;
          const startX = coreX + unitX * coreRadius;
          const startY = coreY + unitY * coreRadius;
          const rectangleFactor = Math.min(
            105 / Math.max(0.001, Math.abs(dx)),
            41 / Math.max(0.001, Math.abs(dy)),
          );
          const endX = x - dx * rectangleFactor;
          const endY = y - dy * rectangleFactor;
          const shake =
            infected > 0.15
              ? Math.sin(frame * 0.72 + index * 1.9) * infected * 4
              : 0;
          return (
            <g key={label}>
              <line
                stroke={alpha(C.red, 0.22 + infected * 0.72)}
                strokeDasharray={`${8 + infected * 8} 10`}
                strokeDashoffset={-frame * infected * 0.8}
                strokeWidth={3 + infected * 2.5}
                x1={startX}
                x2={endX}
                y1={startY}
                y2={endY}
              />
              <g transform={`translate(${shake} 0)`}>
                <rect
                  fill={
                    infected > 0.2
                      ? alpha(C.red, 0.16 + infected * 0.2)
                      : alpha(C.panel, 0.95)
                  }
                  height="82"
                  rx="12"
                  stroke={
                    infected > 0.2 ? C.red : alpha(C.white, 0.16)
                  }
                  strokeWidth={infected > 0.2 ? 3 : 2}
                  width="210"
                  x={x - 105}
                  y={y - 41}
                />
                <text
                  fill={infected > 0.2 ? C.white : C.muted}
                  fontFamily={DATA_FONT_FAMILY}
                  fontSize="17"
                  fontWeight="800"
                  textAnchor="middle"
                  x={x}
                  y={y + 6}
                >
                  {label}
                </text>
                {infected > 0.12 ? (
                  <g transform={`translate(${x + 86} ${y - 31}) scale(${0.7 + infected * 0.3})`}>
                    <circle fill={C.red} r="18" />
                    <text
                      fill={C.white}
                      fontFamily={DATA_FONT_FAMILY}
                      fontSize="23"
                      fontWeight="900"
                      textAnchor="middle"
                      x="0"
                      y="8"
                    >
                      !
                    </text>
                  </g>
                ) : null}
              </g>
            </g>
          );
        })}
        {[0, 1, 2].map((ring) => {
          const phase = Math.max(0, Math.min(1, contagion * 1.45 - ring * 0.2));
          return (
            <circle
              key={ring}
              cx={coreX}
              cy={coreY}
              fill="none"
              opacity={(1 - phase) * 0.7}
              r={coreRadius + phase * (210 + ring * 105)}
              stroke={C.red}
              strokeWidth={4 - ring * 0.7}
            />
          );
        })}
        <circle
          cx={coreX}
          cy={coreY}
          fill={alpha(C.red, 0.16 + contagion * 0.18)}
          r={coreRadius}
          stroke={C.red}
          strokeWidth="4"
        />
        <text
          fill={whole > 0.05 ? C.white : C.red}
          fontFamily={FINANCE_FONT_FAMILY}
          fontSize="31"
          fontWeight="900"
          textAnchor="middle"
          x={coreX}
          y={coreY - coreRadius - 28}
        >
          {whole > 0.05 ? "TODO EL MERCADO" : "CONTAGIO"}
        </text>
        <circle
          cx={coreX}
          cy={coreY}
          fill={C.red}
          opacity={contagion}
          r={9 + contagion * 5}
        />
      </svg>
    </>
  );
};

const ClaimEvidenceGap: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const claimed = pulse(scene, "claimed-thirty", frame, fps);
  const risk = pulse(scene, "index-impact", frame, fps);
  return (
    <>
      <DotcomCards scene={scene} top={205} compact />
      <div
        style={{
          alignItems: "center",
          background: alpha(C.red, 0.08 + claimed * 0.14),
          border: `3px solid ${alpha(C.red, 0.55 + claimed * 0.4)}`,
          borderRadius: 24,
          display: "flex",
          flexDirection: "column",
          height: 310,
          justifyContent: "center",
          left: 610,
          position: "absolute",
          top: 500,
          transform: `scale(${1 + claimed * 0.1})`,
          width: 700,
        }}
      >
        <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 104, fontWeight: 900, letterSpacing: -5}}>≈ 30 %</div>
        <div style={{background: C.red, color: C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 21, fontWeight: 900, marginTop: 4, padding: "10px 18px"}}>CIFRA SIN VERIFICAR</div>
        <div style={{color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 17, marginTop: 18}}>No se representa como gráfica hasta encontrar la serie primaria.</div>
      </div>
      <div
        style={{
          color: risk > 0.05 ? C.gold : C.muted,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 24,
          fontWeight: 850,
          left: 0,
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: 850,
        }}
      >
        EL PESO EN EL ÍNDICE AMPLIFICA EL IMPACTO
      </div>
    </>
  );
};

export const ThirdMinuteNarrativeScene: React.FC<{scene: EditorialScene}> = ({
  scene,
}) => {
  let content: React.ReactNode;
  switch (scene.kind) {
    case "historical-leaders":
      content = <HistoricalLeaders scene={scene} />;
      break;
    case "dominance-facade":
      content = <DominanceFacade scene={scene} />;
      break;
    case "leadership-lag":
      content = <LeadershipLag scene={scene} />;
      break;
    case "contagion-spread":
      content = <ContagionSpread scene={scene} />;
      break;
    default:
      content = <ClaimEvidenceGap scene={scene} />;
  }
  return (
    <>
      <Camera scene={scene}>
        {content}
      </Camera>
      <Header scene={scene} />
    </>
  );
};
