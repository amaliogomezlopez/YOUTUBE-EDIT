import {zColor} from "@remotion/zod-types";
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {z} from "zod";
import {
  KineticNumber,
  MOTION_COLORS,
  MotionCanvas,
  RisingHistogram,
  SignalPath,
  clamp,
  motionProgress,
  rgba,
} from "./motion/Toolkit";

export const ahorrarLimitesScenesV2 = [
  "input-share",
  "harness-workshop",
  "harness-compare",
  "context-snowball",
  "batch-prompts",
  "skills-range",
  "fresh-chat",
  "subagents",
] as const;

export const ahorrarLimitesV2Schema = z.object({
  scene: z.enum(ahorrarLimitesScenesV2),
  clipNumber: z.number().int().min(1),
  title: z.string(),
  showHeader: z.boolean().optional(),
  accentColor: zColor(),
});

export type AhorrarLimitesV2Props = z.infer<
  typeof ahorrarLimitesV2Schema
>;

type SceneProps = {
  frame: number;
  fps: number;
  accentColor: string;
};

const InputShareV2: React.FC<SceneProps> = ({accentColor}) => (
  <div
    style={{
      alignItems: "center",
      display: "grid",
      gridTemplateColumns: "0.72fr 1.28fr",
      height: "100%",
    }}
  >
    <div
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <KineticNumber
        accentColor={accentColor}
        endSeconds={4.8}
        fontSize={220}
        label="tokens de entrada"
        pulseAtSeconds={5.15}
        startSeconds={0.2}
        suffix="%"
        to={90}
      />
    </div>
    <div
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <RisingHistogram
        accentColor={accentColor}
        data={[
          {label: "Entrada", value: 90, color: accentColor},
          {
            label: "Resto",
            value: 10,
            color: rgba(MOTION_COLORS.muted, 0.48),
          },
        ]}
        endSeconds={5.15}
        height={610}
        highlightIndex={0}
        maxValue={100}
        startSeconds={0.35}
        unit="%"
        width={860}
      />
    </div>
  </div>
);

const HarnessWorkshopV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const rail = motionProgress(frame, fps, 0.25, 1.45);
  const signal = motionProgress(
    frame,
    fps,
    0.65,
    6.15,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const result = motionProgress(frame, fps, 4.85, 6.25);
  const modules = [
    {label: "Herramientas", x: 430},
    {label: "Instrucciones", x: 715},
    {label: "Contexto", x: 1000},
    {label: "Flujo", x: 1285},
  ];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <SignalPath
        color={accentColor}
        dotProgress={signal}
        drawProgress={rail}
        x1={180}
        x2={1540}
        y1={390}
        y2={390}
      />
      <g
        opacity={motionProgress(frame, fps, 0.05, 0.65)}
        transform="translate(180 390)"
      >
        <circle fill={MOTION_COLORS.surface} r={72} />
        <circle
          fill="none"
          r={72}
          stroke={rgba(accentColor, 0.7)}
          strokeWidth={4}
        />
        <circle fill={accentColor} r={18} />
        <text
          fill={MOTION_COLORS.ink}
          fontFamily="Schibsted Grotesk"
          fontSize={24}
          fontWeight={800}
          textAnchor="middle"
          y={122}
        >
          MODELO
        </text>
      </g>
      {modules.map((module, index) => {
        const activation = motionProgress(
          frame,
          fps,
          1.0 + index * 0.75,
          2.0 + index * 0.75,
        );
        const scale = interpolate(activation, [0, 1], [0.88, 1], clamp);
        return (
          <g
            key={module.label}
            opacity={activation}
            transform={`translate(${module.x} 390) scale(${scale})`}
          >
            <rect
              fill={rgba(accentColor, 0.09)}
              height={112}
              rx={12}
              stroke={rgba(accentColor, 0.55)}
              strokeWidth={3}
              width={226}
              x={-113}
              y={-56}
            />
            <circle fill={accentColor} r={7} />
            <text
              fill={MOTION_COLORS.ink}
              fontFamily="Schibsted Grotesk"
              fontSize={22}
              fontWeight={750}
              textAnchor="middle"
              y={92}
            >
              {module.label}
            </text>
          </g>
        );
      })}
      <g
        opacity={result}
        transform={`translate(1550 390) scale(${interpolate(
          result,
          [0, 1],
          [0.7, 1],
          clamp,
        )})`}
      >
        <circle fill={rgba(accentColor, 0.1)} r={95} />
        <circle
          fill="none"
          r={72}
          stroke={accentColor}
          strokeDasharray="8 10"
          strokeWidth={5}
        />
        <circle fill={accentColor} r={24} />
        <text
          fill={MOTION_COLORS.ink}
          fontFamily="Schibsted Grotesk"
          fontSize={24}
          fontWeight={800}
          textAnchor="middle"
          y={138}
        >
          RESULTADO
        </text>
      </g>
      <text
        fill={accentColor}
        fontFamily="Schibsted Grotesk"
        fontSize={26}
        fontWeight={800}
        opacity={result}
        textAnchor="middle"
        x={864}
        y={650}
      >
        EL ENTORNO CAMBIA LA SALIDA
      </text>
    </svg>
  );
};

const HarnessCompareV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const lanes = [
    {
      label: "CLAUDE CODE",
      y: 250,
      color: MOTION_COLORS.yellow,
      items: ["Sistema fijo", "Herramientas", "Contexto base"],
      result: "CARGA BASE",
    },
    {
      label: "PI",
      y: 540,
      color: accentColor,
      items: ["Sistema", "Herramientas", "Contexto"],
      result: "CARGA AJUSTABLE",
    },
  ];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      {lanes.map((lane, laneIndex) => {
        const laneIn = motionProgress(
          frame,
          fps,
          0.1 + laneIndex * 0.35,
          0.85 + laneIndex * 0.35,
        );
        const flow = motionProgress(
          frame,
          fps,
          1.0 + laneIndex * 0.45,
          5.8 + laneIndex * 0.3,
          Easing.bezier(0.45, 0, 0.55, 1),
        );
        const result = motionProgress(
          frame,
          fps,
          4.7 + laneIndex * 0.25,
          6.1 + laneIndex * 0.25,
        );
        return (
          <g key={lane.label} opacity={laneIn}>
            <text
              fill={lane.color}
              fontFamily="Schibsted Grotesk"
              fontSize={25}
              fontWeight={850}
              x={66}
              y={lane.y - 92}
            >
              {lane.label}
            </text>
            <SignalPath
              color={lane.color}
              dotProgress={flow}
              drawProgress={laneIn}
              x1={210}
              x2={1470}
              y1={lane.y}
              y2={lane.y}
            />
            {lane.items.map((item, index) => {
              const itemIn = motionProgress(
                frame,
                fps,
                0.75 + laneIndex * 0.35 + index * 0.5,
                1.65 + laneIndex * 0.35 + index * 0.5,
              );
              const x = 380 + index * 300;
              const adjustable = laneIndex === 1 && index > 0;
              const toggle = adjustable
                ? motionProgress(frame, fps, 3.5 + index * 0.25, 4.5 + index * 0.25)
                : 0;
              return (
                <g
                  key={item}
                  opacity={itemIn}
                  transform={`translate(${x} ${lane.y})`}
                >
                  <rect
                    fill={rgba(lane.color, adjustable ? 0.06 + toggle * 0.07 : 0.1)}
                    height={86}
                    rx={10}
                    stroke={rgba(lane.color, 0.55)}
                    strokeWidth={3}
                    width={232}
                    x={-116}
                    y={-43}
                  />
                  <text
                    fill={MOTION_COLORS.ink}
                    fontFamily="Schibsted Grotesk"
                    fontSize={20}
                    fontWeight={700}
                    textAnchor="middle"
                    y={7}
                  >
                    {item}
                  </text>
                  {adjustable ? (
                    <text
                      fill={lane.color}
                      fontFamily="Schibsted Grotesk"
                      fontSize={15}
                      fontWeight={750}
                      textAnchor="middle"
                      y={72}
                    >
                      AJUSTABLE
                    </text>
                  ) : null}
                </g>
              );
            })}
            <g opacity={result} transform={`translate(1510 ${lane.y})`}>
              <circle
                fill={rgba(lane.color, 0.08)}
                r={78}
                stroke={lane.color}
                strokeWidth={4}
              />
              <circle fill={lane.color} r={18} />
              <text
                fill={lane.color}
                fontFamily="Schibsted Grotesk"
                fontSize={18}
                fontWeight={800}
                textAnchor="middle"
                y={120}
              >
                {lane.result}
              </text>
            </g>
          </g>
        );
      })}
      <line
        opacity={0.35}
        stroke={MOTION_COLORS.grid}
        strokeWidth={2}
        x1={66}
        x2={1640}
        y1={395}
        y2={395}
      />
    </svg>
  );
};

const ContextSnowballV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const travel = motionProgress(
    frame,
    fps,
    0.15,
    4.85,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const ballX = interpolate(travel, [0, 1], [150, 1480], clamp);
  const radius = interpolate(travel, [0, 1], [58, 185], clamp);
  const fragments = [
    {x: 380, y: 290},
    {x: 650, y: 470},
    {x: 900, y: 255},
    {x: 1170, y: 470},
  ];
  const finalIn = motionProgress(frame, fps, 4.35, 5.15);

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <path
        d="M 100 560 C 460 610, 930 520, 1610 560"
        fill="none"
        stroke={MOTION_COLORS.grid}
        strokeWidth={4}
      />
      {fragments.map((fragment, index) => {
        const absorb = motionProgress(
          frame,
          fps,
          0.95 + index * 0.9,
          1.65 + index * 0.9,
        );
        const x = interpolate(absorb, [0, 1], [fragment.x, ballX], clamp);
        const y = interpolate(absorb, [0, 1], [fragment.y, 510], clamp);
        return (
          <g
            key={fragment.x}
            opacity={1 - absorb}
            transform={`translate(${x} ${y}) scale(${1 - absorb * 0.55})`}
          >
            <rect
              fill={rgba(MOTION_COLORS.cyan, 0.14)}
              height={64}
              rx={8}
              stroke={rgba(MOTION_COLORS.cyan, 0.48)}
              strokeWidth={2}
              width={150}
              x={-75}
              y={-32}
            />
            <line
              stroke={MOTION_COLORS.cyan}
              strokeOpacity={0.78}
              strokeWidth={5}
              x1={-48}
              x2={48}
              y1={-8}
              y2={-8}
            />
            <line
              stroke={MOTION_COLORS.cyan}
              strokeOpacity={0.46}
              strokeWidth={4}
              x1={-48}
              x2={18}
              y1={12}
              y2={12}
            />
          </g>
        );
      })}
      <g
        transform={`translate(${ballX} 510) rotate(${-travel * 250})`}
      >
        <circle fill={rgba(accentColor, 0.16)} r={radius + 16} />
        <circle fill={accentColor} r={radius} />
        <path
          d={`M ${-radius * 0.72} ${-radius * 0.15} Q 0 ${
            -radius * 0.72
          } ${radius * 0.7} ${-radius * 0.08}`}
          fill="none"
          opacity={0.42}
          stroke={MOTION_COLORS.background}
          strokeLinecap="round"
          strokeWidth={Math.max(7, radius * 0.08)}
        />
      </g>
      <g
        opacity={finalIn}
        transform={`translate(1130 150) scale(${interpolate(
          finalIn,
          [0, 1],
          [0.92, 1],
          clamp,
        )})`}
      >
        <text
          fill={accentColor}
          fontFamily="Schibsted Grotesk"
          fontSize={34}
          fontWeight={850}
        >
          CADA PROMPT ARRASTRA
        </text>
        <text
          fill={MOTION_COLORS.ink}
          fontFamily="Schibsted Grotesk"
          fontSize={50}
          fontWeight={850}
          y={62}
        >
          todo lo anterior
        </text>
      </g>
    </svg>
  );
};

const BatchPromptsV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const collapse = motionProgress(frame, fps, 0.2, 2.1);
  const branch = motionProgress(frame, fps, 1.8, 3.5);
  const pulse = motionProgress(
    frame,
    fps,
    2.35,
    6.25,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const tasks = [
    {x: 1120, y: 160, label: "TAREA 1", bend: -70},
    {x: 1450, y: 300, label: "TAREA 2", bend: -25},
    {x: 1450, y: 535, label: "TAREA 3", bend: 25},
    {x: 1120, y: 670, label: "TAREA 4", bend: 70},
  ];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      {[0, 1, 2].map((index) => {
        const startX = 160 + index * 170;
        const x = interpolate(collapse, [0, 1], [startX, 680], clamp);
        const opacity = interpolate(collapse, [0, 0.78, 1], [0.34, 0.72, 0], clamp);
        return (
          <g
            key={index}
            opacity={opacity}
            transform={`translate(${x} ${390 + (index - 1) * 95}) scale(${
              1 - collapse * 0.38
            })`}
          >
            <rect
              fill={rgba(MOTION_COLORS.coral, 0.08)}
              height={76}
              rx={10}
              stroke={rgba(MOTION_COLORS.coral, 0.45)}
              strokeWidth={2}
              width={200}
              x={-100}
              y={-38}
            />
            <text
              fill={MOTION_COLORS.muted}
              fontFamily="Schibsted Grotesk"
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
              y={7}
            >
              CONTEXTO
            </text>
          </g>
        );
      })}
      <g
        opacity={motionProgress(frame, fps, 1.35, 2.25)}
        transform="translate(690 390)"
      >
        <circle fill={rgba(accentColor, 0.12)} r={108} />
        <circle
          fill={MOTION_COLORS.backgroundRaised}
          r={78}
          stroke={accentColor}
          strokeWidth={4}
        />
        <text
          fill={accentColor}
          fontFamily="Schibsted Grotesk"
          fontSize={23}
          fontWeight={850}
          textAnchor="middle"
          y={-4}
        >
          UNA LECTURA
        </text>
        <text
          fill={MOTION_COLORS.muted}
          fontFamily="Schibsted Grotesk"
          fontSize={17}
          fontWeight={650}
          textAnchor="middle"
          y={26}
        >
          de contexto
        </text>
      </g>
      {tasks.map((task, index) => {
        const localPulse = Math.max(0, Math.min(1, pulse * 1.28 - index * 0.09));
        return (
          <g key={task.label}>
            <SignalPath
              bend={task.bend}
              color={accentColor}
              dotProgress={localPulse}
              drawProgress={branch}
              x1={770}
              x2={task.x}
              y1={390}
              y2={task.y}
            />
            <g
              opacity={motionProgress(
                frame,
                fps,
                2.25 + index * 0.38,
                3.2 + index * 0.38,
              )}
              transform={`translate(${task.x} ${task.y})`}
            >
              <circle
                fill={MOTION_COLORS.backgroundRaised}
                r={66}
                stroke={rgba(accentColor, 0.68)}
                strokeWidth={3}
              />
              <text
                fill={MOTION_COLORS.ink}
                fontFamily="Schibsted Grotesk"
                fontSize={19}
                fontWeight={800}
                textAnchor="middle"
                y={7}
              >
                {task.label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

const SkillsRangeV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const lineIn = motionProgress(frame, fps, 0.15, 1.05);
  const populate = motionProgress(
    frame,
    fps,
    0.65,
    5.7,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const noise = motionProgress(frame, fps, 4.65, 6.2);
  const startX = 180;
  const endX = 1540;
  const y = 420;
  const toX = (value: number) => startX + (value / 40) * (endX - startX);

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <line
        stroke={MOTION_COLORS.grid}
        strokeLinecap="round"
        strokeWidth={10}
        x1={startX}
        x2={interpolate(lineIn, [0, 1], [startX, endX], clamp)}
        y1={y}
        y2={y}
      />
      <line
        opacity={lineIn}
        stroke={accentColor}
        strokeLinecap="round"
        strokeWidth={14}
        x1={toX(10)}
        x2={toX(30)}
        y1={y}
        y2={y}
      />
      {Array.from({length: 36}, (_, index) => index + 1).map((value) => {
        const threshold = value / 36;
        const visible = interpolate(
          populate,
          [threshold - 0.04, threshold],
          [0, 1],
          clamp,
        );
        const beyond = value > 30;
        const jitterX = beyond
          ? Math.sin(frame * 0.18 + value * 1.4) * 9 * noise
          : 0;
        const jitterY = beyond
          ? Math.cos(frame * 0.21 + value * 1.1) * 22 * noise
          : 0;
        const color =
          value >= 10 && value <= 30
            ? accentColor
            : beyond
              ? MOTION_COLORS.coral
              : MOTION_COLORS.muted;
        return (
          <circle
            cx={toX(value) + jitterX}
            cy={y - 64 + jitterY}
            fill={color}
            key={value}
            opacity={visible * (beyond ? 0.85 : 0.7)}
            r={beyond ? 8 : 7}
          />
        );
      })}
      {[0, 10, 30, 40].map((value) => {
        const important = value === 10 || value === 30;
        const pop = important
          ? motionProgress(
              frame,
              fps,
              value === 10 ? 1.7 : 4.1,
              value === 10 ? 2.45 : 5.0,
            )
          : lineIn;
        return (
          <g key={value} opacity={pop}>
            <line
              stroke={important ? accentColor : MOTION_COLORS.muted}
              strokeWidth={important ? 5 : 2}
              x1={toX(value)}
              x2={toX(value)}
              y1={y - 35}
              y2={y + 35}
            />
            <text
              fill={important ? accentColor : MOTION_COLORS.muted}
              fontFamily="Schibsted Grotesk"
              fontSize={important ? 54 : 26}
              fontWeight={important ? 900 : 650}
              style={{fontVariantNumeric: "tabular-nums"}}
              textAnchor="middle"
              x={toX(value)}
              y={y + (important ? 105 : 82)}
            >
              {value}
            </text>
          </g>
        );
      })}
      <g
        opacity={motionProgress(frame, fps, 2.0, 3.0)}
        transform={`translate(${(toX(10) + toX(30)) / 2} 215)`}
      >
        <text
          fill={accentColor}
          fontFamily="Schibsted Grotesk"
          fontSize={31}
          fontWeight={850}
          textAnchor="middle"
        >
          RANGO ÚTIL
        </text>
        <text
          fill={MOTION_COLORS.ink}
          fontFamily="Schibsted Grotesk"
          fontSize={74}
          fontWeight={900}
          style={{fontVariantNumeric: "tabular-nums"}}
          textAnchor="middle"
          y={82}
        >
          10–30
        </text>
      </g>
      <text
        fill={MOTION_COLORS.coral}
        fontFamily="Schibsted Grotesk"
        fontSize={26}
        fontWeight={850}
        opacity={noise}
        textAnchor="middle"
        x={toX(35)}
        y={270}
      >
        RUIDO
      </text>
    </svg>
  );
};

const FreshChatV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const oldIn = motionProgress(frame, fps, 0.05, 0.65);
  const compress = motionProgress(frame, fps, 2.1, 4.15);
  const handoff = motionProgress(
    frame,
    fps,
    3.7,
    5.55,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const freshIn = motionProgress(frame, fps, 4.75, 6.25);
  const detail = motionProgress(frame, fps, 6.0, 7.7);
  const oldX = interpolate(compress, [0, 1], [150, 670], clamp);
  const oldScale = interpolate(compress, [0, 1], [1, 0.16], clamp);
  const packetX = interpolate(handoff, [0, 1], [690, 1080], clamp);

  return (
    <div style={{height: "100%", position: "relative"}}>
      <div
        style={{
          backgroundColor: MOTION_COLORS.backgroundRaised,
          border: `2px solid ${rgba(MOTION_COLORS.coral, 0.38)}`,
          borderRadius: 14,
          height: 560,
          left: oldX,
          opacity: oldIn * (1 - compress * 0.72),
          padding: 30,
          position: "absolute",
          top: 80,
          transform: `scale(${oldScale})`,
          transformOrigin: "center",
          width: 580,
        }}
      >
        <div
          style={{
            color: MOTION_COLORS.coral,
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          CHAT ATASCADO
        </div>
        {["Historial", "Solución fallida", "Corrección", "Otra corrección"].map(
          (label, index) => (
            <div
              key={label}
              style={{
                backgroundColor: rgba(MOTION_COLORS.muted, 0.07),
                borderRadius: 9,
                color: MOTION_COLORS.muted,
                fontSize: 23,
                fontWeight: 650,
                marginTop: 22,
                opacity: motionProgress(
                  frame,
                  fps,
                  0.35 + index * 0.42,
                  1.1 + index * 0.42,
                ),
                padding: "18px 20px",
              }}
            >
              {label}
            </div>
          ),
        )}
      </div>
      <div
        style={{
          alignItems: "center",
          backgroundColor: accentColor,
          borderRadius: 999,
          color: MOTION_COLORS.background,
          display: "flex",
          fontSize: 20,
          fontWeight: 850,
          height: 62,
          justifyContent: "center",
          left: packetX,
          opacity: handoff,
          position: "absolute",
          top: 325,
          transform: `translateX(-50%) scale(${interpolate(
            handoff,
            [0, 0.2, 1],
            [0.75, 1, 1],
            clamp,
          )})`,
          width: 218,
        }}
      >
        IMPLEMENTACIÓN
      </div>
      <div
        style={{
          backgroundColor: MOTION_COLORS.backgroundRaised,
          border: `3px solid ${rgba(accentColor, 0.7)}`,
          borderRadius: 14,
          height: 560,
          opacity: freshIn,
          padding: 34,
          position: "absolute",
          right: 110,
          top: 80,
          transform: `scale(${interpolate(
            freshIn,
            [0, 1],
            [0.82, 1],
            clamp,
          )})`,
          transformOrigin: "center",
          width: 650,
        }}
      >
        <div
          style={{
            color: accentColor,
            fontSize: 23,
            fontWeight: 850,
          }}
        >
          CHAT NUEVO
        </div>
        <div
          style={{
            color: MOTION_COLORS.muted,
            fontSize: 20,
            fontWeight: 700,
            marginTop: 48,
            opacity: detail,
          }}
        >
          CONTEXTO MÍNIMO
        </div>
        <div
          style={{
            color: MOTION_COLORS.ink,
            fontSize: 34,
            fontWeight: 780,
            lineHeight: 1.2,
            marginTop: 12,
            opacity: detail,
          }}
        >
          “Mi agente ha implementado esto…”
        </div>
        <div
          style={{
            backgroundColor: rgba(accentColor, 0.08),
            borderRadius: 10,
            color: accentColor,
            fontSize: 27,
            fontWeight: 800,
            marginTop: 54,
            opacity: motionProgress(frame, fps, 6.65, 7.8),
            padding: "22px 24px",
          }}
        >
          Verificación crítica de bugs y fallos
        </div>
      </div>
    </div>
  );
};

const SubagentsV2: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const orchestrator = motionProgress(frame, fps, 0.05, 0.75);
  const draw = motionProgress(frame, fps, 0.7, 2.2);
  const outbound = motionProgress(
    frame,
    fps,
    1.6,
    4.5,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const returned = motionProgress(
    frame,
    fps,
    4.4,
    7.8,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const agents = [
    {x: 370, label: "EXPLORAR", bend: 100},
    {x: 864, label: "BUSCAR", bend: 45},
    {x: 1358, label: "RESUMIR", bend: 100},
  ];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <g
        opacity={orchestrator}
        transform={`translate(864 150) scale(${interpolate(
          orchestrator,
          [0, 1],
          [0.82, 1],
          clamp,
        )})`}
      >
        <circle fill={rgba(accentColor, 0.12)} r={105} />
        <circle
          fill={MOTION_COLORS.backgroundRaised}
          r={76}
          stroke={accentColor}
          strokeWidth={4}
        />
        <circle fill={accentColor} r={18} />
        <text
          fill={MOTION_COLORS.ink}
          fontFamily="Schibsted Grotesk"
          fontSize={23}
          fontWeight={850}
          textAnchor="middle"
          y={132}
        >
          ORQUESTADOR
        </text>
      </g>
      {agents.map((agent, index) => {
        const localOut = Math.max(
          0,
          Math.min(1, outbound * 1.2 - index * 0.08),
        );
        const localReturn = Math.max(
          0,
          Math.min(1, returned * 1.2 - (2 - index) * 0.08),
        );
        const active = motionProgress(
          frame,
          fps,
          2.6 + index * 0.35,
          3.7 + index * 0.35,
        );
        return (
          <g key={agent.label}>
            <SignalPath
              bend={agent.bend}
              color={accentColor}
              dotProgress={localOut}
              drawProgress={draw}
              x1={864}
              x2={agent.x}
              y1={235}
              y2={570}
            />
            <SignalPath
              bend={-agent.bend}
              color={MOTION_COLORS.cyan}
              dotProgress={localReturn}
              drawProgress={returned}
              opacity={returned}
              x1={agent.x}
              x2={864}
              y1={570}
              y2={235}
            />
            <g
              opacity={draw}
              transform={`translate(${agent.x} 570) scale(${interpolate(
                active,
                [0, 1],
                [0.9, 1],
                clamp,
              )})`}
            >
              <circle
                fill={rgba(MOTION_COLORS.cyan, 0.08)}
                r={74}
                stroke={rgba(MOTION_COLORS.cyan, 0.62)}
                strokeWidth={3}
              />
              <circle
                fill={active > 0.8 ? MOTION_COLORS.cyan : MOTION_COLORS.grid}
                r={13}
              />
              <text
                fill={MOTION_COLORS.ink}
                fontFamily="Schibsted Grotesk"
                fontSize={22}
                fontWeight={820}
                textAnchor="middle"
                y={118}
              >
                {agent.label}
              </text>
            </g>
          </g>
        );
      })}
      <g
        opacity={returned}
        transform={`translate(864 370) scale(${interpolate(
          returned,
          [0, 1],
          [0.7, 1],
          clamp,
        )})`}
      >
        <circle fill={MOTION_COLORS.cyan} r={10} />
        <text
          fill={MOTION_COLORS.cyan}
          fontFamily="Schibsted Grotesk"
          fontSize={24}
          fontWeight={850}
          textAnchor="middle"
          y={52}
        >
          RESULTADOS CONSOLIDADOS
        </text>
      </g>
    </svg>
  );
};

const sceneComponentsV2: Record<
  AhorrarLimitesV2Props["scene"],
  React.FC<SceneProps>
> = {
  "input-share": InputShareV2,
  "harness-workshop": HarnessWorkshopV2,
  "harness-compare": HarnessCompareV2,
  "context-snowball": ContextSnowballV2,
  "batch-prompts": BatchPromptsV2,
  "skills-range": SkillsRangeV2,
  "fresh-chat": FreshChatV2,
  subagents: SubagentsV2,
};

export const AhorrarLimitesV2: React.FC<AhorrarLimitesV2Props> = ({
  scene,
  title,
  showHeader,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const Scene = sceneComponentsV2[scene];

  return (
    <MotionCanvas
      accentColor={accentColor}
      showHeader={showHeader}
      title={title}
    >
      <Scene accentColor={accentColor} fps={fps} frame={frame} />
    </MotionCanvas>
  );
};
