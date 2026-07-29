/**
 * Patrón de catálogo `text.kinetic-phrase` — frase cinética transformativa.
 *
 * ANM-E04 — Estaba `planned` y el plan lo elegía en una escena. El patrón
 * rechaza explícitamente «hacer aparecer palabras»: lo que comunica es la
 * **transformación**. Por eso este componente no revela una frase y para, sino
 * que la tacha y la sustituye por su resolución. Sin `resolution` no hay
 * transformación que contar y el contrato lo impide.
 */
import {zColor} from "@remotion/zod-types";
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {z} from "zod";
import {FINANCE_FONT_FAMILY} from "./fonts";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const ease = (frame: number, fps: number, from: number, to: number) =>
  interpolate(frame, [from * fps, to * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const kineticPhraseSchema = z.object({
  /** La frase de partida: el patrón la exige de ocho palabras o menos. */
  phrase: z.string().min(1).refine(
    (value) => value.trim().split(/\s+/).length <= 8,
    "la frase cinética admite ocho palabras como máximo",
  ),
  /** Aquello en lo que la frase se convierte. Es el mensaje del patrón. */
  resolution: z.string().min(1),
  accentColor: zColor(),
});

export type KineticPhraseProps = z.infer<typeof kineticPhraseSchema>;

export const KineticPhrase: React.FC<KineticPhraseProps> = ({
  phrase,
  resolution,
  accentColor,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const seconds = durationInFrames / fps;
  const words = phrase.toUpperCase().trim().split(/\s+/);
  // La transformación ocupa el tercio central: antes se lee la frase, después
  // se lee su resolución. Un corte seco no se leería.
  const strikeStart = Math.max(1.2, seconds * 0.42);
  const strike = ease(frame, fps, strikeStart, strikeStart + 0.6);
  const swap = ease(frame, fps, strikeStart + 0.5, strikeStart + 1.15);
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: 26,
        height: "100%",
        justifyContent: "center",
        padding: "140px 120px 40px",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
          opacity: 1 - swap * 0.72,
          position: "relative",
          transform: `scale(${1 - swap * 0.12})`,
        }}
      >
        {words.map((word, index) => {
          const enter = ease(
            frame,
            fps,
            0.3 + index * 0.24,
            0.9 + index * 0.24,
          );
          return (
            <div
              key={`${word}-${index}`}
              style={{
                color: index === words.length - 1 ? accentColor : "#FFF9E8",
                fontFamily: FINANCE_FONT_FAMILY,
                fontSize: 92 + (index % 2) * 18,
                fontWeight: 900,
                letterSpacing: -3,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 28}px)`,
              }}
            >
              {word}
            </div>
          );
        })}
        <div
          style={{
            background: accentColor,
            height: 8,
            left: 0,
            position: "absolute",
            top: "52%",
            width: `${strike * 100}%`,
          }}
        />
      </div>
      <div
        style={{
          color: "#FFF9E8",
          fontFamily: FINANCE_FONT_FAMILY,
          fontSize: 40,
          fontWeight: 720,
          lineHeight: 1.2,
          maxWidth: 1320,
          opacity: swap,
          textAlign: "center",
          transform: `translateY(${(1 - swap) * 26}px)`,
        }}
      >
        {resolution}
      </div>
    </div>
  );
};

export const kineticPhraseDemoProps: KineticPhraseProps = {
  phrase: "El crédito como termómetro",
  resolution:
    "Porcentaje neto de bancos que endurecen estándares C&I.",
  accentColor: "#FFC83D",
};
