import {round} from '../../lib/utils.js';

/**
 * Paginacion karaoke para shorts.
 *
 * Comparte las reglas de corte del planner progresivo de FFmpeg
 * (`src/lib/captions/planner.js`): limite de palabras, pausa entre palabras,
 * duracion maxima y cierre de frase. La diferencia es la salida: aqui no se
 * calculan posiciones absolutas para libass, sino paginas en frames que React
 * maqueta con flexbox, porque el subtitulo se compone dentro de Remotion.
 */

const DEFAULT_STYLE = {
  maxWords: 4,
  /**
   * Tope de caracteres por pagina. Manda sobre `maxWords`: cuatro palabras cortas
   * caben en dos lineas grandes, pero cuatro palabras largas obligan al renderer a
   * encoger la tipografia o a usar tres lineas, y el subtitulo deja de leerse de un
   * golpe.
   */
  maxPageChars: 22,
  maxLineChars: 18,
  pauseBreakSeconds: 0.42,
  maxPageSeconds: 2.6,
  tailHoldSeconds: 0.22
};

export function resolveCaptionStyle(overrides = {}) {
  return {
    ...DEFAULT_STYLE,
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null))
  };
}

function closesThought(text) {
  return /[.!?]["'»)]?$/.test(text);
}

/**
 * @param {{text: string, start: number, end: number}[]} words palabras del clip
 * @param {{startSeconds: number, endSeconds: number}} window recorte del clip
 * @returns paginas con tiempos relativos al inicio del recorte
 */
export function buildCaptionPages(words, window, overrides = {}) {
  const style = resolveCaptionStyle(overrides);
  const inWindow = (words ?? [])
    .filter((word) => word.end > window.startSeconds && word.start < window.endSeconds)
    .map((word) => ({
      text: word.text,
      start: round(Math.max(0, word.start - window.startSeconds), 3),
      end: round(Math.min(window.endSeconds - window.startSeconds, word.end - window.startSeconds), 3)
    }))
    .filter((word) => word.end > word.start);

  const groups = [];
  let current = [];
  for (const word of inWindow) {
    const previous = current.at(-1);
    const pause = previous ? word.start - previous.end : 0;
    const spanSeconds = current.length ? word.end - current[0].start : 0;
    const charsWithWord = [...current, word].map((item) => item.text).join(' ').length;
    const shouldBreak = Boolean(current.length) && (
      current.length >= style.maxWords ||
      charsWithWord > style.maxPageChars ||
      pause >= style.pauseBreakSeconds ||
      spanSeconds > style.maxPageSeconds ||
      closesThought(previous.text)
    );
    if (shouldBreak) {
      groups.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) groups.push(current);

  // Una ultima pagina de una sola palabra se lee como un error de montaje. Si
  // cabe en la anterior sin pasarse del limite de caracteres, se fusiona.
  if (groups.length > 1 && groups.at(-1).length === 1) {
    const orphan = groups.at(-1);
    const previous = groups.at(-2);
    const merged = [...previous, ...orphan].map((word) => word.text).join(' ');
    // Se tolera un 20% de exceso: una pagina algo mas larga se lee mejor que una
    // palabra sola colgando al final de la escena. Pero una pausa larga es un
    // silencio buscado, y fusionar sobre ella adelantaria el texto al audio.
    const gap = orphan[0].start - previous.at(-1).end;
    if (merged.length <= Math.round(style.maxPageChars * 1.2) && gap < style.pauseBreakSeconds) {
      previous.push(...orphan);
      groups.pop();
    }
  }

  const clipSeconds = window.endSeconds - window.startSeconds;
  return groups.map((pageWords, index) => {
    const nextStart = groups[index + 1]?.[0]?.start;
    const lastEnd = pageWords.at(-1).end;
    const end = Number.isFinite(nextStart)
      ? Math.max(lastEnd, Math.min(nextStart, lastEnd + style.tailHoldSeconds))
      : Math.min(clipSeconds, lastEnd + style.tailHoldSeconds);
    return {
      startSeconds: pageWords[0].start,
      endSeconds: round(end, 3),
      words: pageWords
    };
  });
}
