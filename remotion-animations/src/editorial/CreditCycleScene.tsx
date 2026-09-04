import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {DATA_FONT_FAMILY, FINANCE_FONT_FAMILY} from "../motion/fonts";
import {EditorialScene} from "./schemas";

import {EDITORIAL_COLORS as C} from "./palette";
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const ease = (frame: number, fps: number, a: number, b: number) =>
  interpolate(frame, [a * fps, b * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(
    value.slice(2, 4),
    16,
  )},${Number.parseInt(value.slice(4, 6), 16)},${opacity})`;
};
const cueAt = (scene: EditorialScene, wordIndex: number, fallback: number) =>
  scene.semanticCues.find((item) => item.anchorWordIndex === wordIndex)?.atSeconds ??
  fallback;

const Header: React.FC<{eyebrow: string; title: string; detail?: string}> = ({
  eyebrow,
  title,
  detail,
}) => (
  <div
    style={{
      left: 145,
      position: "absolute",
      right: 145,
      textAlign: "center",
      top: 48,
      zIndex: 8,
    }}
  >
    <div
      style={{
        color: C.gold,
        fontFamily: DATA_FONT_FAMILY,
        fontSize: 17,
        fontWeight: 900,
        letterSpacing: 3,
      }}
    >
      {eyebrow}
    </div>
    <div
      style={{
        color: C.ink,
        fontFamily: FINANCE_FONT_FAMILY,
        fontSize: 54,
        fontWeight: 950,
        letterSpacing: -1,
        marginTop: 10,
      }}
    >
      {title}
    </div>
    {detail ? (
      <div
        style={{
          color: C.muted,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 21,
          fontWeight: 600,
          marginTop: 8,
        }}
      >
        {detail}
      </div>
    ) : null}
  </div>
);

const Photo: React.FC<{path: string; position?: string; opacity?: number}> = ({
  path,
  position = "center",
  opacity = 0.42,
}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const travel = interpolate(frame, [0, durationInFrames], [1.03, 1.1], clamp);
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(path)}
        style={{
          height: "100%",
          objectFit: "cover",
          objectPosition: position,
          opacity,
          transform: `scale(${travel})`,
          width: "100%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg,rgba(3,7,17,.58),rgba(3,7,17,.72) 54%,rgba(3,7,17,.97)),linear-gradient(90deg,rgba(3,7,17,.78),transparent 48%,rgba(3,7,17,.64))",
        }}
      />
    </AbsoluteFill>
  );
};

const chartGeometry = (scene: EditorialScene) => {
  const chart = {x: 155, y: 250, width: 1610, height: 560};
  const values = scene.chartData.map((item) => item.value);
  const min = Math.min(-40, ...values);
  const max = Math.max(90, ...values);
  const x = (index: number) =>
    chart.x + (index / Math.max(1, scene.chartData.length - 1)) * chart.width;
  const y = (value: number) =>
    chart.y + chart.height - ((value - min) / (max - min)) * chart.height;
  const path = scene.chartData
    .map((item, index) => `${index ? "L" : "M"} ${x(index)} ${y(item.value)}`)
    .join(" ");
  return {chart, x, y, path};
};

const EasyCreditChart: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = ease(frame, fps, 0.25, 4.2);
  const low = ease(frame, fps, cueAt(scene, 1019, 1.88), cueAt(scene, 1019, 1.88) + 0.5);
  const easy = ease(frame, fps, cueAt(scene, 1029, 5.42), cueAt(scene, 1029, 5.42) + 0.45);
  const invest = ease(frame, fps, cueAt(scene, 1039, 10.84), cueAt(scene, 1039, 10.84) + 0.45);
  const {chart, y, path} = chartGeometry(scene);
  const zeroY = y(0);
  return (
    <>
      <Header
        eyebrow="LECTURA DE LA ENCUESTA SLOOS"
        title="Abajo significa crédito más accesible"
        detail="Porcentaje neto de bancos que endurecen estándares C&I"
      />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <rect
          fill={alpha(C.green, 0.09 + easy * 0.1)}
          height={chart.y + chart.height - zeroY}
          rx="18"
          width={chart.width}
          x={chart.x}
          y={zeroY}
        />
        {[0, 20, 40, 60, 80].map((value) => (
          <g key={value}>
            <line
              stroke={value === 0 ? alpha(C.green, 0.72) : alpha(C.muted, 0.18)}
              strokeWidth={value === 0 ? 4 : 2}
              x1={chart.x}
              x2={chart.x + chart.width}
              y1={y(value)}
              y2={y(value)}
            />
            <text
              fill={value === 0 ? C.green : C.muted}
              fontFamily={DATA_FONT_FAMILY}
              fontSize="20"
              textAnchor="end"
              x={chart.x - 18}
              y={y(value) + 7}
            >
              {value}%
            </text>
          </g>
        ))}
        <path
          d={path}
          fill="none"
          pathLength={1}
          stroke={C.gold}
          strokeDasharray={`${draw} 1`}
          strokeWidth="8"
        />
        <rect
          fill={alpha(C.green, 0.9)}
          height="56"
          opacity={easy}
          rx="10"
          width="405"
          x="750"
          y={zeroY + 24}
        />
        <text
          fill={C.bg}
          fontFamily={DATA_FONT_FAMILY}
          fontSize="24"
          fontWeight="950"
          opacity={easy}
          textAnchor="middle"
          x="952"
          y={zeroY + 61}
        >
          TERRENO BAJO · CRÉDITO FÁCIL
        </text>
      </svg>
      <div
        style={{
          bottom: 65,
          display: "flex",
          gap: 22,
          justifyContent: "center",
          left: 150,
          position: "absolute",
          right: 150,
        }}
      >
        {[
          ["↗", "INVERSIÓN"],
          ["+", "CONTRATACIÓN"],
          ["⤢", "EXPANSIÓN"],
        ].map(([icon, label], index) => (
          <div
            key={label}
            style={{
              alignItems: "center",
              background: alpha(C.cyan, 0.1),
              border: `2px solid ${alpha(C.cyan, 0.55)}`,
              borderRadius: 14,
              color: C.ink,
              display: "flex",
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 22,
              fontWeight: 900,
              gap: 16,
              opacity: invest,
              padding: "18px 30px",
              transform: `translateY(${(1 - invest) * 28 + index * 0}px)`,
            }}
          >
            <span style={{color: C.cyan, fontSize: 34}}>{icon}</span>
            {label}
          </div>
        ))}
      </div>
      <div
        style={{
          border: `3px solid ${C.green}`,
          borderRadius: "50%",
          height: 90,
          left: 855,
          opacity: low,
          position: "absolute",
          top: zeroY + 7,
          transform: `scale(${0.65 + low * 0.35})`,
          width: 190,
        }}
      />
    </>
  );
};

const EconomicFlywheel: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const finance = ease(frame, fps, cueAt(scene, 1049, 1.6), cueAt(scene, 1049, 1.6) + 0.45);
  const spending = ease(frame, fps, cueAt(scene, 1054, 3.42), cueAt(scene, 1054, 3.42) + 0.45);
  const bubble = ease(frame, fps, cueAt(scene, 1070, 9.98), cueAt(scene, 1070, 9.98) + 0.45);
  const nodes = [
    {label: "FINANCIACIÓN", icon: "€", x: 330, y: 455},
    {label: "CONSUMO", icon: "🛒", x: 785, y: 700},
    {label: "VENTAS", icon: "↗", x: 1240, y: 455},
    {label: "EMPLEO", icon: "●", x: 785, y: 220},
  ];
  const spin = frame / fps * 9;
  return (
    <>
      <Photo
        path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg"
        position="70% center"
        opacity={0.3}
      />
      <Header eyebrow="EL DINERO SE PROPAGA" title="El crédito flexible pone en marcha la economía" />
      <div
        style={{
          border: `4px solid ${bubble ? C.gold : C.cyan}`,
          borderRadius: "50%",
          height: 570,
          left: 675,
          position: "absolute",
          top: 230,
          transform: `rotate(${spin}deg)`,
          width: 570,
        }}
      />
      {nodes.map((node, index) => {
        const reveal = ease(frame, fps, 0.4 + index * 0.35, 1 + index * 0.35);
        return (
          <div
            key={node.label}
            style={{
              alignItems: "center",
              background: alpha(C.bg, 0.9),
              border: `3px solid ${index === 0 ? C.cyan : C.green}`,
              borderRadius: 18,
              boxShadow: `0 0 44px ${alpha(index === 0 ? C.cyan : C.green, reveal * 0.18)}`,
              display: "flex",
              flexDirection: "column",
              height: 150,
              justifyContent: "center",
              left: node.x,
              opacity: reveal,
              position: "absolute",
              top: node.y,
              transform: `translate(-50%,-50%) scale(${0.82 + reveal * 0.18})`,
              width: 260,
            }}
          >
            <div style={{color: C.gold, fontSize: 43, fontWeight: 950}}>{node.icon}</div>
            <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 21, fontWeight: 950, marginTop: 8}}>
              {node.label}
            </div>
          </div>
        );
      })}
      <div
        style={{
          alignItems: "center",
          background: alpha(C.cyan, 0.16),
          border: `5px solid ${C.cyan}`,
          borderRadius: "50%",
          color: C.ink,
          display: "flex",
          flexDirection: "column",
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 34,
          fontWeight: 950,
          height: 280,
          justifyContent: "center",
          left: 820,
          position: "absolute",
          textAlign: "center",
          top: 375,
          transform: `scale(${0.9 + finance * 0.1 + spending * 0.05})`,
          width: 280,
        }}
      >
        <span style={{color: C.cyan, fontSize: 78}}>€</span>
        GASTO
      </div>
      <div
        style={{
          background: C.gold,
          border: `4px solid ${C.ink}`,
          borderRadius: 12,
          bottom: 74,
          color: C.bg,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 25,
          fontWeight: 950,
          left: "50%",
          opacity: bubble,
          padding: "18px 32px",
          position: "absolute",
          transform: `translateX(-50%) scale(${0.72 + bubble * 0.28})`,
        }}
      >
        MÁS CRÉDITO TAMBIÉN PUEDE INFLAR BURBUJAS
      </div>
    </>
  );
};

const BubbleArchive: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const nineties = ease(frame, fps, cueAt(scene, 1079, 2.22), cueAt(scene, 1079, 2.22) + 0.4);
  const twoThousands = ease(frame, fps, cueAt(scene, 1082, 3.58), cueAt(scene, 1082, 3.58) + 0.5);
  const turn = ease(frame, fps, cueAt(scene, 1086, 5.26), cueAt(scene, 1086, 5.26) + 0.35);
  const close = ease(frame, fps, cueAt(scene, 1098, 8.58), cueAt(scene, 1098, 8.58) + 0.55);
  const flow = Math.max(0, 1 - close);
  return (
    <>
      <Photo
        path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-nyse-facade.jpg"
        position="center 42%"
        opacity={0.46}
      />
      <Header eyebrow="DOS CICLOS, EL MISMO COMBUSTIBLE" title="El crédito barato alimentó grandes burbujas" />
      <div style={{display: "flex", gap: 60, left: 160, position: "absolute", right: 160, top: 250}}>
        {[
          {year: "FINALES DE LOS 90", note: "BURBUJA PUNTOCOM", active: nineties},
          {year: "MEDIADOS DE LOS 2000", note: "CRÉDITO INMOBILIARIO", active: twoThousands},
        ].map((era) => (
          <div
            key={era.year}
            style={{
              background: alpha(C.bg, 0.82),
              border: `4px solid ${era.active ? C.gold : alpha(C.ink, 0.24)}`,
              borderRadius: 22,
              boxShadow: `0 0 65px ${alpha(C.gold, era.active * 0.24)}`,
              flex: 1,
              padding: "55px 45px",
              textAlign: "center",
              transform: `scale(${0.96 + era.active * 0.04})`,
            }}
          >
            <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 29, fontWeight: 950}}>{era.year}</div>
            <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 43, fontWeight: 950, marginTop: 24}}>{era.note}</div>
            <div style={{color: C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 21, fontWeight: 900, marginTop: 32}}>CRÉDITO ABIERTO → EXPANSIÓN</div>
          </div>
        ))}
      </div>
      <div style={{bottom: 84, left: 300, position: "absolute", right: 300}}>
        <div style={{background: alpha(C.cyan, 0.55), height: 64, position: "absolute", top: 12, width: "100%"}} />
        {Array.from({length: 20}, (_, index) => (
          <div
            key={index}
            style={{
              background: C.gold,
              borderRadius: "50%",
              height: 16,
              left: `${(index * 5 + frame / fps * 15) % 100}%`,
              opacity: flow,
              position: "absolute",
              top: 36,
              width: 16,
            }}
          />
        ))}
        <div
          style={{
            background: C.red,
            border: `5px solid ${C.ink}`,
            borderRadius: 16,
            height: 145,
            left: "50%",
            opacity: turn,
            position: "absolute",
            top: -28,
            transform: `translateX(-50%) rotate(${close * 90}deg)`,
            width: 34,
          }}
        />
        <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, opacity: close, paddingTop: 120, textAlign: "center"}}>
          EL GRIFO DEL DINERO SE CIERRA
        </div>
      </div>
    </>
  );
};

const CreditFreeze: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cost = ease(frame, fps, cueAt(scene, 1111, 3), cueAt(scene, 1111, 3) + 0.35);
  const brake = ease(frame, fps, cueAt(scene, 1115, 4.64), cueAt(scene, 1115, 4.64) + 0.4);
  const freeze = ease(frame, fps, cueAt(scene, 1119, 6.66), cueAt(scene, 1119, 6.66) + 0.45);
  const layoffs = ease(frame, fps, cueAt(scene, 1123, 8.18), cueAt(scene, 1123, 8.18) + 0.45);
  const steps = [
    {label: "COSTE FINANCIERO", icon: "↑", state: cost, color: C.red},
    {label: "INVERSIÓN", icon: "Ⅱ", state: brake, color: C.gold},
    {label: "CONTRATACIÓN", icon: "❄", state: freeze, color: C.cyan},
    {label: "EMPLEO", icon: "↓", state: layoffs, color: C.red},
  ];
  return (
    <>
      <Header eyebrow="LA CADENA SE INVIERTE" title="El cierre del crédito congela la economía" />
      <div style={{display: "flex", gap: 42, left: 125, position: "absolute", right: 125, top: 295}}>
        {steps.map((step, index) => (
          <div
            key={step.label}
            style={{
              background: alpha(step.color, 0.08 + step.state * 0.1),
              border: `4px solid ${step.state ? step.color : alpha(C.muted, 0.3)}`,
              borderRadius: 20,
              flex: 1,
              height: 390,
              opacity: 0.55 + step.state * 0.45,
              padding: "48px 24px",
              position: "relative",
              textAlign: "center",
              transform: `translateY(${step.state * 34}px) scale(${0.97 + step.state * 0.03})`,
            }}
          >
            <div style={{color: step.color, fontSize: 92, fontWeight: 950}}>{step.icon}</div>
            <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 25, fontWeight: 950, marginTop: 38}}>{step.label}</div>
            <div style={{color: step.color, fontFamily: FINANCE_FONT_FAMILY, fontSize: 31, fontWeight: 950, marginTop: 45}}>
              {index === 0 ? "SE DISPARA" : index === 1 ? "SE FRENA" : index === 2 ? "SE CONGELA" : "DESPIDOS"}
            </div>
          </div>
        ))}
      </div>
      <div style={{bottom: 86, color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 31, fontWeight: 950, left: 140, opacity: layoffs, position: "absolute", right: 140, textAlign: "center"}}>
        UNA RESTRICCIÓN SE TRANSMITE A TODA LA ECONOMÍA
      </div>
    </>
  );
};

const RecessionOverlay: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reliable = ease(frame, fps, cueAt(scene, 1138, 2.9), cueAt(scene, 1138, 2.9) + 0.4);
  const overlay = ease(frame, fps, cueAt(scene, 1142, 5.56), cueAt(scene, 1142, 5.56) + 0.5);
  const falls = ease(frame, fps, cueAt(scene, 1148, 7.76), cueAt(scene, 1148, 7.76) + 0.45);
  const {chart, x, y, path} = chartGeometry(scene);
  const draw = ease(frame, fps, 0.25, 3.9);
  const eventIndices = [
    {label: "PUNTOCOM", index: 43},
    {label: "2008", index: 74},
    {label: "2020", index: 120},
  ];
  return (
    <>
      <Photo
        path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg"
        opacity={0.22}
      />
      <Header eyebrow="INDICADOR ADELANTADO" title="El crédito se tensa antes de las grandes caídas" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <rect fill={alpha(C.bg, 0.74)} height={chart.height} rx="18" width={chart.width} x={chart.x} y={chart.y} />
        {[0, 20, 40, 60, 80].map((value) => (
          <g key={value}>
            <line
              stroke={value === 40 ? alpha(C.red, 0.7) : alpha(C.muted, 0.2)}
              strokeDasharray={value === 40 ? "12 10" : undefined}
              strokeWidth={value === 40 ? 3 : 2}
              x1={chart.x}
              x2={chart.x + chart.width}
              y1={y(value)}
              y2={y(value)}
            />
            <text fill={value === 40 ? C.red : C.muted} fontFamily={DATA_FONT_FAMILY} fontSize="20" textAnchor="end" x={chart.x - 18} y={y(value) + 7}>
              {value}%
            </text>
          </g>
        ))}
        {eventIndices.map((event) => {
          const eventX = x(event.index);
          return (
            <g key={event.label} opacity={overlay}>
              <rect fill={alpha(C.red, 0.13)} height={chart.height} width="95" x={eventX - 48} y={chart.y} />
              <path d={`M ${eventX - 35} ${chart.y + 70} L ${eventX} ${chart.y + 145} L ${eventX + 35} ${chart.y + 70}`} fill="none" stroke={C.red} strokeWidth="9" />
              <text fill={C.ink} fontFamily={DATA_FONT_FAMILY} fontSize="18" fontWeight="950" textAnchor="middle" x={eventX} y={chart.y + chart.height - 24}>
                {event.label}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" pathLength={1} stroke={C.gold} strokeDasharray={`${draw} 1`} strokeWidth="8" />
      </svg>
      <div style={{background: C.gold, borderRadius: 9, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 20, fontWeight: 950, left: 180, padding: "12px 18px", position: "absolute", top: 215}}>
        ENDURECIMIENTO BANCARIO
      </div>
      <div style={{background: C.red, border: `4px solid ${C.ink}`, borderRadius: 12, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 38, fontWeight: 950, opacity: falls, padding: "16px 30px", position: "absolute", right: 180, top: 205, transform: `scale(${0.78 + falls * 0.22})`}}>
        CAÍDAS BURSÁTILES
      </div>
      <div style={{color: reliable ? C.green : C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 20, fontWeight: 900, left: 180, position: "absolute", top: 848}}>
        SEÑAL ADELANTADA · NO GARANTÍA
      </div>
    </>
  );
};

const ThresholdAlarm: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hardening = ease(frame, fps, cueAt(scene, 1168, 4.9), cueAt(scene, 1168, 4.9) + 0.45);
  const threshold = ease(frame, fps, cueAt(scene, 1176, 9.28), cueAt(scene, 1176, 9.28) + 0.45);
  const needle = interpolate(frame / fps, [0.3, 8.8, 10], [8, 38, 46], clamp);
  const angle = -110 + (needle / 80) * 220;
  const fileProgress = interpolate(frame / fps, [4.9, 8.7], [0, 1], clamp);
  return (
    <>
      <Header
        eyebrow="UMBRAL DE ALERTA"
        title="La señal cambia cuando supera el 40 %"
        detail="Porcentaje neto de bancos que endurecen el crédito"
      />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <path d="M430 780 A530 530 0 0 1 1124 276" fill="none" stroke={alpha(C.green, 0.58)} strokeLinecap="butt" strokeWidth="86" />
        <path d="M1124 276 A530 530 0 0 1 1490 780" fill="none" stroke={alpha(C.red, 0.92)} strokeLinecap="butt" strokeWidth="86" />
        <line x1="960" y1="780" x2="960" y2="360" stroke={C.ink} strokeLinecap="round" strokeWidth="25" transform={`rotate(${angle} 960 780)`} />
        <circle cx="960" cy="780" fill={C.gold} r="54" stroke={C.ink} strokeWidth="12" />
        <text fill={C.green} fontFamily={DATA_FONT_FAMILY} fontSize="26" fontWeight="950" x="390" y="860">CRÉDITO ABIERTO</text>
        <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="26" fontWeight="950" textAnchor="end" x="1530" y="860">RESTRICCIÓN</text>
        <line x1="1124" x2="1165" y1="276" y2="225" stroke={C.red} strokeWidth="6" />
        <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="34" fontWeight="950" x="1183" y="224">40 %</text>
      </svg>
      <div
        style={{
          background: C.red,
          border: `5px solid ${C.ink}`,
          borderRadius: 14,
          color: C.ink,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 31,
          fontWeight: 950,
          left: "50%",
          opacity: threshold,
          padding: "18px 34px",
          position: "absolute",
          top: 315,
          transform: `translateX(-50%) scale(${0.72 + threshold * 0.28})`,
        }}
      >
        ZONA DE PELIGRO
      </div>
      <svg height="190" viewBox="0 0 1500 235" width="1500" style={{bottom: 76, left: 210, opacity: 0.35 + hardening * 0.65, position: "absolute"}}>
        <g transform="translate(30 48)">
          <path d="M25 62 L155 5 L285 62 Z" fill={alpha(C.cyan, 0.18)} stroke={C.cyan} strokeWidth="5" />
          {[55, 105, 155, 205].map((x) => <rect key={x} fill={alpha(C.cyan, 0.15)} height="92" stroke={C.cyan} strokeWidth="4" width="28" x={x} y="66" />)}
          <rect fill={C.cyan} height="12" width="285" x="13" y="164" />
        </g>
        <g transform="translate(590 40)">
          <circle cx="92" cy="48" fill={C.gold} r="36" />
          <path d="M35 174 C39 105 145 105 150 174" fill={alpha(C.gold, 0.2)} stroke={C.gold} strokeWidth="6" />
          <path d="M77 91 L92 121 L108 91" fill={C.ink} />
          <rect fill={alpha(C.bg, 0.94)} height="62" rx="8" stroke={threshold ? C.red : C.cyan} strokeWidth="4" width="155" x="145" y="105" />
          <path d="M166 128 H276 M166 146 H250" stroke={threshold ? C.red : C.muted} strokeWidth="5" />
        </g>
        {[0, 1, 2].map((index) => {
          const x = 990 + index * 142;
          const restricted = index < Math.ceil(fileProgress * 3);
          return (
            <g key={index} transform={`translate(${x} ${45 + index * 9})`} opacity={0.48 + fileProgress * 0.52}>
              <rect fill={alpha(C.bg, 0.94)} height="118" rx="9" stroke={restricted ? C.red : C.green} strokeWidth="5" width="108" />
              <path d="M22 30 H86 M22 52 H75 M22 74 H84" stroke={restricted ? C.red : C.green} strokeWidth="5" />
              {restricted ? <path d="M25 95 L83 24 M25 24 L83 95" stroke={C.red} strokeWidth="9" /> : null}
            </g>
          );
        })}
        <path d="M895 112 H965" stroke={threshold ? C.red : C.cyan} strokeDasharray="12 10" strokeWidth="6" />
        <path d="M950 94 L974 112 L950 130" fill="none" stroke={threshold ? C.red : C.cyan} strokeWidth="6" />
        <text fill={threshold ? C.red : C.green} fontFamily={DATA_FONT_FAMILY} fontSize="20" fontWeight="950" textAnchor="middle" x="1170" y="210">
          {threshold ? "EXPEDIENTES RESTRINGIDOS" : "SOLICITUDES EN REVISIÓN"}
        </text>
      </svg>
    </>
  );
};

const CrisisArchive: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dotcom = ease(frame, fps, cueAt(scene, 1193, 2.98), cueAt(scene, 1193, 2.98) + 0.38);
  const y2008 = ease(frame, fps, cueAt(scene, 1200, 5.12), cueAt(scene, 1200, 5.12) + 0.38);
  const y2022 = ease(frame, fps, cueAt(scene, 1204, 6.86), cueAt(scene, 1204, 6.86) + 0.38);
  const fall = ease(frame, fps, cueAt(scene, 1208, 8.6), cueAt(scene, 1208, 8.6) + 0.38);
  const percent = ease(frame, fps, cueAt(scene, 1210, 9.24), cueAt(scene, 1210, 9.24) + 0.4);
  const turn = interpolate(frame, [cueAt(scene, 1211, 11.14) * fps, (cueAt(scene, 1211, 11.14) + 0.25) * fps, (cueAt(scene, 1211, 11.14) + 1.4) * fps], [0, 1, 0], clamp);
  const records = [
    {year: "2000", label: "PUNTOCOM", state: dotcom},
    {year: "2008", label: "CRISIS FINANCIERA", state: y2008},
    {year: "2022", label: "GIRO DE TIPOS", state: y2022},
  ];
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-nyse-facade.jpg" opacity={0.32} />
      <Header eyebrow="ARCHIVO DE CRISIS" title="Tres episodios dejan la misma huella" />
      <div style={{display: "flex", gap: 45, left: 145, position: "absolute", right: 145, top: 265}}>
        {records.map((record, index) => (
          <div
            key={record.year}
            style={{
              background: alpha(C.bg, 0.88),
              border: `4px solid ${record.state ? C.red : alpha(C.ink, 0.22)}`,
              flex: 1,
              height: 475,
              opacity: 0.52 + record.state * 0.48,
              overflow: "hidden",
              position: "relative",
              transform: `translateY(${(1 - record.state) * 18}px)`,
            }}
          >
            <div style={{background: record.state ? C.red : alpha(C.muted, 0.2), height: 18}} />
            <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 60, fontWeight: 950, paddingTop: 52, textAlign: "center"}}>{record.year}</div>
            <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 33, fontWeight: 950, marginTop: 18, textAlign: "center"}}>{record.label}</div>
            <svg height="180" viewBox="0 0 400 180" width="100%" style={{bottom: 30, position: "absolute"}}>
              <path d={`M20 35 C100 ${50 + index * 15} 125 20 185 62 C235 95 278 78 380 155`} fill="none" pathLength={1} stroke={C.red} strokeDasharray={`${record.state} 1`} strokeWidth="10" />
              <path d="M330 118 L380 155 L320 165" fill="none" opacity={record.state} stroke={C.red} strokeWidth="10" />
            </svg>
          </div>
        ))}
      </div>
      <div
        style={{
          background: C.red,
          border: `5px solid ${C.ink}`,
          borderRadius: 14,
          bottom: 52,
          color: C.ink,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 30,
          fontWeight: 950,
          left: "50%",
          opacity: percent,
          padding: "17px 32px",
          position: "absolute",
          transform: `translateX(-50%) scale(${0.75 + fall * 0.25})`,
        }}
      >
        2022 · MERCADO −25 %
      </div>
      <div style={{background: C.gold, color: C.bg, fontFamily: FINANCE_FONT_FAMILY, fontSize: 54, fontWeight: 950, left: "50%", opacity: turn, padding: "20px 42px", position: "absolute", top: 450, transform: `translate(-50%,-50%) scale(${0.78 + turn * 0.22})`, zIndex: 10}}>
        PERO HOY ES DISTINTO
      </div>
    </>
  );
};

const RestrictionDrop: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const prior = ease(frame, fps, cueAt(scene, 1230, 3.94), cueAt(scene, 1230, 3.94) + 0.4);
  const low = ease(frame, fps, cueAt(scene, 1239, 6.98), cueAt(scene, 1239, 6.98) + 0.48);
  const improve = ease(frame, fps, cueAt(scene, 1244, 9.54), cueAt(scene, 1244, 9.54) + 0.42);
  const current = interpolate(frame / fps, [0.5, 4.1, 7.5], [50.8, 40, 8.1], clamp);
  const fill = (current / 55) * 620;
  return (
    <>
      <Header eyebrow="LECTURA ACTUAL" title="La restricción ha caído a mínimos" detail="SLOOS · estándares C&I · 2026Q2" />
      <div style={{border: `5px solid ${C.cyan}`, borderRadius: 42, bottom: 145, left: 390, overflow: "hidden", position: "absolute", top: 250, width: 300}}>
        <div style={{background: `linear-gradient(0deg,${C.green},${C.gold})`, bottom: 0, height: fill, position: "absolute", width: "100%"}} />
        <div style={{background: alpha(C.red, 0.12), borderTop: `4px dashed ${C.red}`, bottom: `${(40 / 55) * 100}%`, height: `${(15 / 55) * 100}%`, position: "absolute", width: "100%"}} />
        <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 950, left: 22, position: "absolute", top: 50}}>UMBRAL 40 %</div>
      </div>
      <div style={{left: 820, position: "absolute", top: 310, width: 700}}>
        <div style={{color: current > 20 ? C.gold : C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 155, fontVariantNumeric: "tabular-nums", fontWeight: 950, lineHeight: 1}}>
          {current.toLocaleString("es-ES", {maximumFractionDigits: 1})} %
        </div>
        <div style={{color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 800, marginTop: 22}}>BANCOS QUE ENDURECEN EL CRÉDITO</div>
        <div style={{display: "flex", gap: 30, marginTop: 90}}>
          <div style={{borderLeft: `7px solid ${C.red}`, color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, opacity: prior, padding: "15px 24px"}}>HACE UN PAR DE AÑOS<br /><span style={{color: C.red}}>≈40 %</span></div>
          <div style={{borderLeft: `7px solid ${C.green}`, color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, opacity: low, padding: "15px 24px"}}>ACTUALIDAD<br /><span style={{color: C.green}}>8,1 %</span></div>
        </div>
      </div>
      <div style={{background: C.green, border: `4px solid ${C.ink}`, borderRadius: 12, bottom: 58, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 28, fontWeight: 950, left: "50%", opacity: improve, padding: "16px 30px", position: "absolute", transform: `translateX(-50%) scale(${0.8 + improve * 0.2})`}}>CONDICIONES CREDITICIAS EN MEJORA</div>
    </>
  );
};

const MarketFoundation: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const support = ease(frame, fps, cueAt(scene, 1253, 1.14), cueAt(scene, 1253, 1.14) + 0.45);
  const earnings = ease(frame, fps, cueAt(scene, 1261, 4.14), cueAt(scene, 1261, 4.14) + 0.45);
  const concentration = ease(frame, fps, cueAt(scene, 1271, 7.76), cueAt(scene, 1271, 7.76) + 0.45);
  const seven = ease(frame, fps, cueAt(scene, 1274, 9.26), cueAt(scene, 1274, 9.26) + 0.4);
  const growth = Math.max(support * 0.35, earnings * 0.72, concentration);
  const logos = [
    "finance-cavaliers-apple.png",
    "finance-cavaliers-microsoft.png",
    "finance-cavaliers-nvidia.png",
    "finance-cavaliers-amazon.png",
    "finance-cavaliers-alphabet.png",
    "finance-cavaliers-meta.png",
    "finance-cavaliers-tesla.png",
  ];
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-ai-servers.jpg" opacity={0.28} />
      <Header eyebrow="LA BASE DEL MERCADO" title="El crédito sostiene beneficios y liderazgo" />
      <svg height="330" viewBox="0 0 1500 330" width="1500" style={{left: 210, position: "absolute", top: 305}}>
        <defs>
          <linearGradient id="foundation-growth" x1="0" x2="1">
            <stop offset="0" stopColor={C.cyan} />
            <stop offset="0.52" stopColor={C.green} />
            <stop offset="1" stopColor={C.gold} />
          </linearGradient>
        </defs>
        <path d="M70 270 C360 260 535 218 720 183 C940 140 1110 85 1420 35" fill="none" opacity="0.2" stroke={C.ink} strokeWidth="18" />
        <path d="M70 270 C360 260 535 218 720 183 C940 140 1110 85 1420 35" fill="none" pathLength={1} stroke="url(#foundation-growth)" strokeDasharray={`${growth} 1`} strokeLinecap="round" strokeWidth="13" />
        <path d="M1375 28 L1420 35 L1392 75" fill="none" opacity={growth} stroke={C.gold} strokeLinecap="round" strokeWidth="13" />
        {[{x: 300, y: 250, color: C.cyan}, {x: 760, y: 175, color: C.green}, {x: 1200, y: 76, color: C.gold}].map((point, index) => (
          <circle key={point.x} cx={point.x} cy={point.y} fill={point.color} opacity={[support, earnings, concentration][index]} r="18" stroke={C.bg} strokeWidth="7" />
        ))}
      </svg>
      <div style={{bottom: 85, height: 390, left: 160, position: "absolute", right: 160}}>
        <div style={{background: C.cyan, height: 60, opacity: support, position: "absolute", top: 330, transform: `scaleX(${support})`, transformOrigin: "left", width: "100%"}} />
        <div style={{color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 23, fontWeight: 950, left: 0, opacity: support, position: "absolute", textAlign: "center", top: 346, width: "100%"}}>CONDICIONES CREDITICIAS</div>
        {logos.map((logo, index) => {
          const reveal = ease(frame, fps, 2 + index * 0.22, 2.55 + index * 0.22) * Math.max(earnings, 0.18);
          return (
            <div key={logo} style={{alignItems: "center", background: alpha(C.bg, 0.94), border: `3px solid ${index < 3 ? C.gold : C.cyan}`, borderRadius: 12, display: "flex", height: 130 + (index % 3) * 28, justifyContent: "center", left: `${index * 14.1}%`, opacity: reveal, position: "absolute", top: 330 - (130 + (index % 3) * 28), transform: `translateY(${(1 - reveal) * 50}px)`, width: 150}}>
              <Img src={staticFile(`assets/library/finance-cavaliers-company-logos/${logo}`)} style={{height: 72, objectFit: "contain", width: 95}} />
            </div>
          );
        })}
      </div>
      <div style={{alignItems: "center", display: "flex", gap: 45, justifyContent: "center", left: 140, position: "absolute", right: 140, top: 235}}>
        {[
          {label: "CRÉDITO", color: C.cyan, state: support},
          {label: "BENEFICIOS", color: C.green, state: earnings},
          {label: "CONCENTRACIÓN", color: C.gold, state: concentration},
        ].map((item, index) => (
          <div key={item.label} style={{alignItems: "center", color: item.color, display: "flex", fontFamily: DATA_FONT_FAMILY, fontSize: 32, fontWeight: 950, gap: 36, opacity: item.state, textShadow: `0 0 22px ${alpha(item.color, 0.35)}`}}>
            {item.label}{index < 2 ? <span style={{color: C.ink, fontSize: 46}}>→</span> : null}
          </div>
        ))}
      </div>
      <div style={{background: C.gold, border: `4px solid ${C.ink}`, borderRadius: 12, bottom: 28, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, left: "50%", opacity: seven, padding: "16px 30px", position: "absolute", transform: `translateX(-50%) scale(${0.8 + seven * 0.2})`}}>LOS SIETE MAGNÍFICOS SIGUEN EN PIE</div>
    </>
  );
};

const CapitalRotation: React.FC<{scene: EditorialScene}> = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rotate = ease(frame, fps, 0.4, 3.2);
  const healthy = ease(frame, fps, 3.8, 6.2);
  const opportunity = ease(frame, fps, 7.1, 9.5);
  // Keep the particles travelling on a wrapped track. Rendering a copy on
  // either side of the viewport removes the visible cut when a dot restarts.
  const trackLength = 1820;
  const flow = frame * 10.5;
  const dotCopies = (lane: "upper" | "lower", color: string, phase: number) =>
    Array.from({length: 8}, (_, index) => {
      const seed = (index * 255 + flow + phase) % trackLength;
      return [-trackLength, 0, trackLength].map((wrap, copy) => {
        const x = 90 + seed + wrap;
        if (x < 115 || x > 1800) return null;
        const progress = Math.max(0, Math.min(1, (x - 170) / 1565));
        const y = lane === "upper"
          ? 620 - Math.sin(progress * Math.PI) * 255
          : 620 + Math.sin(progress * Math.PI) * 170;
        return <circle key={`${lane}-${index}-${copy}`} cx={x} cy={y} fill={color} opacity={rotate} r={15 + (index % 3) * 4} />;
      });
    });
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg" opacity={0.24} />
      <Header eyebrow="ROTACIÓN, NO HUIDA" title="El capital cambia de carril" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <path d="M170 620 C480 620 560 365 870 365 C1160 365 1230 620 1735 620" fill="none" stroke={alpha(C.cyan, 0.22)} strokeWidth="96" />
        <path d="M170 620 C480 620 560 365 870 365 C1160 365 1230 620 1735 620" fill="none" pathLength={1} stroke={C.cyan} strokeDasharray={`${rotate} 1`} strokeWidth="18" />
        <path d="M170 620 C515 620 590 790 925 790 C1240 790 1310 620 1735 620" fill="none" stroke={alpha(C.gold, 0.18)} strokeWidth="96" />
        <path d="M170 620 C515 620 590 790 925 790 C1240 790 1310 620 1735 620" fill="none" pathLength={1} stroke={C.gold} strokeDasharray={`${healthy} 1`} strokeWidth="18" />
        {dotCopies("upper", C.cyan, 0)}
        {dotCopies("lower", C.gold, 124)}
        <circle cx="1735" cy="620" fill={C.green} opacity={opportunity} r="66" stroke={C.ink} strokeWidth="12" />
        <path d="M1700 620 L1727 648 L1775 588" fill="none" opacity={opportunity} stroke={C.bg} strokeLinecap="round" strokeWidth="16" />
      </svg>
      <div style={{background: alpha(C.green, 0.15), border: `4px solid ${C.green}`, color: C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, left: "50%", opacity: healthy, padding: "16px 28px", position: "absolute", top: 470, transform: `translateX(-50%) scale(${0.84 + healthy * 0.16})`}}>MOVIMIENTO SALUDABLE</div>
      <div style={{bottom: 82, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 44, fontWeight: 950, left: "50%", opacity: opportunity, position: "absolute", transform: "translateX(-50%)"}}>NUEVAS OPORTUNIDADES</div>
    </>
  );
};

const FundamentalLesson: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const balance = ease(frame, fps, 0.35, 2.5);
  const recession = ease(frame, fps, 2.7, 4.7);
  const turn = ease(frame, fps, cueAt(scene, 1336, 5.1), cueAt(scene, 1336, 5.1) + 0.32);
  const lesson = ease(frame, fps, 6.2, 8.4);
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg" opacity={0.27} />
      <Header eyebrow="ANTES DE LA CONCLUSIÓN" title="Dos condiciones sostienen la oportunidad" />
      <div style={{display: "flex", gap: 100, left: 250, position: "absolute", right: 250, top: 300}}>
        <div style={{alignItems: "center", display: "flex", flex: 1, flexDirection: "column", opacity: balance}}>
          <svg height="320" viewBox="0 0 430 320" width="430">
            <path d="M45 268 H385 V135 L215 35 L45 135 Z" fill={alpha(C.cyan, 0.12)} stroke={C.cyan} strokeWidth="8" />
            {[95, 165, 235, 305].map((x) => <rect key={x} fill={alpha(C.cyan, 0.15)} height="112" stroke={C.cyan} strokeWidth="7" width="38" x={x} y="145" />)}
            <path d="M45 268 H385" stroke={C.ink} strokeWidth="18" />
          </svg>
          <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 29, fontWeight: 950}}>BALANCES SÓLIDOS</div>
        </div>
        <div style={{alignItems: "center", display: "flex", flex: 1, flexDirection: "column", opacity: recession}}>
          <svg height="320" viewBox="0 0 430 320" width="430">
            <path d="M65 250 C95 120 155 78 215 78 C275 78 335 120 365 250" fill={alpha(C.green, 0.12)} stroke={C.green} strokeWidth="14" />
            <path d="M215 78 V250" stroke={C.green} strokeWidth="10" />
            <path d="M125 164 H305" opacity={turn} stroke={C.red} strokeWidth="28" />
            <rect fill={C.red} height="76" opacity={turn} rx="10" width="270" x="80" y="126" />
            <text fill={C.ink} fontFamily={DATA_FONT_FAMILY} fontSize="27" fontWeight="950" opacity={turn} textAnchor="middle" x="215" y="174">RECESIÓN</text>
          </svg>
          <div style={{color: turn ? C.red : C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 29, fontWeight: 950}}>ECONOMÍA SIN RUPTURA</div>
        </div>
      </div>
      <div style={{background: C.gold, border: `5px solid ${C.ink}`, bottom: 55, color: C.bg, fontFamily: FINANCE_FONT_FAMILY, fontSize: 44, fontWeight: 950, left: "50%", opacity: lesson, padding: "20px 48px", position: "absolute", transform: `translateX(-50%) scale(${0.78 + lesson * 0.22})`}}>LA LECCIÓN FUNDAMENTAL</div>
    </>
  );
};

const IndexIllusion: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = ease(frame, fps, 0.3, 1.8);
  const compress = ease(frame, fps, 2.4, 7.6);
  const extreme = ease(frame, fps, 7.8, 10.3);
  const logos = [
    {label: "NVIDIA", file: "finance-cavaliers-nvidia.png"},
    {label: "APPLE", file: "finance-cavaliers-apple.png"},
    {label: "MICROSOFT", file: "finance-cavaliers-microsoft.png"},
    {label: "AMAZON", file: "finance-cavaliers-amazon.png"},
    {label: "ALPHABET", file: "finance-cavaliers-alphabet.png"},
    {label: "META", file: "finance-cavaliers-meta.png"},
    {label: "TESLA", file: "finance-cavaliers-tesla.png"},
  ];
  const seven = scene.metric?.value ?? 33.23;
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-nyse-facade.jpg" opacity={0.2} />
      <Header eyebrow="LA ILUSIÓN DEL ÍNDICE" title="Comprar 500 nombres no reparte igual" />
      <div style={{background: alpha(C.bg, 0.84), border: `4px solid ${C.cyan}`, borderRadius: 24, height: 530, left: 120, opacity: reveal, padding: "35px 38px", position: "absolute", top: 270, width: 560}}>
        <div style={{alignItems: "baseline", display: "flex", gap: 20}}>
          <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 106, fontWeight: 950, lineHeight: 1}}>500</div>
          <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 950}}>NOMBRES</div>
        </div>
        <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 900, marginTop: 8}}>CESTA DEL S&amp;P 500</div>
        <div style={{display: "grid", gap: 10, gridTemplateColumns: "repeat(10, 1fr)", marginTop: 40, opacity: 0.9}}>
          {Array.from({length: 60}, (_, index) => (
            <div key={index} style={{background: index % 7 === 0 ? alpha(C.gold, 0.74) : alpha(C.cyan, 0.7), borderRadius: 5, height: 20, transform: `scale(${0.8 + compress * 0.2})`}} />
          ))}
        </div>
        <div style={{borderTop: `3px solid ${alpha(C.cyan, 0.45)}`, color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 24, fontWeight: 800, marginTop: 35, paddingTop: 22}}>Cada empresa entra, pero no pesa lo mismo.</div>
      </div>
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <defs>
          <linearGradient id="index-funnel" x1="0" x2="1">
            <stop offset="0" stopColor={C.cyan} />
            <stop offset="1" stopColor={C.gold} />
          </linearGradient>
        </defs>
        <path d="M720 530 C830 530 890 420 1035 420 C1080 420 1100 475 1125 530" fill="none" opacity={compress} stroke={alpha(C.cyan, 0.22)} strokeWidth="58" />
        <path d="M720 530 C830 530 890 420 1035 420 C1080 420 1100 475 1125 530" fill="none" opacity={compress} stroke="url(#index-funnel)" strokeLinecap="round" strokeWidth="17" />
        <path d="M1090 530 H1160" fill="none" opacity={compress} stroke={C.gold} strokeLinecap="round" strokeWidth="17" />
        <path d="M1128 493 L1170 530 L1128 567" fill="none" opacity={compress} stroke={C.gold} strokeLinecap="round" strokeLinejoin="round" strokeWidth="17" />
        <text fill={C.ink} fontFamily={DATA_FONT_FAMILY} fontSize="24" fontWeight="950" opacity={compress} textAnchor="middle" x="930" y="350">PESO POR CAPITALIZACIÓN</text>
        <text fill={C.muted} fontFamily={DATA_FONT_FAMILY} fontSize="20" fontWeight="900" opacity={compress} textAnchor="middle" x="940" y="690">500 POSICIONES → 7 PESOS DOMINANTES</text>
      </svg>
      <div style={{background: alpha(C.bg, 0.9), border: `4px solid ${C.gold}`, borderRadius: 24, height: 520, opacity: compress, padding: "30px 32px", position: "absolute", right: 120, top: 260, width: 560}}>
        <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 950}}>LOS 7 PESOS QUE TIRAN DEL ÍNDICE</div>
        <div style={{display: "grid", gap: 16, gridTemplateColumns: "repeat(4, 1fr)", marginTop: 32}}>
          {logos.map((logo, index) => {
            const rise = ease(frame, fps, 3.2 + index * 0.18, 3.65 + index * 0.18);
            return (
              <div key={logo.label} style={{alignItems: "center", background: alpha(index < 2 ? C.gold : C.cyan, 0.12), border: `3px solid ${index < 2 ? C.gold : C.cyan}`, borderRadius: 12, display: "flex", flexDirection: "column", height: 128, justifyContent: "center", opacity: rise, transform: `translateY(${(1 - rise) * 35}px) scale(${0.88 + rise * 0.12})`}}>
                <Img src={staticFile(`assets/library/finance-cavaliers-company-logos/${logo.file}`)} style={{height: 57, objectFit: "contain", width: 82}} />
                <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 13, fontWeight: 950, marginTop: 9}}>{logo.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{alignItems: "center", display: "flex", gap: 18, justifyContent: "center", marginTop: 24, opacity: extreme}}>
          <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 72, fontWeight: 950, lineHeight: 1}}>{seven.toLocaleString("es-ES", {minimumFractionDigits: 2})} %</div>
          <div style={{color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 23, fontWeight: 850, lineHeight: 1.1}}>del índice<br />en solo 7 nombres</div>
        </div>
      </div>
      <div style={{background: C.red, border: `5px solid ${C.ink}`, borderRadius: 14, bottom: 48, color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 28, fontWeight: 950, left: "50%", opacity: extreme, padding: "16px 30px", position: "absolute", transform: `translateX(-50%) scale(${0.8 + extreme * 0.2})`}}>EL PESO REAL ESTÁ CONCENTRADO</div>
    </>
  );
};

const UnequalWeights: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = ease(frame, fps, 0.3, 2);
  const unequal = ease(frame, fps, cueAt(scene, 1387, 2.64), cueAt(scene, 1387, 2.64) + 0.45);
  const focus = ease(frame, fps, 5.2, 8.5);
  const total = scene.metric?.value ?? 33.23;
  return (
    <>
      <Header eyebrow="PONDERACIÓN REAL DEL SPY" title="La diversificación no es equilibrada" detail="State Street · SPY holdings · 17 Jul 2026" />
      <div style={{bottom: 150, display: "flex", gap: 22, left: 130, position: "absolute", right: 130, top: 290}}>
        {(scene.assets ?? []).map((asset, index) => {
          const value = scene.values?.[index] ?? 0;
          const height = 120 + (value / 8) * 390;
          const rise = ease(frame, fps, 0.8 + index * 0.13, 2.1 + index * 0.13);
          return (
            <div key={asset.id} style={{alignItems: "center", display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end", opacity: reveal}}>
              <div style={{alignItems: "center", background: index < 2 ? alpha(C.gold, 0.22) : alpha(C.cyan, 0.12), border: `4px solid ${index < 2 ? C.gold : C.cyan}`, display: "flex", height: height * rise, justifyContent: "center", position: "relative", width: "100%"}}>
                <Img src={staticFile(asset.path)} style={{height: 68, objectFit: "contain", width: 88}} />
                <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 24, fontWeight: 950, position: "absolute", top: 16}}>{value.toLocaleString("es-ES", {maximumFractionDigits: 2})} %</div>
              </div>
              <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 17, fontWeight: 900, marginTop: 15}}>{asset.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{background: C.gold, border: `5px solid ${C.ink}`, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 35, fontWeight: 950, opacity: focus, padding: "18px 32px", position: "absolute", right: 105, top: 205, transform: `scale(${0.78 + focus * 0.22})`, transformOrigin: "right center"}}>{total.toLocaleString("es-ES", {minimumFractionDigits: 2})} % · SOLO 7 EMPRESAS</div>
      <div style={{background: C.red, bottom: 48, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 950, left: "50%", opacity: unequal, padding: "15px 28px", position: "absolute", transform: "translateX(-50%)"}}>500 NOMBRES ≠ 500 PESOS IGUALES</div>
    </>
  );
};

const RiskScaffolding: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safe = ease(frame, fps, 0.3, 2.1);
  const turn = ease(frame, fps, cueAt(scene, 1420, 5.06), cueAt(scene, 1420, 5.06) + 0.32);
  const bank = ease(frame, fps, 6.2, 8.7);
  const profits = ease(frame, fps, 8.8, 11.3);
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-ai-servers.jpg" opacity={0.24} />
      <Header eyebrow="RIESGO CONDICIONAL" title="La estructura ya está montada" />
      <svg height="750" viewBox="0 0 1500 750" width="1500" style={{bottom: 35, left: 210, position: "absolute"}}>
        <path d="M120 620 H1380" stroke={C.ink} strokeWidth="18" />
        {[250, 520, 790, 1060].map((x, index) => (
          <g key={x} opacity={safe}>
            <path d={`M${x} 620 V${270 - index * 20}`} stroke={turn ? C.red : C.cyan} strokeWidth="18" />
            <path d={`M${x - 75} ${350 - index * 20} H${x + 75}`} stroke={turn ? C.red : C.cyan} strokeWidth="14" />
            <path d={`M${x - 75} ${470 - index * 20} H${x + 75}`} stroke={turn ? C.red : C.cyan} strokeWidth="14" />
          </g>
        ))}
        {[250, 520, 790].map((x, index) => (
          <g key={`brace-${x}`} opacity={safe}>
            <path d={`M${x} 620 L${x + 270} ${350 - index * 20}`} stroke={turn ? alpha(C.red, 0.72) : alpha(C.cyan, 0.72)} strokeWidth="12" />
            <path d={`M${x + 270} 620 L${x} ${350 - index * 20}`} stroke={turn ? alpha(C.red, 0.72) : alpha(C.cyan, 0.72)} strokeWidth="12" />
          </g>
        ))}
        {[250, 520, 790].map((x, index) => (
          <g key={`brace-${x}`} opacity={safe}>
            <path d={`M${x} 620 L${x + 270} ${350 - index * 20}`} stroke={turn ? alpha(C.red, 0.72) : alpha(C.cyan, 0.72)} strokeWidth="12" />
            <path d={`M${x + 270} 620 L${x} ${350 - index * 20}`} stroke={turn ? alpha(C.red, 0.72) : alpha(C.cyan, 0.72)} strokeWidth="12" />
          </g>
        ))}
        <path d="M180 270 H1150 L1320 620" fill="none" stroke={turn ? C.red : C.green} strokeWidth="22" />
        <g opacity={bank}>
          <path d="M125 150 H455 L290 55 Z" fill={alpha(C.red, 0.16)} stroke={C.red} strokeWidth="8" />
          <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="26" fontWeight="950" textAnchor="middle" x="290" y="205">BANCOS RESTRINGEN</text>
        </g>
        <g opacity={profits}>
          <path d="M870 160 H1240" stroke={C.red} strokeWidth="18" />
          <path d="M1200 120 L1240 160 L1200 200" fill="none" stroke={C.red} strokeWidth="18" />
          <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="26" fontWeight="950" textAnchor="middle" x="1045" y="105">BENEFICIOS CAEN</text>
        </g>
      </svg>
      <div style={{background: turn ? C.red : C.green, border: `5px solid ${C.ink}`, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 31, fontWeight: 950, left: "50%", padding: "18px 35px", position: "absolute", top: 275, transform: `translateX(-50%) scale(${0.86 + turn * 0.14})`}}>{turn ? "RIESGO ACTIVADO" : "SIN COLAPSO INMINENTE"}</div>
    </>
  );
};

const PassiveTrap: React.FC<{scene: EditorialScene}> = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safe = ease(frame, fps, 0.3, 2.4);
  const crack = ease(frame, fps, 3.4, 6.2);
  const danger = ease(frame, fps, 6.3, 8.6);
  const logos = [
    "finance-cavaliers-nvidia.png",
    "finance-cavaliers-apple.png",
    "finance-cavaliers-microsoft.png",
    "finance-cavaliers-amazon.png",
    "finance-cavaliers-alphabet.png",
    "finance-cavaliers-meta.png",
    "finance-cavaliers-tesla.png",
  ];
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg" opacity={0.22} />
      <Header eyebrow="LA PARADOJA PASIVA" title="Lo más seguro puede concentrar el riesgo" />
      <svg height="600" viewBox="0 0 1600 600" width="1600" style={{bottom: 150, left: 160, position: "absolute"}}>
        <defs>
          <linearGradient id="passive-bridge" x1="0" x2="1">
            <stop offset="0" stopColor={C.green} />
            <stop offset="0.48" stopColor={C.cyan} />
            <stop offset="0.52" stopColor={C.red} />
            <stop offset="1" stopColor={C.red} />
          </linearGradient>
        </defs>
        <path d="M120 235 H760 M840 235 H1480" fill="none" opacity="0.22" stroke={C.ink} strokeWidth="132" />
        <path d="M120 235 H760" fill="none" pathLength={1} stroke={C.green} strokeDasharray={`${safe} 1`} strokeLinecap="round" strokeWidth="28" />
        <path d="M840 235 H1480" fill="none" opacity={crack} stroke={C.red} strokeLinecap="round" strokeWidth="28" />
        {[200, 520, 1080, 1400].map((x) => (
          <g key={x} opacity={safe * (1 - danger * 0.7)}>
            <path d={`M${x} 300 V480`} stroke={C.cyan} strokeWidth="22" />
            <path d={`M${x - 52} 480 H${x + 52}`} stroke={C.cyan} strokeWidth="16" />
          </g>
        ))}
        <path d="M765 150 L730 238 L810 280 L765 395" fill="none" opacity={crack} stroke={C.red} strokeLinecap="round" strokeLinejoin="round" strokeWidth="21" />
        <path d="M778 330 C700 420 620 472 505 530 M800 330 C900 432 1010 478 1140 535" fill="none" opacity={crack} stroke={alpha(C.red, 0.72)} strokeLinecap="round" strokeWidth="12" />
        <path d="M690 505 H910 L855 560 H745 Z" fill={alpha(C.red, 0.2)} opacity={danger} stroke={C.red} strokeWidth="7" />
        <path d="M800 410 L800 495" opacity={danger} stroke={C.red} strokeDasharray="10 12" strokeWidth="8" />
        <path d="M770 455 L800 495 L830 455" fill="none" opacity={danger} stroke={C.red} strokeWidth="9" />
        <text fill={C.green} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="950" opacity={safe * Math.max(0, 1 - danger * 2)} textAnchor="middle" x="440" y="170">DIVERSIFICACIÓN APARENTE</text>
        <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="950" opacity={danger} textAnchor="middle" x="1160" y="170">PESO CONCENTRADO</text>
      </svg>
      <div style={{background: C.green, border: `4px solid ${C.ink}`, borderRadius: 10, color: C.bg, fontFamily: DATA_FONT_FAMILY, fontSize: 27, fontWeight: 950, left: "50%", opacity: safe * Math.max(0, 1 - danger * 2), padding: "14px 28px", position: "absolute", top: 350, transform: "translateX(-50%)"}}>INVERSIÓN PASIVA “SEGURA”</div>
      {logos.map((logo, index) => {
        const fall = ease(frame, fps, 6.15 + index * 0.18, 6.65 + index * 0.18);
        return (
          <div key={logo} style={{alignItems: "center", background: alpha(C.bg, 0.96), border: `3px solid ${C.red}`, borderRadius: 10, display: "flex", height: 72, justifyContent: "center", left: `${700 + (index % 4) * 116}px`, opacity: danger * fall, position: "absolute", top: `${385 + Math.floor(index / 4) * 92}px`, transform: `translateY(${fall * 45}px) rotate(${(index % 2 ? 1 : -1) * fall * 8}deg)`, width: 78}}>
            <Img src={staticFile(`assets/library/finance-cavaliers-company-logos/${logo}`)} style={{height: 45, objectFit: "contain", width: 60}} />
          </div>
        );
      })}
      <div style={{background: alpha(C.bg, 0.97), border: `4px solid ${C.red}`, borderRadius: 12, color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 34, fontWeight: 950, left: "50%", opacity: danger, padding: "15px 28px", position: "absolute", top: 735, transform: `translateX(-50%) scale(${0.78 + danger * 0.22})`}}>ZONA DE CONCENTRACIÓN</div>
      <div style={{background: C.red, border: `5px solid ${C.ink}`, borderRadius: 14, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 44, fontWeight: 950, left: "50%", opacity: danger, padding: "17px 38px", position: "absolute", bottom: 52, transform: `translateX(-50%) scale(${0.76 + danger * 0.24})`}}>EL LUGAR MÁS PELIGROSO</div>
    </>
  );
};

/**
 * Cierre editorial del episodio. No usa la órbita de logos del catálogo:
 * convierte el mensaje en una secuencia de lectura (datos -> criterio -> CTA)
 * y deja el logo como firma, no como protagonista repetido.
 */
const EditorialOutroScene: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const reveal = ease(frame, fps, 0.2, 1.1);
  const isCta = scene.id === "scene-057";
  const isEnd = scene.id === "scene-058";
  const logoAssets = scene.assets.filter((asset) => asset.kind === "logo");

  if (isEnd) {
    const endReveal = ease(frame, fps, 0, 0.22);
    return (
      <>
        <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg" opacity={0.2} />
        <div style={{alignItems: "center", display: "flex", flexDirection: "column", inset: 0, justifyContent: "center", opacity: endReveal, position: "absolute"}}>
          <div style={{alignItems: "center", background: alpha(C.bg, 0.84), border: `3px solid ${C.gold}`, borderRadius: 22, display: "flex", gap: 28, padding: "24px 42px"}}>
            <Img src={staticFile("assets/library/finance-cavaliers/episodes/1/logo-primary.png")} style={{height: 72, objectFit: "contain", width: 72}} />
            <div>
              <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 42, fontWeight: 950, letterSpacing: 2}}>FINANCE CAVALIERS</div>
              <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 19, fontWeight: 900, letterSpacing: 4, marginTop: 8}}>DATOS · CRITERIO · CONTEXTO</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (isCta) {
    const cta = ease(frame, fps, 0.25, 1.05);
    const question = ease(frame, fps, 2.1, 2.85);
    return (
      <>
        <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-nyse-facade.jpg" opacity={0.25} />
        <Header eyebrow="CIERRE · SIGUIENTE PREGUNTA" title="La historia detrás de los datos" detail="Una lectura con contexto para invertir con criterio." />
        <div style={{background: `linear-gradient(115deg,${alpha(C.bg, 0.96)},${alpha(C.bg, 0.72)})`, border: `3px solid ${C.cyan}`, borderRadius: 24, left: 178, opacity: cta, padding: "42px 48px", position: "absolute", top: 280, width: 780}}>
          <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 20, fontWeight: 900, letterSpacing: 3}}>SI TE HA SERVIDO</div>
          <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 54, fontWeight: 950, lineHeight: 1.05, marginTop: 18}}>Suscríbete y<br />sigamos la señal.</div>
          <div style={{display: "flex", gap: 16, marginTop: 38}}>
            {["ME GUSTA", "COMENTA", "SUSCRÍBETE"].map((label, index) => (
              <div key={label} style={{alignItems: "center", background: alpha(index === 2 ? C.gold : C.cyan, 0.16), border: `2px solid ${index === 2 ? C.gold : C.cyan}`, borderRadius: 10, color: index === 2 ? C.gold : C.cyan, display: "flex", fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 950, minHeight: 52, padding: "0 18px"}}>
                <span style={{fontSize: 26, marginRight: 10}}>{index === 0 ? "♥" : index === 1 ? "✦" : "↗"}</span>{label}
              </div>
            ))}
          </div>
        </div>
        <div style={{background: alpha(C.red, 0.14), border: `3px solid ${C.red}`, borderRadius: 18, left: 1070, opacity: question, padding: "28px 34px", position: "absolute", top: 380, transform: `translateY(${(1 - question) * 24}px) rotate(-2deg)`, width: 570}}>
          <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 900, letterSpacing: 3}}>PARA EL PRÓXIMO VÍDEO</div>
          <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 900, lineHeight: 1.12, marginTop: 18}}>¿Recuperación tecnológica<br />o rotación más profunda?</div>
          <div style={{background: C.red, height: 5, marginTop: 25, transform: `scaleX(${question})`, transformOrigin: "left", width: 370}} />
        </div>
        <Img src={staticFile("assets/library/finance-cavaliers/episodes/1/logo-primary.png")} style={{bottom: 54, height: 54, objectFit: "contain", opacity: cta, position: "absolute", right: 78, width: 54}} />
      </>
    );
  }

  const criterion = ease(frame, fps, 2.1, 3.0);
  const evidence = ease(frame, fps, 0.45, 1.35);
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg" opacity={0.23} />
      <Header eyebrow="CIERRE EDITORIAL" title="De los datos al criterio" detail="La historia detrás de cada cifra importa más que el ruido del momento." />
      <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 900, left: 190, letterSpacing: 3, opacity: reveal, position: "absolute", top: 220}}>UNA LECTURA EN DOS PASOS</div>
      <div style={{background: alpha(C.bg, 0.9), border: `3px solid ${C.cyan}`, borderRadius: 20, left: 170, opacity: evidence, padding: "34px 38px", position: "absolute", top: 280, transform: `translateX(${(1 - evidence) * -50}px)`, width: 620}}>
        <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 950, letterSpacing: 2}}>01 · EVIDENCIA</div>
        <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 43, fontWeight: 950, marginTop: 14}}>Los datos cuentan<br />una secuencia.</div>
        <div style={{display: "flex", gap: 12, marginTop: 34}}>
          {logoAssets.map((asset, index) => {
            const item = ease(frame, fps, 0.8 + index * 0.08, 1.2 + index * 0.08);
            return <div key={asset.id} style={{alignItems: "center", background: alpha(C.cyan, 0.1), border: `2px solid ${alpha(C.cyan, 0.7)}`, borderRadius: 8, display: "flex", height: 56, justifyContent: "center", opacity: item, transform: `translateY(${(1 - item) * 18}px)`, width: 56}}><Img src={staticFile(asset.path)} style={{height: 36, objectFit: "contain", width: 42}} /></div>;
          })}
        </div>
        <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 800, marginTop: 23}}>Siete nombres, una misma historia de mercado.</div>
      </div>
      <svg height="190" style={{left: 770, opacity: criterion, position: "absolute", top: 430, transform: `scaleX(${criterion})`, transformOrigin: "left center"}} width="300">
        <path d="M15 95 H245" fill="none" stroke={C.gold} strokeDasharray="12 12" strokeWidth="8" />
        <path d="M225 60 L270 95 L225 130" fill="none" stroke={C.gold} strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" />
      </svg>
      <div style={{background: alpha(C.gold, 0.12), border: `3px solid ${C.gold}`, borderRadius: 20, opacity: criterion, padding: "34px 38px", position: "absolute", right: 170, top: 280, transform: `translateX(${(1 - criterion) * 50}px)`, width: 620}}>
        <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 22, fontWeight: 950, letterSpacing: 2}}>02 · CRITERIO</div>
        <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 43, fontWeight: 950, marginTop: 14}}>El contexto convierte<br />la señal en decisión.</div>
        <div style={{alignItems: "center", display: "flex", gap: 22, marginTop: 32}}>
          <svg height="92" viewBox="0 0 100 100" width="92"><circle cx="50" cy="50" fill={alpha(C.gold, 0.18)} r="40" stroke={C.gold} strokeWidth="5" /><path d="M30 52 L44 67 L72 35" fill="none" stroke={C.gold} strokeLinecap="round" strokeLinejoin="round" strokeWidth="9" /></svg>
          <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 19, fontWeight: 800, lineHeight: 1.35}}>No invertir por emociones.<br />Leer antes de actuar.</div>
        </div>
      </div>
      <div style={{alignItems: "center", bottom: 45, display: "flex", gap: 16, opacity: reveal, position: "absolute", right: 84}}>
        <Img src={staticFile("assets/library/finance-cavaliers/episodes/1/logo-primary.png")} style={{height: 42, objectFit: "contain", width: 42}} />
        <div style={{color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 17, fontWeight: 900, letterSpacing: 3}}>FINANCE CAVALIERS</div>
      </div>
    </>
  );
};

const BubbleDiagnosis: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const surface = ease(frame, fps, cueAt(scene, 1284, 3.6), cueAt(scene, 1284, 3.6) + 0.45);
  const bubble = ease(frame, fps, cueAt(scene, 1290, 5.56), cueAt(scene, 1290, 5.56) + 0.42);
  const data = ease(frame, fps, cueAt(scene, 1292, 6.78), cueAt(scene, 1292, 6.78) + 0.45);
  const no = ease(frame, fps, cueAt(scene, 1299, 9.22), cueAt(scene, 1299, 9.22) + 0.4);
  const scanX = interpolate(frame / fps, [0.5, 8.8], [260, 1660], clamp);
  return (
    <>
      <Photo path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg" opacity={0.25} />
      <Header eyebrow="DIAGNÓSTICO, NO PARECIDO" title="La superficie parece una burbuja; el crédito no" />
      <div style={{border: `5px solid ${C.gold}`, borderRadius: "50%", boxShadow: `inset 0 0 100px ${alpha(C.gold, 0.18)}`, height: 520, left: 250, opacity: surface, position: "absolute", top: 270, transform: `scale(${0.9 + bubble * 0.1})`, width: 520}}>
        <div style={{color: C.gold, fontFamily: FINANCE_FONT_FAMILY, fontSize: 46, fontWeight: 950, paddingTop: 180, textAlign: "center"}}>PARECIDO<br />A UN TECHO</div>
        <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 900, marginTop: 26, textAlign: "center"}}>LECTURA SUPERFICIAL</div>
      </div>
      <div style={{background: alpha(C.bg, 0.9), border: `5px solid ${C.green}`, borderRadius: 22, height: 520, padding: "65px 52px", position: "absolute", right: 230, top: 270, width: 700}}>
        <div style={{color: C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 24, fontWeight: 950, opacity: data}}>DATOS CREDITICIOS</div>
        <div style={{alignItems: "flex-end", display: "flex", gap: 32, marginTop: 70}}>
          <div style={{color: C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 132, fontWeight: 950, lineHeight: 1, opacity: data}}>8,1 %</div>
          <div style={{color: C.muted, fontFamily: FINANCE_FONT_FAMILY, fontSize: 28, fontWeight: 800, lineHeight: 1.15, paddingBottom: 12}}>restricción<br />actual</div>
        </div>
        <div style={{background: alpha(C.green, 0.16), borderLeft: `8px solid ${C.green}`, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 950, marginTop: 65, opacity: no, padding: "20px 25px"}}>POR AHORA, NO ESTAMOS AHÍ</div>
      </div>
      <div style={{background: `linear-gradient(90deg,transparent,${alpha(C.cyan, 0.8)},transparent)`, bottom: 120, left: scanX, position: "absolute", top: 210, width: 8}} />
    </>
  );
};

export const CreditCycleScene: React.FC<{scene: EditorialScene}> = ({scene}) => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(145deg,#030711,#071426 64%,#02040B)",
      overflow: "hidden",
    }}
  >
    {scene.id === "scene-040" ? (
      <EasyCreditChart scene={scene} />
    ) : scene.id === "scene-041" ? (
      <EconomicFlywheel scene={scene} />
    ) : scene.id === "scene-042" ? (
      <BubbleArchive scene={scene} />
    ) : scene.id === "scene-043" ? (
      <CreditFreeze scene={scene} />
    ) : scene.id === "scene-044" ? (
      <RecessionOverlay scene={scene} />
    ) : scene.id === "scene-045" ? (
      <ThresholdAlarm scene={scene} />
    ) : scene.id === "scene-046" ? (
      <CrisisArchive scene={scene} />
    ) : scene.id === "scene-047" ? (
      <RestrictionDrop scene={scene} />
    ) : scene.id === "scene-048" ? (
      <MarketFoundation scene={scene} />
    ) : scene.id === "scene-050" ? (
      <CapitalRotation scene={scene} />
    ) : scene.id === "scene-051" ? (
      <FundamentalLesson scene={scene} />
    ) : scene.id === "scene-052" ? (
      <IndexIllusion scene={scene} />
    ) : scene.id === "scene-053" ? (
      <UnequalWeights scene={scene} />
    ) : scene.id === "scene-054" ? (
      <RiskScaffolding scene={scene} />
    ) : scene.id === "scene-055" ? (
      <PassiveTrap scene={scene} />
    ) : ["scene-056", "scene-057", "scene-058"].includes(scene.id) ? (
      <EditorialOutroScene scene={scene} />
    ) : (
      <BubbleDiagnosis scene={scene} />
    )}
  </AbsoluteFill>
);
