import {Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {IntroDepth, IntroTone, toneColor} from "./layout";
import {IntroCue} from "./schemas";
import {IntroTextStyle} from "./textStyle";
import {TypeReveal} from "./TypeReveal";

/** Cues que son solo texto: entran escribiendose, sin zoom ni caja. */
const TEXT_CUES = new Set(["keyword", "stat", "chip", "label", "list"]);

type CuePalette = {theme: MotionTheme; accent: string; danger: string; text: IntroTextStyle};

/**
 * Capa de arte de una escena, filtrada por profundidad.
 *
 * Se dibuja dos veces por escena: una antes del sujeto con los cues `back` y otra
 * despues con los `front`. Asi el orden de pintado sale de un dato del plan
 * (`depth`) y no del orden del array, que es lo que hace que un logo "salga por
 * detras" de forma reproducible.
 */
export const IntroCueLayer: React.FC<{
  cues: IntroCue[];
  depth: IntroDepth;
  palette: CuePalette;
}> = ({cues, depth, palette}) => (
  <>
    {cues
      .filter((cue) => cue.depth === depth)
      .map((cue) => (
        <Sequence
          durationInFrames={cue.durationInFrames}
          from={cue.fromFrame}
          key={cue.id}
          layout="none"
          name={`${depth}:${cue.type}:${cue.slot ?? "center"}`}
        >
          <Cue cue={cue} palette={palette} />
        </Sequence>
      ))}
  </>
);

const Cue: React.FC<{cue: IntroCue; palette: CuePalette}> = ({cue, palette}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const color = toneColor(cue.tone as IntroTone, palette.theme, palette.accent, palette.danger);

  // Entrada con muelle y zoom: el rebote corto es lo que hace que el logo "golpee"
  // a la vez que su efecto de sonido en lugar de aparecer sin peso. Un cue de fondo
  // entra mas lento y desde mas lejos, que es como se lee la profundidad.
  const entry = spring({
    frame,
    fps,
    config: cue.depth === "back"
      ? {damping: 22, mass: 0.9, stiffness: 90}
      : {damping: 14, mass: 0.5, stiffness: 150},
  });
  const exit = interpolate(
    frame,
    [cue.durationInFrames - 10, cue.durationInFrames - 1],
    [1, 0],
    {...clamp, easing: Easing.in(Easing.cubic)},
  );
  const opacity = Math.min(entry, exit) * (cue.depth === "back" ? 0.85 : 1);
  const zoomFrom = cue.depth === "back" ? 0.5 : 0.66;
  const scale = cue.scale * interpolate(entry, [0, 1], [zoomFrom, 1]);

  if (cue.type === "list") {
    return <ListCue cue={cue} exit={exit} frame={frame} palette={palette} />;
  }
  if (TEXT_CUES.has(cue.type)) {
    return <TextCue color={color} cue={cue} exit={exit} frame={frame} palette={palette} />;
  }

  const shared: React.CSSProperties = {
    position: "absolute",
    left: cue.rect.left,
    top: cue.rect.top,
    width: cue.rect.width,
    height: cue.rect.height,
    opacity,
    filter: cue.blurPx > 0 ? `blur(${cue.blurPx}px)` : undefined,
    transform: `scale(${scale})`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  switch (cue.type) {
    case "logo":
    case "brand":
      return <ArtCue color={color} cue={cue} entry={entry} palette={palette} style={shared} />;
    case "screenshot":
      return <ScreenshotCue cue={cue} palette={palette} style={shared} />;
    default:
      return null;
  }
};

const ArtCue: React.FC<{
  cue: IntroCue;
  color: string;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, entry, palette, style}) => {
  const blend = cue.presentation === "blend";
  const framed = cue.presentation !== "plain" && !blend;
  const plate = cue.presentation === "plate";
  const surface = plate ? "#F5F1EA" : palette.theme.surfaceRaised;
  return (
    <div
      style={{
        ...style,
        flexDirection: "column",
        gap: 16,
        // `screen` tiene que ir en el elemento que compone contra el video: este
        // contenedor ya lleva `opacity` y `transform`, que aislan el grupo de mezcla.
        mixBlendMode: blend ? "screen" : undefined,
      }}
    >
      <div
        style={{
          width: framed ? "82%" : "100%",
          maxHeight: cue.text ? "70%" : "100%",
          flex: framed ? undefined : 1,
          minHeight: 0,
          aspectRatio: framed ? "1 / 1" : undefined,
          borderRadius: framed ? 30 : 18,
          background: framed ? surface : "transparent",
          border: framed ? `3px solid ${rgba(color, 0.55)}` : undefined,
          boxShadow: framed
            ? `0 0 0 ${10 * entry}px ${rgba(color, 0.12)}, 0 28px 56px ${rgba("#000000", 0.45)}`
            : `0 0 60px ${rgba(color, 0.32 * entry)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: framed ? 24 : 0,
          overflow: "hidden",
        }}
      >
        {cue.src ? (
          <Img
            src={staticFile(cue.src)}
            style={{maxWidth: "100%", maxHeight: "100%", objectFit: "contain"}}
          />
        ) : null}
      </div>
      {cue.text ? (
        <div
          style={{
            fontFamily: MOTION_FONT_FAMILY,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: 1.4,
            color: palette.theme.ink,
            textAlign: "center",
            lineHeight: 1.1,
            whiteSpace: "pre-line",
          }}
        >
          {cue.text}
        </div>
      ) : null}
    </div>
  );
};

const ScreenshotCue: React.FC<{
  cue: IntroCue;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, palette, style}) => (
  <div style={style}>
    {cue.src ? (
      <Img
        src={staticFile(cue.src)}
        style={{
          // `contain`: una captura es texto y no se puede recortar sin perder el
          // dato que justifica ponerla en pantalla.
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: 18,
          border: `2px solid ${rgba(palette.accent, 0.4)}`,
          boxShadow: `0 30px 64px ${rgba("#000000", 0.5)}`,
        }}
      />
    ) : null}
  </div>
);

/**
 * Texto en pantalla: palabra clave, cifra o etiqueta.
 *
 * Sin rectangulo ni pastilla detras (el usuario los rechazo por genericos). Fuente,
 * tamano, revelado, acento y resalte salen de los tokens del estilo de texto
 * (`text-styles.json`), no del componente. En la franja inferior, un degradado a
 * sangre oscurece la base del plano; una cifra flotante lleva un oscurecido radial
 * sobre el video en vez de la columna lateral.
 */
const TextCue: React.FC<{
  cue: IntroCue;
  color: string;
  exit: number;
  frame: number;
  palette: CuePalette;
}> = ({cue, color, exit, frame, palette}) => {
  const style = palette.text;
  const text = cue.text ?? "";
  const lower = cue.slot === "lower" || cue.slot === "lower-left" || cue.slot === "strip";
  const centered = cue.slot === "lower" && style.keywordAlign === "center";
  const floating = cue.type === "stat" && style.stat.presentation === "floating";
  const muted = cue.tone === "muted";
  const lift = interpolate(exit, [0, 1], [-14, 0]);
  const ink = style.color.ink;
  const accent = cue.tone === "neutral" ? palette.accent : color;
  const noteFade = interpolate(frame, [0, 8], [0, 1], clamp);
  const display = style.display;
  const em = (size: number, value: number) => size * value;
  const revealProps = {
    reveal: style.reveal,
    accentMode: style.color.accentMode,
    underline: style.highlight.underline,
    italic: style.highlight.italic,
  } as const;

  const noteSize = cue.type === "stat" ? style.sizes.statNote : style.sizes.note;
  const note = cue.note ? (
    <div
      style={{
        fontFamily: style.label.family,
        fontWeight: style.label.weight,
        fontSize: noteSize,
        letterSpacing: em(noteSize, style.label.letterSpacingEm),
        textTransform: style.label.uppercase ? "uppercase" : undefined,
        color: accent,
        opacity: noteFade,
        textShadow: `0 2px 18px ${rgba("#000000", 0.7)}`,
      }}
    >
      {cue.note}
    </div>
  ) : null;

  const body = (() => {
    switch (cue.type) {
      case "stat": {
        const size = text.length > 6 ? style.sizes.statLong : style.sizes.stat;
        const family = style.stat.family ?? display.family;
        const shown = style.stat.counter ? countUp(text, frame) : text;
        return (
          <TypeReveal
            {...revealProps}
            accent={accent}
            accentMode={style.color.accentMode === "ink" || muted ? "ink" : "highlight"}
            fontFamily={family}
            fontSize={size}
            fontVariationSettings={style.stat.family ? undefined : display.variation ?? undefined}
            fontWeight={style.stat.family ? 400 : display.weight}
            frame={frame}
            highlight={cue.highlight?.length ? cue.highlight : text.split(/\s+/).map((_, i) => i)}
            ink={ink}
            italic={false}
            justify="center"
            letterSpacing={em(size, display.letterSpacingEm) - 1}
            lineHeight={0.95}
            reveal={style.stat.counter ? "fade" : style.reveal}
            text={shown}
            underline={false}
            uppercase={display.uppercase}
          />
        );
      }
      case "chip":
      case "label":
        return (
          <TypeReveal
            accent={accent}
            text={text}
            fontFamily={style.label.family}
            fontSize={40}
            fontWeight={700}
            frame={frame}
            highlight={cue.highlight ?? []}
            ink={ink}
            letterSpacing={4}
            maxRevealFrames={24}
            uppercase
          />
        );
      default: {
        const size = text.length > 30 ? style.sizes.keywordLong : style.sizes.keyword;
        return (
          <TypeReveal
            {...revealProps}
            accent={accent}
            text={text}
            fontFamily={display.family}
            fontSize={size}
            fontVariationSettings={display.variation ?? undefined}
            fontWeight={display.weight}
            frame={frame}
            highlight={cue.highlight ?? []}
            ink={ink}
            justify={centered ? "center" : "flex-start"}
            letterSpacing={em(size, display.letterSpacingEm)}
            lineHeight={display.lineHeight}
            uppercase={display.uppercase}
          />
        );
      }
    }
  })();

  const cx = ((cue.rect.left + cue.rect.width / 2) / 1920) * 100;
  const cy = ((cue.rect.top + cue.rect.height / 2) / 1080) * 100;
  return (
    <>
      {lower ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 560,
            width: 1920,
            height: 520,
            background: `linear-gradient(to bottom, ${rgba("#000000", 0)}, ${rgba("#000000", 0.62)})`,
            opacity: exit * noteFade,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {floating ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 32% 46% at ${cx}% ${cy}%, ${rgba("#000000", 0.62)}, ${rgba("#000000", 0)})`,
            opacity: exit * noteFade,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: cue.rect.left,
          top: cue.rect.top,
          width: cue.rect.width,
          height: cue.rect.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: lower ? "flex-end" : "center",
          alignItems: centered || (!lower && cue.type === "stat") ? "center" : "flex-start",
          gap: 10,
          opacity: exit * (muted ? 0.78 : 1),
          transform: `translateY(${lift}px)`,
        }}
      >
        {cue.type === "stat" ? null : note}
        {body}
        {cue.type === "stat" ? note : null}
      </div>
    </>
  );
};

/**
 * Contador de una cifra ("+25 %", "20 $", "1,5x"): el numero sube desde cero en ~28
 * frames conservando signo, decimales, separador y sufijo. Un texto sin numero al
 * principio se devuelve tal cual.
 */
export function countUp(text: string, frame: number, frames = 28): string {
  const match = /^([+\-−]?)(\d+(?:[.,]\d+)?)(.*)$/su.exec(text);
  if (!match) return text;
  const [, sign, number, rest] = match;
  const separator = number.includes(",") ? "," : ".";
  const decimals = number.includes(separator) ? number.split(separator)[1].length : 0;
  const value = Number(number.replace(",", "."));
  const progress = interpolate(frame, [0, frames], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const current = (value * progress).toFixed(decimals).replace(".", separator);
  return `${sign}${current}${rest}`;
}

/**
 * Agenda: lista numerada que se construye punto a punto (referencia medida: Rourke
 * Heath). El numero va en acento y el texto en tinta; cada punto entra deslizando
 * cuando se dice. Con `active` es un recordatorio: ese punto se queda entero y los
 * demas se atenuan. Sin caja: un degradado lateral oscurece la columna.
 */
const ListCue: React.FC<{cue: IntroCue; exit: number; frame: number; palette: CuePalette}> = ({cue, exit, frame, palette}) => {
  const style = palette.text;
  const display = style.display;
  const size = style.sizes.list ?? 60;
  const items = cue.items ?? [];
  const fade = interpolate(frame, [0, 8], [0, 1], clamp);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1100,
          height: 1080,
          background: `linear-gradient(to right, ${rgba("#000000", 0.58)}, ${rgba("#000000", 0)})`,
          opacity: exit * fade,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cue.rect.left,
          top: cue.rect.top,
          width: cue.rect.width,
          height: cue.rect.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: size * 0.3,
          opacity: exit,
        }}
      >
        {items.map((item, index) => {
          const progress = interpolate(frame - item.fromFrame, [0, 9], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
          const dimmed = cue.active !== null && cue.active !== undefined && cue.active !== index;
          return (
            <div
              key={index}
              style={{
                display: "flex",
                gap: size * 0.3,
                alignItems: "baseline",
                fontFamily: display.family,
                fontWeight: display.weight,
                fontVariationSettings: display.variation ?? undefined,
                fontSize: size,
                lineHeight: 1.05,
                letterSpacing: size * display.letterSpacingEm,
                textTransform: display.uppercase ? "uppercase" : undefined,
                color: style.color.ink,
                opacity: progress * (dimmed ? 0.34 : 1),
                transform: `translateX(${interpolate(progress, [0, 1], [-34, 0])}px)`,
                filter: progress < 1 ? `blur(${interpolate(progress, [0, 1], [6, 0])}px)` : undefined,
                textShadow: `0 3px 22px ${rgba("#000000", 0.7)}`,
              }}
            >
              <span style={{color: palette.accent}}>{index + 1}.</span>
              <span>{item.text}</span>
            </div>
          );
        })}
      </div>
    </>
  );
};
