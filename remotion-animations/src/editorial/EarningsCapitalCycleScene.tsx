import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {DATA_FONT_FAMILY, FINANCE_FONT_FAMILY} from "../motion/fonts";
import {EditorialScene} from "./schemas";

const C = {
  bg: "#050817",
  panel: "#0B1327",
  white: "#FFF9E8",
  muted: "#9AA6BC",
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
const ease = (frame: number, fps: number, from: number, to: number) =>
  interpolate(frame, [from * fps, to * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
const cue = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
  latch = false,
) => {
  const item = scene.semanticCues.find((candidate) => candidate.id === id);
  if (!item) return 0;
  const start = item.atSeconds;
  if (latch) return ease(frame, fps, start, start + 0.32);
  return interpolate(
    frame,
    [
      start * fps,
      (start + 0.2) * fps,
      (start + Math.max(0.7, item.durationSeconds) * 0.75) * fps,
      (start + Math.max(0.7, item.durationSeconds)) * fps,
    ],
    [0, 1, 1, 0],
    clamp,
  );
};

const Header: React.FC<{eyebrow: string; title: string}> = ({
  eyebrow,
  title,
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
          left: 240,
          letterSpacing: 3,
          opacity: enter,
          position: "absolute",
          right: 240,
          textAlign: "center",
          top: 62,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 57,
          fontWeight: 900,
          left: 240,
          letterSpacing: -2,
          opacity: enter,
          position: "absolute",
          right: 240,
          textAlign: "center",
          top: 96,
        }}
      >
        {title}
      </div>
    </>
  );
};

const CenteredFooter: React.FC<{children: React.ReactNode; color?: string}> = ({
  children,
  color = C.white,
}) => (
  <div
    style={{
      bottom: 70,
      color,
      fontFamily: FINANCE_FONT_FAMILY,
      fontSize: 35,
      fontWeight: 900,
      left: 180,
      position: "absolute",
      right: 180,
      textAlign: "center",
    }}
  >
    {children}
  </div>
);

const EvidenceGate: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reason = cue(scene, "clear-reason", frame, fps, true);
  const understand = cue(scene, "understand-first", frame, fps, true);
  const assume = cue(scene, "avoid-assumption", frame, fps, true);
  const crash = cue(scene, "crash-tomorrow", frame, fps);
  const travel = ease(frame, fps, 0.3, 2.8);
  const stopped = Math.max(understand, assume);
  return (
    <>
      <Header eyebrow="ANTES DE SACAR CONCLUSIONES" title="La evidencia frena el atajo" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920">
        <defs>
          <marker id="gate-arrow" markerHeight="9" markerWidth="9" orient="auto" refX="8" refY="4.5">
            <path d="M0,0 L9,4.5 L0,9 Z" fill={C.red} />
          </marker>
        </defs>
        <path
          d="M160 310 C520 360 720 520 1040 675 C1250 775 1460 790 1750 875"
          fill="none"
          markerEnd="url(#gate-arrow)"
          opacity={0.24 + travel * 0.76}
          pathLength={1}
          stroke={C.red}
          strokeDasharray={`${travel} ${1 - travel}`}
          strokeWidth="13"
        />
        <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="900" x="136" y="270">
          CONCENTRACIÓN → “CAÍDA MAÑANA”
        </text>
        <g transform={`translate(${1060 - stopped * 90} 520) rotate(-14)`}>
          <rect
            fill={C.panel}
            height="410"
            rx="18"
            stroke={reason > 0.02 ? C.gold : C.white}
            strokeWidth="7"
            width="72"
          />
          <rect fill={C.gold} height="28" width="430" x="-180" y="175" />
          <text
            fill={C.gold}
            fontFamily={FINANCE_FONT_FAMILY}
            fontSize="38"
            fontWeight="950"
            textAnchor="middle"
            transform="rotate(14)"
            x="260"
            y="105"
          >
            BENEFICIOS
          </text>
        </g>
        <g opacity={stopped} transform="translate(1260 330)">
          <circle fill={alpha(C.green, 0.14)} r="135" stroke={C.green} strokeWidth="5" />
          <path d="M-55 0 L-14 44 L70 -58" fill="none" stroke={C.green} strokeLinecap="round" strokeWidth="20" />
          <text fill={C.white} fontFamily={FINANCE_FONT_FAMILY} fontSize="30" fontWeight="900" textAnchor="middle" y="205">
            COMPROBAR PRIMERO
          </text>
        </g>
      </svg>
      <div
        style={{
          bottom: 75,
          color: crash > 0.03 ? C.red : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 35,
          fontWeight: 900,
          left: 112,
          position: "absolute",
        }}
      >
        {crash > 0.03 ? "CONCENTRACIÓN NO EQUIVALE A COLAPSO INMEDIATO" : "PRIMERO: ENTENDER POR QUÉ SE CONCENTRA"}
      </div>
    </>
  );
};

const ProfitMagnet: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const profits = cue(scene, "profits-key", frame, fps, true);
  const capital = cue(scene, "profits-attract-capital", frame, fps, true);
  const money = cue(scene, "money-flows", frame, fps, true);
  const gains = cue(scene, "largest-gains", frame, fps, true);
  const pull = Math.max(capital, money, gains);
  const zoom = 1 + gains * 0.07;
  return (
    <>
      <Header eyebrow="MOTOR DE LA CONCENTRACIÓN" title="Los beneficios atraen capital" />
      <div
        style={{
          height: 650,
          left: 240,
          position: "absolute",
          top: 215,
          transform: `scale(${zoom})`,
          transformOrigin: "center",
          width: 1440,
        }}
      >
        <svg height="650" viewBox="0 0 1440 650" width="1440">
          <g opacity={0.55 + profits * 0.45} transform="translate(90 125)">
            <path
              d="M55 155 C55 55 145 0 285 0 C425 0 515 55 515 155 L515 390 C515 455 455 505 380 505 H190 C115 505 55 455 55 390 Z"
              fill={alpha(C.gold, 0.17)}
              stroke={C.gold}
              strokeWidth="9"
            />
            <ellipse cx="285" cy="110" fill={C.panel} rx="93" ry="18" stroke={C.gold} strokeWidth="7" />
            <circle cx="470" cy="410" fill={C.gold} r="24" />
            <circle cx="105" cy="410" fill={C.gold} r="24" />
            <text fill={C.white} fontFamily={FINANCE_FONT_FAMILY} fontSize="40" fontWeight="950" textAnchor="middle" x="285" y="285">
              BENEFICIOS
            </text>
            <text fill={C.gold} fontFamily={DATA_FONT_FAMILY} fontSize="26" fontWeight="900" textAnchor="middle" x="285" y="330">
              DEPÓSITO DE VALOR
            </text>
          </g>
          {Array.from({length: 14}, (_, index) => {
            const column = index % 7;
            const startX = 760 + column * 86;
            const startY = 65 + Math.floor(index / 7) * 90;
            const t = Math.max(0, Math.min(1, pull * 1.8 - index * 0.085));
            const x = startX + (375 - startX) * t;
            const y = startY + (240 + (index % 4) * 28 - startY) * t;
            return (
              <g key={index} opacity={0.28 + t * 0.72} transform={`translate(${x} ${y}) rotate(${t * 300})`}>
                <circle fill={index % 2 ? C.gold : C.cyan} r="25" stroke={C.white} strokeOpacity=".35" strokeWidth="3" />
                <text fill={C.bg} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="950" textAnchor="middle" y="8">
                  €
                </text>
              </g>
            );
          })}
          <g opacity={gains} transform={`translate(1010 ${335 - gains * 24})`}>
            <rect fill={C.panel} height="170" rx="24" stroke={C.cyan} strokeWidth="6" width="330" />
            <path d="M42 125 H285" stroke={C.muted} strokeWidth="8" />
            <path d="M55 114 L132 82 L203 91 L275 38" fill="none" stroke={C.gold} strokeWidth="10" />
            <text fill={C.cyan} fontFamily={DATA_FONT_FAMILY} fontSize="25" fontWeight="900" textAnchor="middle" x="165" y="218">
              MAYOR PESO EN EL ÍNDICE
            </text>
          </g>
        </svg>
      </div>
      <CenteredFooter>BENEFICIOS → ENTRADA DE CAPITAL → MAYOR PESO</CenteredFooter>
    </>
  );
};

const ProfitDoubling: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const y1995 = cue(scene, "date-1995-662", frame, fps, true);
  const y2000 = cue(scene, "date-2000-666", frame, fps, true);
  const doubled = cue(scene, "profits-doubled", frame, fps, true);
  const base = ease(frame, fps, 0.25, 1.4);
  return (
    <>
      <Header eyebrow="SECTOR TECNOLÓGICO · 1995–2000" title="El beneficio casi duplica su altura" />
      <div style={{alignItems: "flex-end", display: "flex", gap: 150, height: 610, left: 330, position: "absolute", top: 230}}>
        {[
          {label: "1995", height: 250, active: y1995, value: "1×"},
          {label: "2000", height: 500, active: Math.max(y2000, doubled), value: "≈2×"},
        ].map((item, index) => (
          <div key={item.label} style={{alignItems: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end", width: 430}}>
            <div style={{color: index ? C.gold : C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 78, fontWeight: 950, marginBottom: 18}}>{item.value}</div>
            <div
              style={{
                background: index ? `linear-gradient(180deg,${C.gold},#765307)` : `linear-gradient(180deg,${C.cyan},#164E6B)`,
                boxShadow: item.active > 0.03 ? `0 0 42px ${alpha(index ? C.gold : C.cyan, 0.48)}` : "none",
                height: item.height * base,
                width: 300,
              }}
            />
            <div style={{color: C.white, fontFamily: DATA_FONT_FAMILY, fontSize: 29, fontWeight: 900, marginTop: 20}}>{item.label}</div>
          </div>
        ))}
      </div>
      <div style={{color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 28, fontWeight: 750, position: "absolute", right: 170, textAlign: "right", top: 430, width: 520}}>
        Relación cualitativa basada en la afirmación narrada
      </div>
      <div style={{bottom: 75, color: doubled > 0.03 ? C.gold : C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 35, fontWeight: 900, left: 112, position: "absolute"}}>
        CRECEN LOS BENEFICIOS · CRECE EL PESO POTENCIAL
      </div>
    </>
  );
};

const IndexBandExpansion: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sp = cue(scene, "number-500-683", frame, fps, true);
  const fifteen = Math.max(cue(scene, "number-15-686", frame, fps, true), cue(scene, "percent-687-687", frame, fps, true));
  const thirty = cue(scene, "weight-thirty", frame, fps, true);
  const width = 240 + thirty * 240;
  return (
    <>
      <Header eyebrow="CONSECUENCIA EN EL S&P 500" title="La franja tecnológica gana espacio" />
      <div style={{display: "flex", height: 300, left: 150, position: "absolute", right: 150, top: 365}}>
        <div style={{alignItems: "center", background: alpha(C.gold, 0.25), border: `4px solid ${C.gold}`, boxShadow: fifteen > 0.03 ? `0 0 34px ${alpha(C.gold, 0.38)}` : "none", display: "flex", justifyContent: "center", width}}>
          <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 75, fontWeight: 950}}>{thirty > 0.03 ? "≈30%" : "15%"}</div>
        </div>
        <div style={{alignItems: "center", background: alpha(C.cyan, 0.1), border: `4px solid ${alpha(C.cyan, 0.55)}`, color: C.cyan, display: "flex", flex: 1, fontFamily: DATA_FONT_FAMILY, fontSize: 42, fontWeight: 900, justifyContent: "center"}}>
          RESTO DEL ÍNDICE
        </div>
      </div>
      <div style={{color: C.gold, fontFamily: FINANCE_FONT_FAMILY, fontSize: 28, fontWeight: 900, left: 150, position: "absolute", top: 700, width, textAlign: "center"}}>
        TECNOLOGÍA
      </div>
      <div style={{bottom: 75, color: sp > 0.03 ? C.white : C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 35, fontWeight: 900, left: 112, position: "absolute"}}>
        EL PESO SIGUE AL BENEFICIO
      </div>
    </>
  );
};

const ReverseValve: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const turn = cue(scene, "turn-pero-692", frame, fps, true);
  const falling = cue(scene, "profits-fall", frame, fps, true);
  const miss = cue(scene, "miss-expectations", frame, fps, true);
  const reverse = Math.max(turn * 0.35, falling, miss);
  const closed = Math.max(0, Math.min(1, reverse * 1.25));
  return (
    <>
      <Header eyebrow="EL MISMO MECANISMO, AL REVÉS" title="Cuando cae el beneficio, se corta el flujo" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920">
        <g transform="translate(360 270)">
          <rect fill={alpha(C.cyan, 0.14)} height="300" rx="26" stroke={C.cyan} strokeWidth="7" width="410" />
          <path d="M45 255 H365" stroke={C.cyan} strokeOpacity=".35" strokeWidth="9" />
          <text fill={C.white} fontFamily={FINANCE_FONT_FAMILY} fontSize="38" fontWeight="950" textAnchor="middle" x="205" y="140">
            BENEFICIOS
          </text>
          <text fill={falling > 0.03 ? C.red : C.gold} fontFamily={DATA_FONT_FAMILY} fontSize="31" fontWeight="900" textAnchor="middle" x="205" y="195">
            {falling > 0.03 ? "CAEN" : "SOSTIENEN EL FLUJO"}
          </text>
        </g>
        <path d="M770 420 H980 Q1080 420 1080 520 V590 H1260" fill="none" stroke={C.cyan} strokeWidth="78" />
        <path d="M780 420 H980 Q1080 420 1080 520 V590 H1260" fill="none" stroke={C.panel} strokeWidth="52" />
        <g transform={`translate(1050 325) rotate(${closed * 90})`}>
          <rect fill={closed > 0.55 ? C.red : C.gold} height="28" rx="14" width="240" x="-120" y="-14" />
          <circle fill={C.panel} r="33" stroke={closed > 0.55 ? C.red : C.gold} strokeWidth="10" />
        </g>
        {Array.from({length: 8}, (_, index) => {
          const fall = ((frame / fps) * 175 + index * 92) % 560;
          return (
            <path
              d={`M${1120 + (index % 2) * 55} ${610 + fall * 0.38} C${1100 + (index % 2) * 50} ${640 + fall * 0.38} ${1110 + (index % 2) * 45} ${675 + fall * 0.38} ${1120 + (index % 2) * 55} ${700 + fall * 0.38}`}
              fill={C.gold}
              key={index}
              opacity={(1 - closed) * (1 - fall / 700)}
            />
          );
        })}
        <g transform="translate(1260 540)">
          <path d="M0 0 H390 V270 H0 Z" fill={alpha(C.gold, 0.1)} stroke={C.gold} strokeWidth="7" />
          <path d={`M20 ${230 - (1 - closed) * 105} H370 V250 H20 Z`} fill={alpha(C.gold, 0.62)} />
          <text fill={C.white} fontFamily={FINANCE_FONT_FAMILY} fontSize="38" fontWeight="950" textAnchor="middle" x="195" y="120">
            CAPITAL
          </text>
          <text fill={closed > 0.55 ? C.red : C.gold} fontFamily={DATA_FONT_FAMILY} fontSize="27" fontWeight="900" textAnchor="middle" x="195" y="168">
            {closed > 0.55 ? "ENTRADA DETENIDA" : "ENTRADA ACTIVA"}
          </text>
        </g>
        <g opacity={miss} transform="translate(700 770)">
          <rect fill={C.panel} height="90" rx="16" stroke={C.red} strokeWidth="5" width="520" />
          <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="25" fontWeight="950" textAnchor="middle" x="260" y="56">
            EXPECTATIVAS INCUMPLIDAS → GRIFO CERRADO
          </text>
        </g>
      </svg>
      <CenteredFooter color={closed > 0.55 ? C.red : C.white}>
        {closed > 0.55 ? "SIN BENEFICIO, DEJA DE ENTRAR CAPITAL" : "EL CAPITAL FLUYE MIENTRAS RESPONDE EL BENEFICIO"}
      </CenteredFooter>
    </>
  );
};

const CapitalImplosion: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const capital = cue(scene, "capital-entered", frame, fps, true);
  const exit = cue(scene, "capital-exits-fast", frame, fps, true);
  const collapse = cue(scene, "concentration-collapses", frame, fps, true);
  const violent = cue(scene, "violent-collapse", frame, fps, true);
  const fall = Math.max(collapse, violent);
  return (
    <>
      <Header eyebrow="DESARME DE LA CONCENTRACIÓN" title="El capital abandona la estructura" />
      <div style={{height: 610, left: 245, position: "absolute", top: 225, width: 720}}>
        <div
          style={{
            background: `linear-gradient(90deg,${alpha(C.gold, 0.2)},${C.panel})`,
            border: `7px solid ${fall > 0.05 ? C.red : C.gold}`,
            bottom: 20,
            height: 500,
            left: 70,
            position: "absolute",
            transform: `rotate(${fall * 12}deg) translate(${fall * 85}px,${fall * 105}px)`,
            transformOrigin: "bottom right",
            width: 500,
          }}
        >
          <div style={{background: C.gold, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 25, fontWeight: 950, left: 45, padding: "13px 20px", position: "absolute", right: 45, textAlign: "center", top: 28}}>
            CONCENTRACIÓN
          </div>
          {Array.from({length: 24}, (_, index) => {
          const col = index % 4;
          const row = Math.floor(index / 4);
          const fly = Math.max(0, Math.min(1, exit * 1.7 - index * 0.035));
          return (
            <div
              key={index}
              style={{
                background: fly > 0.1 ? C.gold : alpha(C.cyan, 0.42),
                border: `3px solid ${C.gold}`,
                height: 46,
                left: 55 + col * 105 + fly * (720 + col * 34),
                opacity: 0.35 + capital * 0.65,
                position: "absolute",
                top: 118 + row * 58 - fly * (55 + row * 16),
                transform: `rotate(${fly * (index % 2 ? 18 : -14)}deg)`,
                width: 72,
              }}
            />
          );
        })}
        </div>
        {Array.from({length: 8}, (_, index) => (
          <div
            key={`debris-${index}`}
            style={{
              background: index % 2 ? C.red : C.gold,
              bottom: 15 + (index % 3) * 12,
              height: 18 + (index % 2) * 12,
              left: 410 + index * 38 + fall * index * 8,
              opacity: fall,
              position: "absolute",
              transform: `rotate(${index * 24}deg)`,
              width: 48,
            }}
          />
        ))}
      </div>
      <svg height="1080" style={{inset: 0, position: "absolute"}} viewBox="0 0 1920 1080" width="1920">
        <path d="M1020 540 C1125 500 1190 475 1270 430" fill="none" opacity={exit} stroke={C.red} strokeDasharray="14 12" strokeWidth="7" />
        <path d="M1020 610 C1125 630 1190 650 1270 690" fill="none" opacity={exit} stroke={C.red} strokeDasharray="14 12" strokeWidth="7" />
      </svg>
      <div
        style={{
          background: C.panel,
          border: `6px solid ${exit > 0.03 ? C.red : C.gold}`,
          borderRadius: 20,
          color: exit > 0.03 ? C.red : C.gold,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 52,
          fontWeight: 950,
          letterSpacing: 4,
          padding: "25px 35px",
          position: "absolute",
          right: 120,
          textAlign: "center",
          top: 300,
          width: 520,
        }}
      >
        SALIDA DE CAPITAL
      </div>
      <CenteredFooter color={violent > 0.03 ? C.red : C.white}>
        {violent > 0.03 ? "LA CONCENTRACIÓN PIERDE SU ESTRUCTURA" : "EL MISMO CAPITAL QUE ENTRÓ PUEDE SALIR"}
      </CenteredFooter>
    </>
  );
};

export const EarningsCapitalCycleScene: React.FC<{scene: EditorialScene}> = ({
  scene,
}) => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 64% 40%,rgba(42,101,142,.14),transparent 36%),linear-gradient(145deg,#050817,#070D1D 58%,#03050E)",
      overflow: "hidden",
    }}
  >
    {scene.id === "scene-024" ? <EvidenceGate scene={scene} /> : null}
    {scene.id === "scene-025" ? <ProfitMagnet scene={scene} /> : null}
    {scene.id === "scene-026" ? <ProfitDoubling scene={scene} /> : null}
    {scene.id === "scene-027" ? <IndexBandExpansion scene={scene} /> : null}
    {scene.id === "scene-028" ? <ReverseValve scene={scene} /> : null}
    {scene.id === "scene-029" ? <CapitalImplosion scene={scene} /> : null}
  </AbsoluteFill>
);
