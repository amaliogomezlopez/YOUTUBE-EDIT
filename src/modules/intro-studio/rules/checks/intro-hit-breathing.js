import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Respiro entre golpes.
 *
 * IN-R-041 limita los golpes visuales por segundo; esta regla mide lo que percibe el
 * espectador, que es la suma de lo que ve y lo que oye. Un flash, el whoosh de un
 * corte y el pop de una palabra clave separados por 300 ms son tres golpes aunque
 * solo uno sea un efecto fuerte, y con un golpe por segundo sostenido la apertura se
 * vuelve cargante (feedback del usuario sobre la apertura de Claude Opus 5.5).
 *
 * Instante de golpe: cada efecto fuerte y cada efecto de sonido, fundiendo en uno
 * los que caen a menos de 120 ms (un corte con su whoosh y su flash es un solo
 * golpe). El techo por ventana deslizante lo fija el perfil en
 * `budget.hitBreathing = {windowSeconds, maxHits}`.
 */
const MERGE_SECONDS = 0.12;

export default {
  id: 'intro-hit-breathing',
  run(context) {
    const limit = context.budget?.hitBreathing;
    if (!Number.isFinite(limit?.windowSeconds) || !Number.isFinite(limit?.maxHits)) {
      return notEvaluable(
        'El perfil no declara `hitBreathing` ({windowSeconds, maxHits}); sin techo de ' +
        'golpes por ventana no hay contra qué medir.'
      );
    }

    const moments = [
      ...(context.scenes ?? []).flatMap((scene) => (scene.effects ?? [])
        .filter((effect) => effect.strong)
        .map((effect) => ({
          sceneId: scene.id,
          atSeconds: Number(effect.absoluteSeconds ?? effect.atSeconds),
          what: effect.effect
        }))),
      ...(context.soundCues ?? []).map((cue) => ({
        sceneId: null,
        // Un riser o un whoosh inverso empiezan antes del corte y golpean en el: cuenta
        // el instante que se oye (`hitSeconds`), no el arranque del fichero.
        atSeconds: Number(cue.hitSeconds ?? cue.startSeconds),
        what: 'sonido'
      }))
    ].filter((moment) => Number.isFinite(moment.atSeconds))
      .sort((a, b) => a.atSeconds - b.atSeconds);

    const hits = [];
    for (const moment of moments) {
      const last = hits.at(-1);
      if (last && moment.atSeconds - last.atSeconds < MERGE_SECONDS) {
        last.what.add(moment.what);
        last.sceneId ??= moment.sceneId;
        continue;
      }
      hits.push({...moment, what: new Set([moment.what])});
    }

    const issues = [];
    let clearUntil = -Infinity;
    for (const hit of hits) {
      if (hit.atSeconds < clearUntil) continue;
      const end = hit.atSeconds + limit.windowSeconds;
      const inside = hits.filter((other) => other.atSeconds >= hit.atSeconds && other.atSeconds < end);
      if (inside.length <= limit.maxHits) continue;
      // Una incidencia por tramo cargado, no una por cada golpe que lo abre.
      clearUntil = end;
      issues.push({
        sceneId: hit.sceneId ?? sceneAt(context, hit.atSeconds),
        message: `${inside.length} golpes en ${limit.windowSeconds}s desde ${round(hit.atSeconds)}s ` +
          `(${inside.map((other) => `${round(other.atSeconds)}s ${[...other.what].join('+')}`).join(', ')}); ` +
          `el perfil «${context.budget.profileId ?? context.profileId}» admite ${limit.maxHits}. ` +
          'Deja respirar: el golpe solo donde la frase lo pide y, entre medias, zoom de cámara.'
      });
    }
    return issues;
  }
};

const round = (value) => Math.round(value * 100) / 100;

function sceneAt(context, seconds) {
  const fps = context.format?.fps ?? 60;
  const scene = (context.scenes ?? []).find(
    (candidate) => seconds >= candidate.from / fps && seconds < (candidate.from + candidate.durationInFrames) / fps
  );
  return scene?.id ?? null;
}
