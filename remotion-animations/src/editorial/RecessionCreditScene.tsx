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

const C = {
  bg: "#030711",
  ink: "#FFF9E8",
  muted: "#A9B3C7",
  gold: "#FFC83D",
  cyan: "#62D4FF",
  red: "#FF5F6D",
  green: "#52D69B",
  ice: "#BCEBFF",
} as const;
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"} as const;
const ease = (frame: number, fps: number, a: number, b: number) =>
  interpolate(frame, [a * fps, b * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
const cue = (scene: EditorialScene, id: string, frame: number, fps: number) => {
  const target = scene.semanticCues.find((item) => item.id === id);
  return target ? ease(frame, fps, target.atSeconds, target.atSeconds + 0.42) : 0;
};
const transientCue = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const target = scene.semanticCues.find((item) => item.id === id);
  if (!target) return 0;
  return interpolate(
    frame,
    [
      target.atSeconds * fps,
      (target.atSeconds + 0.24) * fps,
      (target.atSeconds + 1.16) * fps,
      (target.atSeconds + 1.48) * fps,
    ],
    [0, 1, 1, 0],
    clamp,
  );
};
const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(
    value.slice(2, 4),
    16,
  )},${Number.parseInt(value.slice(4, 6), 16)},${opacity})`;
};

const PhotoBackdrop: React.FC<{path: string; focus?: string}> = ({
  path,
  focus = "center",
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill>
      <Img
        src={staticFile(path)}
        style={{
          height: "100%",
          objectFit: "cover",
          objectPosition: focus,
          opacity: 0.42,
          transform: `scale(${1.04 + frame / fps / 420})`,
          width: "100%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg,rgba(3,7,17,.98) 0%,rgba(3,7,17,.72) 48%,rgba(3,7,17,.36) 100%),linear-gradient(0deg,rgba(3,7,17,.92),transparent 55%)",
        }}
      />
    </AbsoluteFill>
  );
};

const Header: React.FC<{eyebrow: string; title: string}> = ({eyebrow, title}) => (
  <div style={{left: 150, position: "absolute", right: 150, textAlign: "center", top: 52, zIndex: 8}}>
    <div style={{color: C.gold, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 900, letterSpacing: 3}}>
      {eyebrow}
    </div>
    <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 56, fontWeight: 950, marginTop: 12}}>
      {title}
    </div>
  </div>
);

const RecessionBreaker: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const recession = cue(scene, "recession-905", frame, fps);
  const recessionWord = transientCue(scene, "recession-905", frame, fps);
  const technology = cue(scene, "technology-914", frame, fps);
  const benefits = cue(scene, "benefits-923", frame, fps);
  const travel = ease(frame, fps, 0.6, 8.2);
  return (
    <>
      <PhotoBackdrop path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg" focus="62% center" />
      <Header eyebrow="RIESGO SISTÉMICO" title="El ciclo económico puede cambiar la trayectoria" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        <path d="M160 720 C470 660 710 580 1010 430 C1250 310 1510 285 1770 245" fill="none" pathLength={1} stroke={C.green} strokeDasharray={`${travel} 1`} strokeWidth="16" />
        <g opacity={recession}>
          <rect fill={alpha(C.red, 0.88)} height="510" rx="18" transform="rotate(11 1060 520)" width="92" x="1014" y="265" />
          <path d="M1015 550 L1095 510" stroke={C.ink} strokeWidth="10" />
          <circle cx="1052" cy="535" fill={C.ink} r="18" />
        </g>
        <path d="M1075 535 C1290 600 1510 710 1760 815" fill="none" opacity={recession} stroke={C.red} strokeDasharray="18 14" strokeWidth="15" />
      </svg>
      <div style={{background: alpha(C.bg, 0.82), borderLeft: `7px solid ${recession ? C.red : C.green}`, bottom: 95, left: 155, padding: "28px 36px", position: "absolute", width: 690}}>
        <div style={{color: recession ? C.red : C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 23, fontWeight: 900}}>LA TECNOLOGÍA NO ANULA EL CICLO</div>
        <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 36, fontWeight: 900, marginTop: 12}}>Los beneficios siguen conectados a la economía real</div>
      </div>
      <div style={{background: C.red, border: `5px solid ${C.ink}`, boxShadow: `0 0 70px ${alpha(C.red, recessionWord * 0.65)}`, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 62, fontWeight: 950, left: "50%", opacity: recessionWord, padding: "22px 46px", position: "absolute", top: 455, transform: `translate(-50%,-50%) scale(${0.72 + recessionWord * 0.28})`, zIndex: 10}}>RECESIÓN</div>
      <div style={{background: alpha(C.cyan, 0.13), border: `4px solid ${C.cyan}`, color: C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 23, fontWeight: 950, opacity: technology, padding: "22px 28px", position: "absolute", right: 190, top: 245, transform: `scale(${0.82 + technology * 0.18})`}}>VENTAJA TECNOLÓGICA ≠ INMUNIDAD</div>
      <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 31, fontWeight: 950, opacity: recession, position: "absolute", right: 170, top: 700, transform: `scale(${0.8 + benefits * 0.2})`}}>TRAYECTORIA INTERRUMPIDA</div>
    </>
  );
};

const SpendingCut: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spend = cue(scene, "spend-936", frame, fps);
  const cut = cue(scene, "cut-947", frame, fps);
  const flow = ease(frame, fps, 0.5, 4.8) * (1 - cut * 0.82);
  const stages = [
    {label: "HOGARES", sub: "CAPACIDAD DE GASTO"},
    {label: "DEMANDA", sub: "VENTAS"},
    {label: "EMPRESAS", sub: "INVERSIÓN"},
  ];
  return (
    <>
      <Header eyebrow="CADENA DE TRANSMISIÓN" title="El negocio empieza en el bolsillo del cliente" />
      <div style={{display: "flex", gap: 90, left: 160, position: "absolute", right: 160, top: 330}}>
        {stages.map((stage, index) => (
          <div key={stage.label} style={{background: alpha(C.cyan, 0.09), border: `4px solid ${index === 2 && cut ? C.red : C.cyan}`, borderRadius: 18, flex: 1, padding: "55px 25px", position: "relative", textAlign: "center"}}>
            <div style={{color: index === 2 && cut ? C.red : C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 28, fontWeight: 950}}>{stage.label}</div>
            <div style={{color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 31, fontWeight: 850, marginTop: 24}}>{stage.sub}</div>
            {index < 2 ? <div style={{color: C.gold, fontSize: 64, fontWeight: 900, position: "absolute", right: -76, top: 82, opacity: flow}}>→</div> : null}
          </div>
        ))}
      </div>
      <div style={{bottom: 180, height: 46, left: 220, position: "absolute", right: 220}}>
        {Array.from({length: 18}, (_, index) => (
          <div key={index} style={{background: index % 2 ? C.gold : C.green, borderRadius: "50%", height: 18, left: `${index * 5.5}%`, opacity: index / 18 < flow ? 1 : 0.12, position: "absolute", top: 12, transform: `translateX(${spend * 12}px)`, width: 18}} />
        ))}
        <div style={{background: C.red, height: 82, left: "68%", opacity: cut, position: "absolute", top: -20, transform: "rotate(22deg)", width: 18}} />
        <div style={{background: C.red, height: 82, left: "71%", opacity: cut, position: "absolute", top: -20, transform: "rotate(-22deg)", width: 18}} />
      </div>
      <div style={{bottom: 72, color: cut ? C.red : C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 29, fontWeight: 950, left: 160, position: "absolute", right: 160, textAlign: "center"}}>{cut ? "MENOS GASTO → MENOS INVERSIÓN" : "EL FLUJO TODAVÍA ESTÁ ABIERTO"}</div>
    </>
  );
};

const FrozenBudget: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const freeze = cue(scene, "freeze-955", frame, fps);
  const weak = cue(scene, "weak-960", frame, fps);
  return (
    <>
      <Header eyebrow="PRESUPUESTOS BAJO CERO" title="La congelación se propaga por toda la economía" />
      <div style={{background: "#F3F0E5", borderRadius: 12, boxShadow: `0 25px 70px ${alpha(C.ice, freeze * 0.35)}`, height: 550, left: 250, overflow: "hidden", padding: 46, position: "absolute", top: 250, transform: `rotate(${-2 + freeze * 1.3}deg)`, width: 610}}>
        <div style={{color: "#172033", fontFamily: DATA_FONT_FAMILY, fontSize: 25, fontWeight: 950}}>PLAN DE INVERSIÓN</div>
        {[0.86, 0.7, 0.92, 0.52].map((width, index) => <div key={index} style={{background: "#BCC4CC", height: 18, marginTop: 42, opacity: 0.8, width: `${width * 100}%`}} />)}
        <div style={{border: "8px solid #D74652", color: "#D74652", fontFamily: DATA_FONT_FAMILY, fontSize: 46, fontWeight: 950, left: 100, opacity: freeze, padding: "18px 32px", position: "absolute", top: 230, transform: "rotate(-11deg)"}}>CONGELADO</div>
        <AbsoluteFill style={{background: `linear-gradient(135deg,transparent 35%,${alpha(C.ice, freeze * 0.48)} 36%,transparent 38%,transparent 54%,${alpha(C.ice, freeze * 0.5)} 55%,transparent 58%)`, opacity: freeze}} />
      </div>
      <div style={{display: "grid", gap: 20, gridTemplateColumns: "repeat(2, 1fr)", position: "absolute", right: 230, top: 290, width: 620}}>
        {["EMPLEO", "PROVEEDORES", "CONSUMO", "BENEFICIOS"].map((label, index) => {
          const off = weak * Math.min(1, Math.max(0, (frame / fps - 4.8 - index * 0.28) / 0.5));
          return <div key={label} style={{background: alpha(C.cyan, 0.08), border: `3px solid ${off ? alpha(C.red, 0.9) : alpha(C.cyan, 0.65)}`, color: off ? C.muted : C.ink, fontFamily: DATA_FONT_FAMILY, fontSize: 23, fontWeight: 900, opacity: 1 - off * 0.55, padding: "48px 18px", textAlign: "center", transform: `translateY(${off * 35}px)`}}>{label}</div>;
        })}
      </div>
      <div style={{bottom: 74, color: C.ice, fontFamily: FINANCE_FONT_FAMILY, fontSize: 36, fontWeight: 900, left: 160, position: "absolute", right: 160, textAlign: "center"}}>NINGÚN LÍDER QUEDA AISLADO DE LA DEMANDA</div>
    </>
  );
};

const CreditMonitor: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const restriction = cue(scene, "restriction-996", frame, fps);
  const chart = cue(scene, "chart-1002", frame, fps);
  return (
    <>
      <PhotoBackdrop path="assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg" focus="center" />
      <Header eyebrow="INDICADOR ADELANTADO" title="El crédito muestra la temperatura antes que el mercado" />
      <div style={{background: alpha(C.bg, 0.83), border: `4px solid ${C.cyan}`, borderRadius: 24, bottom: 145, left: 175, padding: 46, position: "absolute", top: 260, width: 720}}>
        <div style={{color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 25, fontWeight: 950}}>TERMÓMETRO BANCARIO</div>
        <div style={{height: 320, marginTop: 30, position: "relative"}}>
          <div style={{background: alpha(C.green, 0.22), borderRadius: 30, bottom: 0, left: 80, position: "absolute", top: 0, width: 90}} />
          <div style={{background: restriction ? C.red : C.green, borderRadius: 30, bottom: 0, height: `${30 + restriction * 65}%`, left: 80, position: "absolute", width: 90}} />
          <div style={{color: restriction ? C.red : C.green, fontFamily: DATA_FONT_FAMILY, fontSize: 33, fontWeight: 950, left: 230, position: "absolute", top: 115}}>ESTÁNDARES {restriction ? "MÁS DUROS" : "ABIERTOS"}</div>
        </div>
      </div>
      <div style={{background: alpha(C.gold, 0.12), border: `4px solid ${C.gold}`, borderRadius: 22, color: C.ink, fontFamily: FINANCE_FONT_FAMILY, fontSize: 42, fontWeight: 950, opacity: chart, padding: "75px 48px", position: "absolute", right: 175, textAlign: "center", top: 360, transform: `translateX(${(1 - chart) * 90}px)`, width: 650}}>
        LA ENCUESTA CONVIERTE DECISIONES BANCARIAS EN UNA SERIE
      </div>
    </>
  );
};

const LendingGate: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const harden = cue(scene, "harden-1010", frame, fps);
  const draw = ease(frame, fps, 0.4, 4.9);
  const values = scene.chartData.map((item) => item.value);
  const minimum = Math.min(-40, ...values);
  const maximum = Math.max(90, ...values);
  const chart = {x: 150, y: 270, width: 1620, height: 590};
  const xFor = (index: number) =>
    chart.x + (index / Math.max(1, scene.chartData.length - 1)) * chart.width;
  const yFor = (value: number) =>
    chart.y + chart.height - ((value - minimum) / (maximum - minimum)) * chart.height;
  const path = scene.chartData
    .map((item, index) => `${index === 0 ? "M" : "L"} ${xFor(index)} ${yFor(item.value)}`)
    .join(" ");
  const latest = scene.chartData[scene.chartData.length - 1];
  const latestX = xFor(scene.chartData.length - 1);
  const latestY = latest ? yFor(latest.value) : 0;
  return (
    <>
      <Header eyebrow="ENCUESTA SLOOS · RESERVA FEDERAL" title="Porcentaje neto de bancos que endurecen estándares" />
      <svg height="1080" viewBox="0 0 1920 1080" width="1920" style={{position: "absolute"}}>
        {[0, 20, 40, 60, 80].map((value) => (
          <g key={value}>
            <line x1={chart.x} x2={chart.x + chart.width} y1={yFor(value)} y2={yFor(value)} stroke={value === 0 ? alpha(C.ink, 0.55) : alpha(C.muted, 0.2)} strokeWidth={value === 0 ? 3 : 2} />
            <text fill={C.muted} fontFamily={DATA_FONT_FAMILY} fontSize="21" textAnchor="end" x={chart.x - 18} y={yFor(value) + 7}>{value}%</text>
          </g>
        ))}
        <path d={path} fill="none" pathLength={1} stroke={C.gold} strokeDasharray={`${draw} 1`} strokeWidth="9" />
        <circle cx={latestX} cy={latestY} fill={C.cyan} opacity={harden} r={14} />
        <line x1={latestX} x2={latestX} y1={latestY} y2={chart.y + chart.height} stroke={alpha(C.cyan, harden * 0.65)} strokeDasharray="8 8" strokeWidth="3" />
        {[
          ["1990", 0],
          ["2000", 40],
          ["2008", 74],
          ["2020", 120],
          ["2026", scene.chartData.length - 1],
        ].map(([label, index]) => <text key={label} fill={C.muted} fontFamily={DATA_FONT_FAMILY} fontSize="21" textAnchor="middle" x={xFor(Number(index))} y={900}>{label}</text>)}
      </svg>
      <div style={{background: alpha(C.bg, 0.92), border: `3px solid ${C.cyan}`, color: C.cyan, fontFamily: DATA_FONT_FAMILY, fontSize: 25, fontWeight: 950, opacity: harden, padding: "15px 20px", position: "absolute", right: 118, top: latestY + 60, transform: `scale(${0.82 + harden * 0.18})`}}>{latest?.value.toLocaleString("es-ES")} % · {latest?.label}</div>
      <div style={{color: C.red, fontFamily: DATA_FONT_FAMILY, fontSize: 18, fontWeight: 950, position: "absolute", right: 150, top: 245}}>MÁS RESTRICCIÓN ↑</div>
      <div style={{bottom: 35, color: C.muted, fontFamily: DATA_FONT_FAMILY, fontSize: 17, left: 150, position: "absolute"}}>FUENTE · FEDERAL RESERVE · SLOOS · SUBLPDCILS_N.Q</div>
    </>
  );
};

export const RecessionCreditScene: React.FC<{scene: EditorialScene}> = ({scene}) => (
  <AbsoluteFill style={{background: "linear-gradient(145deg,#030711,#071426 64%,#02040B)", overflow: "hidden"}}>
    {scene.id === "scene-035" ? <RecessionBreaker scene={scene} /> :
      scene.id === "scene-036" ? <SpendingCut scene={scene} /> :
        scene.id === "scene-037" ? <FrozenBudget scene={scene} /> :
          scene.id === "scene-038" ? <CreditMonitor scene={scene} /> :
            <LendingGate scene={scene} />}
  </AbsoluteFill>
);
