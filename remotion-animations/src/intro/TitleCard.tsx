import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {INTRO_LAYOUT} from "./layout";
import {IntroVideoProps} from "./schemas";

/**
 * Titular de la intro.
 *
 * Entra por palabras con desfase: es el unico texto grande de la pieza y aparecer
 * de golpe lo deja sin ritmo, mientras que letra a letra tarda demasiado para los
 * 8-20 s que dura una intro.
 *
 * Se ancla a la banda de titulo de `geometry.json`, que ya esta por encima de la
 * zona del reproductor: el titular es justo lo que no se puede quedar debajo de la
 * barra de progreso.
 */
export const TitleCard: React.FC<{
  title: NonNullable<IntroVideoProps["titleCard"]>;
  theme: MotionTheme;
  accent: string;
}> = ({title, theme, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const band = INTRO_LAYOUT.titleBand;
  const words = title.text.split(/\s+/).filter(Boolean);
  const exit = interpolate(
    frame,
    [title.durationInFrames - 14, title.durationInFrames - 1],
    [1, 0],
    {...clamp, easing: Easing.in(Easing.cubic)},
  );

  return (
    <div
      style={{
        position: "absolute",
        left: band.left,
        top: band.top,
        width: band.width,
        height: band.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 18,
        opacity: exit,
      }}
    >
      {title.kicker ? (
        <div
          style={{
            alignSelf: "flex-start",
            padding: "10px 24px",
            borderRadius: 999,
            background: rgba(accent, 0.18),
            border: `2px solid ${rgba(accent, 0.55)}`,
            fontFamily: MOTION_FONT_FAMILY,
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: 2.6,
            textTransform: "uppercase",
            color: theme.ink,
            opacity: spring({frame, fps, config: {damping: 18, mass: 0.5, stiffness: 130}}),
          }}
        >
          {title.kicker}
        </div>
      ) : null}
      <div style={{display: "flex", flexWrap: "wrap", gap: "0 22px"}}>
        {words.map((word, index) => {
          const entry = spring({
            frame: frame - index * 3,
            fps,
            config: {damping: 15, mass: 0.5, stiffness: 150},
          });
          return (
            <span
              key={`${word}-${index}`}
              style={{
                fontFamily: MOTION_FONT_FAMILY,
                fontWeight: 900,
                fontSize: 108,
                lineHeight: 1.04,
                letterSpacing: -1.5,
                color: theme.ink,
                textShadow: `0 18px 48px ${rgba("#000000", 0.6)}`,
                opacity: entry,
                transform: `translateY(${interpolate(entry, [0, 1], [46, 0])}px)`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
      <div
        style={{
          height: 8,
          width: `${interpolate(
            spring({frame: frame - words.length * 3, fps, config: {damping: 20, mass: 0.6, stiffness: 110}}),
            [0, 1],
            [0, 42],
          )}%`,
          background: accent,
          borderRadius: 4,
        }}
      />
    </div>
  );
};
