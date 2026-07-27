import React from "react";

export type MotionIconProps = {
  id: string;
  color?: string;
  secondaryColor?: string;
  progress?: number;
  strokeWidth?: number;
  title?: string;
  style?: React.CSSProperties;
};

type IconGlyphProps = Omit<MotionIconProps, "style" | "title">;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const renderGlyph = (
  id: string,
  color: string,
  secondaryColor: string,
  strokeWidth: number,
) => {
  const line = {
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const soft = {
    ...line,
    stroke: secondaryColor,
  };

  switch (id) {
    case "agent":
      return (
        <>
          <circle cx="28" cy="20" r="9" {...line} />
          <path d="M12 51c2-12 9-18 16-18s14 6 16 18" {...line} />
          <circle cx="48" cy="18" r="3" fill={secondaryColor} />
          <path d="M45 27c6-2 10-7 11-13" {...soft} />
        </>
      );
    case "model":
      return (
        <>
          <circle cx="32" cy="32" r="10" {...line} />
          {[
            [32, 8],
            [53, 20],
            [53, 44],
            [32, 56],
            [11, 44],
            [11, 20],
          ].map(([x, y]) => (
            <React.Fragment key={`${x}-${y}`}>
              <line x1="32" y1="32" x2={x} y2={y} {...soft} />
              <circle cx={x} cy={y} r="3.5" fill={secondaryColor} />
            </React.Fragment>
          ))}
          <circle cx="32" cy="32" r="3" fill={color} />
        </>
      );
    case "memory":
      return (
        <>
          <rect x="14" y="14" width="36" height="36" rx="7" {...line} />
          <rect x="23" y="23" width="18" height="18" rx="3" {...soft} />
          {[20, 32, 44].map((n) => (
            <React.Fragment key={n}>
              <line x1={n} y1="8" x2={n} y2="14" {...line} />
              <line x1={n} y1="50" x2={n} y2="56" {...line} />
              <line x1="8" y1={n} x2="14" y2={n} {...line} />
              <line x1="50" y1={n} x2="56" y2={n} {...line} />
            </React.Fragment>
          ))}
        </>
      );
    case "context":
      return (
        <>
          <rect x="9" y="12" width="46" height="40" rx="7" {...line} />
          <line x1="9" y1="23" x2="55" y2="23" {...soft} />
          <rect x="16" y="30" width="20" height="5" rx="2.5" fill={color} />
          <rect x="16" y="40" width="32" height="5" rx="2.5" fill={secondaryColor} />
        </>
      );
    case "prompt":
      return (
        <>
          <path d="M11 14h42v31H30L18 54v-9h-7z" {...line} />
          <path d="m20 27 6 5-6 5M31 38h12" {...soft} />
        </>
      );
    case "tokens":
      return (
        <>
          <ellipse cx="25" cy="19" rx="13" ry="6" {...line} />
          <path d="M12 19v12c0 3 6 6 13 6s13-3 13-6V19" {...line} />
          <path d="M16 38v7c0 4 7 7 15 7s15-3 15-7V31" {...soft} />
          <path d="M22 17h7M22 27h7" {...line} />
        </>
      );
    case "tool":
      return (
        <>
          <path d="M39 10a12 12 0 0 0-12 16L10 43a7 7 0 0 0 10 10l17-17A12 12 0 0 0 53 22l-9 9-8-3-3-8 9-9z" {...line} />
          <circle cx="16" cy="47" r="2.5" fill={secondaryColor} />
        </>
      );
    case "api":
      return (
        <>
          <circle cx="13" cy="32" r="5" {...line} />
          <circle cx="51" cy="17" r="5" {...line} />
          <circle cx="51" cy="47" r="5" {...line} />
          <path d="M18 32h12c7 0 9-15 16-15M30 32c7 0 9 15 16 15" {...soft} />
        </>
      );
    case "file":
      return (
        <>
          <path d="M16 7h22l11 11v39H16z" {...line} />
          <path d="M38 7v12h11M23 31h19M23 40h19M23 49h12" {...soft} />
        </>
      );
    case "folder":
      return (
        <>
          <path d="M7 18h19l6 7h25v28H7z" {...line} />
          <path d="M7 26V13h17l6 6h27v8" {...soft} />
        </>
      );
    case "repository":
      return (
        <>
          <path d="M6 18h19l6 7h27v28H6z" {...line} />
          <circle cx="22" cy="33" r="3" fill={secondaryColor} />
          <circle cx="22" cy="45" r="3" fill={secondaryColor} />
          <circle cx="42" cy="39" r="3" fill={color} />
          <path d="M22 36v6M25 33h7c4 0 4 6 7 6" {...soft} />
        </>
      );
    case "code":
      return (
        <>
          <path d="m24 16-15 16 15 16M40 16l15 16-15 16M36 11 28 53" {...line} />
        </>
      );
    case "terminal":
      return (
        <>
          <rect x="7" y="11" width="50" height="42" rx="6" {...line} />
          <path d="M7 22h50M16 32l7 6-7 6M30 45h13" {...soft} />
          <circle cx="15" cy="17" r="2" fill={secondaryColor} />
        </>
      );
    case "browser":
      return (
        <>
          <rect x="7" y="10" width="50" height="44" rx="6" {...line} />
          <path d="M7 22h50" {...soft} />
          <circle cx="14" cy="16" r="2" fill={secondaryColor} />
          <circle cx="21" cy="16" r="2" fill={secondaryColor} />
          <rect x="15" y="30" width="34" height="15" rx="3" {...soft} />
        </>
      );
    case "database":
      return (
        <>
          <ellipse cx="32" cy="13" rx="20" ry="7" {...line} />
          <path d="M12 13v13c0 4 9 7 20 7s20-3 20-7V13M12 26v13c0 4 9 7 20 7s20-3 20-7V26M12 39v12c0 4 9 7 20 7s20-3 20-7V39" {...line} />
        </>
      );
    case "server":
      return (
        <>
          {[9, 25, 41].map((y) => (
            <g key={y}>
              <rect x="8" y={y} width="48" height="13" rx="4" {...line} />
              <circle cx="16" cy={y + 6.5} r="2" fill={secondaryColor} />
              <line x1="25" y1={y + 6.5} x2="47" y2={y + 6.5} {...soft} />
            </g>
          ))}
        </>
      );
    case "cloud":
      return (
        <>
          <path d="M18 50h31a10 10 0 0 0 1-20 18 18 0 0 0-34-4A12 12 0 0 0 18 50z" {...line} />
          <path d="m27 41 5 5 9-12" {...soft} />
        </>
      );
    case "mobile":
      return (
        <>
          <rect x="17" y="5" width="30" height="54" rx="7" {...line} />
          <path d="M25 13h14M28 51h8" {...soft} />
          <rect x="23" y="20" width="18" height="23" rx="3" fill={secondaryColor} opacity=".22" />
        </>
      );
    case "input":
      return (
        <>
          <path d="M36 12h17v40H36" {...line} />
          <path d="M8 32h31M28 21l11 11-11 11" {...soft} />
        </>
      );
    case "output":
      return (
        <>
          <path d="M28 12H11v40h17" {...line} />
          <path d="M25 32h31M45 21l11 11-11 11" {...soft} />
        </>
      );
    case "queue":
      return (
        <>
          {[12, 27, 42].map((y, index) => (
            <rect
              key={y}
              x={10 + index * 5}
              y={y}
              width={34 - index * 5}
              height="10"
              rx="3"
              {...(index === 2 ? soft : line)}
            />
          ))}
          <path d="M48 15v36M42 45l6 6 6-6" {...soft} />
        </>
      );
    case "filter":
      return (
        <>
          <path d="M7 10h50L39 32v17l-14 7V32z" {...line} />
          <path d="M18 18h28" {...soft} />
        </>
      );
    case "branch":
      return (
        <>
          <circle cx="13" cy="32" r="5" {...line} />
          <circle cx="51" cy="15" r="5" {...line} />
          <circle cx="51" cy="49" r="5" {...line} />
          <path d="M18 32h10c9 0 9-17 18-17M28 32c9 0 9 17 18 17" {...soft} />
        </>
      );
    case "merge":
      return (
        <>
          <circle cx="13" cy="15" r="5" {...line} />
          <circle cx="13" cy="49" r="5" {...line} />
          <circle cx="51" cy="32" r="5" {...line} />
          <path d="M18 15c10 0 10 17 20 17h8M18 49c10 0 10-17 20-17" {...soft} />
        </>
      );
    case "loop":
      return (
        <>
          <path d="M52 25A22 22 0 0 0 14 17l-5 8M12 19l-3 6 7 2M12 39a22 22 0 0 0 38 8l5-8M52 45l3-6-7-2" {...line} />
        </>
      );
    case "sync":
      return (
        <>
          <path d="M11 25c5-12 20-17 32-11l8 5M44 10l7 9-10 4M53 39c-5 12-20 17-32 11l-8-5M20 54l-7-9 10-4" {...line} />
        </>
      );
    case "search":
      return (
        <>
          <circle cx="27" cy="27" r="17" {...line} />
          <path d="m40 40 15 15M20 27h14M27 20v14" {...soft} />
        </>
      );
    case "index":
      return (
        <>
          {[13, 27, 41].map((y, index) => (
            <React.Fragment key={y}>
              <circle cx="13" cy={y + 4} r="3" fill={index === 1 ? color : secondaryColor} />
              <rect x="22" y={y} width={34 - index * 4} height="8" rx="4" {...soft} />
            </React.Fragment>
          ))}
        </>
      );
    case "camera":
      return (
        <>
          <path d="M8 20h12l5-7h15l5 7h11v34H8z" {...line} />
          <circle cx="32" cy="37" r="11" {...soft} />
          <circle cx="32" cy="37" r="4" fill={secondaryColor} />
        </>
      );
    case "microphone":
      return (
        <>
          <rect x="22" y="7" width="20" height="33" rx="10" {...line} />
          <path d="M15 31c0 11 7 17 17 17s17-6 17-17M32 48v9M23 57h18" {...soft} />
        </>
      );
    case "edit":
      return (
        <>
          <rect x="7" y="15" width="50" height="34" rx="6" {...line} />
          <path d="M17 15v34M30 15v34M45 15v34M10 32h44" {...soft} />
          <path d="M38 8v48" {...line} />
          <circle cx="38" cy="32" r="4" fill={secondaryColor} />
        </>
      );
    case "upload":
      return (
        <>
          <path d="M11 42v13h42V42M32 45V9M20 21 32 9l12 12" {...line} />
          <path d="M20 55h24" {...soft} />
        </>
      );
    case "analytics":
      return (
        <>
          <path d="M9 8v47h47" {...line} />
          <rect x="17" y="34" width="8" height="14" rx="2" {...soft} />
          <rect x="31" y="25" width="8" height="23" rx="2" {...soft} />
          <rect x="45" y="14" width="8" height="34" rx="2" fill={secondaryColor} opacity=".24" stroke={secondaryColor} strokeWidth={strokeWidth} />
          <path d="m17 26 11-8 10 3 14-13" {...line} />
        </>
      );
    case "clock":
      return (
        <>
          <circle cx="32" cy="32" r="24" {...line} />
          <path d="M32 17v16l11 7" {...soft} />
          <circle cx="32" cy="32" r="3" fill={color} />
        </>
      );
    case "cost":
      return (
        <>
          <circle cx="27" cy="34" r="21" {...line} />
          <path d="M31 22h-7c-8 0-8 10 0 10h6c8 0 8 10 0 10h-8M27 17v30" {...soft} />
          <path d="m42 18 6-8 7 5" {...line} />
        </>
      );
    case "wallet":
      return (
        <>
          <path d="M8 17h42a6 6 0 0 1 6 6v31H8zM8 17l34-8v8" {...line} />
          <path d="M38 30h18v14H38a7 7 0 0 1 0-14z" {...soft} />
          <circle cx="44" cy="37" r="2" fill={color} />
        </>
      );
    case "risk":
      return (
        <>
          <path d="M32 7 59 55H5z" {...line} />
          <path d="M32 23v17" {...soft} />
          <circle cx="32" cy="48" r="2.5" fill={secondaryColor} />
        </>
      );
    case "limit":
      return (
        <>
          <path d="M10 45a23 23 0 0 1 44 0" {...line} />
          <path d="M16 39h5M21 25l4 4M32 20v6M43 25l-4 4M48 39h-5M32 43l13-13" {...soft} />
          <circle cx="32" cy="43" r="4" fill={color} />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="11" y="27" width="42" height="31" rx="6" {...line} />
          <path d="M20 27v-8a12 12 0 0 1 24 0v8" {...soft} />
          <circle cx="32" cy="41" r="4" fill={secondaryColor} />
          <path d="M32 45v6" {...soft} />
        </>
      );
    case "shield":
      return (
        <>
          <path d="M32 6c8 6 15 8 23 9v15c0 14-8 23-23 29C17 53 9 44 9 30V15c8-1 15-3 23-9z" {...line} />
          <path d="m20 32 8 8 17-18" {...soft} />
        </>
      );
    default:
      return (
        <>
          <circle cx="32" cy="32" r="23" {...line} />
          <path d="M25 24c1-6 13-7 15 0 2 8-8 8-8 15M32 49h.1" {...soft} />
        </>
      );
  }
};

export const IconGlyph: React.FC<IconGlyphProps> = ({
  id,
  color = "#F8FAFC",
  secondaryColor = "#38BDF8",
  progress = 1,
  strokeWidth = 3.5,
}) => {
  const reveal = clamp01(progress);
  const scale = 0.86 + reveal * 0.14;

  return (
    <g
      opacity={reveal}
      transform={`translate(32 32) scale(${scale}) translate(-32 -32)`}
    >
      {renderGlyph(id, color, secondaryColor, strokeWidth)}
    </g>
  );
};

export const MotionIcon: React.FC<MotionIconProps> = ({
  id,
  color = "#F8FAFC",
  secondaryColor = "#38BDF8",
  progress = 1,
  strokeWidth = 3.5,
  title,
  style,
}) => {
  return (
    <svg
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      style={{overflow: "visible", ...style}}
    >
      {title ? <title>{title}</title> : null}
      <IconGlyph
        id={id}
        color={color}
        secondaryColor={secondaryColor}
        progress={progress}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
};
