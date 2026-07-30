import {
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {DATA_FONT_FAMILY, MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {
  CueTone,
  ShortLayoutId,
  ShortSlot,
  podiumIndexForSlot,
  slotRect,
  toneColor,
} from "./layout";
import {ShortCue} from "./schemas";

type CuePalette = {
  theme: MotionTheme;
  accent: string;
  danger: string;
};

export const CueLayer: React.FC<{
  cues: ShortCue[];
  layout: ShortLayoutId;
  palette: CuePalette;
}> = ({cues, layout, palette}) => {
  // Los chips comparten un unico rect (`stage-footer`), asi que no pueden vivir en
  // Sequences independientes: se maquetan juntos en una fila que reparte el ancho
  // y cada uno entra en su propio frame.
  const chips = cues.filter((cue) => cue.type === "chip");
  const rest = cues.filter((cue) => cue.type !== "chip");

  return (
    <>
      {rest.map((cue) => (
        <Sequence
          durationInFrames={cue.durationInFrames}
          from={cue.fromFrame}
          key={cue.id}
          layout="none"
          name={`${cue.type}:${cue.slot ?? "stage-full"}`}
        >
          <Cue cue={cue} layout={layout} palette={palette} />
        </Sequence>
      ))}
      {chips.length ? <ChipRow chips={chips} layout={layout} palette={palette} /> : null}
    </>
  );
};

const ChipRow: React.FC<{chips: ShortCue[]; layout: ShortLayoutId; palette: CuePalette}> = ({
  chips,
  layout,
  palette,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rect = slotRect((chips[0].slot ?? "stage-footer") as ShortSlot, layout);

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      {chips.map((chip) => {
        const local = frame - chip.fromFrame;
        if (local < 0) return null;
        const entry = spring({frame: local, fps, config: {damping: 13, mass: 0.4, stiffness: 170}});
        const fade = interpolate(
          local,
          [chip.durationInFrames - 9, chip.durationInFrames - 1],
          [1, 0],
          {...clamp, easing: Easing.in(Easing.cubic)},
        );
        const color = toneColor(chip.tone as CueTone, palette.theme, palette.accent, palette.danger);
        return (
          <div
            key={chip.id}
            style={{
              opacity: Math.min(entry, fade),
              transform: `translateY(${interpolate(entry, [0, 1], [26, 0])}px) scale(${interpolate(entry, [0, 1], [0.8, 1])})`,
              padding: "14px 30px",
              borderRadius: 999,
              background: rgba(color, 0.16),
              border: `2px solid ${rgba(color, 0.5)}`,
              fontFamily: MOTION_FONT_FAMILY,
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: 2,
              color: palette.theme.ink,
              whiteSpace: "nowrap",
            }}
          >
            {chip.text}
          </div>
        );
      })}
    </div>
  );
};

const Cue: React.FC<{cue: ShortCue; layout: ShortLayoutId; palette: CuePalette}> = ({
  cue,
  layout,
  palette,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const slot = (cue.slot ?? "stage-full") as ShortSlot;
  const rect = slotRect(slot, layout, podiumIndexForSlot(slot));
  const color = toneColor(cue.tone as CueTone, palette.theme, palette.accent, palette.danger);

  // Entrada con muelle: el rebote corto es lo que hace que un logo "golpee" a la
  // vez que el efecto de sonido en lugar de aparecer sin peso.
  const entry = spring({frame, fps, config: {damping: 14, mass: 0.5, stiffness: 150}});
  // Salida solo si el cue no dura hasta el final de la escena.
  const exit = interpolate(
    frame,
    [cue.durationInFrames - 9, cue.durationInFrames - 1],
    [1, 0],
    {...clamp, easing: Easing.in(Easing.cubic)},
  );
  const opacity = Math.min(entry, exit);

  const shared: React.CSSProperties = {
    position: "absolute",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    opacity,
  };

  switch (cue.type) {
    case "logo":
      return <LogoCue cue={cue} color={color} entry={entry} palette={palette} style={shared} />;
    case "screenshot":
      return <ScreenshotCue cue={cue} entry={entry} frame={frame} palette={palette} style={shared} />;
    case "stat":
      return <StatCue cue={cue} color={color} entry={entry} palette={palette} style={shared} />;
    case "label":
      return <LabelCue cue={cue} color={color} entry={entry} palette={palette} style={shared} />;
    case "brand":
      return <BrandCue cue={cue} entry={entry} palette={palette} style={shared} />;
    default:
      return null;
  }
};

const LogoCue: React.FC<{
  cue: ShortCue;
  color: string;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, entry, palette, style}) => {
  const scale = interpolate(entry, [0, 1], [0.62, 1]);
  const rotate = interpolate(entry, [0, 1], [-7, 0]);
  const blend = cue.presentation === "blend";
  const framed = cue.presentation !== "plain" && !blend;
  const plate = cue.presentation === "plate";
  const surface = plate ? "#F5F1EA" : palette.theme.surfaceRaised;
  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        // `screen` tiene que ir en el elemento que compone contra el video. Este
        // contenedor ya lleva `opacity` y `transform`, que aislan el grupo de
        // mezcla: puesto en la imagen de dentro, el negro se sumaba contra un
        // fondo transparente y seguia siendo negro.
        mixBlendMode: blend ? "screen" : undefined,
      }}
    >
      <div
        style={{
          width: framed ? "78%" : "100%",
          aspectRatio: framed ? "1 / 1" : undefined,
          maxHeight: cue.text ? "68%" : "100%",
          flex: framed ? undefined : 1,
          minHeight: 0,
          borderRadius: framed ? 28 : 18,
          background: framed ? surface : "transparent",
          border: framed ? `3px solid ${rgba(color, 0.55)}` : undefined,
          boxShadow: framed
            ? `0 0 0 ${8 * entry}px ${rgba(color, 0.14)}, 0 24px 48px ${rgba("#000000", 0.45)}`
            : `0 0 44px ${rgba(color, 0.3 * entry)}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: framed ? 22 : 0,
          overflow: "hidden",
        }}
      >
        {cue.src ? (
          <Img
            src={staticFile(cue.src)}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        ) : null}
      </div>
      {cue.text ? (
        <div
          style={{
            fontFamily: MOTION_FONT_FAMILY,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: 1.2,
            color: palette.theme.ink,
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          {cue.text}
        </div>
      ) : null}
    </div>
  );
};

const ScreenshotCue: React.FC<{
  cue: ShortCue;
  entry: number;
  frame: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, entry, frame, palette, style}) => {
  const rise = interpolate(entry, [0, 1], [64, 0]);
  // Zoom lento en lugar de desplazamiento: una captura es texto, y moverla en
  // vertical obliga a releer. El acercamiento minimo la mantiene viva sin que se
  // pierda ninguna linea.
  const zoom = interpolate(frame, [0, cue.durationInFrames], [1, 1.04], clamp);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${rise}px)`,
      }}
    >
      {cue.src ? (
        <Img
          src={staticFile(cue.src)}
          style={{
            // `contain`: una captura de texto no se puede recortar sin perder el
            // dato que justifica ponerla en pantalla.
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            borderRadius: 18,
            border: `2px solid ${rgba(palette.accent, 0.4)}`,
            boxShadow: `0 28px 60px ${rgba("#000000", 0.5)}`,
            transform: `scale(${zoom})`,
          }}
        />
      ) : null}
    </div>
  );
};

const StatCue: React.FC<{
  cue: ShortCue;
  color: string;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, entry, palette, style}) => {
  const scale = interpolate(entry, [0, 1], [0.5, 1]);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 168,
          lineHeight: 0.9,
          color,
          textShadow: `0 0 42px ${rgba(color, 0.4)}`,
        }}
      >
        {cue.text}
      </div>
      {cue.note ? (
        <div
          style={{
            fontFamily: MOTION_FONT_FAMILY,
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: 1.4,
            textTransform: "uppercase",
            color: palette.theme.muted,
          }}
        >
          {cue.note}
        </div>
      ) : null}
    </div>
  );
};

const LabelCue: React.FC<{
  cue: ShortCue;
  color: string;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, color, entry, palette, style}) => {
  const reveal = interpolate(entry, [0, 1], [0, 1]);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
      }}
    >
      <div
        style={{
          height: 6,
          width: `${18 * reveal}%`,
          background: color,
          borderRadius: 3,
        }}
      />
      <div
        style={{
          fontFamily: MOTION_FONT_FAMILY,
          fontWeight: 900,
          fontSize: 44,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: cue.tone === "neutral" ? palette.theme.ink : color,
          whiteSpace: "nowrap",
        }}
      >
        {cue.text}
      </div>
      <div
        style={{
          height: 6,
          width: `${18 * reveal}%`,
          background: color,
          borderRadius: 3,
        }}
      />
    </div>
  );
};

const BrandCue: React.FC<{
  cue: ShortCue;
  entry: number;
  palette: CuePalette;
  style: React.CSSProperties;
}> = ({cue, entry, palette, style}) => {
  const scale = interpolate(entry, [0, 1], [0.82, 1]);
  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        transform: `scale(${scale})`,
        borderRadius: 26,
        background: `linear-gradient(150deg, ${rgba(palette.accent, 0.22)}, ${rgba(palette.theme.background, 0.9)})`,
        border: `2px solid ${rgba(palette.accent, 0.5)}`,
      }}
    >
      <div
        style={{
          fontFamily: MOTION_FONT_FAMILY,
          fontWeight: 900,
          fontSize: 76,
          letterSpacing: 3,
          color: palette.theme.ink,
        }}
      >
        {cue.text}
      </div>
      {cue.note ? (
        <div
          style={{
            fontFamily: MOTION_FONT_FAMILY,
            fontWeight: 600,
            fontSize: 36,
            letterSpacing: 1,
            color: palette.accent,
          }}
        >
          {cue.note}
        </div>
      ) : null}
    </div>
  );
};
