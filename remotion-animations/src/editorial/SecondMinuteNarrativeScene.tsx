import {
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
  panel: "#121B34",
  white: "#FFF9E8",
  muted: "#A9A9B8",
  gold: "#FFC83D",
  cyan: "#6ED4FF",
  green: "#49C98A",
  red: "#FF5F6D",
} as const;
const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(
    value.slice(2, 4),
    16,
  )},${Number.parseInt(value.slice(4, 6), 16)},${opacity})`;
};
const cue = (scene: EditorialScene, id: string) =>
  scene.semanticCues.find((item) => item.id === id);
const enter = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const item = cue(scene, id);
  if (!item) return 0;
  return interpolate(
    frame,
    [item.atSeconds * fps, (item.atSeconds + 0.42) * fps],
    [0, 1],
    {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    },
  );
};
const flash = (
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
    interpolate(frame, [start, start + 0.28 * fps], [0, 1], clamp),
    interpolate(frame, [end - 0.22 * fps, end], [1, 0], clamp),
  );
};
const reveal = (
  frame: number,
  fps: number,
  from: number,
  to: number,
) =>
  interpolate(frame, [from * fps, to * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const CAMERA_TARGETS: Record<string, [number, number]> = {
  "market-engine": [44, 54],
  "market-output": [72, 54],
  "named-company-logos": [50, 24],
  "ai-core": [50, 55],
  "gains-column": [62, 55],
  "decade-track": [50, 76],
  "correction-zone": [50, 54],
  "warning-signal": [50, 32],
  "tech-bubble": [62, 50],
  "wall-street-rule": [50, 78],
  "upward-force": [50, 35],
  "downward-force": [50, 68],
  abyss: [72, 80],
  "not-first-time": [50, 30],
  "dotcom-destination": [20, 58],
};

const CameraStage: React.FC<{
  scene: EditorialScene;
  children: React.ReactNode;
}> = ({scene, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cameraCues = scene.semanticCues.filter((item) =>
    ["focus", "highlight", "zoom", "verify"].includes(item.action),
  );
  const active = cameraCues
    .map((item) => ({
      item,
      amount: flash(scene, item.id, frame, fps),
    }))
    .sort((left, right) => right.amount - left.amount)[0];
  const amount = active?.amount ?? 0;
  const target = CAMERA_TARGETS[active?.item.target ?? ""] ?? [50, 50];
  const scale = 1 + amount * 0.085;
  return (
    <div
      style={{
        height: "100%",
        position: "absolute",
        transform: `scale(${scale})`,
        transformOrigin: `${target[0]}% ${target[1]}%`,
        width: "100%",
      }}
    >
      {children}
    </div>
  );
};

const logoFor = (scene: EditorialScene, label: string) => {
  const normalized = label.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return scene.assets.find(
    (asset) =>
      asset.kind === "logo" &&
      asset.label.replace(/[^a-z0-9]/gi, "").toLowerCase() === normalized,
  );
};

const LogoRow: React.FC<{
  scene: EditorialScene;
  labels?: string[];
  emphasis?: number;
}> = ({scene, labels = scene.labels, emphasis = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        justifyContent: "center",
        left: 120,
        position: "absolute",
        right: 120,
        top: 198,
      }}
    >
      {labels.slice(0, 7).map((label, index) => {
        const amount = reveal(frame, fps, 0.1 + index * 0.08, 0.58 + index * 0.08);
        const asset = logoFor(scene, label);
        return (
          <div
            key={label}
            style={{
              alignItems: "center",
              background: alpha(C.panel, 0.94),
              border: `2px solid ${alpha(
                emphasis > 0.15 ? C.cyan : C.white,
                0.16 + emphasis * 0.68,
              )}`,
              borderRadius: 13,
              boxShadow:
                emphasis > 0.15
                  ? `0 0 30px ${alpha(C.cyan, emphasis * 0.22)}`
                  : "none",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              height: 112,
              justifyContent: "center",
              opacity: amount,
              transform: `translateY(${(1 - amount) * -20}px) scale(${
                0.9 + amount * 0.1 + emphasis * 0.035
              })`,
              width: 112,
            }}
          >
            {asset ? (
              <Img
                src={staticFile(asset.path)}
                style={{height: 48, objectFit: "contain", width: 62}}
              />
            ) : (
              <span style={{fontSize: 36, fontWeight: 900}}>{label[0]}</span>
            )}
            <span
              style={{
                color: C.white,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const Tag: React.FC<{
  scene: EditorialScene;
  id: string;
  fallback: string;
  top?: number;
  left?: number | string;
  persistent?: boolean;
}> = ({
  scene,
  id,
  fallback,
  top = 790,
  left = "50%",
  persistent = false,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const amount = persistent
    ? enter(scene, id, frame, fps)
    : flash(scene, id, frame, fps);
  const item = cue(scene, id);
  const color =
    item?.tone === "negative"
      ? C.red
      : item?.tone === "cyan"
        ? C.cyan
        : item?.tone === "positive"
          ? C.green
          : C.gold;
  return (
    <div
      style={{
        background:
          item?.tone === "negative" ? alpha(color, 0.95) : alpha(color, 0.17),
        border: `1px solid ${alpha(color, 0.8)}`,
        borderRadius: 10,
        color: item?.tone === "negative" ? C.white : color,
        fontFamily: FINANCE_FONT_FAMILY,
        fontSize: 28,
        fontWeight: 900,
        left,
        opacity: amount,
        padding: "11px 22px 13px",
        position: "absolute",
        top,
        transform: `translateX(-50%) scale(${0.94 + amount * 0.06})`,
        whiteSpace: "nowrap",
        zIndex: 9,
      }}
    >
      {item?.label ?? fallback}
    </div>
  );
};

const MarketEngine: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const engine = enter(scene, "engine", frame, fps);
  const output = enter(scene, "whole-market", frame, fps);
  const named = flash(scene, "named-companies", frame, fps);
  const spin = (frame / fps) * (26 + engine * 34);
  const teeth = 16;
  return (
    <>
      <LogoRow emphasis={named} scene={scene} />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          left: 370,
          position: "absolute",
          right: 370,
          top: 410,
        }}
      >
        <div style={{background: C.cyan, height: 5, opacity: 0.55, width: 300}} />
        <div
          style={{
            alignItems: "center",
            background: alpha(C.panel, 0.96),
            border: `4px solid ${C.gold}`,
            borderRadius: "50%",
            boxShadow: `0 0 ${42 + engine * 46}px ${alpha(C.gold, 0.22)}`,
            display: "flex",
            height: 300,
            justifyContent: "center",
            position: "relative",
            width: 300,
          }}
        >
          {Array.from({length: teeth}, (_, index) => (
            <div
              key={index}
              style={{
                background: index % 2 ? C.gold : C.cyan,
                borderRadius: 4,
                height: 38,
                left: 142,
                opacity: 0.82,
                position: "absolute",
                top: 18,
                transform: `rotate(${spin + index * (360 / teeth)}deg)`,
                transformOrigin: "8px 132px",
                width: 16,
              }}
            />
          ))}
          <div
            style={{
              alignItems: "center",
              background: alpha(C.bg, 0.96),
              border: `4px solid ${alpha(C.cyan, 0.78)}`,
              borderRadius: "50%",
              boxShadow: `inset 0 0 28px ${alpha(C.cyan, 0.22)}`,
              display: "flex",
              height: 112,
              justifyContent: "center",
              position: "relative",
              width: 112,
            }}
          >
            <div
              style={{
                background: C.gold,
                border: `10px solid ${C.panel}`,
                borderRadius: "50%",
                boxShadow: `0 0 24px ${alpha(C.gold, 0.46)}`,
                height: 54,
                width: 54,
              }}
            />
          </div>
        </div>
        <div
          style={{
            background: `linear-gradient(90deg,${C.gold},${C.cyan})`,
            height: 7,
            opacity: output,
            position: "relative",
            width: 300,
          }}
        >
          <div
            style={{
              borderBottom: "15px solid transparent",
              borderLeft: `25px solid ${C.cyan}`,
              borderTop: "15px solid transparent",
              position: "absolute",
              right: -22,
              top: -12,
            }}
          />
        </div>
        <div
          style={{
            color: C.cyan,
            fontFamily: FINANCE_FONT_FAMILY,
            fontSize: 42,
            fontWeight: 900,
            marginLeft: 32,
            opacity: output,
          }}
        >
          MERCADO
        </div>
      </div>
      <Tag fallback="MOTOR DEL ÍNDICE" id="engine" scene={scene} top={330} />
      <Tag fallback="TODO EL MERCADO" id="whole-market" scene={scene} top={770} />
    </>
  );
};

const AiCore: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ai = enter(scene, "ai-boom", frame, fps);
  const gains = enter(scene, "gains", frame, fps);
  const decade = flash(scene, "decade", frame, fps);
  const however = enter(scene, "however", frame, fps);
  return (
    <>
      <LogoRow emphasis={ai} scene={scene} />
      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          gap: 52,
          justifyContent: "center",
          left: 300,
          position: "absolute",
          right: 300,
          top: 420,
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: alpha(C.bg, 0.82),
            border: `3px solid ${C.cyan}`,
            borderRadius: 20,
            boxShadow: `0 0 64px ${alpha(C.cyan, ai * 0.28)}`,
            color: C.cyan,
            display: "flex",
            fontFamily: DATA_FONT_FAMILY,
            fontSize: 126,
            fontWeight: 900,
            height: 280,
            justifyContent: "center",
            transform: `scale(${0.9 + ai * 0.1})`,
            width: 350,
          }}
        >
          IA
        </div>
        <div style={{alignItems: "flex-end", display: "flex", gap: 16}}>
          {[0.32, 0.45, 0.58, 0.72, 0.68, 0.86, 0.92].map((height, index) => (
            <div
              key={index}
              style={{
                background:
                  index > 4
                    ? C.gold
                    : `linear-gradient(180deg,${C.cyan},${alpha(C.cyan, 0.22)})`,
                borderRadius: "7px 7px 2px 2px",
                height: 300 * height * gains,
                opacity: gains,
                width: 58,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          background: alpha(C.gold, decade * 0.95),
          borderRadius: 10,
          bottom: 105,
          color: decade > 0.15 ? C.bg : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 34,
          fontWeight: 900,
          left: 585,
          padding: "14px 24px",
          position: "absolute",
          right: 585,
          textAlign: "center",
        }}
      >
        UNA DÉCADA DE LIDERAZGO
      </div>
      <div
        style={{
          background: alpha(C.red, 0.84),
          inset: 0,
          opacity: however * 0.9,
          position: "absolute",
        }}
      />
      <Tag fallback="SIN EMBARGO" id="however" scene={scene} top={470} />
    </>
  );
};

const AlertIcon: React.FC<{amount: number}> = ({amount}) => (
  <svg
    height="240"
    style={{opacity: 0.25 + amount * 0.75}}
    viewBox="0 0 240 240"
    width="240"
  >
    <circle
      cx="120"
      cy="120"
      fill={alpha(C.red, 0.16)}
      r="104"
      stroke={C.red}
      strokeWidth="6"
    />
    <path d="M120 25 L218 205 H22 Z" fill={C.red} />
    <rect fill={C.white} height="82" rx="8" width="20" x="110" y="78" />
    <circle cx="120" cy="181" fill={C.white} r="12" />
  </svg>
);

const CorrectionAlert: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const correction = enter(scene, "correction", frame, fps);
  const analysts = enter(scene, "analysts", frame, fps);
  const alarm = flash(scene, "alarm", frame, fps);
  return (
    <>
      <LogoRow emphasis={correction} scene={scene} />
      <div
        style={{
          alignItems: "center",
          display: "flex",
          left: 280,
          position: "absolute",
          right: 280,
          top: 420,
        }}
      >
        <AlertIcon amount={alarm} />
        <div style={{flex: 1, height: 270, marginLeft: 60, position: "relative"}}>
          <div
            style={{
              background: alpha(C.white, 0.16),
              height: 6,
              position: "absolute",
              top: 95,
              width: "100%",
            }}
          />
          <div
            style={{
              background: C.red,
              height: 6,
              position: "absolute",
              top: 95,
              transform: `rotate(${correction * 8}deg) scaleX(${correction})`,
              transformOrigin: "left",
              width: "100%",
            }}
          />
          {[
            {label: "CORRECCIÓN", left: 0, top: 42, opacity: correction},
            {label: "ANALISTAS", left: 43, top: 92, opacity: analysts},
            {label: "ALARMA", left: 78, top: 154, opacity: alarm},
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background:
                  item.label === "ALARMA" ? C.red : alpha(C.bg, 0.9),
                border: `2px solid ${
                  item.label === "ALARMA" ? C.red : alpha(C.cyan, 0.7)
                }`,
                borderRadius: 9,
                color: C.white,
                fontFamily: FINANCE_FONT_FAMILY,
                fontSize: 22,
                fontWeight: 900,
                left: `${item.left}%`,
                opacity: item.opacity,
                padding: "13px 17px",
                position: "absolute",
                top: item.top,
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
      <Tag fallback="CORRECCIÓN SIGNIFICATIVA" id="correction" scene={scene} />
      <Tag fallback="OLEADA DE ANALISTAS" id="analysts" scene={scene} />
      <Tag fallback="VOZ DE ALARMA" id="alarm" scene={scene} />
    </>
  );
};

const BubbleTrigger: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const catalyst = enter(scene, "catalyst", frame, fps);
  const bubble = enter(scene, "bubble", frame, fps);
  const rule = flash(scene, "wall-street", frame, fps);
  return (
    <>
      <div
        style={{
          alignItems: "center",
          background: `radial-gradient(circle at 34% 28%,${alpha(
            C.cyan,
            0.72,
          )},${alpha(C.cyan, 0.12)} 54%,${alpha(C.red, bubble * 0.24)})`,
          border: `5px solid ${bubble > 0.15 ? C.red : alpha(C.cyan, 0.72)}`,
          borderRadius: "50%",
          boxShadow: `0 0 90px ${alpha(bubble > 0.15 ? C.red : C.cyan, 0.24)}`,
          color: C.white,
          display: "flex",
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 48,
          fontWeight: 900,
          height: 430,
          justifyContent: "center",
          left: 745,
          position: "absolute",
          top: 310,
          transform: `scale(${0.94 + bubble * 0.06})`,
          width: 430,
        }}
      >
        TECNOLOGÍA
        <svg
          height="270"
          style={{left: 80, opacity: bubble, position: "absolute", top: 72}}
          viewBox="0 0 270 270"
          width="270"
        >
          <path
            d="M126 12 L105 94 L150 126 L112 178 L142 258 M107 95 L55 132 M149 126 L218 95 M112 178 L48 220"
            fill="none"
            stroke={C.white}
            strokeWidth="7"
          />
        </svg>
      </div>
      <div
        style={{
          background: C.gold,
          height: 8,
          left: 320,
          position: "absolute",
          top: 530,
          transform: `rotate(-8deg) scaleX(${catalyst})`,
          transformOrigin: "left",
          width: 425,
        }}
      />
      <div
        style={{
          color: C.gold,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 30,
          fontWeight: 900,
          left: 360,
          opacity: catalyst,
          position: "absolute",
          top: 444,
        }}
      >
        CATALIZADOR →
      </div>
      <div
        style={{
          background: alpha(C.white, rule * 0.94),
          borderRadius: 10,
          bottom: 105,
          color: rule > 0.15 ? C.bg : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 30,
          fontWeight: 900,
          left: 555,
          padding: "15px 24px",
          position: "absolute",
          right: 555,
          textAlign: "center",
        }}
      >
        REGLA NO ESCRITA DE WALL STREET
      </div>
      <Tag fallback="BURBUJA TECNOLÓGICA" id="bubble" scene={scene} top={210} />
    </>
  );
};

const MarketGravity: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = enter(scene, "rise", frame, fps);
  const turn = enter(scene, "also", frame, fps);
  const drag = enter(scene, "drag", frame, fps);
  const abyss = flash(scene, "abyss", frame, fps);
  const y = 620 - rise * 220 + drag * 430;
  return (
    <>
      <div
        style={{
          background: `linear-gradient(180deg,${alpha(
            C.green,
            0.25,
          )},transparent 48%,${alpha(C.red, 0.38)})`,
          bottom: 80,
          left: 470,
          position: "absolute",
          right: 470,
          top: 210,
        }}
      />
      <div
        style={{
          background: drag > 0.1 ? C.red : C.green,
          borderRadius: 16,
          boxShadow: `0 0 45px ${alpha(drag > 0.1 ? C.red : C.green, 0.32)}`,
          color: C.bg,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 34,
          fontWeight: 900,
          left: 790,
          padding: "27px 38px",
          position: "absolute",
          textAlign: "center",
          top: y,
          transform: `rotate(${turn * 3 - drag * 7}deg)`,
          width: 260,
        }}
      >
        MERCADO
      </div>
      <div
        style={{
          color: C.green,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 50,
          fontWeight: 900,
          left: 1120,
          opacity: rise * (1 - drag * 0.7),
          position: "absolute",
          top: 300,
        }}
      >
        ↑ IMPULSO
      </div>
      <div
        style={{
          color: C.red,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 54,
          fontWeight: 900,
          left: 1120,
          opacity: drag,
          position: "absolute",
          top: 700,
        }}
      >
        ↓ ARRASTRE
      </div>
      <div
        style={{
          background: `linear-gradient(180deg,transparent,${C.bg})`,
          bottom: 0,
          left: 0,
          opacity: abyss,
          position: "absolute",
          right: 0,
          top: 670,
        }}
      />
      <Tag
        fallback="ABISMO"
        id="abyss"
        left={1390}
        persistent
        scene={scene}
        top={835}
      />
    </>
  );
};

const HistoryRewind: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const same = enter(scene, "same-script", frame, fps);
  const past = enter(scene, "past", frame, fps);
  return (
    <>
      <div
        style={{
          color: C.cyan,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 132,
          fontWeight: 900,
          left: 1210,
          opacity: past,
          position: "absolute",
          top: 300,
          transform: `translateX(${-70 * past}px)`,
        }}
      >
        ◀◀
      </div>
      <div
        style={{
          background: alpha(C.white, 0.15),
          height: 6,
          left: 380,
          position: "absolute",
          top: 570,
          width: 1160,
        }}
      />
      <div
        style={{
          background: C.cyan,
          height: 6,
          right: 380,
          position: "absolute",
          top: 570,
          width: 1160 * past,
        }}
      />
      {[
        {x: 380, label: "PUNTOCOM", color: C.red, opacity: past},
        {x: 960, label: "MISMO LIBRETO", color: C.cyan, opacity: same},
        {x: 1540, label: "HOY", color: C.gold, opacity: 1},
      ].map((item, index) => (
        <div
          key={item.label}
          style={{
            color: item.color,
            fontFamily: FINANCE_FONT_FAMILY,
            fontSize: 28,
            fontWeight: 900,
            left: item.x,
            opacity: item.opacity,
            position: "absolute",
            textAlign: "center",
            top: index === 1 ? 470 : 610,
            transform: "translateX(-50%)",
          }}
        >
          <div
            style={{
              background: item.color,
              borderRadius: "50%",
              height: 28,
              margin: "0 auto 18px",
              width: 28,
            }}
          />
          {item.label}
        </div>
      ))}
      <div
        style={{
          background: alpha(C.gold, same * 0.94),
          borderRadius: 11,
          color: same > 0.15 ? C.bg : C.white,
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 36,
          fontWeight: 900,
          left: 620,
          opacity: same,
          padding: "17px 26px",
          position: "absolute",
          right: 620,
          textAlign: "center",
          top: 760,
        }}
      >
        ESTO YA OCURRIÓ
      </div>
      <Tag fallback="NO ES LA PRIMERA VEZ" id="not-first" scene={scene} top={210} />
      <Tag fallback="REBOBINAR" id="past" scene={scene} top={210} />
    </>
  );
};

export const SecondMinuteNarrativeScene: React.FC<{
  scene: EditorialScene;
}> = ({scene}) => {
  let content: React.ReactNode;
  if (scene.kind === "market-engine") content = <MarketEngine scene={scene} />;
  else if (scene.kind === "ai-core") content = <AiCore scene={scene} />;
  else if (scene.kind === "correction-alert")
    content = <CorrectionAlert scene={scene} />;
  else if (scene.kind === "bubble-trigger")
    content = <BubbleTrigger scene={scene} />;
  else if (scene.kind === "market-gravity")
    content = <MarketGravity scene={scene} />;
  else content = <HistoryRewind scene={scene} />;
  return <CameraStage scene={scene}>{content}</CameraStage>;
};
