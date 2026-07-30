import {measureText} from "@remotion/layout-utils";
import {Easing, Sequence, interpolate, useCurrentFrame} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {SHORT_LAYOUT} from "./layout";
import {CaptionPage} from "./schemas";

type CaptionTrackProps = {
  pages: CaptionPage[];
  layout: "full" | "split" | "stage";
  theme: MotionTheme;
  accent: string;
  uppercase: boolean;
};

/**
 * Subtitulos karaoke: el bloque completo esta visible y solo la palabra que suena
 * en ese frame se ilumina. Se lee mejor que un subtitulo que aparece palabra a
 * palabra, porque el espectador ya ve hacia donde va la frase.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({
  pages,
  layout,
  theme,
  accent,
  uppercase,
}) => (
  <>
    {pages.map((page, index) => (
      <Sequence
        durationInFrames={page.durationInFrames}
        from={page.fromFrame}
        key={`caption-${index}`}
        layout="none"
        name={`caption:${page.words.map((word) => word.text).join(" ")}`}
      >
        <CaptionPageBlock
          accent={accent}
          layout={layout}
          page={page}
          theme={theme}
          uppercase={uppercase}
        />
      </Sequence>
    ))}
  </>
);

const CAPTION_MAX_FONT = 90;
const CAPTION_MIN_FONT = 50;
const CAPTION_LINE_RATIO = 1.14;
const CAPTION_WORD_GAP = 28;

/**
 * Numero de lineas que ocupara la pagina, replicando el reparto codicioso de
 * `flex-wrap`.
 *
 * Los anchos se miden con `measureText` en vez de estimarse por numero de
 * caracteres: una palabra no se parte, y en mayusculas un ancho medio por glifo se
 * queda corto y predice dos lineas donde el navegador dibuja tres.
 */
const wrappedLineCount = (
  words: string[],
  fontSize: number,
  usableWidth: number,
  uppercase: boolean,
): number => {
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const {width} = measureText({
      text: uppercase ? word.toUpperCase() : word,
      fontFamily: MOTION_FONT_FAMILY,
      fontWeight: 900,
      fontSize,
      letterSpacing: "-1px",
    });
    const needed = used === 0 ? width : used + CAPTION_WORD_GAP + width;
    if (needed > usableWidth && used > 0) {
      lines += 1;
      used = width;
    } else {
      used = needed;
    }
  }
  return lines;
};

/**
 * Ajusta el cuerpo del subtitulo para que la pagina quepa en el alto disponible sin
 * invadir la zona segura inferior, donde la interfaz de Shorts dibuja sus botones.
 */
export const captionFontSize = (
  page: CaptionPage,
  availableHeight: number,
  uppercase: boolean,
): number => {
  const words = page.words.map((word) => word.text);
  const usableWidth = SHORT_LAYOUT.width - SHORT_LAYOUT.safeX * 2;
  for (let size = CAPTION_MAX_FONT; size > CAPTION_MIN_FONT; size -= 2) {
    const lines = wrappedLineCount(words, size, usableWidth, uppercase);
    if (lines * size * CAPTION_LINE_RATIO <= availableHeight) return size;
  }
  return CAPTION_MIN_FONT;
};

const CaptionPageBlock: React.FC<{
  page: CaptionPage;
  layout: "full" | "split" | "stage";
  theme: MotionTheme;
  accent: string;
  uppercase: boolean;
}> = ({page, layout, theme, accent, uppercase}) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [0, 5], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const leave = interpolate(
    frame,
    [page.durationInFrames - 5, page.durationInFrames - 1],
    [1, 0],
    clamp,
  );
  const availableHeight = SHORT_LAYOUT.captionHeight[layout];
  const fontSize = captionFontSize(page, availableHeight, uppercase);

  return (
    <div
      style={{
        position: "absolute",
        left: SHORT_LAYOUT.safeX,
        // Anclado por abajo: el bloque crece hacia arriba, hacia el hueco libre.
        top: SHORT_LAYOUT.captionBottom[layout] - availableHeight,
        height: availableHeight,
        width: SHORT_LAYOUT.width - SHORT_LAYOUT.safeX * 2,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        alignContent: "flex-end",
        justifyContent: "center",
        // El gap horizontal es generoso porque la palabra activa crece un 6% y su
        // resplandor invade los laterales: con menos espacio, dos palabras se
        // leen pegadas.
        gap: "4px 28px",
        opacity: Math.min(appear, leave),
        transform: `translateY(${interpolate(appear, [0, 1], [18, 0])}px)`,
      }}
    >
      {page.words.map((word, index) => {
        // La palabra activa se mide contra el frame local de la pagina: los
        // tiempos del build son relativos al inicio de la escena, no de la pagina.
        const absolute = frame + page.fromFrame;
        const active = absolute >= word.fromFrame && absolute < word.toFrame;
        const spoken = absolute >= word.toFrame;
        const lift = active ? 1 : 0;
        return (
          <span
            key={`${word.text}-${index}`}
            style={{
              fontFamily: MOTION_FONT_FAMILY,
              fontWeight: 900,
              fontSize,
              lineHeight: 1.06,
              letterSpacing: -1,
              textTransform: uppercase ? "uppercase" : "none",
              color: active ? accent : theme.ink,
              opacity: active || spoken ? 1 : 0.58,
              transform: `scale(${1 + lift * 0.06}) translateY(${-lift * 4}px)`,
              textShadow: active
                ? `0 0 34px ${rgba(accent, 0.55)}, 0 6px 18px ${rgba("#000000", 0.7)}`
                : `0 6px 18px ${rgba("#000000", 0.7)}`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};
