import {round} from '../../lib/utils.js';

/**
 * Recorte y ventanas de locucion, comunes a las superficies de montaje.
 *
 * Lo habitual en una grabacion por clips es que sobre silencio en los extremos: se
 * pulsa grabar, se respira, se habla y se tarda en parar. Ese silencio no se ve en
 * el JSON pero se nota mucho al ver la pieza, y el criterio para quitarlo es el
 * mismo en un short y en una intro.
 */

/**
 * Aire que se deja antes de la primera palabra y despues de la ultima. Sin nada de
 * margen la voz entra cortada; con mas de medio segundo el clip se siente muerto.
 */
export const DEFAULT_SILENCE_PADDING_SECONDS = 0.5;

/**
 * Recorte de la escena.
 *
 * Cuando el plan no fija un extremo se deduce de la primera y la ultima palabra de
 * la transcripcion, dejando `padding` de aire. Un extremo declarado en el plan se
 * respeta siempre: es como se parte un clip en dos escenas con distinto layout sin
 * cortar el audio.
 */
export function resolveTrim(trim, clip, words, padding = DEFAULT_SILENCE_PADDING_SECONDS) {
  const duration = clip.durationSeconds;
  const declaredStart = Number.isFinite(trim?.start) ? Math.max(0, Number(trim.start)) : null;
  const declaredEnd = Number.isFinite(trim?.end) ? Math.min(duration, Number(trim.end)) : null;

  const speechStart = words.length ? Math.max(0, words[0].start - padding) : 0;
  const speechEnd = words.length ? Math.min(duration, words.at(-1).end + padding) : duration;

  const startSeconds = round(declaredStart ?? speechStart, 3);
  const endSeconds = round(declaredEnd ?? speechEnd, 3);
  const leadTrimmed = declaredStart === null ? round(startSeconds, 3) : 0;
  const tailTrimmed = declaredEnd === null ? round(duration - endSeconds, 3) : 0;

  return {
    startSeconds,
    endSeconds,
    leadTrimmed,
    tailTrimmed,
    trimmedSeconds: round(leadTrimmed + tailTrimmed, 3)
  };
}

/**
 * Ventanas de locucion en tiempo absoluto de la pieza, para que los efectos y la
 * musica cedan mientras se habla. Palabras separadas por menos de `gapSeconds` se
 * unen en una sola ventana: cerrar y reabrir el ducking en cada silencio de 200 ms
 * produce un bombeo audible.
 */
export function speechWindows(words, window, offsetSeconds, gainDb, gapSeconds = 0.4) {
  const windows = [];
  for (const word of words ?? []) {
    if (word.end <= window.startSeconds || word.start >= window.endSeconds) continue;
    const start = Math.max(window.startSeconds, word.start) - window.startSeconds + offsetSeconds;
    const end = Math.min(window.endSeconds, word.end) - window.startSeconds + offsetSeconds;
    const previous = windows.at(-1);
    if (previous && start - previous.endSeconds <= gapSeconds) {
      previous.endSeconds = round(end, 3);
      continue;
    }
    windows.push({startSeconds: round(start, 3), endSeconds: round(end, 3), gainDb: Number(gainDb ?? -6)});
  }
  return windows;
}

/**
 * Silencio que queda dentro de la escena tras el recorte. El recorte automatico lo
 * deja acotado, pero un extremo declarado a mano puede esconder dos segundos de
 * nadie hablando, y eso solo se ve viendo la pieza.
 */
export function edgeSilence(words, startSeconds, endSeconds) {
  const inside = (words ?? []).filter(
    (word) => word.end > startSeconds && word.start < endSeconds
  );
  if (!inside.length) return {};
  return {
    speechLeadSeconds: round(Math.max(0, inside[0].start - startSeconds), 3),
    speechTailSeconds: round(Math.max(0, endSeconds - inside.at(-1).end), 3)
  };
}

/**
 * Medidas del arte de los assets de imagen, una vez por build. Si la media no esta
 * presente (carpeta ignorada por git, otra maquina) se avisa y las reglas de
 * presentacion se declaran no evaluables en vez de inventarse un veredicto.
 */
export async function measureArtwork(assets, warnings, analyze) {
  const measured = new Map();
  for (const asset of assets ?? []) {
    // Un asset de video no tiene "arte" que medir con sharp: su fondo cambia frame
    // a frame y las reglas de presentacion no le aplican.
    if (asset.kind === 'video') continue;
    try {
      measured.set(asset.id, await analyze(asset.file));
    } catch (error) {
      warnings.push(
        `no se pudo medir el arte de "${asset.id}" (${asset.file}): ${error.message}`
      );
    }
  }
  return measured;
}
