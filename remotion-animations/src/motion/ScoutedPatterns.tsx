import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  MOTION_COLORS,
  SignalPath,
  clamp,
  motionProgress,
  rgba,
} from "./Toolkit";
import {MotionIcon} from "../visuals/icons/MotionIcon";

export type RadialOrbitItem = {
  label: string;
};

export type RadialSideCard = {
  label: string;
  value: string;
};

export type RadialOrbitSummaryProps = {
  value: number;
  suffix?: string;
  centerLabel: string;
  orbitItems: RadialOrbitItem[];
  sideCards: RadialSideCard[];
  accentColor: string;
};

export const RadialOrbitSummary: React.FC<RadialOrbitSummaryProps> = ({
  value,
  suffix = "%",
  centerLabel,
  orbitItems,
  sideCards,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const centerX = 704;
  const centerY = 374;
  const radius = 170;
  const safeValue = Math.min(100, Math.max(0, value));
  const ringProgress = motionProgress(
    frame,
    fps,
    0.2,
    3.2,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const haloProgress = motionProgress(frame, fps, 0.7, 2.1);
  const orbitTravel = interpolate(
    frame,
    [0.4 * fps, 6.25 * fps],
    [0, 1.15],
    clamp,
  );
  const focus = motionProgress(frame, fps, 5.15, 5.75);
  const animatedValue = Math.round(safeValue * ringProgress);
  const visibleRatio = (safeValue / 100) * ringProgress;

  return (
    <svg
      height="100%"
      viewBox="0 0 1728 760"
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx={centerX}
        cy={centerY}
        fill="none"
        opacity={haloProgress * 0.38}
        pathLength={1}
        r={252}
        stroke={accentColor}
        strokeDasharray="0.005 0.027"
        strokeLinecap="round"
        strokeWidth={4}
        transform={`rotate(${-54 - orbitTravel * 70} ${centerX} ${centerY})`}
      />
      <circle
        cx={centerX}
        cy={centerY}
        fill={rgba(MOTION_COLORS.backgroundRaised, 0.66)}
        opacity={motionProgress(frame, fps, 0.05, 0.55)}
        r={radius + 28}
        stroke={rgba(MOTION_COLORS.grid, 0.58)}
        strokeWidth={2}
      />
      <circle
        cx={centerX}
        cy={centerY}
        fill="none"
        pathLength={1}
        r={radius}
        stroke={rgba(MOTION_COLORS.muted, 0.16)}
        strokeWidth={34}
      />
      <circle
        cx={centerX}
        cy={centerY}
        fill="none"
        pathLength={1}
        r={radius}
        stroke={accentColor}
        strokeDasharray={`${visibleRatio} ${1 - visibleRatio}`}
        strokeLinecap="round"
        strokeWidth={34}
        transform={`rotate(-90 ${centerX} ${centerY})`}
      />
      <circle
        cx={centerX}
        cy={centerY}
        fill="none"
        opacity={interpolate(ringProgress, [0, 0.12, 1], [0, 1, 1], clamp)}
        pathLength={1}
        r={radius}
        stroke={MOTION_COLORS.ink}
        strokeDasharray="0.035 0.965"
        strokeDashoffset={-orbitTravel}
        strokeLinecap="round"
        strokeWidth={9}
        transform={`rotate(-90 ${centerX} ${centerY})`}
      />

      {orbitItems.slice(0, 5).map((item, index, items) => {
        const angle =
          -142 + (index / Math.max(1, items.length - 1)) * 284;
        const angleRadians = (angle * Math.PI) / 180;
        const x = centerX + Math.cos(angleRadians) * 273;
        const y = centerY + Math.sin(angleRadians) * 273;
        const reveal = motionProgress(
          frame,
          fps,
          1.05 + index * 0.22,
          1.62 + index * 0.22,
        );
        const isFocus = index === items.length - 1;
        const emphasis = isFocus ? focus : 0;
        const cardWidth = Math.max(150, Math.min(236, item.label.length * 13));

        return (
          <g
            key={`${item.label}-${index}`}
            opacity={reveal}
            transform={`translate(${x} ${y}) scale(${interpolate(
              reveal + emphasis * 0.08,
              [0, 1],
              [0.82, 1],
              clamp,
            )})`}
          >
            <rect
              fill={
                isFocus
                  ? rgba(accentColor, 0.13 + emphasis * 0.08)
                  : rgba(MOTION_COLORS.backgroundRaised, 0.92)
              }
              height={58}
              rx={14}
              stroke={
                isFocus
                  ? rgba(accentColor, 0.75)
                  : rgba(MOTION_COLORS.muted, 0.24)
              }
              strokeWidth={2}
              width={cardWidth}
              x={-cardWidth / 2}
              y={-29}
            />
            <circle
              cx={-cardWidth / 2 + 23}
              cy={0}
              fill={isFocus ? accentColor : rgba(accentColor, 0.5)}
              r={6}
            />
            <text
              dominantBaseline="middle"
              fill={
                isFocus ? MOTION_COLORS.ink : rgba(MOTION_COLORS.ink, 0.78)
              }
              fontFamily="Schibsted Grotesk"
              fontSize={20}
              fontWeight={760}
              textAnchor="middle"
              x={8}
              y={1}
            >
              {item.label}
            </text>
          </g>
        );
      })}

      <g opacity={motionProgress(frame, fps, 0.65, 1.2)}>
        <text
          fill={accentColor}
          fontFamily="Schibsted Grotesk"
          fontSize={88}
          fontWeight={900}
          style={{fontVariantNumeric: "tabular-nums"}}
          textAnchor="middle"
          x={centerX}
          y={centerY + 12}
        >
          {animatedValue}
          {suffix}
        </text>
        <text
          fill={MOTION_COLORS.muted}
          fontFamily="Schibsted Grotesk"
          fontSize={22}
          fontWeight={760}
          letterSpacing={0.7}
          textAnchor="middle"
          x={centerX}
          y={centerY + 64}
        >
          {centerLabel}
        </text>
      </g>

      {sideCards.slice(0, 2).map((card, index) => {
        const cardX = 1194;
        const cardY = 237 + index * 244;
        const pathStart = 2.95 + index * 0.34;
        const draw = motionProgress(
          frame,
          fps,
          pathStart,
          pathStart + 1.05,
        );
        const reveal = motionProgress(
          frame,
          fps,
          pathStart + 0.62,
          pathStart + 1.2,
        );
        const pulse = motionProgress(
          frame,
          fps,
          4.65 + index * 0.42,
          5.45 + index * 0.42,
          Easing.inOut(Easing.cubic),
        );

        return (
          <g key={`${card.label}-${index}`}>
            <SignalPath
              bend={index === 0 ? -42 : 42}
              color={accentColor}
              dotProgress={pulse > 0 && pulse < 1 ? pulse : undefined}
              drawProgress={draw}
              opacity={0.95}
              x1={centerX + radius + 22}
              x2={cardX - 40}
              y1={centerY + (index === 0 ? -56 : 56)}
              y2={cardY}
            />
            <g
              opacity={reveal}
              transform={`translate(${interpolate(
                reveal,
                [0, 1],
                [34, 0],
              )} 0)`}
            >
              <rect
                fill={rgba(MOTION_COLORS.backgroundRaised, 0.94)}
                height={154}
                rx={16}
                stroke={rgba(accentColor, 0.28 + pulse * 0.36)}
                strokeWidth={2}
                width={382}
                x={cardX}
                y={cardY - 77}
              />
              <rect
                fill={accentColor}
                height={62}
                opacity={0.84}
                rx={3}
                width={5}
                x={cardX + 30}
                y={cardY - 31}
              />
              <text
                fill={MOTION_COLORS.muted}
                fontFamily="Schibsted Grotesk"
                fontSize={19}
                fontWeight={730}
                x={cardX + 58}
                y={cardY - 20}
              >
                {card.label}
              </text>
              <text
                fill={MOTION_COLORS.ink}
                fontFamily="Schibsted Grotesk"
                fontSize={36}
                fontWeight={860}
                x={cardX + 58}
                y={cardY + 32}
              >
                {card.value}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export type ChainNodeState = {
  label: string;
  caption: string;
};

export type ConnectedChainNode = {
  states: ChainNodeState[];
};

export type ConnectedCardChainProps = {
  nodes: ConnectedChainNode[];
  accentColor: string;
};

const stateOpacity = (
  frame: number,
  fps: number,
  stateIndex: number,
  stateCount: number,
) => {
  if (stateCount <= 1) {
    return 1;
  }

  const firstSwitch = 4.35;
  const switchSpacing = 1.25;
  const fadeSeconds = 0.42;
  const enter =
    stateIndex === 0
      ? 1
      : motionProgress(
          frame,
          fps,
          firstSwitch + (stateIndex - 1) * switchSpacing,
          firstSwitch + (stateIndex - 1) * switchSpacing + fadeSeconds,
        );
  const exit =
    stateIndex === stateCount - 1
      ? 0
      : motionProgress(
          frame,
          fps,
          firstSwitch + stateIndex * switchSpacing,
          firstSwitch + stateIndex * switchSpacing + fadeSeconds,
        );
  return Math.min(1, Math.max(0, enter - exit));
};

export const ConnectedCardChain: React.FC<ConnectedCardChainProps> = ({
  nodes,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safeNodes = nodes.slice(0, 4);
  const width = safeNodes.length >= 4 ? 290 : 352;
  const gap =
    (1580 - width * Math.max(1, safeNodes.length)) /
    Math.max(1, safeNodes.length - 1);
  const startX = 74;
  const y = 278;
  const height = 218;
  const signalProgress = motionProgress(
    frame,
    fps,
    3.15,
    6.25,
    Easing.inOut(Easing.cubic),
  );
  const connectorCount = Math.max(1, safeNodes.length - 1);
  const activeIndex = Math.min(
    safeNodes.length - 1,
    Math.round(signalProgress * connectorCount),
  );

  return (
    <svg
      height="100%"
      viewBox="0 0 1728 760"
      width="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      {safeNodes.slice(0, -1).map((_, index) => {
        const x1 = startX + index * (width + gap) + width;
        const x2 = startX + (index + 1) * (width + gap);
        const draw = motionProgress(
          frame,
          fps,
          0.78 + index * 1.02,
          1.84 + index * 1.02,
        );
        const localSignal = Math.min(
          1,
          Math.max(0, signalProgress * connectorCount - index),
        );

        return (
          <SignalPath
            color={accentColor}
            dotProgress={
              localSignal > 0 && localSignal < 1 ? localSignal : undefined
            }
            drawProgress={draw}
            key={`connector-${index}`}
            opacity={0.9}
            x1={x1}
            x2={x2}
            y1={y + height / 2}
            y2={y + height / 2}
          />
        );
      })}

      {safeNodes.map((node, index) => {
        const x = startX + index * (width + gap);
        const enterStart = 0.18 + index * 1.02;
        const enter = motionProgress(
          frame,
          fps,
          enterStart,
          enterStart + 0.68,
        );
        const isActive = index === activeIndex && signalProgress > 0;
        const activePulse = isActive
          ? interpolate(
              frame % Math.max(1, Math.round(fps * 0.9)),
              [0, fps * 0.45, fps * 0.9],
              [0, 1, 0],
              clamp,
            )
          : 0;

        return (
          <g
            key={`node-${index}`}
            opacity={enter}
            transform={`translate(0 ${interpolate(
              enter,
              [0, 1],
              [28, 0],
            )})`}
          >
            <rect
              fill={rgba(MOTION_COLORS.backgroundRaised, 0.97)}
              height={height}
              rx={16}
              stroke={
                isActive
                  ? rgba(accentColor, 0.72 + activePulse * 0.2)
                  : rgba(MOTION_COLORS.muted, 0.22)
              }
              strokeWidth={isActive ? 3 : 2}
              width={width}
              x={x}
              y={y}
            />
            <rect
              fill={isActive ? accentColor : rgba(accentColor, 0.46)}
              height={5}
              rx={2}
              width={isActive ? 74 : 42}
              x={x + 34}
              y={y + 34}
            />
            {node.states.slice(0, 3).map((state, stateIndex) => {
              const opacity = stateOpacity(
                frame,
                fps,
                stateIndex,
                node.states.length,
              );
              const offsetY = interpolate(opacity, [0, 1], [10, 0]);

              return (
                <g
                  key={`${state.label}-${stateIndex}`}
                  opacity={opacity}
                  transform={`translate(0 ${offsetY})`}
                >
                  <text
                    fill={MOTION_COLORS.ink}
                    fontFamily="Schibsted Grotesk"
                    fontSize={width < 330 ? 29 : 34}
                    fontWeight={870}
                    textAnchor="middle"
                    x={x + width / 2}
                    y={y + 103}
                  >
                    {state.label}
                  </text>
                  <text
                    fill={MOTION_COLORS.muted}
                    fontFamily="Schibsted Grotesk"
                    fontSize={19}
                    fontWeight={620}
                    textAnchor="middle"
                    x={x + width / 2}
                    y={y + 151}
                  >
                    {state.caption}
                  </text>
                </g>
              );
            })}
            <circle
              cx={x + width / 2}
              cy={y + height}
              fill={isActive ? accentColor : rgba(MOTION_COLORS.muted, 0.42)}
              r={isActive ? 8 : 5}
            />
            <text
              fill={rgba(MOTION_COLORS.muted, 0.62)}
              fontFamily="Schibsted Grotesk"
              fontSize={17}
              fontWeight={750}
              letterSpacing={1}
              textAnchor="middle"
              x={x + width / 2}
              y={y + height + 48}
            >
              {String(index + 1).padStart(2, "0")}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export type CapacityMatrixProps = {
  rows: number;
  columns: number;
  activeCount: number;
  selectedIndex: number;
  accentColor: string;
};

export const CapacityMatrix: React.FC<CapacityMatrixProps> = ({
  rows,
  columns,
  activeCount,
  selectedIndex,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safeRows = Math.min(6, Math.max(3, Math.round(rows)));
  const safeColumns = Math.min(10, Math.max(4, Math.round(columns)));
  const total = safeRows * safeColumns;
  const safeActive = Math.min(total, Math.max(0, Math.round(activeCount)));
  const safeSelected = Math.min(total - 1, Math.max(0, selectedIndex));
  const waveSize = Math.ceil(total / 5);
  const selection = motionProgress(frame, fps, 5.05, 5.72);
  const scan = motionProgress(
    frame,
    fps,
    0.65,
    5.15,
    Easing.bezier(0.45, 0, 0.55, 1),
  );

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "18px 22px",
          gridTemplateColumns: `repeat(${safeColumns}, 82px)`,
          position: "relative",
        }}
      >
        {Array.from({length: total}, (_, index) => {
          const wave = Math.min(4, Math.floor(index / waveSize));
          const reveal = motionProgress(
            frame,
            fps,
            0.18 + wave * 0.66,
            0.83 + wave * 0.66,
          );
          const isActive = index < safeActive;
          const isSelected = index === safeSelected;
          const selectedProgress = isSelected ? selection : 0;
          const fill = isSelected
            ? interpolate(
                selectedProgress,
                [0, 1],
                [0.42, 1],
                clamp,
              )
            : isActive
              ? 0.45
              : 0.13;
          const color = isSelected
            ? MOTION_COLORS.ink
            : isActive
              ? accentColor
              : MOTION_COLORS.muted;
          const scanDistance = Math.abs(
            index / Math.max(1, total - 1) - scan,
          );
          const scanBoost = Math.max(0, 1 - scanDistance / 0.075);

          return (
            <div
              key={index}
              style={{
                alignItems: "center",
                display: "flex",
                height: 82,
                justifyContent: "center",
                opacity: reveal,
                position: "relative",
                transform: `translateY(${interpolate(
                  reveal,
                  [0, 1],
                  [24, 0],
                )}px) scale(${interpolate(
                  reveal + selectedProgress * 0.1,
                  [0, 1],
                  [0.72, 1],
                  clamp,
                )})`,
                width: 82,
              }}
            >
              {isSelected ? (
                <div
                  style={{
                    border: `2px solid ${rgba(accentColor, 0.76)}`,
                    borderRadius: "50%",
                    boxShadow: `0 0 34px ${rgba(accentColor, 0.18)}`,
                    height: 78,
                    opacity: selectedProgress,
                    position: "absolute",
                    width: 78,
                  }}
                />
              ) : null}
              <MotionIcon
                color={rgba(
                  color,
                  Math.min(1, fill + scanBoost * 0.22),
                )}
                id="agent"
                progress={Math.min(1, fill + scanBoost * 0.22)}
                secondaryColor={rgba(accentColor, 0.86)}
                style={{height: 66, width: 66}}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          backgroundColor: accentColor,
          borderRadius: 2,
          bottom: 54,
          height: 4,
          left: "50%",
          opacity: 0.74,
          position: "absolute",
          transform: "translateX(-50%)",
          width: interpolate(scan, [0, 1], [0, 980]),
        }}
      />
    </div>
  );
};
