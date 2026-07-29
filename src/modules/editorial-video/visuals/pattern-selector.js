/**
 * Selección de patrón con ventana deslizante.
 *
 * ANM-H05 — El episodio 1 se montó con una tabla fija `kind → patrón`: cada
 * escena de un mismo `componentKey` producía siempre el mismo `patternId`, así
 * que `process.signal-flow` acabó siendo el 24 % del episodio y 17 de los 29
 * patrones del catálogo no se usaron nunca. Ningún planificador podía
 * diversificar porque no había entre qué elegir.
 *
 * Aquí el binding declara `patternCandidates` y este selector reparte. **No es
 * un algoritmo nuevo**: es el mecanismo de `VariantSelector`
 * (`sound-director.js`), que ya resolvió exactamente este problema en el
 * sonido, con el cooldown temporal sustituido por la ventana de seis escenas
 * que mide FC-R-020:
 *
 * - rotación sembrada por episodio → el punto de arranque de cada componentKey
 *   depende del episodio, no del orden de escritura del JSON;
 * - reparto acumulado → con la ventana satisfecha manda el uso total;
 * - la preferencia del binding se honra **solo mientras no se despegue del
 *   reparto de su grupo**; si se despega, manda la rotación.
 *
 * Esto NO sustituye a `planSceneVariety`: aquel rota énfasis, cámara y
 * dirección de arte y recibe el patrón ya decidido. Este decide el patrón.
 */
import {hashSeed, mulberry32} from './sound-director.js';

/** La misma ventana que mide FC-R-020, incluida la escena en curso. */
export const PATTERN_WINDOW = 6;
export const MAX_PATTERN_REPEATS_IN_WINDOW = 2;

export class PatternSelector {
  constructor({
    registry,
    episodeId = 'episode-sin-id',
    window = PATTERN_WINDOW,
    maxRepeats = MAX_PATTERN_REPEATS_IN_WINDOW
  }) {
    this.registry = registry;
    this.random = mulberry32(hashSeed(String(episodeId)));
    this.window = window;
    this.maxRepeats = maxRepeats;
    this.usage = new Map();
    this.lastUsedAt = new Map();
    this.cursor = new Map();
    this.chosen = [];
  }

  /**
   * Preferente primero; después los alternativos declarados.
   *
   * El preferente entra siempre: es el patrón con el que la escena ya se pinta.
   * Un alternativo, en cambio, tiene que existir en el catálogo y no estar
   * `planned`: rotar hacia un patrón sin componente no es variedad, es deuda
   * nueva. Diversificar bajando el listón de lo que se puede renderizar sería la
   * misma trampa que aprobar una regla sin comprobarla.
   */
  candidatesFor(componentKey) {
    const binding = this.registry?.get(componentKey) ?? null;
    if (!binding?.patternId) return [];
    const alternatives = (binding.patternCandidates ?? []).filter(
      (patternId) =>
        patternId !== binding.patternId &&
        this.registry.knowsPattern(patternId) &&
        (this.registry.patternStatus?.(patternId) ?? 'ready') !== 'planned'
    );
    return [...new Set([binding.patternId, ...alternatives])];
  }

  /** Rotación sembrada: el arranque por componentKey depende del episodio. */
  startCursor(componentKey, size) {
    if (!this.cursor.has(componentKey)) {
      this.cursor.set(componentKey, Math.floor(this.random() * size));
    }
    return this.cursor.get(componentKey);
  }

  /**
   * Apariciones del patrón en las escenas anteriores que comparten ventana con
   * la que se está decidiendo. Con `window = 6` son las cinco previas: si ya hay
   * dos, una tercera dispararía FC-R-020.
   */
  windowCount(patternId) {
    return this.chosen
      .slice(-(this.window - 1))
      .filter((entry) => entry === patternId).length;
  }

  select(componentKey) {
    const candidates = this.candidatesFor(componentKey);
    if (!candidates.length) {
      return {
        patternId: null,
        reason: `«${componentKey}» no tiene binding en pattern-bindings.json: ` +
          'no hay patrón que elegir.'
      };
    }
    const position = this.chosen.length;
    const preferred = candidates[0];
    const usageOf = (patternId) => this.usage.get(patternId) ?? 0;
    const minUsage = Math.min(...candidates.map(usageOf));
    const windowFree = (patternId) => this.windowCount(patternId) < this.maxRepeats;

    // El preferente del binding es una preferencia, no un cerrojo — el mismo
    // criterio que hizo falta en el sonido para que un alias frecuente dejara de
    // monopolizar su fichero. Se honra mientras la ventana lo admita y no se
    // haya despegado del reparto de su grupo.
    if (windowFree(preferred) && usageOf(preferred) <= minUsage) {
      return this.commit(preferred, componentKey, position, {
        rule: 'preferred',
        reason: `Patrón ${preferred}: preferente de «${componentKey}», ` +
          `${this.windowCount(preferred)} apariciones en la ventana de ` +
          `${this.window} y uso acumulado ${usageOf(preferred)} (mínimo del ` +
          `grupo ${minUsage}).`
      });
    }

    const start = this.startCursor(componentKey, candidates.length);
    const rotated = candidates.map(
      (_, offset) => candidates[(start + offset) % candidates.length]
    );
    const available = rotated.filter(windowFree);
    // Con la ventana satisfecha manda el reparto acumulado. Si todos los
    // candidatos están saturados no hay elección buena, solo la menos mala: el
    // visto hace más escenas. Ordenar por uso ahí reabriría un patrón usado hace
    // una escena teniendo otro de hace cinco.
    const chosen = available.length
      ? available.reduce(
        (best, patternId) => (usageOf(patternId) < usageOf(best) ? patternId : best),
        available[0]
      )
      : rotated.reduce((best, patternId) => {
        const bestLast = this.lastUsedAt.get(best) ?? -Infinity;
        const last = this.lastUsedAt.get(patternId) ?? -Infinity;
        if (last !== bestLast) return last < bestLast ? patternId : best;
        return usageOf(patternId) < usageOf(best) ? patternId : best;
      }, rotated[0]);

    const saturated = !available.length;
    return this.commit(chosen, componentKey, position, {
      rule: saturated ? 'window-saturated' : 'rotation',
      windowSaturated: saturated,
      reason: saturated
        ? `Patrón ${chosen}: todos los candidatos de «${componentKey}» ` +
          `(${candidates.join(', ')}) llegan al máximo de ${this.maxRepeats} en ` +
          `la ventana de ${this.window}; se usa el visto hace más escenas. ` +
          'FC-R-020 seguirá marcando esta escena: faltan candidatos en el binding.'
        : `Patrón ${chosen}: se aparta del preferente ${preferred} porque ` +
          (windowFree(preferred)
            ? `su uso acumulado (${usageOf(preferred)}) se despega del reparto ` +
              `del grupo (mínimo ${minUsage})`
            : `ya suma ${this.windowCount(preferred)} en la ventana de ${this.window}`) +
          `; la rotación sembrada de «${componentKey}» da ${chosen} ` +
          `(uso acumulado ${usageOf(chosen)}).`
    });
  }

  commit(patternId, componentKey, position, meta) {
    this.usage.set(patternId, (this.usage.get(patternId) ?? 0) + 1);
    this.lastUsedAt.set(patternId, position);
    this.chosen.push(patternId);
    return {patternId, componentKey, position, ...meta};
  }

  report() {
    return {
      window: this.window,
      maxRepeats: this.maxRepeats,
      scenes: this.chosen.length,
      distinctPatterns: new Set(this.chosen).size,
      usage: Object.fromEntries(
        [...this.usage.entries()].sort((left, right) => right[1] - left[1])
      )
    };
  }
}

/**
 * Recorre las escenas en orden y devuelve el patrón elegido para cada una.
 * Útil para tests y para cualquier build que ya tenga la lista completa.
 */
export function selectScenePatterns(scenes, options) {
  const selector = new PatternSelector(options);
  const selections = scenes.map((scene) =>
    selector.select(scene.componentKey ?? scene.kind ?? scene.props?.kind));
  return {selections, report: selector.report()};
}
