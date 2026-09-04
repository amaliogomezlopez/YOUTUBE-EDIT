import React from "react";
import {IconGlyph} from "../icons/MotionIcon";

export type EditorialDoodleProps = {
  id: string;
  progress?: number;
  color?: string;
  accentColor?: string;
  mutedColor?: string;
  showLabel?: boolean;
  style?: React.CSSProperties;
};

type NodeSpec = {
  icon: string;
  x: number;
  y: number;
  scale?: number;
};

type EdgeSpec = {
  from: number;
  to: number;
  dashed?: boolean;
  blocked?: boolean;
};

type DrawingLayout = {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  label: string;
};

const layouts: Record<string, DrawingLayout> = {
  "memory-repositories": {
    label: "La memoria no viaja entre repositorios",
    nodes: [
      {icon: "repository", x: 57, y: 78},
      {icon: "memory", x: 160, y: 110, scale: 1.15},
      {icon: "repository", x: 263, y: 78},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2, dashed: true, blocked: true},
    ],
  },
  "context-window": {
    label: "La ventana de contexto se llena",
    nodes: [
      {icon: "prompt", x: 52, y: 110},
      {icon: "context", x: 160, y: 110, scale: 1.2},
      {icon: "prompt", x: 268, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "token-stream": {
    label: "Los tokens recorren el modelo",
    nodes: [
      {icon: "input", x: 50, y: 110},
      {icon: "tokens", x: 142, y: 110},
      {icon: "model", x: 242, y: 110, scale: 1.15},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "agent-workspace": {
    label: "El agente activa su espacio de trabajo",
    nodes: [
      {icon: "agent", x: 72, y: 110, scale: 1.15},
      {icon: "tool", x: 176, y: 66},
      {icon: "terminal", x: 246, y: 146},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 0, to: 2},
      {from: 1, to: 2},
    ],
  },
  "tool-stack": {
    label: "Las herramientas se apilan en el contexto",
    nodes: [
      {icon: "tool", x: 78, y: 55},
      {icon: "file", x: 78, y: 110},
      {icon: "context", x: 218, y: 110, scale: 1.22},
    ],
    edges: [
      {from: 0, to: 2},
      {from: 1, to: 2},
    ],
  },
  "server-cloud": {
    label: "El servidor despliega en la nube",
    nodes: [
      {icon: "server", x: 64, y: 110},
      {icon: "upload", x: 160, y: 110},
      {icon: "cloud", x: 260, y: 110, scale: 1.1},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  pipeline: {
    label: "La información recorre el pipeline",
    nodes: [
      {icon: "input", x: 50, y: 110},
      {icon: "tool", x: 160, y: 110},
      {icon: "output", x: 270, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "filter-compress": {
    label: "El filtro comprime la cola",
    nodes: [
      {icon: "queue", x: 54, y: 110},
      {icon: "filter", x: 154, y: 110, scale: 1.15},
      {icon: "output", x: 258, y: 110, scale: 0.85},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "branch-merge": {
    label: "El trabajo se divide y vuelve a reunirse",
    nodes: [
      {icon: "branch", x: 55, y: 110},
      {icon: "agent", x: 160, y: 55},
      {icon: "agent", x: 160, y: 165},
      {icon: "merge", x: 265, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 0, to: 2},
      {from: 1, to: 3},
      {from: 2, to: 3},
    ],
  },
  bottleneck: {
    label: "La cola se acumula ante el límite",
    nodes: [
      {icon: "queue", x: 55, y: 110},
      {icon: "limit", x: 160, y: 110, scale: 1.18},
      {icon: "output", x: 265, y: 110, scale: 0.82},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2, dashed: true},
    ],
  },
  "review-loop": {
    label: "La revisión vuelve sobre la edición",
    nodes: [
      {icon: "prompt", x: 72, y: 112},
      {icon: "edit", x: 178, y: 70},
      {icon: "loop", x: 240, y: 150},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
      {from: 2, to: 0, dashed: true},
    ],
  },
  "off-peak": {
    label: "El coste cambia fuera de las horas punta",
    nodes: [
      {icon: "clock", x: 55, y: 110},
      {icon: "limit", x: 160, y: 110},
      {icon: "cost", x: 265, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "credit-cycle": {
    label: "El crédito recorre banco, préstamo y hogar",
    nodes: [
      {icon: "bank", x: 54, y: 110},
      {icon: "credit", x: 160, y: 110, scale: 1.12},
      {icon: "household", x: 266, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "market-concentration": {
    label: "El peso se concentra en unos pocos nombres",
    nodes: [
      {icon: "chart", x: 58, y: 110},
      {icon: "balance", x: 160, y: 110, scale: 1.15},
      {icon: "risk", x: 262, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "contagion-path": {
    label: "El shock se propaga de un sector al resto",
    nodes: [
      {icon: "factory", x: 58, y: 70},
      {icon: "contagion", x: 160, y: 110, scale: 1.2},
      {icon: "chart", x: 262, y: 150},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
  "bubble-earnings": {
    label: "El precio se hincha; los beneficios sostienen o no",
    nodes: [
      {icon: "bubble", x: 58, y: 110, scale: 1.12},
      {icon: "chart", x: 160, y: 110},
      {icon: "shield", x: 262, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2, dashed: true},
    ],
  },
  "rate-channel": {
    label: "Los tipos se transmiten al crédito y al empleo",
    nodes: [
      {icon: "inflation", x: 54, y: 110},
      {icon: "credit", x: 160, y: 110, scale: 1.1},
      {icon: "employment", x: 266, y: 110},
    ],
    edges: [
      {from: 0, to: 1},
      {from: 1, to: 2},
    ],
  },
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const nodeProgress = (progress: number, index: number, total: number) =>
  clamp01(progress * 1.55 - (index / Math.max(1, total)) * 0.45);

const edgePath = (from: NodeSpec, to: NodeSpec) => {
  const direction = to.x >= from.x ? 1 : -1;
  const startX = from.x + 31 * direction;
  const endX = to.x - 31 * direction;
  const bend = Math.abs(to.y - from.y) > 20 ? (from.y + to.y) / 2 : from.y;
  return `M ${startX} ${from.y} Q ${(startX + endX) / 2} ${bend} ${endX} ${to.y}`;
};

export const EditorialDoodle: React.FC<EditorialDoodleProps> = ({
  id,
  progress = 1,
  color = "#F8FAFC",
  accentColor = "#38BDF8",
  mutedColor = "#1E789F",
  showLabel = false,
  style,
}) => {
  const safeProgress = clamp01(progress);
  const layout = layouts[id] ?? {
    label: "Recurso visual pendiente",
    nodes: [{icon: "unknown", x: 160, y: 110}],
    edges: [],
  };

  return (
    <svg
      viewBox="0 0 320 220"
      role="img"
      aria-label={layout.label}
      style={{overflow: "visible", ...style}}
    >
      <defs>
        <filter id={`soft-glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {layout.edges.map((edge, index) => {
        const from = layout.nodes[edge.from];
        const to = layout.nodes[edge.to];
        const edgeReveal = clamp01(safeProgress * 1.45 - 0.16 - index * 0.08);
        const dashLength = 240;
        const path = edgePath(from, to);
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowX = to.x - Math.cos(angle) * 35;
        const arrowY = to.y - Math.sin(angle) * 35;

        return (
          <g key={`${edge.from}-${edge.to}-${index}`}>
            <path
              d={path}
              fill="none"
              stroke={edge.blocked ? "#FB7185" : mutedColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={edge.dashed ? "9 9" : `${dashLength} ${dashLength}`}
              strokeDashoffset={edge.dashed ? 0 : dashLength * (1 - edgeReveal)}
              opacity={0.2 + edgeReveal * 0.8}
            />
            <path
              d={`M ${arrowX - 9} ${arrowY - 6} L ${arrowX} ${arrowY} L ${arrowX - 9} ${arrowY + 6}`}
              fill="none"
              stroke={edge.blocked ? "#FB7185" : accentColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={edgeReveal}
              transform={`rotate(${(angle * 180) / Math.PI} ${arrowX} ${arrowY})`}
            />
            {edge.blocked ? (
              <g opacity={edgeReveal} transform={`translate(${arrowX - 1} ${arrowY})`}>
                <circle r="14" fill="#071421" stroke="#FB7185" strokeWidth="3" />
                <path d="M-5-5 5 5M5-5-5 5" stroke="#FB7185" strokeWidth="3" strokeLinecap="round" />
              </g>
            ) : null}
          </g>
        );
      })}

      {layout.nodes.map((node, index) => {
        const reveal = nodeProgress(safeProgress, index, layout.nodes.length);
        const baseScale = node.scale ?? 1;
        const scale = baseScale * (0.8 + reveal * 0.2);

        return (
          <g
            key={`${node.icon}-${index}`}
            opacity={reveal}
            transform={`translate(${node.x} ${node.y}) scale(${scale})`}
          >
            <circle
              r="34"
              fill={accentColor}
              opacity={0.12 * reveal}
              filter={`url(#soft-glow-${id})`}
            />
            <circle r="34" fill="#081827" stroke={mutedColor} strokeWidth="2" />
            <g transform="translate(-32 -32)">
              <IconGlyph
                id={node.icon}
                color={color}
                secondaryColor={accentColor}
                progress={reveal}
                strokeWidth={3}
              />
            </g>
          </g>
        );
      })}

      {showLabel ? (
        <text
          x="160"
          y="210"
          fill={color}
          opacity={safeProgress}
          fontFamily="Schibsted Grotesk"
          fontSize="13"
          fontWeight="700"
          textAnchor="middle"
        >
          {layout.label}
        </text>
      ) : null}
    </svg>
  );
};
