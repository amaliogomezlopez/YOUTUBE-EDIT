import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {clamp, rgba} from "../motion/Toolkit";
import {INTRO_LAYOUT} from "./layout";
import {IntroVideoProps} from "./schemas";
import {IntroTextStyle} from "./textStyle";
import {TypeReveal} from "./TypeReveal";

/**
 * Titular de la intro.
 *
 * Se revela con los mismos tokens que las palabras clave (fuente, revelado, acento),
 * con la ultima palabra resaltada: un solo sistema tipografico en toda la pieza. El
 * estilo puede darle al titular su propia familia (`title.family`). El
 * revelado esta acotado en duracion, asi que no se come el golpe que lo acompana.
 *
 * Se ancla a la banda de titulo de `geometry.json`, que ya esta por encima de la
 * zona del reproductor: el titular es justo lo que no se puede quedar debajo de la
 * barra de progreso.
 */
export const TitleCard: React.FC<{
  title: NonNullable<IntroVideoProps["titleCard"]>;
  theme: MotionTheme;
  accent: string;
  textStyle: IntroTextStyle;
}> = ({title, theme, accent, textStyle}) => {
  const display = textStyle.display;
  const family = textStyle.title?.family ?? display.family;
  const ownFamily = family !== display.family;
  const size = textStyle.sizes.title;
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
            fontFamily: textStyle.label.family,
            fontWeight: textStyle.label.weight,
            fontSize: textStyle.sizes.kicker,
            letterSpacing: textStyle.sizes.kicker * textStyle.label.letterSpacingEm,
            textTransform: textStyle.label.uppercase ? "uppercase" : undefined,
            color: accent,
            textShadow: `0 2px 18px ${rgba("#000000", 0.7)}`,
            opacity: spring({frame, fps, config: {damping: 18, mass: 0.5, stiffness: 130}}),
          }}
        >
          {title.kicker}
        </div>
      ) : null}
      <TypeReveal
        accent={accent}
        accentMode={textStyle.color.accentMode}
        fontFamily={family}
        fontSize={size}
        fontVariationSettings={ownFamily ? undefined : display.variation ?? undefined}
        fontWeight={ownFamily ? 400 : display.weight}
        frame={frame}
        highlight={words.length > 1 ? [words.length - 1] : []}
        ink={theme.ink}
        italic={!ownFamily && textStyle.highlight.italic}
        letterSpacing={size * display.letterSpacingEm}
        lineHeight={display.lineHeight}
        reveal={textStyle.reveal}
        text={title.text}
        uppercase={textStyle.title?.uppercase ?? display.uppercase}
      />
      <div
        style={{
          height: 4,
          width: `${interpolate(
            spring({frame: frame - 30, fps, config: {damping: 20, mass: 0.6, stiffness: 110}}),
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
