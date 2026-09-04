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

import {EDITORIAL_COLORS as C} from "./palette";
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
  "leaders-drop": [62, 50, 0.3],
  "weak-leaders": [30, 50, 0.12],
  "leader-pulse": [38, 50, 0.11],
  "contagion-wave": [55, 54, 0.15],
  "whole-market-grid": [73, 54, 0.13],
  "claim-companies": [22, 52, 0.16],
  "unsupported-thirty": [27, 50, 0.12],
  "index-risk": [69, 55, 0.15],
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

const HistoricalArchive: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const labels = ["CISCO", "MICROSOFT", "INTEL", "DELL"];
  const focusIds = ["company-cisco", "company-microsoft", "company-intel", "company-dell"];
  return (
    <div style={{inset: 0, position: "absolute"}}>
      <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 22, left: 135, letterSpacing: 4, position: "absolute", top: 225}}>
        ARCHIVO TECNOLÓGICO · 1999
      </div>
      <div style={{display: "grid", gap: 18, gridTemplateColumns: "repeat(4,1fr)", left: 135, position: "absolute", right: 135, top: 330}}>
        {labels.map((label, index) => {
          const reveal = enter(frame, fps, 1.1 + index * 0.48, 1.65 + index * 0.48);
          const focus = pulse(scene, focusIds[index], frame, fps);
          const asset = logoFor(scene, label);
          return (
            <div key={label} style={{background: index % 2 ? "#EEE7D5" : "#F7F1DF", borderTop: `10px solid ${focus ? C.cyan : C.gold}`, boxShadow: `0 24px 70px rgba(0,0,0,.35)`, height: 420, opacity: reveal * (focus ? 1 : .86), padding: "34px 28px", transform: `translateY(${(1-reveal)*90}px) rotate(${[-2,1,-1,2][index]}deg) scale(${1+focus*.08})`}}>
              <div style={{color: "#172038", fontFamily: DATA_FONT_FAMILY, fontSize: 16}}>EXPEDIENTE 0{index+1}</div>
              <div style={{alignItems: "center", display: "flex", height: 190, justifyContent: "center"}}>
                {asset ? <Img src={staticFile(asset.path)} style={{height: 105, objectFit: "contain", width: 180}} /> : null}
              </div>
              <div style={{color: "#091020", fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 900}}>{label}</div>
              <div style={{background: "#172038", height: 2, margin: "20px 0"}} />
              <div style={{color: "#485168", fontFamily: DATA_FONT_FAMILY, fontSize: 15, lineHeight: 1.5}}>UNA DE LAS CUATRO EMPRESAS QUE CONCENTRARON LA NARRATIVA TECNOLÓGICA</div>
            </div>
          );
        })}
      </div>
      <div style={{bottom: 70, color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 17, left: 135, position: "absolute"}}>
        CUATRO NOMBRES · UNA MISMA PROMESA DE DOMINIO
      </div>
    </div>
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
      {nyse ? (
        <div
          style={{
            inset: 0,
            opacity: .82,
            overflow: "hidden",
            position: "absolute",
          }}
        >
          <Img
            src={staticFile(nyse.path)}
            style={{
              filter: "brightness(0.48) contrast(1.08) saturate(0.72)",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${1.04 + cutaway * 0.04}) translateX(${cutaway * -18}px)`,
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
        </div>
      ) : null}
      <div style={{color: peak ? C.red : C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 190, fontWeight: 950, left: 105, letterSpacing: -10, lineHeight: .8, opacity: .9, position: "absolute", top: 330, transform: `translateX(${dominant * 20}px)`}}>
        DOMINIO
      </div>
      <div style={{background: locked ? C.cyan : C.gold, height: 14, left: 115, position: "absolute", top: 540, transform: `scaleX(${.35 + unstoppable * .65})`, transformOrigin: "left", width: 1000}} />
      <div style={{color: C.white, fontFamily: DATA_FONT_FAMILY, fontSize: 25, left: 120, letterSpacing: 3, position: "absolute", top: 590}}>
        TECNOLOGÍA → CAPITAL → ECONOMÍA
      </div>
      {dominant > .04 ? <div style={{background:alpha(C.gold,.18),border:`2px solid ${C.gold}`,color:C.gold,fontFamily:DATA_FONT_FAMILY,fontSize:22,fontWeight:900,left:120,padding:"13px 20px",position:"absolute",top:680,transform:`scale(${.82+dominant*.18})`,transformOrigin:"left"}}>FUERZA DOMINANTE</div>:null}
      {unstoppable > .04 ? <div style={{background:alpha(C.cyan,.18),border:`2px solid ${C.cyan}`,color:C.cyan,fontFamily:DATA_FONT_FAMILY,fontSize:22,fontWeight:900,left:430,padding:"13px 20px",position:"absolute",top:680,transform:`translateY(${(1-unstoppable)*30}px) scale(${.86+unstoppable*.14})`}}>AÑOS DE VENTAJA</div>:null}
      {locked > .04 ? <div style={{background:alpha(C.white,.12),border:`2px solid ${C.white}`,color:C.white,fontFamily:DATA_FONT_FAMILY,fontSize:22,fontWeight:900,left:720,padding:"13px 20px",position:"absolute",top:680,transform:`scale(${.84+locked*.16})`}}>BARRERAS DE ENTRADA</div>:null}
      <div style={{border: `3px solid ${peak ? C.red : C.white}`, color: peak ? C.red : C.white, fontFamily: DATA_FONT_FAMILY, fontSize: 19, fontWeight: 900, padding: "16px 22px", position: "absolute", right: 145, top: 760, transform: `rotate(${peak * -4}deg)`}}>
        {peak ? "LA FACHADA EMPIEZA A AGRIETARSE" : "SIN COMPETENCIA VISIBLE"}
      </div>
      {peak > .05 ? <div style={{background: C.red, height: 470, left: 1260, position: "absolute", top: 330, transform: "rotate(22deg)", width: 6}} /> : null}
    </>
  );
};

const LeadershipLag: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = enter(frame, fps, 0.25, 1.8);
  const peakFocus = pulse(scene, "peak", frame, fps);
  const lag = pulse(scene, "leaders-lag", frame, fps);
  const early = pulse(scene, "months-before", frame, fps);
  const divergenceFocus = Math.max(early * 0.72, lag);
  return (
    <svg height="100%" viewBox="0 0 1920 1080" width="100%">
      <defs>
        <linearGradient id="early-zone" x1="0" x2="1">
          <stop offset="0" stopColor={alpha(C.cyan, 0)} />
          <stop offset="1" stopColor={alpha(C.cyan, 0.22 + early * 0.22)} />
        </linearGradient>
        <filter id="divergence-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur result="blur" stdDeviation="10" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        fill={alpha(C.bg, divergenceFocus * 0.34)}
        height="1080"
        opacity={divergenceFocus}
        width="1920"
      />
      <rect fill="url(#early-zone)" height="510" rx="16" width="470" x="890" y="270" />
      <line stroke={alpha(C.muted, 0.35)} strokeWidth="3" x1="180" x2="1740" y1="800" y2="800" />
      <path
        d="M180 710 C420 650 600 580 820 500 C1040 420 1260 310 1450 265 C1560 290 1640 355 1740 430"
        fill="none"
        pathLength={1}
        stroke={C.gold}
        strokeDasharray={`${draw} ${1 - draw}`}
        strokeLinecap="round"
        strokeWidth={8 + peakFocus * 7}
        filter={peakFocus > .02 ? "url(#divergence-glow)" : undefined}
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
      {divergenceFocus > 0.02 ? (
        <>
          <rect
            fill={alpha(C.red, 0.055)}
            height="350"
            opacity={early}
            rx="28"
            stroke={alpha(C.red, 0.58)}
            strokeDasharray="16 12"
            strokeWidth="3"
            width="555"
            x="890"
            y="330"
          />
          <path
            d="M930 470 C1080 430 1190 455 1320 540 C1370 570 1410 596 1450 618"
            fill="none"
            filter="url(#divergence-glow)"
            opacity={lag}
            stroke={C.red}
            strokeLinecap="round"
            strokeWidth="17"
          />
          <path
            d="M930 470 C1080 430 1190 455 1320 540 C1370 570 1410 596 1450 618"
            fill="none"
            opacity={lag}
            stroke={C.white}
            strokeDasharray="4 20"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <g opacity={lag} transform="translate(1015 690)">
            <rect
              fill={alpha(C.bg, 0.94)}
              height="48"
              rx="12"
              stroke={C.red}
              strokeWidth="2"
              width="330"
            />
            <text
              fill={C.white}
              fontFamily={DATA_FONT_FAMILY}
              fontSize="18"
              fontWeight="900"
              letterSpacing="1.2"
              textAnchor="middle"
              x="165"
              y="31"
            >
              DIVERGENCIA · MESES ANTES
            </text>
          </g>
        </>
      ) : null}
      <line stroke={C.red} strokeDasharray="12 10" strokeWidth="4" x1="1450" x2="1450" y1="235" y2="800" />
      <text fill={C.gold} fontFamily={DATA_FONT_FAMILY} fontSize="23" fontWeight="800" x="1430" y="205">TECHO GENERAL</text>
      <text fill={C.cyan} fontFamily={DATA_FONT_FAMILY} fontSize="22" fontWeight="800" x="960" y="835">MESES ANTES</text>
      <text fill={C.red} fontFamily={FINANCE_FONT_FAMILY} fontSize="31" fontWeight="900" x="1370" y="670">LÍDERES ↓</text>
      <text fill={C.gold} fontFamily={FINANCE_FONT_FAMILY} fontSize="25" fontWeight="850" x="1540" y="390">MERCADO</text>
    </svg>
  );
};

const ClaimEvidenceGap: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const claimed = pulse(scene, "claimed-thirty", frame, fps) || pulse(scene, "percent-419-419", frame, fps) || pulse(scene, "unsupported-thirty", frame, fps);
  const fourCompanies = pulse(scene, "four-companies", frame, fps) || pulse(scene, "claim-companies", frame, fps);
  const risk = pulse(scene, "index-impact", frame, fps) || pulse(scene, "index-risk", frame, fps);

  return (
    <>
      <DotcomCards scene={scene} top={205} compact />
      
      <div
        style={{
          display: "flex",
          gap: 36,
          justifyContent: "center",
          left: 140,
          position: "absolute",
          right: 140,
          top: 450,
        }}
      >
        {/* Panel 1: Afirmación */}
        <div
          style={{
            alignItems: "center",
            background: alpha(C.panel, 0.95),
            border: `2px solid ${alpha(claimed > 0.05 ? C.gold : C.cyan, 0.6 + claimed * 0.4)}`,
            borderRadius: 20,
            boxShadow: `0 0 ${20 + claimed * 40}px ${alpha(C.gold, claimed * 0.3)}`,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: 320,
            justifyContent: "center",
            padding: "24px 32px",
            transform: `scale(${1 + claimed * 0.05})`,
          }}
        >
          <div
            style={{
              background: alpha(C.gold, 0.15),
              borderRadius: 6,
              color: C.gold,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.5,
              padding: "6px 14px",
            }}
          >
            1. AFIRMACIÓN NARRADA
          </div>
          <div
            style={{
              color: C.gold,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 84,
              fontWeight: 900,
              letterSpacing: -3,
              marginTop: 12,
            }}
          >
            ≈ 30 %
          </div>
          <div
            style={{
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 18,
              fontWeight: 700,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            Peso acumulado estimado
          </div>
          <div
            style={{
              color: C.muted,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 14,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Cisco, Microsoft, Intel y Dell
          </div>
        </div>

        {/* Panel 2: Evidencia de Mercado */}
        <div
          style={{
            alignItems: "center",
            background: alpha(C.panel, 0.95),
            border: `2px solid ${alpha(fourCompanies > 0.05 ? C.cyan : C.white, 0.3 + fourCompanies * 0.7)}`,
            borderRadius: 20,
            boxShadow: `0 0 ${20 + fourCompanies * 40}px ${alpha(C.cyan, fourCompanies * 0.3)}`,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: 320,
            justifyContent: "center",
            padding: "24px 32px",
            transform: `scale(${1 + fourCompanies * 0.05})`,
          }}
        >
          <div
            style={{
              background: alpha(C.cyan, 0.15),
              borderRadius: 6,
              color: C.cyan,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.5,
              padding: "6px 14px",
            }}
          >
            2. EVIDENCIA DISPONIBLE
          </div>
          <div
            style={{
              color: C.cyan,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 64,
              fontWeight: 900,
              letterSpacing: -2,
              marginTop: 18,
            }}
          >
            4 LÍDERES
          </div>
          <div
            style={{
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 18,
              fontWeight: 700,
              marginTop: 14,
              textAlign: "center",
            }}
          >
            Concentración en el S&P 500
          </div>
          <div
            style={{
              color: C.muted,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 14,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Casi 1/3 del índice en 4 nombres
          </div>
        </div>

        {/* Panel 3: Dato Verificable */}
        <div
          style={{
            alignItems: "center",
            background: alpha(C.panel, 0.95),
            border: `2px solid ${alpha(risk > 0.05 ? C.red : C.green, 0.4 + risk * 0.6)}`,
            borderRadius: 20,
            boxShadow: `0 0 ${20 + risk * 40}px ${alpha(C.red, risk * 0.3)}`,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            height: 320,
            justifyContent: "center",
            padding: "24px 32px",
            transform: `scale(${1 + risk * 0.05})`,
          }}
        >
          <div
            style={{
              background: alpha(risk > 0.05 ? C.red : C.green, 0.15),
              borderRadius: 6,
              color: risk > 0.05 ? C.red : C.green,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 14,
              fontWeight: 800,
              letterSpacing: 1.5,
              padding: "6px 14px",
            }}
          >
            3. DATO VERIFICABLE
          </div>
          <div
            style={{
              color: risk > 0.05 ? C.red : C.green,
              fontFamily: DATA_FONT_FAMILY,
              fontSize: 56,
              fontWeight: 900,
              letterSpacing: -2,
              marginTop: 22,
            }}
          >
            CAÍDA 1/3
          </div>
          <div
            style={{
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 18,
              fontWeight: 700,
              marginTop: 18,
              textAlign: "center",
            }}
          >
            Arrastre simultáneo del mercado
          </div>
          <div
            style={{
              color: C.muted,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 14,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Efecto directo de la concentración
          </div>
        </div>
      </div>

      <div
        style={{
          color: risk > 0.05 ? C.gold : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 24,
          fontWeight: 850,
          left: 0,
          position: "absolute",
          right: 0,
          textAlign: "center",
          top: 845,
        }}
      >
        EL PESO EN EL ÍNDICE AMPLIFICA EL IMPACTO EN EL MERCADO
      </div>
    </>
  );
};

const ContagionDomino: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spread = pulse(scene, "contagion", frame, fps);
  const whole = pulse(scene, "whole-market", frame, fps);
  const sectors = [
    ["TECNOLOGÍA","⌁"],["CONSUMO","◈"],["INDUSTRIA","⚙"],
    ["FINANZAS","¤"],["ENERGÍA","ϟ"],["SALUD","✚"],
  ];
  return (
    <div style={{inset: 0, position: "absolute"}}>
      <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 18, left: 145, letterSpacing: 3, position: "absolute", top: 225}}>PROPAGACIÓN POR CAPAS</div>
      <div style={{display: "flex", gap: 20, left: 145, position: "absolute", right: 145, top: 385}}>
        {sectors.map(([sector, icon], index) => {
          const local = Math.max(0, Math.min(1, spread * 2.2 - index * .24 + whole));
          return (
            <div key={sector} style={{background: `linear-gradient(180deg,${alpha(local > .1 ? C.red : C.cyan,.22)},${C.panel})`, border: `2px solid ${alpha(local > .1 ? C.red : C.cyan,.65)}`, borderRadius: 12, height: 330, position: "relative", transform: `perspective(600px) rotateX(${local * 58}deg) translateY(${local * 75}px)`, transformOrigin: "bottom", width: 250}}>
              <div style={{color: local > .1 ? C.red : C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 16, left: 18, position: "absolute", top: 18}}>0{index+1}</div>
              <div style={{color:local>.1?C.red:C.cyan,fontFamily:FINANCE_FONT_FAMILY,fontSize:58,fontWeight:900,left:0,position:"absolute",right:0,textAlign:"center",top:72}}>{icon}</div>
              <div style={{bottom: 38, color: C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 19, fontWeight: 850, left: 8, position: "absolute", right:8,textAlign:"center"}}>{sector}</div>
            </div>
          );
        })}
      </div>
      <svg height="1080" style={{left: 0, position: "absolute", top: 0}} viewBox="0 0 1920 1080" width="1920">
        <path d="M210 790 C520 920 1130 920 1700 790" fill="none" opacity={spread} stroke={C.red} strokeDasharray="18 14" strokeWidth="5" />
      </svg>
      <div style={{bottom: 90, color: whole ? C.red : C.white, fontFamily: FINANCE_FONT_FAMILY, fontSize: 34, fontWeight: 900, left: 145, position: "absolute"}}>
        {whole ? "EL PROBLEMA YA NO ESTÁ AISLADO" : "PRIMERO CEDEN LOS LÍDERES"}
      </div>
    </div>
  );
};

const IndexWeightScene: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const four = pulse(scene, "four-companies", frame, fps);
  const thirty = pulse(scene, "percent-419-419", frame, fps);
  const impact = pulse(scene, "index-impact", frame, fps);
  const labels = ["CISCO", "MICROSOFT", "INTEL", "DELL"];
  return (
    <div style={{inset: 0, position: "absolute"}}>
      <div style={{color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 18, left: 140, letterSpacing: 3, position: "absolute", top: 225}}>REPRESENTACIÓN CONCEPTUAL DEL PESO NARRADO</div>
      <div style={{display: "flex", height: 260, left: 140, position: "absolute", right: 140, top: 390, transform: `rotate(${impact * 3}deg) translateY(${impact * 35}px)`, transformOrigin: "80% 50%"}}>
        <div style={{alignItems: "center", background: `linear-gradient(135deg,${alpha(C.gold,.42)},${alpha(C.gold,.14)})`, border: `3px solid ${C.gold}`, display: "flex", gap: 18, justifyContent: "center", position: "relative", width: `${30 + thirty * 2}%`}}>
          {labels.map((label) => {
            const asset=logoFor(scene,label);
            return <div key={label} style={{alignItems:"center",background:C.white,borderRadius:10,boxShadow:`0 0 ${four*34}px ${alpha(C.gold,four*.65)}`,display:"flex",height:82,justifyContent:"center",opacity:.7+four*.3,transform:`translateY(${-four*35}px) scale(${1+four*.18})`,width:105}}>{asset?<Img src={staticFile(asset.path)} style={{height:50,maxWidth:78,objectFit:"contain"}}/>:null}</div>;
          })}
          <div style={{color:C.gold,fontFamily:DATA_FONT_FAMILY,fontSize:72,fontWeight:950,left:20,position:"absolute",top:-105}}>≈30%</div>
        </div>
        <div style={{alignItems:"center",background:alpha(C.cyan,.1),border:`3px solid ${alpha(C.cyan,.55)}`,color:C.cyan,display:"flex",fontFamily:DATA_FONT_FAMILY,fontSize:44,fontWeight:900,justifyContent:"center",width:"70%"}}>RESTO DEL ÍNDICE</div>
      </div>
      <div style={{background:C.white,height:12,left:140,position:"absolute",right:140,top:690,transform:`rotate(${impact*3}deg) translateY(${impact*35}px)`,transformOrigin:"80% 50%"}}/>
      <div style={{color:impact?C.red:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:38,fontWeight:900,left:140,position:"absolute",top:790}}>
        {impact ? "CUANDO CEDE EL BLOQUE PESADO, EL ÍNDICE LO SIENTE" : "CUATRO EMPRESAS OCUPAN UNA PARTE DESPROPORCIONADA"}
      </div>
    </div>
  );
};

export const ThirdMinuteNarrativeScene: React.FC<{scene: EditorialScene}> = ({
  scene,
}) => {
  let content: React.ReactNode;
  switch (scene.kind) {
    case "historical-leaders":
      content = <HistoricalArchive scene={scene} />;
      break;
    case "dominance-facade":
      content = <DominanceFacade scene={scene} />;
      break;
    case "leadership-lag":
      content = <LeadershipLag scene={scene} />;
      break;
    case "contagion-spread":
      content = <ContagionDomino scene={scene} />;
      break;
    case "claim-evidence-gap":
      content = <IndexWeightScene scene={scene} />;
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
