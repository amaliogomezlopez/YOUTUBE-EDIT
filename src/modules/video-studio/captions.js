import {round} from '../../lib/utils.js';

/**
 * Paginacion karaoke de subtitulos en Remotion.
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
  tailHoldSeconds: 0.22,
  /**
   * `karaoke` muestra la pagina entera y solo ilumina la palabra que suena.
   * `progressive` oculta las palabras que aun no han sonado y, cuando la pagina
   * tiene una palabra que se sostiene sola, la saca como heroe en su propia fila
   * (`heroIndex`); el renderer compone lead/hero/tail apilados.
   */
  mode: 'karaoke'
};

// Las stop-words y la puntuacion de enfasis estan portadas de
// `src/lib/captions/planner.js` (subtitulos progresivos con FFmpeg): la palabra
// hero de una pagina de Remotion se elige con el mismo criterio que la del ASS,
// para que los dos renderers destaquen lo mismo.
const STOP_WORDS = new Set([
  'a', 'al', 'and', 'as', 'at', 'con', 'como', 'de', 'del', 'el', 'en', 'es', 'esta', 'este', 'for',
  'la', 'las', 'lo', 'los', 'of', 'o', 'para', 'por', 'que', 'se', 'sin', 'the', 'to', 'un', 'una', 'y'
]);

function normalizedWord(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function emphasisScore(word, index, words) {
  const normalized = normalizedWord(word.text);
  if (!normalized || STOP_WORDS.has(normalized)) return -100;
  let score = Math.min(12, normalized.length);
  if (/\d/.test(normalized)) score += 7;
  if (normalized.length >= 5) score += 3;
  if (['error','gratis','resultado','rapido','lento','mejor','peor','coste','precio','limite','funciona','falla'].includes(normalized)) score += 12;
  if (index > 0 && index < words.length - 1) score += 2;
  if (/[!:]$/.test(word.text)) score += 2;
  return score;
}

/**
 * Indice de la palabra hero dentro de una pagina, o -1 si no hay hero.
 *
 * Es la variante `reference-stack` del planner: el hero no puede abrir ni cerrar
 * la pagina (lead y tail enmarcan la fila grande) y se prefiere el centro con un
 * bonus estructural. A diferencia del planner, aqui una stop-word nunca sale
 * hero aunque sea la unica candidata: el suelo de puntuacion es 0, y cualquier
 * candidato con carga semantica lo supera.
 */
export function chooseHeroIndex(words) {
  if (words.length < 3) return -1;
  const target = Math.floor(words.length / 2);
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 1; index < words.length - 1; index += 1) {
    const structural = Math.max(0, 4 - Math.abs(index - target) * 1.5);
    const score = emphasisScore(words[index], index, words) + structural;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

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
 * Une tokens que forman una sola entidad visual. Whisper puede separar `5.2`
 * como `5` + `.2`; después se une el nombre inmediatamente anterior para que
 * `GLM 5.2` o `Gemini 3.6` no se rompan entre filas del subtítulo.
 */
export function compactCaptionCompounds(words) {
  const decimals = [];
  for (const word of words ?? []) {
    const previous = decimals.at(-1);
    if (previous && /^\.\d+$/.test(word.text) && /^\d+$/.test(previous.text)) {
      previous.text += word.text;
      previous.end = word.end;
      continue;
    }
    decimals.push({...word});
  }

  const compounds = [];
  for (const word of decimals) {
    const previous = compounds.at(-1);
    if (
      previous &&
      /^\d+(?:\.\d+)+$/.test(word.text) &&
      /^[\p{L}][\p{L}\p{N}-]{1,15}$/u.test(previous.text)
    ) {
      previous.text = `${previous.text}\u00A0${word.text}`;
      previous.end = word.end;
      continue;
    }
    compounds.push({...word});
  }
  return compounds;
}

/**
 * @param {{text: string, start: number, end: number}[]} words palabras del clip
 * @param {{startSeconds: number, endSeconds: number}} window recorte del clip
 * @returns paginas con tiempos relativos al inicio del recorte
 */
export function buildCaptionPages(words, window, overrides = {}) {
  const style = resolveCaptionStyle(overrides);
  const inWindow = compactCaptionCompounds((words ?? [])
    .filter((word) => word.end > window.startSeconds && word.start < window.endSeconds)
    .map((word) => ({
      text: word.text,
      start: round(Math.max(0, word.start - window.startSeconds), 3),
      end: round(Math.min(window.endSeconds - window.startSeconds, word.end - window.startSeconds), 3)
    }))
    .filter((word) => word.end > word.start));

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
  if (style.maxWords > 1 && groups.length > 1 && groups.at(-1).length === 1) {
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
      words: pageWords,
      // Solo en modo progressive: en karaoke la salida se mantiene igual para no
      // invalidar los fixtures que comparan paginas campo a campo.
      ...(style.mode === 'progressive' ? {heroIndex: chooseHeroIndex(pageWords)} : {})
    };
  });
}
