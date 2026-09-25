import {Easing, interpolate} from "remotion";
import {clamp, rgba} from "../motion/Toolkit";

export type TextReveal = "letters" | "words" | "mask" | "fade";
export type AccentMode = "writing" | "highlight" | "ink";

/**
 * Texto que se revela sin caja detras.
 *
 * Cuatro revelados (tokens de `text-styles.json`):
 * - `letters`: cada caracter entra con opacidad, un desplazamiento corto y un
 *   desenfoque que se resuelve en cinco frames (la v3 aprobada);
 * - `words`: palabra a palabra, con subida;
 * - `mask`: una mascara barre la linea de izquierda a derecha;
 * - `fade`: fundido del bloque con una escala minima.
 *
 * El color sigue `accentMode`: `writing` pinta en acento la palabra que se esta
 * escribiendo y las de `highlight`; `highlight`, solo estas; `ink`, ninguna. Las
 * resaltadas pueden ademas ir en cursiva o llevar un subrayado en acento que barre
 * bajo la palabra cuando termina de entrar. La legibilidad la da la sombra, nunca un
 * rectangulo detras.
 *
 * El ritmo se adapta a la longitud: nunca mas de 1,6 frames por letra ni mas de
 * `maxRevealFrames` en total, porque una frase larga escrita a velocidad fija tarda
 * mas que el golpe que la motiva.
 */
export const TypeReveal: React.FC<{
  text: string;
  frame: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  ink: string;
  accent: string;
  highlight?: number[];
  letterSpacing?: number;
  lineHeight?: number;
  uppercase?: boolean;
  fontVariationSettings?: string;
  justify?: React.CSSProperties["justifyContent"];
  maxRevealFrames?: number;
  delayFrames?: number;
  reveal?: TextReveal;
  accentMode?: AccentMode;
  underline?: boolean;
  italic?: boolean;
}> = ({
  text,
  frame,
  fontFamily,
  fontSize,
  fontWeight,
  ink,
  accent,
  highlight = [],
  letterSpacing = 0,
  lineHeight = 1.02,
  uppercase = false,
  fontVariationSettings,
  justify = "flex-start",
  maxRevealFrames = 40,
  delayFrames = 0,
  reveal = "letters",
  accentMode = "writing",
  underline = false,
  italic = false,
}) => {
  const words = text.split(/\s+/).filter(Boolean);
  const totalChars = words.reduce((sum, word) => sum + word.length, 0);
  const framesPerChar = Math.min(1.6, maxRevealFrames / Math.max(1, totalChars));
  const framesPerWord = Math.min(7, maxRevealFrames / Math.max(1, words.length));
  const blockFrames = reveal === "mask" ? Math.min(maxRevealFrames, 22) : 10;
  const local = frame - delayFrames;

  // Ventana de entrada de cada palabra, segun el revelado.
  let cursor = 0;
  const timing = words.map((word, index) => {
    let start = 0;
    let end = blockFrames;
    if (reveal === "letters") {
      start = cursor * framesPerChar;
      end = (cursor + word.length) * framesPerChar;
    } else if (reveal === "words") {
      start = index * framesPerWord;
      end = start + 8;
    }
    const chars = [...word].map((char, charIndex) => ({char, start: (cursor + charIndex) * framesPerChar}));
    cursor += word.length;
    return {word, start, end, chars};
  });

  const block = interpolate(local, [0, blockFrames], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: justify,
    columnGap: fontSize * 0.26,
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    fontVariationSettings,
    textTransform: uppercase ? "uppercase" : undefined,
    textShadow: `0 4px 28px ${rgba("#000000", 0.7)}, 0 1px 3px ${rgba("#000000", 0.55)}`,
  };
  if (reveal === "mask") {
    // Margen vertical en el recorte para no cortar sombra, acentos ni descendentes.
    containerStyle.clipPath = `inset(-30% ${(1 - block) * 100}% -45% -4%)`;
  } else if (reveal === "fade") {
    containerStyle.opacity = block;
    containerStyle.transform = `scale(${0.96 + 0.04 * block})`;
    containerStyle.transformOrigin = justify === "center" ? "50% 60%" : "0% 60%";
  }

  return (
    <div style={containerStyle}>
      {timing.map(({word, start, end, chars}, wordIndex) => {
        const highlighted = highlight.includes(wordIndex);
        const writing = local >= start && local < end + 8;
        const colored =
          accentMode === "writing" ? writing || highlighted : accentMode === "highlight" ? highlighted : false;
        const wordProgress = interpolate(local, [start, start + 8], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
        const underlineProgress = interpolate(local, [end + 2, end + 14], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
        return (
          <span
            key={`${word}-${wordIndex}`}
            style={{
              position: "relative",
              display: "inline-flex",
              whiteSpace: "pre",
              color: colored ? accent : ink,
              fontStyle: italic && highlighted ? "italic" : undefined,
              ...(reveal === "words"
                ? {
                    opacity: wordProgress,
                    transform: `translateY(${interpolate(wordProgress, [0, 1], [fontSize * 0.35, 0])}px)`,
                    filter: wordProgress < 1 ? `blur(${interpolate(wordProgress, [0, 1], [6, 0])}px)` : undefined,
                  }
                : {}),
            }}
          >
            {reveal === "letters"
              ? chars.map(({char, start: charStart}, charIndex) => {
                  const progress = interpolate(local, [charStart, charStart + 5], [0, 1], {
                    ...clamp,
                    easing: Easing.out(Easing.cubic),
                  });
                  return (
                    <span
                      key={charIndex}
                      style={{
                        display: "inline-block",
                        opacity: progress,
                        transform: `translateY(${interpolate(progress, [0, 1], [fontSize * 0.16, 0])}px)`,
                        filter: progress < 1 ? `blur(${interpolate(progress, [0, 1], [8, 0])}px)` : undefined,
                      }}
                    >
                      {char}
                    </span>
                  );
                })
              : word}
            {underline && highlighted ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -fontSize * 0.02,
                  height: Math.max(4, Math.round(fontSize * 0.055)),
                  background: accent,
                  transform: `scaleX(${underlineProgress})`,
                  transformOrigin: "left center",
                  boxShadow: `0 2px 10px ${rgba("#000000", 0.45)}`,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
};
