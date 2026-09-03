import {measureText} from "@remotion/layout-utils";
import {Easing, Sequence, interpolate, useCurrentFrame} from "remotion";
import {MotionTheme} from "../motion/DesignSystem";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp, rgba} from "../motion/Toolkit";
import {SHORT_LAYOUT, ShortLayoutId} from "./layout";
import {CaptionPage} from "./schemas";

type CaptionMode = "karaoke" | "progressive";

type CaptionTrackProps = {
  pages: CaptionPage[];
  layout: ShortLayoutId;
  mode: CaptionMode;
  theme: MotionTheme;
  accent: string;
  uppercase: boolean;
};

/**
 * Subtitulos karaoke: el bloque completo esta visible y solo la palabra que suena
 * en ese frame se ilumina. Se lee mejor que un subtitulo que aparece palabra a
 * palabra, porque el espectador ya ve hacia donde va la frase.
 *
 * En modo `progressive` las palabras futuras no existen hasta que suenan, y una
 * pagina con `heroIndex` se apila en tres filas (lead, hero, tail) con la palabra
 * hero en mayusculas y cuerpo grande: es el equivalente Remotion del ASS
 * progresivo de `src/lib/captions/planner.js`.
 */
export const CaptionTrack: React.FC<CaptionTrackProps> = ({
  pages,
  layout,
  mode,
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
          mode={mode}
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
/** La hero crece sobre el cuerpo base; mas de 1.5x y la fila grande come a las otras. */
const HERO_SCALE = 1.5;

const measureWord = (text: string, fontSize: number, uppercase: boolean) =>
  measureText({
    text: uppercase ? text.toUpperCase() : text,
    fontFamily: MOTION_FONT_FAMILY,
    fontWeight: 900,
    fontSize,
    letterSpacing: "-1px",
  }).width;

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
    const width = measureWord(word, fontSize, uppercase);
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

/**
 * Cuerpo de la fila hero: HERO_SCALE veces el base, reducido con `measureText`
 * hasta que la palabra quepa en el ancho seguro. La hero siempre va en
 * mayusculas, asi que se mide en mayusculas aunque la pagina no lo este.
 */
const heroFontSize = (word: string, baseFontSize: number, usableWidth: number): number => {
  for (let size = Math.round(baseFontSize * HERO_SCALE); size > baseFontSize; size -= 2) {
    if (measureWord(word, size, true) <= usableWidth) return size;
  }
  return baseFontSize;
};

/**
 * Cuerpo base de una pagina apilada lead/hero/tail: tres filas ocupan mas que el
 * bloque karaoke de la misma pagina, asi que se parte del tamano karaoke y se
 * encoge hasta que la pila quepa en el alto disponible.
 */
const progressiveFontSize = (
  page: CaptionPage,
  availableHeight: number,
  uppercase: boolean,
  heroIndex: number,
): number => {
  const usableWidth = SHORT_LAYOUT.width - SHORT_LAYOUT.safeX * 2;
  const lead = page.words.slice(0, heroIndex).map((word) => word.text);
  const tail = page.words.slice(heroIndex + 1).map((word) => word.text);
  for (let size = captionFontSize(page, availableHeight, uppercase); size > CAPTION_MIN_FONT; size -= 2) {
    const rows =
      wrappedLineCount(lead, size, usableWidth, uppercase) +
      wrappedLineCount(tail, size, usableWidth, uppercase);
    const hero = heroFontSize(page.words[heroIndex].text, size, usableWidth);
    // 16px de respiro entre la fila hero y sus vecinas.
    if (rows * size * CAPTION_LINE_RATIO + hero * CAPTION_LINE_RATIO + 16 <= availableHeight) {
      return size;
    }
  }
  return CAPTION_MIN_FONT;
};

const CaptionWord: React.FC<{
  word: CaptionPage["words"][number];
  absolute: number;
  fontSize: number;
  accent: string;
  ink: string;
  uppercase: boolean;
  progressive: boolean;
  hero?: boolean;
}> = ({word, absolute, fontSize, accent, ink, uppercase, progressive, hero = false}) => {
  // La palabra activa se mide contra el frame local de la pagina: los
  // tiempos del build son relativos al inicio de la escena, no de la pagina.
  const active = absolute >= word.fromFrame && absolute < word.toFrame;
  const spoken = absolute >= word.toFrame;
  const lift = active ? 1 : 0;
  // En progressive la palabra no existe hasta que suena: aparece en tres frames.
  const appear = progressive
    ? interpolate(absolute, [word.fromFrame, word.fromFrame + 3], [0, 1], clamp)
    : 1;
  return (
    <span
      style={{
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: 900,
        fontSize,
        lineHeight: 1.06,
        letterSpacing: -1,
        textTransform: uppercase || hero ? "uppercase" : "none",
        color: active ? accent : ink,
        opacity: progressive ? appear : active || spoken ? 1 : 0.58,
        transform: `scale(${1 + lift * 0.06}) translateY(${-lift * 4}px)`,
        textShadow: active
          ? `0 0 34px ${rgba(accent, 0.55)}, 0 6px 18px ${rgba("#000000", 0.7)}`
          : `0 6px 18px ${rgba("#000000", 0.7)}`,
      }}
    >
      {word.text}
    </span>
  );
};

const CaptionPageBlock: React.FC<{
  page: CaptionPage;
  layout: ShortLayoutId;
  mode: CaptionMode;
  theme: MotionTheme;
  accent: string;
  uppercase: boolean;
}> = ({page, layout, mode, theme, accent, uppercase}) => {
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
  const absolute = frame + page.fromFrame;
  const progressive = mode === "progressive";
  const heroIndex = progressive ? (page.heroIndex ?? -1) : -1;
  const usableWidth = SHORT_LAYOUT.width - SHORT_LAYOUT.safeX * 2;
  const fontSize =
    heroIndex >= 0
      ? progressiveFontSize(page, availableHeight, uppercase, heroIndex)
      : captionFontSize(page, availableHeight, uppercase);

  const wordAt = (index: number, size: number, hero = false) => (
    <CaptionWord
      absolute={absolute}
      accent={accent}
      fontSize={size}
      hero={hero}
      ink={theme.ink}
      key={`${page.words[index].text}-${index}`}
      progressive={progressive}
      uppercase={uppercase}
      word={page.words[index]}
    />
  );

  if (heroIndex >= 0) {
    // Pagina apilada: lead y tail enmarcan la fila hero, que es lo unico que el
    // espectador tiene que leer de un golpe.
    const heroSize = heroFontSize(page.words[heroIndex].text, fontSize, usableWidth);
    const rowStyle: React.CSSProperties = {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "4px 28px",
    };
    return (
      <div
        style={{
          position: "absolute",
          left: SHORT_LAYOUT.safeX,
          top: SHORT_LAYOUT.captionBottom[layout] - availableHeight,
          height: availableHeight,
          width: usableWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          opacity: Math.min(appear, leave),
          transform: `translateY(${interpolate(appear, [0, 1], [18, 0])}px)`,
        }}
      >
        {heroIndex > 0 ? (
          <div style={rowStyle}>
            {page.words.slice(0, heroIndex).map((_, index) => wordAt(index, fontSize))}
          </div>
        ) : null}
        <div style={rowStyle}>{wordAt(heroIndex, heroSize, true)}</div>
        {heroIndex < page.words.length - 1 ? (
          <div style={rowStyle}>
            {page.words.slice(heroIndex + 1).map((_, offset) => wordAt(heroIndex + 1 + offset, fontSize))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: SHORT_LAYOUT.safeX,
        // Anclado por abajo: el bloque crece hacia arriba, hacia el hueco libre.
        top: SHORT_LAYOUT.captionBottom[layout] - availableHeight,
        height: availableHeight,
        width: usableWidth,
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
      {page.words.map((_, index) => wordAt(index, fontSize))}
    </div>
  );
};
