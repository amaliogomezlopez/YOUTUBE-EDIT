import { zColor } from "@remotion/zod-types";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  MOTION_COLORS,
  MotionCanvas,
  SignalPath,
  clamp,
  motionProgress,
  rgba,
} from "./motion/Toolkit";
import {IconGlyph} from "./visuals/icons/MotionIcon";

export const ahorrarLimitesScenesV4 = [
  "rising-cost",
  "token-breakdown",
  "context-window",
  "sparse-attention",
  "three-skills",
  "md-clutter",
  "review-loop",
  "memory-cost",
  "off-peak",
] as const;

export const ahorrarLimitesV4Schema = z.object({
  scene: z.enum(ahorrarLimitesScenesV4),
  clipNumber: z.number().int().min(1),
  title: z.string(),
  kicker: z.string().optional(),
  showHeader: z.boolean().optional(),
  accentColor: zColor(),
});

export type AhorrarLimitesV4Props = z.infer<typeof ahorrarLimitesV4Schema>;

type SceneProps = {
  frame: number;
  fps: number;
  accentColor: string;
};

const FONT = "Inter, Segoe UI, Arial, sans-serif";

const RisingCostV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const bars = [
    { label: "Mensaje 1", ratio: 0.3 },
    { label: "Mensaje 2", ratio: 0.48 },
    { label: "Mensaje 3", ratio: 0.7 },
    { label: "Mensaje 4", ratio: 1 },
  ];
  const baselineIn = motionProgress(frame, fps, 0.1, 0.7);
  const emphasis = motionProgress(frame, fps, 4.6, 5.2);
  const glow = interpolate(
    frame,
    [4.6 * fps, 5.1 * fps, 6.1 * fps],
    [0, 1, 0],
    clamp,
  );
  const baseline = 600;
  const plotHeight = 500;
  const barWidth = 210;
  const gap = 92;
  const totalWidth = bars.length * barWidth + (bars.length - 1) * gap;
  const startX = (1728 - totalWidth) / 2;
  const lastX = startX + (bars.length - 1) * (barWidth + gap);

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <line
        stroke={MOTION_COLORS.muted}
        strokeOpacity={0.45}
        strokeWidth={3}
        x1={startX - 60}
        x2={interpolate(
          baselineIn,
          [0, 1],
          [startX - 60, startX + totalWidth + 60],
          clamp,
        )}
        y1={baseline}
        y2={baseline}
      />
      {bars.map((bar, index) => {
        const barIn = motionProgress(
          frame,
          fps,
          0.9 + index * 0.55,
          2.2 + index * 0.55,
        );
        const isLast = index === bars.length - 1;
        const barHeight = bar.ratio * plotHeight * barIn;
        const x = startX + index * (barWidth + gap);
        const y = baseline - barHeight;
        return (
          <g key={bar.label}>
            {isLast ? (
              <rect
                fill={rgba(accentColor, 0.2 * glow)}
                height={barHeight + 44}
                rx={20}
                width={barWidth + 44}
                x={x - 22}
                y={y - 22}
              />
            ) : null}
            <rect
              fill={isLast ? accentColor : rgba(MOTION_COLORS.muted, 0.42)}
              height={barHeight}
              opacity={isLast ? 1 : 0.78}
              rx={12}
              width={barWidth}
              x={x}
              y={y}
            />
            <text
              fill={MOTION_COLORS.muted}
              fontFamily={FONT}
              fontSize={26}
              fontWeight={700}
              opacity={motionProgress(
                frame,
                fps,
                0.5 + index * 0.55,
                1.1 + index * 0.55,
              )}
              textAnchor="middle"
              x={x + barWidth / 2}
              y={baseline + 48}
            >
              {bar.label}
            </text>
          </g>
        );
      })}
      <text
        fill={accentColor}
        fontFamily={FONT}
        fontSize={36}
        fontWeight={850}
        opacity={emphasis}
        textAnchor="middle"
        x={lastX + barWidth / 2}
        y={baseline - plotHeight - 42}
      >
        cuesta mucho más
      </text>
    </svg>
  );
};

const TokenBreakdownV4: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const trackX = 180;
  const trackW = 1368;
  const barY = 320;
  const barH = 150;
  const segments = [
    {
      label: "System prompt",
      fraction: 0.6,
      start: 0.7,
      end: 3.1,
      fill: rgba(accentColor, 0.92),
      text: MOTION_COLORS.background,
    },
    {
      label: "Herramientas",
      fraction: 0.33,
      start: 3.1,
      end: 5.1,
      fill: rgba(accentColor, 0.42),
      text: MOTION_COLORS.ink,
    },
    {
      label: "Tu pregunta",
      fraction: 0.07,
      start: 5.1,
      end: 5.9,
      fill: MOTION_COLORS.ink,
      text: MOTION_COLORS.background,
    },
  ];
  const trackIn = motionProgress(frame, fps, 0.2, 0.7);
  const braceIn = motionProgress(frame, fps, 6.1, 6.8);
  const braceEnd =
    trackX + trackW * (segments[0].fraction + segments[1].fraction);

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <rect
        fill="none"
        height={barH}
        opacity={trackIn}
        rx={14}
        stroke={rgba(MOTION_COLORS.muted, 0.4)}
        strokeWidth={3}
        width={trackW}
        x={trackX}
        y={barY}
      />
      {segments.map((segment, index) => {
        const offset = segments
          .slice(0, index)
          .reduce((sum, item) => sum + item.fraction, 0);
        const progress = motionProgress(
          frame,
          fps,
          segment.start,
          segment.end,
          Easing.bezier(0.22, 1, 0.36, 1),
        );
        const width = segment.fraction * trackW * progress;
        const x = trackX + offset * trackW;
        const labelIn = motionProgress(
          frame,
          fps,
          segment.end - 0.15,
          segment.end + 0.35,
        );
        const isSmall = segment.fraction < 0.1;
        return (
          <g key={segment.label}>
            <rect
              fill={segment.fill}
              height={barH - 16}
              opacity={progress > 0 ? 1 : 0}
              rx={index === 0 ? 9 : 6}
              width={Math.max(0, width - (index === 0 ? 8 : 12))}
              x={x + (index === 0 ? 8 : 6)}
              y={barY + 8}
            />
            {isSmall ? (
              <g opacity={labelIn}>
                <line
                  stroke={MOTION_COLORS.ink}
                  strokeWidth={2}
                  x1={x + segment.fraction * trackW * 0.5}
                  x2={x + segment.fraction * trackW * 0.5}
                  y1={barY - 12}
                  y2={barY - 52}
                />
                <text
                  fill={MOTION_COLORS.ink}
                  fontFamily={FONT}
                  fontSize={24}
                  fontWeight={750}
                  textAnchor="middle"
                  x={x + segment.fraction * trackW * 0.5}
                  y={barY - 68}
                >
                  {segment.label}
                </text>
              </g>
            ) : (
              <text
                fill={segment.text}
                fontFamily={FONT}
                fontSize={30}
                fontWeight={800}
                opacity={labelIn * progress}
                textAnchor="middle"
                x={x + segment.fraction * trackW * 0.5}
                y={barY + barH / 2 + 11}
              >
                {segment.label}
              </text>
            )}
          </g>
        );
      })}
      <g opacity={braceIn}>
        <path
          d={`M ${trackX + 4} ${barY - 118} L ${trackX + 4} ${barY - 138} L ${braceEnd - 4} ${barY - 138} L ${braceEnd - 4} ${barY - 118}`}
          fill="none"
          stroke={accentColor}
          strokeWidth={3}
        />
        <text
          fill={accentColor}
          fontFamily={FONT}
          fontSize={34}
          fontWeight={850}
          textAnchor="middle"
          x={(trackX + braceEnd) / 2}
          y={barY - 158}
        >
          miles de tokens
        </text>
      </g>
    </svg>
  );
};

const ContextWindowV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const frameIn = motionProgress(frame, fps, 0.1, 0.7);
  const labelIn = motionProgress(frame, fps, 3.0, 3.5);
  const winX = 514;
  const winY = 30;
  const winW = 700;
  const winH = 636;
  const blockWidths = [0.92, 0.7, 0.84, 0.58, 0.78];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <g opacity={frameIn}>
        <rect
          fill={MOTION_COLORS.backgroundRaised}
          height={winH}
          rx={18}
          stroke={rgba(accentColor, 0.65)}
          strokeWidth={3}
          width={winW}
          x={winX}
          y={winY}
        />
        <line
          stroke={rgba(accentColor, 0.35)}
          strokeWidth={2}
          x1={winX}
          x2={winX + winW}
          y1={winY + 56}
          y2={winY + 56}
        />
        {[0, 1, 2].map((dot) => (
          <circle
            cx={winX + 34 + dot * 26}
            cy={winY + 28}
            fill={rgba(MOTION_COLORS.muted, 0.6)}
            key={dot}
            r={7}
          />
        ))}
      </g>
      {blockWidths.map((widthRatio, index) => {
        const blockIn = motionProgress(
          frame,
          fps,
          0.6 + index * 0.45,
          1.1 + index * 0.45,
        );
        const blockW = (winW - 64) * widthRatio;
        const y = winY + 76 + index * 112;
        return (
          <g
            key={index}
            opacity={blockIn}
            transform={`translate(0 ${interpolate(
              blockIn,
              [0, 1],
              [-24, 0],
              clamp,
            )})`}
          >
            <rect
              fill={rgba(MOTION_COLORS.ink, 0.05)}
              height={92}
              rx={10}
              width={winW - 64}
              x={winX + 32}
              y={y}
            />
            <rect
              fill={rgba(accentColor, 0.75)}
              height={12}
              rx={6}
              width={blockW}
              x={winX + 56}
              y={y + 24}
            />
            <rect
              fill={rgba(MOTION_COLORS.muted, 0.45)}
              height={12}
              rx={6}
              width={blockW * 0.62}
              x={winX + 56}
              y={y + 54}
            />
          </g>
        );
      })}
      <g opacity={labelIn}>
        <text
          fill={accentColor}
          fontFamily={FONT}
          fontSize={30}
          fontWeight={850}
          textAnchor="middle"
          x={winX + winW / 2}
          y={winY + winH + 52}
        >
          VENTANA DE CONTEXTO
        </text>
        <text
          fill={MOTION_COLORS.muted}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={650}
          textAnchor="middle"
          x={winX + winW / 2}
          y={winY + winH + 92}
        >
          lo que recuerda el modelo
        </text>
      </g>
    </svg>
  );
};

const SparseAttentionV4: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const blockCount = 8;
  const blockW = 130;
  const gap = 14;
  const rowWidth = blockCount * blockW + (blockCount - 1) * gap;
  const startX = (1728 - rowWidth) / 2;
  const leftY = 240;
  const rightY = 540;
  const targetIndex = 5;
  const targetX = startX + targetIndex * (blockW + gap) + blockW / 2;
  const blocksIn = motionProgress(frame, fps, 0.4, 1.0);
  const laneLabelsIn = motionProgress(frame, fps, 0.3, 0.8);
  const sweep = motionProgress(
    frame,
    fps,
    1.5,
    5.4,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const sweepX = interpolate(sweep, [0, 1], [startX, startX + rowWidth], clamp);
  const indexIn = motionProgress(frame, fps, 0.9, 1.5);
  const lensIn = motionProgress(frame, fps, 1.8, 2.4);
  const jump = motionProgress(
    frame,
    fps,
    2.4,
    3.2,
    Easing.bezier(0.22, 1, 0.36, 1),
  );
  const lensX = interpolate(jump, [0, 1], [170, targetX], clamp);
  const lensY = rightY - Math.sin(jump * Math.PI) * 46;
  const targetIn = motionProgress(frame, fps, 3.1, 3.7);
  const finalIn = motionProgress(frame, fps, 5.9, 6.5);

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <text
        fill={MOTION_COLORS.muted}
        fontFamily={FONT}
        fontSize={26}
        fontWeight={800}
        opacity={laneLabelsIn}
        x={startX}
        y={leftY - 78}
      >
        releer todo
      </text>
      <text
        fill={accentColor}
        fontFamily={FONT}
        fontSize={26}
        fontWeight={800}
        opacity={laneLabelsIn}
        x={startX}
        y={rightY - 78}
      >
        buscar con índices
      </text>
      {Array.from({ length: blockCount }, (_, index) => {
        const x = startX + index * (blockW + gap);
        const lit = interpolate(
          sweep,
          [index / blockCount, (index + 0.6) / blockCount],
          [0, 1],
          clamp,
        );
        const isTarget = index === targetIndex;
        return (
          <g key={index} opacity={blocksIn}>
            <rect
              fill={rgba(MOTION_COLORS.muted, 0.1 + lit * 0.08)}
              height={70}
              rx={9}
              stroke={rgba(MOTION_COLORS.muted, 0.35 + lit * 0.35)}
              strokeWidth={2}
              width={blockW}
              x={x}
              y={leftY - 35}
            />
            <rect
              fill={
                isTarget
                  ? rgba(accentColor, 0.1 + targetIn * 0.3)
                  : rgba(MOTION_COLORS.muted, 0.08)
              }
              height={70}
              rx={9}
              stroke={
                isTarget
                  ? rgba(accentColor, 0.3 + targetIn * 0.6)
                  : rgba(MOTION_COLORS.muted, 0.3)
              }
              strokeWidth={isTarget ? 3 : 2}
              width={blockW}
              x={x}
              y={rightY - 35}
            />
          </g>
        );
      })}
      <line
        opacity={sweep > 0 && sweep < 1 ? 0.9 : 0}
        stroke={MOTION_COLORS.ink}
        strokeWidth={4}
        x1={sweepX}
        x2={sweepX}
        y1={leftY - 58}
        y2={leftY + 58}
      />
      <g opacity={indexIn}>
        <text
          fill={MOTION_COLORS.muted}
          fontFamily={FONT}
          fontSize={20}
          fontWeight={800}
          textAnchor="middle"
          x={170}
          y={rightY - 118}
        >
          ÍNDICE
        </text>
        {[0, 1, 2, 3].map((row) => (
          <rect
            fill={rgba(accentColor, row === 2 ? 0.5 : 0.18)}
            height={30}
            key={row}
            rx={8}
            width={150 - (row % 2) * 36}
            x={95}
            y={rightY - 92 + row * 46}
          />
        ))}
      </g>
      <g
        opacity={lensIn}
        transform={`translate(${lensX} ${lensY}) scale(${interpolate(
          lensIn,
          [0, 1],
          [0.6, 1],
          clamp,
        )})`}
      >
        <circle
          fill={rgba(accentColor, 0.1)}
          r={40}
          stroke={accentColor}
          strokeWidth={5}
        />
        <line
          stroke={accentColor}
          strokeLinecap="round"
          strokeWidth={7}
          x1={30}
          x2={58}
          y1={30}
          y2={58}
        />
      </g>
      <text
        fill={accentColor}
        fontFamily={FONT}
        fontSize={38}
        fontWeight={850}
        opacity={finalIn}
        textAnchor="middle"
        x={864}
        y={712}
      >
        Atención dispersa
      </text>
    </svg>
  );
};

const ThreeSkillsV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const cards = [
    { kind: "server", label: "Servidores" },
    { kind: "branch", label: "Arquitectura" },
    { kind: "agent", label: "Objetivos y rol" },
  ];
  const chatIn = motionProgress(frame, fps, 2.6, 3.2);
  const chatGlow = interpolate(
    frame,
    [5.6 * fps, 6.1 * fps, 6.9 * fps],
    [0, 1, 0.25],
    clamp,
  );

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <g opacity={chatIn}>
        <rect
          fill={MOTION_COLORS.backgroundRaised}
          height={520}
          rx={18}
          stroke={rgba(accentColor, 0.4 + chatGlow * 0.5)}
          strokeWidth={3}
          width={400}
          x={1080}
          y={120}
        />
        <text
          fill={MOTION_COLORS.muted}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={800}
          textAnchor="middle"
          x={1280}
          y={176}
        >
          chat del agente
        </text>
      </g>
      {cards.map((card, index) => {
        const enter = motionProgress(
          frame,
          fps,
          0.5 + index * 0.6,
          1.3 + index * 0.6,
        );
        const travel = motionProgress(
          frame,
          fps,
          2.8 + index * 0.45,
          4.4 + index * 0.45,
          Easing.bezier(0.22, 1, 0.36, 1),
        );
        const startX = 320;
        const startY = 170 + index * 220;
        const dockX = 1280;
        const dockY = 300 + index * 130;
        const x = interpolate(travel, [0, 1], [startX, dockX], clamp);
        const y = interpolate(travel, [0, 1], [startY, dockY], clamp);
        const scale = interpolate(travel, [0, 1], [1, 0.62], clamp);
        return (
          <g
            key={card.label}
            opacity={enter}
            transform={`translate(${interpolate(
              enter,
              [0, 1],
              [x - 70, x],
              clamp,
            )} ${y}) scale(${scale})`}
          >
            <rect
              fill={MOTION_COLORS.surface}
              height={170}
              rx={14}
              stroke={rgba(accentColor, 0.55)}
              strokeWidth={3}
              width={360}
              x={-180}
              y={-85}
            />
            <text
              fill={rgba(accentColor, 0.85)}
              fontFamily={FONT}
              fontSize={20}
              fontWeight={800}
              x={132}
              y={-52}
            >
              .md
            </text>
            <g transform="translate(-127 -32)">
              <IconGlyph
                color={accentColor}
                id={card.kind}
                progress={enter}
                secondaryColor={MOTION_COLORS.ink}
                strokeWidth={4}
              />
            </g>
            <text
              fill={MOTION_COLORS.ink}
              fontFamily={FONT}
              fontSize={30}
              fontWeight={800}
              textAnchor="middle"
              x={55}
              y={11}
            >
              {card.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const MarkdownClutterV4: React.FC<SceneProps> = ({
  frame,
  fps,
  accentColor,
}) => {
  const folderIn = motionProgress(frame, fps, 0.2, 0.8);
  const agentIn = motionProgress(frame, fps, 4.0, 4.6);
  const arrowIn = motionProgress(frame, fps, 6.6, 7.2);
  const files = [0, 1, 2, 3, 4];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <g opacity={folderIn}>
        <rect
          fill={MOTION_COLORS.backgroundRaised}
          height={40}
          rx={10}
          stroke={rgba(MOTION_COLORS.muted, 0.5)}
          strokeWidth={3}
          width={170}
          x={130}
          y={268}
        />
        <rect
          fill={MOTION_COLORS.backgroundRaised}
          height={240}
          rx={16}
          stroke={rgba(MOTION_COLORS.muted, 0.5)}
          strokeWidth={3}
          width={400}
          x={120}
          y={300}
        />
        <text
          fill={MOTION_COLORS.muted}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={800}
          textAnchor="middle"
          x={320}
          y={596}
        >
          repo
        </text>
      </g>
      {files.map((index) => {
        const fileIn = motionProgress(
          frame,
          fps,
          0.8 + index * 0.5,
          1.3 + index * 0.5,
        );
        const x = 150 + index * 72;
        const y = 190 + (index % 2) * 14;
        const read = motionProgress(
          frame,
          fps,
          4.6 + index * 0.32,
          5.3 + index * 0.32,
        );
        return (
          <g
            key={index}
            opacity={fileIn}
            transform={`translate(${x + 65} ${y + 80}) rotate(${
              (index - 2) * 4
            }) translate(-65 -80)`}
          >
            <path
              d={`M 0 0 L 96 0 L 130 34 L 130 160 L 0 160 Z`}
              fill={MOTION_COLORS.surface}
              stroke={rgba(accentColor, 0.3 + read * 0.5)}
              strokeWidth={3}
            />
            <path
              d="M 96 0 L 96 34 L 130 34"
              fill="none"
              stroke={rgba(accentColor, 0.45)}
              strokeWidth={3}
            />
            <text
              fill={MOTION_COLORS.ink}
              fontFamily={FONT}
              fontSize={26}
              fontWeight={800}
              textAnchor="middle"
              x={65}
              y={96}
            >
              .md
            </text>
          </g>
        );
      })}
      <g opacity={agentIn} transform="translate(900 430)">
        <circle fill={rgba(accentColor, 0.12)} r={92} />
        <circle
          fill={MOTION_COLORS.backgroundRaised}
          r={66}
          stroke={accentColor}
          strokeWidth={4}
        />
        <text
          fill={MOTION_COLORS.ink}
          fontFamily={FONT}
          fontSize={22}
          fontWeight={800}
          textAnchor="middle"
          y={8}
        >
          agente
        </text>
      </g>
      {files.map((index) => (
        <SignalPath
          bend={-40 + index * 20}
          color={accentColor}
          dotProgress={motionProgress(
            frame,
            fps,
            4.6 + index * 0.32,
            5.3 + index * 0.32,
          )}
          drawProgress={agentIn}
          key={`pulse-${index}`}
          opacity={1 - motionProgress(frame, fps, 6.9, 7.5)}
          x1={834}
          x2={215 + index * 72}
          y1={430}
          y2={225 + (index % 2) * 14}
        />
      ))}
      {[
        { label: "+ tokens", y: 250, delay: 0 },
        { label: "peores resultados", y: 470, delay: 0.3 },
      ].map((signal) => {
        const signalIn = motionProgress(
          frame,
          fps,
          6.9 + signal.delay,
          7.4 + signal.delay,
        );
        return (
          <g key={signal.label}>
            <SignalPath
              bend={signal.y < 400 ? -50 : 50}
              color={accentColor}
              drawProgress={arrowIn}
              x1={968}
              x2={1292}
              y1={430}
              y2={signal.y + 48}
            />
            <g
              opacity={signalIn}
              transform={`translate(1470 ${signal.y + 48}) scale(${interpolate(
                signalIn,
                [0, 1],
                [0.85, 1],
                clamp,
              )})`}
            >
              <rect
                fill={rgba(accentColor, 0.1)}
                height={96}
                rx={12}
                stroke={accentColor}
                strokeWidth={3}
                width={356}
                x={-178}
                y={-48}
              />
              <text
                fill={accentColor}
                fontFamily={FONT}
                fontSize={32}
                fontWeight={850}
                textAnchor="middle"
                y={11}
              >
                {signal.label}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

const ReviewLoopV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const nodes = [
    { label: "Prompt", x: 300 },
    { label: "Implementa", x: 864 },
    { label: "Revisión", x: 1428 },
  ];
  const nodeY = 330;
  const forwardA = motionProgress(frame, fps, 0.9, 1.5);
  const forwardB = motionProgress(frame, fps, 1.6, 2.2);
  const returnDraw = motionProgress(
    frame,
    fps,
    2.6,
    4.6,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const warningIn = motionProgress(frame, fps, 4.8, 5.4);
  const warningPulse = interpolate(
    frame,
    [5.4 * fps, 5.7 * fps, 6.2 * fps],
    [1, 1.06, 1],
    clamp,
  );
  const loopPulse = motionProgress(frame, fps, 5.6, 6.9);
  const returnPath = "M 1428 402 C 1428 608, 300 608, 300 402";
  const pulseT = loopPulse;
  const oneMinus = 1 - pulseT;
  const pulseX =
    oneMinus * oneMinus * oneMinus * 1428 +
    3 * oneMinus * oneMinus * pulseT * 1428 +
    3 * oneMinus * pulseT * pulseT * 300 +
    pulseT * pulseT * pulseT * 300;
  const pulseY =
    oneMinus * oneMinus * oneMinus * 402 +
    3 * oneMinus * oneMinus * pulseT * 608 +
    3 * oneMinus * pulseT * pulseT * 608 +
    pulseT * pulseT * pulseT * 402;

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      {[
        { x1: 428, x2: 736, progress: forwardA },
        { x1: 992, x2: 1300, progress: forwardB },
      ].map((arrow) => (
        <g key={arrow.x1} opacity={arrow.progress}>
          <line
            stroke={MOTION_COLORS.muted}
            strokeLinecap="round"
            strokeWidth={5}
            x1={arrow.x1}
            x2={interpolate(
              arrow.progress,
              [0, 1],
              [arrow.x1, arrow.x2 - 18],
              clamp,
            )}
            y1={nodeY}
            y2={nodeY}
          />
          <path
            d={`M ${arrow.x2} ${nodeY} L ${arrow.x2 - 24} ${nodeY - 14} L ${arrow.x2 - 24} ${nodeY + 14} Z`}
            fill={MOTION_COLORS.muted}
            opacity={arrow.progress > 0.95 ? 1 : 0}
          />
        </g>
      ))}
      {nodes.map((node, index) => {
        const nodeIn = motionProgress(
          frame,
          fps,
          0.3 + index * 0.45,
          0.8 + index * 0.45,
        );
        return (
          <g
            key={node.label}
            opacity={nodeIn}
            transform={`translate(${node.x} ${nodeY}) scale(${interpolate(
              nodeIn,
              [0, 1],
              [0.85, 1],
              clamp,
            )})`}
          >
            <rect
              fill={MOTION_COLORS.surface}
              height={110}
              rx={14}
              stroke={rgba(MOTION_COLORS.ink, 0.4)}
              strokeWidth={3}
              width={256}
              x={-128}
              y={-55}
            />
            <text
              fill={MOTION_COLORS.ink}
              fontFamily={FONT}
              fontSize={30}
              fontWeight={800}
              textAnchor="middle"
              y={11}
            >
              {node.label}
            </text>
          </g>
        );
      })}
      <path
        d={returnPath}
        fill="none"
        pathLength={1}
        stroke={accentColor}
        strokeDasharray={1}
        strokeDashoffset={1 - returnDraw}
        strokeLinecap="round"
        strokeWidth={5}
      />
      <path
        d="M 300 380 L 284 414 L 316 414 Z"
        fill={accentColor}
        opacity={returnDraw > 0.97 ? 1 : 0}
      />
      {loopPulse > 0 && loopPulse < 1 ? (
        <g>
          <circle
            cx={pulseX}
            cy={pulseY}
            fill={rgba(accentColor, 0.2)}
            r={20}
          />
          <circle cx={pulseX} cy={pulseY} fill={accentColor} r={8} />
        </g>
      ) : null}
      <g
        opacity={warningIn}
        transform={`translate(864 692) scale(${warningPulse})`}
      >
        <path
          d="M -190 -6 L -158 -58 L -126 -6 Z"
          fill={rgba(accentColor, 0.14)}
          stroke={accentColor}
          strokeLinejoin="round"
          strokeWidth={4}
        />
        <text
          fill={accentColor}
          fontFamily={FONT}
          fontSize={30}
          fontWeight={900}
          textAnchor="middle"
          x={-158}
          y={-14}
        >
          !
        </text>
        <text
          fill={accentColor}
          fontFamily={FONT}
          fontSize={32}
          fontWeight={850}
          x={-98}
          y={4}
        >
          la tentación: corregir en el mismo chat
        </text>
      </g>
    </svg>
  );
};

const MemoryCostV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const chipIn = motionProgress(frame, fps, 0.2, 0.8);
  const reposIn = motionProgress(frame, fps, 3.0, 3.6);
  const costIn = motionProgress(frame, fps, 5.9, 6.4);
  const costFill = motionProgress(frame, fps, 6.2, 7.3);
  const notes = [
    { dockY: 300, travelTo: { x: 1195, y: 260 } },
    { dockY: 390, travelTo: { x: 1195, y: 570 } },
    { dockY: 480, travelTo: null },
  ];

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      <g opacity={chipIn}>
        {[-1, 1].map((side) =>
          [0, 1, 2, 3].map((pin) => (
            <rect
              fill={rgba(accentColor, 0.5)}
              height={16}
              key={`${side}-${pin}`}
              rx={4}
              width={26}
              x={side < 0 ? 190 : 484}
              y={268 + pin * 72}
            />
          )),
        )}
        <rect
          fill={MOTION_COLORS.backgroundRaised}
          height={320}
          rx={20}
          stroke={accentColor}
          strokeWidth={4}
          width={260}
          x={220}
          y={240}
        />
        <text
          fill={accentColor}
          fontFamily={FONT}
          fontSize={26}
          fontWeight={850}
          textAnchor="middle"
          x={350}
          y={212}
        >
          MEMORIA
        </text>
      </g>
      {notes.map((note, index) => {
        const noteIn = motionProgress(
          frame,
          fps,
          0.7 + index * 0.7,
          1.4 + index * 0.7,
        );
        const x = interpolate(noteIn, [0, 1], [-140, 265], clamp);
        return (
          <g key={`note-${index}`} opacity={noteIn}>
            <rect
              fill={MOTION_COLORS.surface}
              height={70}
              rx={10}
              stroke={rgba(accentColor, 0.55)}
              strokeWidth={2}
              width={170}
              x={x}
              y={note.dockY - 35}
            />
            <text
              fill={MOTION_COLORS.ink}
              fontFamily={FONT}
              fontSize={21}
              fontWeight={750}
              textAnchor="middle"
              x={x + 85}
              y={note.dockY + 7}
            >
              preferencia
            </text>
          </g>
        );
      })}
      {[
        { label: "Repo A", y: 200 },
        { label: "Repo B", y: 510 },
      ].map((repo) => (
        <g key={repo.label} opacity={reposIn}>
          <rect
            fill={MOTION_COLORS.backgroundRaised}
            height={34}
            rx={9}
            stroke={rgba(MOTION_COLORS.muted, 0.5)}
            strokeWidth={3}
            width={120}
            x={1190}
            y={repo.y - 28}
          />
          <rect
            fill={MOTION_COLORS.backgroundRaised}
            height={120}
            rx={14}
            stroke={rgba(MOTION_COLORS.muted, 0.5)}
            strokeWidth={3}
            width={300}
            x={1180}
            y={repo.y}
          />
          <text
            fill={MOTION_COLORS.muted}
            fontFamily={FONT}
            fontSize={24}
            fontWeight={800}
            textAnchor="middle"
            x={1330}
            y={repo.y + 168}
          >
            {repo.label}
          </text>
        </g>
      ))}
      {notes
        .filter((note) => note.travelTo !== null)
        .map((note, index) => {
          const travel = motionProgress(
            frame,
            fps,
            3.8 + index * 0.2,
            5.3 + index * 0.2,
            Easing.bezier(0.22, 1, 0.36, 1),
          );
          const stamp = motionProgress(
            frame,
            fps,
            5.3 + index * 0.15,
            5.8 + index * 0.15,
          );
          const target = note.travelTo as { x: number; y: number };
          const x = interpolate(travel, [0, 1], [510, target.x], clamp);
          const y = interpolate(travel, [0, 1], [note.dockY, target.y], clamp);
          const rejected = travel > 0.97;
          return (
            <g key={`travel-${index}`}>
              <g opacity={rejected ? 0.35 : 1}>
                <rect
                  fill={MOTION_COLORS.surface}
                  height={56}
                  rx={9}
                  stroke={rgba(accentColor, 0.55)}
                  strokeWidth={2}
                  width={130}
                  x={x}
                  y={y - 28}
                />
                <text
                  fill={MOTION_COLORS.ink}
                  fontFamily={FONT}
                  fontSize={17}
                  fontWeight={750}
                  textAnchor="middle"
                  x={x + 65}
                  y={y + 6}
                >
                  preferencia
                </text>
              </g>
              <g
                opacity={stamp}
                transform={`translate(${x + 65} ${y}) scale(${interpolate(
                  stamp,
                  [0, 1],
                  [1.5, 1],
                  clamp,
                )})`}
              >
                <line
                  stroke={MOTION_COLORS.coral}
                  strokeLinecap="round"
                  strokeWidth={8}
                  x1={-26}
                  x2={26}
                  y1={-26}
                  y2={26}
                />
                <line
                  stroke={MOTION_COLORS.coral}
                  strokeLinecap="round"
                  strokeWidth={8}
                  x1={26}
                  x2={-26}
                  y1={-26}
                  y2={26}
                />
              </g>
            </g>
          );
        })}
      <g opacity={costIn}>
        <text
          fill={MOTION_COLORS.muted}
          fontFamily={FONT}
          fontSize={24}
          fontWeight={750}
          textAnchor="middle"
          x={864}
          y={636}
        >
          coste al leer la memoria
        </text>
        <rect
          fill={rgba(MOTION_COLORS.muted, 0.15)}
          height={30}
          rx={10}
          width={500}
          x={614}
          y={656}
        />
        <rect
          fill={accentColor}
          height={30}
          rx={10}
          width={Math.max(0.001, 500 * costFill)}
          x={614}
          y={656}
        />
      </g>
    </svg>
  );
};

const OffPeakV4: React.FC<SceneProps> = ({ frame, fps, accentColor }) => {
  const stripX = 180;
  const stripW = 1368;
  const stripY = 210;
  const stripH = 90;
  const peakStart = 0.27;
  const peakEnd = 0.72;
  const valleyColor = accentColor;
  const peakColor = MOTION_COLORS.coral;
  const travel = motionProgress(
    frame,
    fps,
    1.1,
    4.1,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const pointerX = interpolate(
    travel,
    [0, 1],
    [stripX, stripX + stripW],
    clamp,
  );
  const peakLeft = stripX + stripW * peakStart;
  const peakRight = stripX + stripW * peakEnd;
  const barLength = interpolate(
    pointerX,
    [peakLeft - 110, peakLeft + 110, peakRight - 110, peakRight + 110],
    [900, 340, 340, 900],
    clamp,
  );
  const barStrength = interpolate(
    pointerX,
    [peakLeft - 110, peakLeft + 110, peakRight - 110, peakRight + 110],
    [1, 0.45, 0.45, 1],
    clamp,
  );
  const barY = 470;
  const barH = 64;

  return (
    <svg height="100%" viewBox="0 0 1728 780" width="100%">
      {[
        {
          x: stripX,
          w: stripW * peakStart,
          color: valleyColor,
          label: "valle",
          delay: 0,
        },
        {
          x: peakLeft,
          w: stripW * (peakEnd - peakStart),
          color: peakColor,
          label: "horas pico",
          delay: 0.2,
        },
        {
          x: peakRight,
          w: stripW * (1 - peakEnd),
          color: valleyColor,
          label: null,
          delay: 0.4,
        },
      ].map((segment, index) => {
        const segmentIn = motionProgress(
          frame,
          fps,
          0.3 + segment.delay,
          0.7 + segment.delay,
        );
        return (
          <g key={index} opacity={segmentIn}>
            <rect
              fill={rgba(segment.color, 0.16)}
              height={stripH}
              stroke={rgba(segment.color, 0.55)}
              strokeWidth={2}
              width={segment.w}
              x={segment.x}
              y={stripY}
            />
            {segment.label ? (
              <text
                fill={segment.color}
                fontFamily={FONT}
                fontSize={26}
                fontWeight={850}
                textAnchor="middle"
                x={segment.x + segment.w / 2}
                y={stripY + stripH / 2 + 10}
              >
                {segment.label}
              </text>
            ) : null}
          </g>
        );
      })}
      {Array.from({ length: 9 }, (_, tick) => (
        <line
          key={tick}
          stroke={rgba(MOTION_COLORS.muted, 0.4)}
          strokeWidth={2}
          x1={stripX + (stripW / 8) * tick}
          x2={stripX + (stripW / 8) * tick}
          y1={stripY + stripH + 8}
          y2={stripY + stripH + 22}
        />
      ))}
      <g opacity={travel > 0 ? 1 : 0}>
        <line
          stroke={MOTION_COLORS.ink}
          strokeDasharray="6 8"
          strokeWidth={3}
          x1={pointerX}
          x2={pointerX}
          y1={stripY + stripH + 30}
          y2={barY - 18}
        />
        <circle
          cx={pointerX}
          cy={stripY + stripH / 2}
          fill={MOTION_COLORS.ink}
          r={13}
          stroke={MOTION_COLORS.background}
          strokeWidth={4}
        />
      </g>
      <rect
        fill={rgba(MOTION_COLORS.muted, 0.12)}
        height={barH}
        rx={12}
        width={900}
        x={stripX}
        y={barY}
      />
      <rect
        fill={rgba(valleyColor, barStrength)}
        height={barH}
        rx={12}
        width={Math.max(0.001, barLength)}
        x={stripX}
        y={barY}
      />
      <text
        fill={MOTION_COLORS.ink}
        fontFamily={FONT}
        fontSize={26}
        fontWeight={800}
        opacity={motionProgress(frame, fps, 0.9, 1.3)}
        x={stripX}
        y={barY + barH + 52}
      >
        tu límite
      </text>
    </svg>
  );
};

const sceneComponentsV4: Record<
  AhorrarLimitesV4Props["scene"],
  React.FC<SceneProps>
> = {
  "rising-cost": RisingCostV4,
  "token-breakdown": TokenBreakdownV4,
  "context-window": ContextWindowV4,
  "sparse-attention": SparseAttentionV4,
  "three-skills": ThreeSkillsV4,
  "md-clutter": MarkdownClutterV4,
  "review-loop": ReviewLoopV4,
  "memory-cost": MemoryCostV4,
  "off-peak": OffPeakV4,
};

export const AhorrarLimitesV4: React.FC<AhorrarLimitesV4Props> = ({
  scene,
  title,
  kicker,
  showHeader,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const Scene = sceneComponentsV4[scene];

  return (
    <MotionCanvas
      accentColor={accentColor}
      showHeader={showHeader}
      supportingText={kicker}
      title={title}
    >
      <Scene accentColor={accentColor} fps={fps} frame={frame} />
    </MotionCanvas>
  );
};
