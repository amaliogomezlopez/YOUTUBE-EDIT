/**
 * Patrón de catálogo `process.contagion-spread` — propagación radial por estados.
 *
 * ANM-E03 — Vivía dentro de `editorial/ThirdMinuteNarrativeScene.tsx` y el
 * catálogo lo declaraba con `compositionId: "Finance-Cavaliers-Episode"`, que no
 * es una composición genérica sino el episodio entero. Aquí queda como patrón
 * reutilizable: sin `EditorialScene`, sin nombres de empresa escritos a mano y
 * con su propia composición registrada.
 *
 * La propagación no se deriva del frame: la recibe en `spread`. Quien llama
 * decide si esa cifra sale de un cue anclado a palabra (episodio) o del reloj de
 * la composición (demo del catálogo).
 */
import {zColor} from "@remotion/zod-types";
import {Img, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {z} from "zod";
import {DATA_FONT_FAMILY, FINANCE_FONT_FAMILY} from "./fonts";

import {EDITORIAL_COLORS as C} from "../editorial/palette";

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)},${Number.parseInt(
    value.slice(2, 4),
    16,
  )},${Number.parseInt(value.slice(4, 6), 16)},${opacity})`;
};

export const contagionSourceSchema = z.object({
  label: z.string(),
  logoPath: z.string().optional(),
  /** Cuánto destaca esta tarjeta de origen (0–1). El resto se atenúa. */
  focus: z.number().min(0).max(1).default(0),
  /** Progreso de entrada de la tarjeta (0–1). */
  reveal: z.number().min(0).max(1).default(1),
});

export const contagionSpreadSchema = z.object({
  /** Origen del deterioro: entre 3 y 8 destinos que cambian de estado. */
  targets: z.array(z.string()).min(3).max(8),
  sources: z.array(contagionSourceSchema).max(6).default([]),
  /** Progreso de la propagación desde el núcleo (0–1). */
  spread: z.number().min(0).max(1),
  /** 0 = solo el origen está afectado; >0 = el conjunto completo lo está. */
  reach: z.number().min(0).max(1).default(0),
  spreadLabel: z.string(),
  reachLabel: z.string(),
  showLabel: z.boolean().default(true),
  compactSources: z.boolean().default(true),
  sourcesTop: z.number().default(225),
  accentColor: zColor().default(C.red),
});

export type ContagionSpreadProps = z.infer<typeof contagionSpreadSchema>;

const SourceCards: React.FC<
  Pick<ContagionSpreadProps, "sources" | "compactSources" | "sourcesTop">
> = ({sources, compactSources, sourcesTop}) => {
  if (!sources.length) return null;
  const anyFocus = Math.max(0, ...sources.map((source) => source.focus));
  return (
    <div
      style={{
        display: "flex",
        gap: compactSources ? 24 : 42,
        justifyContent: "center",
        left: 150,
        position: "absolute",
        right: 150,
        top: sourcesTop,
      }}
    >
      {sources.map((source) => {
        const {focus, reveal} = source;
        return (
          <div
            key={source.label}
            style={{
              alignItems: "center",
              background: `linear-gradient(150deg,${alpha(C.panel, 0.98)},${alpha(C.bg, 0.95)})`,
              border: `2px solid ${alpha(focus > 0.05 ? C.cyan : C.white, 0.18 + focus * 0.8)}`,
              borderRadius: 20,
              boxShadow: `0 0 ${20 + focus * 55}px ${alpha(C.cyan, focus * 0.42)}`,
              display: "flex",
              flexDirection: "column",
              height: compactSources ? 130 : 190,
              justifyContent: "center",
              opacity: reveal * (anyFocus > 0.08 ? 0.4 + focus * 0.6 : 1),
              transform: `translateY(${(1 - reveal) * 34 - focus * 20}px) scale(${0.9 + reveal * 0.1 + focus * 0.16})`,
              width: compactSources ? 170 : 250,
            }}
          >
            {source.logoPath ? (
              <Img
                src={staticFile(source.logoPath)}
                style={{
                  height: compactSources ? 58 : 88,
                  objectFit: "contain",
                  width: compactSources ? 92 : 136,
                }}
              />
            ) : null}
            <div
              style={{
                color: C.white,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: compactSources ? 14 : 19,
                fontWeight: 800,
                marginTop: 12,
              }}
            >
              {source.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const ContagionSpread: React.FC<ContagionSpreadProps> = ({
  targets,
  sources,
  spread,
  reach,
  spreadLabel,
  reachLabel,
  showLabel,
  compactSources,
  sourcesTop,
}) => {
  const frame = useCurrentFrame();
  const coreX = 960;
  const coreY = 540;
  const coreRadius = 104;
  return (
    <>
      <SourceCards
        compactSources={compactSources}
        sources={sources}
        sourcesTop={sourcesTop}
      />
      <svg height="100%" viewBox="0 0 1920 1080" width="100%">
        {targets.map((label, index) => {
          const angle = (Math.PI * 2 * index) / targets.length;
          const baseX = 960 + Math.cos(angle) * 560;
          const baseY = 720 + Math.sin(angle) * 155;
          const infected = Math.max(0, Math.min(1, spread * 1.7 - index * 0.12));
          const drift = infected * 22;
          const x = baseX + Math.cos(angle) * drift;
          const y = baseY + Math.sin(angle) * drift;
          const dx = x - coreX;
          const dy = y - coreY;
          const length = Math.max(1, Math.hypot(dx, dy));
          const unitX = dx / length;
          const unitY = dy / length;
          const startX = coreX + unitX * coreRadius;
          const startY = coreY + unitY * coreRadius;
          // ANM-F/FC-R-071 — El conector muere en el borde de la tarjeta, no la
          // atraviesa: se recorta la recta contra el rectángulo del destino.
          const rectangleFactor = Math.min(
            105 / Math.max(0.001, Math.abs(dx)),
            41 / Math.max(0.001, Math.abs(dy)),
          );
          const endX = x - dx * rectangleFactor;
          const endY = y - dy * rectangleFactor;
          const shake =
            infected > 0.15
              ? Math.sin(frame * 0.72 + index * 1.9) * infected * 4
              : 0;
          return (
            <g key={label}>
              <line
                stroke={alpha(C.red, 0.22 + infected * 0.72)}
                strokeDasharray={`${8 + infected * 8} 10`}
                strokeDashoffset={-frame * infected * 0.8}
                strokeWidth={3 + infected * 2.5}
                x1={startX}
                x2={endX}
                y1={startY}
                y2={endY}
              />
              <g transform={`translate(${shake} 0)`}>
                <rect
                  fill={
                    infected > 0.2
                      ? alpha(C.red, 0.16 + infected * 0.2)
                      : alpha(C.panel, 0.95)
                  }
                  height="82"
                  rx="12"
                  stroke={infected > 0.2 ? C.red : alpha(C.white, 0.16)}
                  strokeWidth={infected > 0.2 ? 3 : 2}
                  width="210"
                  x={x - 105}
                  y={y - 41}
                />
                <text
                  fill={infected > 0.2 ? C.white : C.muted}
                  fontFamily={DATA_FONT_FAMILY}
                  fontSize="17"
                  fontWeight="800"
                  textAnchor="middle"
                  x={x}
                  y={y + 6}
                >
                  {label}
                </text>
                {infected > 0.12 ? (
                  <g
                    transform={`translate(${x + 86} ${y - 31}) scale(${0.7 + infected * 0.3})`}
                  >
                    <circle fill={C.red} r="18" />
                    <text
                      fill={C.white}
                      fontFamily={DATA_FONT_FAMILY}
                      fontSize="23"
                      fontWeight="900"
                      textAnchor="middle"
                      x="0"
                      y="8"
                    >
                      !
                    </text>
                  </g>
                ) : null}
              </g>
            </g>
          );
        })}
        {[0, 1, 2].map((ring) => {
          const phase = Math.max(0, Math.min(1, spread * 1.45 - ring * 0.2));
          return (
            <circle
              key={ring}
              cx={coreX}
              cy={coreY}
              fill="none"
              opacity={(1 - phase) * 0.7}
              r={coreRadius + phase * (210 + ring * 105)}
              stroke={C.red}
              strokeWidth={4 - ring * 0.7}
            />
          );
        })}
        <circle
          cx={coreX}
          cy={coreY}
          fill={alpha(C.red, 0.16 + spread * 0.18)}
          r={coreRadius}
          stroke={C.red}
          strokeWidth="4"
        />
        <circle cx={coreX} cy={coreY} fill={C.red} opacity={spread} r={9 + spread * 5} />
      </svg>
      {showLabel ? (
        <ContagionStateLabel
          reach={reach}
          reachLabel={reachLabel}
          spreadLabel={spreadLabel}
        />
      ) : null}
    </>
  );
};

/**
 * El rótulo de estado se expone aparte porque no debe entrar en el grupo que
 * la cámara escala: un rótulo que crece con el zoom deja de ser legible.
 */
export const ContagionStateLabel: React.FC<
  Pick<ContagionSpreadProps, "spreadLabel" | "reachLabel" | "reach">
> = ({spreadLabel, reachLabel, reach}) => (
  <div
    style={{
      background: alpha(C.bg, 0.96),
      border: `2px solid ${alpha(C.red, 0.78)}`,
      borderRadius: 12,
      boxShadow: `0 0 24px ${alpha(C.red, 0.22)}`,
      color: C.white,
      fontFamily: FINANCE_FONT_FAMILY,
      fontSize: 28,
      fontWeight: 900,
      left: "50%",
      padding: "8px 20px 7px",
      position: "absolute",
      top: 372,
      transform: "translateX(-50%)",
      zIndex: 7,
    }}
  >
    {reach > 0.05 ? reachLabel : spreadLabel}
  </div>
);

/**
 * Demo de catálogo: la propagación la marca el reloj de la composición, no un
 * cue del episodio. Sirve para el still de QA y para revisar el patrón aislado.
 */
export const contagionSpreadDemoProps: ContagionSpreadProps = {
  targets: ["FINANZAS", "INDUSTRIA", "CONSUMO", "SALUD", "ENERGÍA", "MERCADO"],
  sources: [
    {label: "ORIGEN A", focus: 0, reveal: 1},
    {label: "ORIGEN B", focus: 0, reveal: 1},
    {label: "ORIGEN C", focus: 0, reveal: 1},
  ],
  spread: 0,
  reach: 0,
  spreadLabel: "PROPAGACIÓN",
  reachLabel: "ALCANCE COMPLETO",
  showLabel: true,
  compactSources: true,
  sourcesTop: 225,
  accentColor: C.red,
};

export const ContagionSpreadDemo: React.FC<ContagionSpreadProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const span = Math.max(1, durationInFrames - fps * 1.2);
  const spread = Math.min(1, Math.max(0, (frame - fps * 0.6) / span));
  return (
    <ContagionSpread
      {...props}
      reach={spread > 0.82 ? 1 : 0}
      spread={spread}
    />
  );
};
