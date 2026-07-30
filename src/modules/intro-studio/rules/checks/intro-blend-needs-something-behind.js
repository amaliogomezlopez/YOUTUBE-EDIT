import {rectsOverlap, subjectRect} from '../../geometry.js';

/**
 * Validador nacido de un montaje real: el logo de Kimi desaparecio en la escena de
 * cierre de la intro de `canal-amalio`.
 *
 * `blend` compone con `screen` para que el rectangulo negro de un logo exportado sin
 * alfa desaparezca sobre el video. Pero `screen` no distingue: sobre el fondo del
 * tema, que tambien es oscuro, lo que desaparece es el logo entero. La presentacion
 * era la correcta —la exige IN-R-021— y aun asi no se veia nada, porque el problema
 * no estaba en el arte sino en *donde* caia el cue.
 *
 * La condicion es de sitio, y no es la misma segun la profundidad:
 *
 * - Un cue `front` se dibuja sobre el sujeto, asi que le vale con caer sobre su
 *   video: ahi `screen` tiene algo con lo que sumar.
 * - Un cue `back` se dibuja *antes* que el sujeto, asi que la parte que lo solapa
 *   queda tapada y lo unico que se ve es justo la parte que cae fuera, sobre el
 *   fondo del tema. Para un cue de fondo, `blend` sin backdrop no se ve nunca.
 *
 * Esa asimetria es la que hacia invisible al logo de Kimi: el 73 % de su rectangulo
 * caia sobre el sujeto, que parecia suficiente, pero era precisamente el 73 % que la
 * tarjeta del sujeto tapaba.
 */
export default {
  id: 'intro-blend-needs-something-behind',
  run(context, rule) {
    const minCoverage = rule?.params?.minCoverage ?? 0.5;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      // Un backdrop cubre el frame entero: con el, cualquier cue tiene algo detras.
      if (scene.backdrop) continue;
      const subject = subjectRect(scene.layout);
      for (const cue of scene.cues ?? []) {
        if (cue.presentation !== 'blend') continue;
        if (cue.depth === 'back') {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El cue «${cue.id}» va detrás del sujeto con «blend» y la escena no ` +
              'tiene backdrop: lo único que se ve de un cue de fondo es la parte que el ' +
              'sujeto no tapa, y ahí `screen` se suma contra el fondo del tema y ' +
              'desaparece. Dale backdrop a la escena o súbelo a `depth: "front"`.'
          });
          continue;
        }
        if (!rectsOverlap(cue.rect, subject)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El cue «${cue.id}» se presenta con «blend» pero su rectángulo no ` +
              `toca el vídeo del sujeto (layout ${scene.layout}) y la escena no tiene ` +
              'backdrop: `screen` sobre el fondo del tema lo hace invisible.'
          });
          continue;
        }
        const covered = overlapArea(cue.rect, subject) / (cue.rect.width * cue.rect.height);
        if (covered >= minCoverage) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El cue «${cue.id}» se presenta con «blend» y solo el ` +
            `${Math.round(covered * 100)} % de su rectángulo cae sobre el vídeo ` +
            `(mínimo ${Math.round(minCoverage * 100)} %): el resto se suma contra el fondo ` +
            'del tema y desaparece. Dale backdrop a la escena o muévelo sobre el sujeto.'
        });
      }
    }
    return issues;
  }
};

function overlapArea(a, b) {
  const width = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const height = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return Math.max(0, width) * Math.max(0, height);
}
