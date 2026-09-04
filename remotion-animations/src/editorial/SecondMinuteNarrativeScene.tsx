import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY,
} from "../motion/fonts";
import {EditorialScene} from "./schemas";

import {EDITORIAL_COLORS as C} from "./palette";
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
  "company-card-nvidia": [29, 24],
  "company-card-microsoft": [43, 24],
  "company-card-amazon": [50, 24],
  "company-card-alphabet": [57, 24],
  "company-card-meta": [64, 24],
  "ai-core": [50, 55],
  "gains-column": [62, 55],
  "decade-track": [50, 76],
  "correction-zone": [50, 54],
  "warning-signal": [50, 32],
  "tech-bubble": [62, 50],
  "wall-street-rule": [50, 78],
  "catalyst-pin": [48, 50],
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
    ["connect", "focus", "highlight", "zoom", "verify"].includes(item.action),
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

const BubbleTrigger: React.FC<{scene: EditorialScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const catalyst = enter(scene, "catalyst", frame, fps);
  const bubble = enter(scene, "bubble", frame, fps);
  const bubbleCue = cue(scene, "bubble");
  const burst = bubbleCue
    ? reveal(
        frame,
        fps,
        bubbleCue.atSeconds + 0.12,
        bubbleCue.atSeconds + 0.68,
      )
    : 0;
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
          opacity: 1 - burst,
          position: "absolute",
          top: 310,
          transform: `scale(${0.94 + bubble * 0.06 + burst * 0.24})`,
          width: 430,
        }}
      >
        <div
          style={{
            background: alpha(C.bg, 0.94),
            border: `2px solid ${alpha(C.white, 0.3)}`,
            borderRadius: 10,
            boxShadow: `0 8px 28px ${alpha(C.bg, 0.7)}`,
            opacity: 1 - burst * 0.72,
            padding: "12px 22px 14px",
            position: "relative",
            zIndex: 3,
          }}
        >
          TECNOLOGÍA
        </div>
        <svg
          height="270"
          style={{
            left: 80,
            opacity: bubble * (1 - burst),
            position: "absolute",
            top: 72,
          }}
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
          border: `7px solid ${alpha(C.cyan, 1 - burst)}`,
          borderRadius: "50%",
          height: 430,
          left: 745,
          opacity: burst * (1 - burst),
          position: "absolute",
          top: 310,
          transform: `scale(${1 + burst * 0.72})`,
          width: 430,
        }}
      />
      {Array.from({length: 18}, (_, index) => {
        const angle = (index / 18) * Math.PI * 2;
        const distance = 100 + (index % 4) * 34;
        const x = Math.cos(angle) * distance * burst;
        const y = Math.sin(angle) * distance * burst;
        return (
          <div
            key={index}
            style={{
              background: index % 3 === 0 ? C.red : C.cyan,
              borderRadius: 3,
              height: 7 + (index % 3) * 3,
              left: 954,
              opacity: burst * (1 - burst * 0.72),
              position: "absolute",
              top: 520,
              transform: `translate(${x}px, ${y}px) rotate(${
                index * 37 + burst * 160
              }deg)`,
              width: 30 + (index % 4) * 10,
            }}
          />
        );
      })}
      <div
        style={{
          left: 320,
          position: "absolute",
          top: 530,
          transform: "rotate(-8deg)",
          width: 440,
        }}
      >
        <div
          style={{
            background: `linear-gradient(90deg,${C.gold},${C.white})`,
            boxShadow: `0 0 18px ${alpha(C.gold, 0.45)}`,
            height: 8,
            transform: `scaleX(${catalyst})`,
            transformOrigin: "left",
            width: 440,
          }}
        />
        <div
          style={{
            borderBottom: "12px solid transparent",
            borderLeft: `26px solid ${C.white}`,
            borderTop: "12px solid transparent",
            left: Math.max(0, catalyst * 440 - 4),
            opacity: catalyst,
            position: "absolute",
            top: -8,
          }}
        />
      </div>
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
        SEÑAL A VIGILAR →
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
          opacity: rule,
          padding: "15px 24px",
          position: "absolute",
          right: 555,
          textAlign: "center",
        }}
      >
        HIPÓTESIS, NO CERTEZA
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
        {
          x: 380,
          label: "PUNTOCOM",
          detail: "2000–2002",
          color: C.red,
          opacity: past,
        },
        {x: 960, label: "VARIABLES", color: C.cyan, opacity: same},
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
          {"detail" in item ? (
            <div
              style={{
                color: C.muted,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: 18,
                letterSpacing: 1,
                marginTop: 7,
              }}
            >
              {item.detail}
            </div>
          ) : null}
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
        CONCENTRACIÓN + VALORACIÓN
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
  if (scene.kind === "bubble-trigger")
    content = <BubbleTrigger scene={scene} />;
  else if (scene.kind === "market-gravity")
    content = <MarketGravity scene={scene} />;
  else content = <HistoryRewind scene={scene} />;
  return <CameraStage scene={scene}>{content}</CameraStage>;
};
