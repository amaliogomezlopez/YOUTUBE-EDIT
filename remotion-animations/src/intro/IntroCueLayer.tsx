import {Easing, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {DATA_FONT_FAMILY, MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {IntroDepth, IntroTone, toneColor} from "./layout";
import {IntroCue} from "./schemas";

type CuePalette = {theme: MotionTheme; accent: string; danger: string};

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
    case "stat":
      return <StatCue color={color} cue={cue} palette={palette} style={shared} />;
    case "chip":
    case "label":
      return <LabelCue color={color} cue={cue} entry={entry} palette={palette} style={shared} />;
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

const StatCue: React.FC<{
  cue: IntroCue;
  color: string;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, palette, style}) => (
  <div style={{...style, flexDirection: "column", gap: 8}}>
    <div
      style={{
        fontFamily: DATA_FONT_FAMILY,
        fontSize: 176,
        lineHeight: 0.9,
        color,
        textShadow: `0 0 48px ${rgba(color, 0.4)}`,
      }}
    >
      {cue.text}
    </div>
    {cue.note ? (
      <div
        style={{
          fontFamily: MOTION_FONT_FAMILY,
          fontWeight: 700,
          fontSize: 40,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: palette.theme.muted,
        }}
      >
        {cue.note}
      </div>
    ) : null}
  </div>
);

const LabelCue: React.FC<{
  cue: IntroCue;
  color: string;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, entry, palette, style}) => (
  <div style={style}>
    <div
      style={{
        padding: "16px 34px",
        borderRadius: cue.type === "chip" ? 999 : 8,
        background: rgba(color, 0.18),
        border: `2px solid ${rgba(color, 0.55)}`,
        borderLeft: cue.type === "chip" ? undefined : `6px solid ${color}`,
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: 900,
        fontSize: 44,
        letterSpacing: 2.2,
        textTransform: "uppercase",
        color: palette.theme.ink,
        whiteSpace: "pre-line",
        transform: `translateY(${interpolate(entry, [0, 1], [24, 0])}px)`,
      }}
    >
      {cue.text}
    </div>
  </div>
);
