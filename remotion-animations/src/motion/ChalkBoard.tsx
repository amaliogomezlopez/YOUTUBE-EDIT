import {AbsoluteFill, Img, staticFile} from "remotion";
import {useId} from "react";
import {EDITORIAL_COLORS, alpha} from "../editorial/palette";

const RULE_GAP = 48;

export const ChalkBoard: React.FC<{
  accentColor?: string;
  showRules?: boolean;
}> = ({accentColor = EDITORIAL_COLORS.gold, showRules = true}) => {
  const filterId = useId().replace(/:/g, "");
  const rules = Array.from({length: 22}, (_, index) => 36 + index * RULE_GAP);

  return (
    <AbsoluteFill style={{backgroundColor: EDITORIAL_COLORS.background, overflow: "hidden"}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 42%, ${alpha(
            accentColor,
            0.045,
          )}, transparent 42%), radial-gradient(ellipse at 18% 88%, ${alpha(
            EDITORIAL_COLORS.cyan,
            0.03,
          )}, transparent 36%)`,
        }}
      />
      {showRules ? (
        <svg
          height="1080"
          viewBox="0 0 1920 1080"
          width="1920"
          style={{height: "100%", left: 0, position: "absolute", top: 0, width: "100%"}}
        >
          {rules.map((y) => (
            <line
              key={y}
              x1="72"
              x2="1848"
              y1={y}
              y2={y}
              stroke={EDITORIAL_COLORS.grid}
              strokeWidth="1"
              opacity="0.28"
            />
          ))}
          <path
            d="M140 70 C 420 58, 780 92, 1180 64 S 1760 88, 1840 72"
            fill="none"
            opacity="0.12"
            stroke={EDITORIAL_COLORS.ink}
            strokeLinecap="round"
            strokeWidth="1.4"
          />
          <path
            d="M90 980 C 360 1008, 820 956, 1240 992 S 1700 970, 1860 1004"
            fill="none"
            opacity="0.08"
            stroke={EDITORIAL_COLORS.muted}
            strokeLinecap="round"
            strokeWidth="1.2"
          />
        </svg>
      ) : null}
      <svg
        height="1080"
        viewBox="0 0 1920 1080"
        width="1920"
        style={{height: "100%", left: 0, pointerEvents: "none", position: "absolute", top: 0, width: "100%"}}
      >
        <defs>
          <filter id={`board-grain-${filterId}`}>
            <feTurbulence
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
              type="fractalNoise"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect
          filter={`url(#board-grain-${filterId})`}
          height="1080"
          opacity="0.11"
          width="1920"
        />
      </svg>
      <Img
        src={staticFile("assets/textures/slate-dust.svg")}
        style={{
          height: "100%",
          mixBlendMode: "overlay",
          opacity: 0.22,
          width: "100%",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 48%, rgba(0,0,0,.42) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
