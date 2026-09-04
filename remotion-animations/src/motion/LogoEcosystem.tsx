/**
 * Patrón de catálogo `asset.logo-ecosystem` — ecosistema de logos.
 *
 * ANM-E04 — El patrón estaba `planned` y sin implementación, pero el plan del
 * episodio 1 lo elegía en dos escenas: eran las únicas cuyo patrón no podía
 * renderizarse por catálogo. Se implementa en vez de reasignar el binding
 * porque describe exactamente esto —un núcleo y actores identificados a su
 * alrededor— y ningún patrón `ready` dice lo mismo: `data.part-to-whole`
 * obligaría a inventar una proporción y `process.signal-flow` una cadena
 * causal que la escena no afirma.
 */
import {zColor} from "@remotion/zod-types";
import {Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {z} from "zod";
import {FINANCE_FONT_FAMILY} from "./fonts";

import {EDITORIAL_COLORS as C} from "../editorial/palette";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const alpha = (hex: string, opacity: number) => {
  const value = hex.replace("#", "");
  return `rgba(${Number.parseInt(value.slice(0, 2), 16)}, ${Number.parseInt(
    value.slice(2, 4),
    16,
  )}, ${Number.parseInt(value.slice(4, 6), 16)}, ${opacity})`;
};

const reveal = (frame: number, fps: number, from: number, to: number) =>
  interpolate(frame, [from * fps, to * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const logoEcosystemParticipantSchema = z.object({
  label: z.string().min(1),
  /** Ruta local del logo. Sin logo se imprime la inicial: nunca se resuelve por red. */
  logoPath: z.string().optional(),
});

export const logoEcosystemSchema = z.object({
  /** Los participantes son la evidencia: sin al menos dos no hay ecosistema. */
  participants: z.array(logoEcosystemParticipantSchema).min(2).max(8),
  coreLogoPath: z.string().min(1),
  coreLabel: z.string().default(""),
  accentColor: zColor(),
});

export type LogoEcosystemProps = z.infer<typeof logoEcosystemSchema>;

export const LogoEcosystem: React.FC<LogoEcosystemProps> = ({
  participants,
  coreLogoPath,
  coreLabel,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const orbit = (frame / fps) * 0.17;
  const radiusX = 620;
  const radiusY = 300;
  return (
    <div style={{height: "100%", position: "relative", width: "100%"}}>
      <div
        style={{
          alignItems: "center",
          background: alpha(C.surfaceRaised, 0.9),
          border: `2px solid ${alpha(accentColor, 0.55)}`,
          borderRadius: "50%",
          boxShadow: `0 0 80px ${alpha(accentColor, 0.14)}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          height: 260,
          justifyContent: "center",
          left: "50%",
          position: "absolute",
          top: "54%",
          transform: "translate(-50%, -50%)",
          width: 260,
        }}
      >
        <Img
          src={staticFile(coreLogoPath)}
          style={{
            borderRadius: "50%",
            height: 178,
            mixBlendMode: "screen",
            objectFit: "contain",
            width: 178,
          }}
        />
        {coreLabel ? (
          <span
            style={{
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 1.1,
            }}
          >
            {coreLabel}
          </span>
        ) : null}
      </div>
      {participants.map((participant, index) => {
        const angle =
          (index / participants.length) * Math.PI * 2 - Math.PI / 2 + orbit;
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;
        const enter = reveal(frame, fps, 0.2 + index * 0.16, 0.8 + index * 0.16);
        return (
          <div
            key={`${participant.label}-${index}`}
            style={{
              background: alpha(C.surface, 0.94),
              border: `1px solid ${alpha(accentColor, 0.42)}`,
              borderRadius: 10,
              color: C.white,
              fontFamily: FINANCE_FONT_FAMILY,
              fontSize: 18,
              fontWeight: 700,
              left: `calc(50% + ${x}px)`,
              opacity: enter,
              padding: "15px 22px",
              position: "absolute",
              top: `calc(54% + ${y}px)`,
              transform: `translate(-50%, -50%) scale(${0.82 + enter * 0.18})`,
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {participant.logoPath ? (
                <Img
                  src={staticFile(participant.logoPath)}
                  style={{height: 42, objectFit: "contain", width: 42}}
                />
              ) : (
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    fontSize: 18,
                    fontWeight: 900,
                    height: 42,
                    justifyContent: "center",
                    width: 42,
                  }}
                >
                  {participant.label.slice(0, 1)}
                </div>
              )}
              <span>{participant.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const logoEcosystemDemoProps: LogoEcosystemProps = {
  participants: [
    {label: "ACTOR A"},
    {label: "ACTOR B"},
    {label: "ACTOR C"},
    {label: "ACTOR D"},
    {label: "ACTOR E"},
  ],
  coreLogoPath: "assets/library/finance-cavaliers/episodes/1/logo-primary.png",
  coreLabel: "NÚCLEO",
  accentColor: "#FFC83D",
};
