/**
 * El texto en pantalla tiene que anadir informacion. El caso real: en la escena de
 * resultados habia tres chips `TIEMPO / TOKENS / PRECIO` mientras la locucion decia
 * «en cuanto a tiempo, tokens y precio». No aportaban nada que el subtitulo no
 * dijera ya, y ocupaban el sitio del dato.
 *
 * Solo se miden chips y cifras: un rotulo que repite el nombre de una entidad
 * («KIMI K3» sobre la captura) si aporta, porque fija en la imagen a quien pertenece
 * lo que se ve. Y solo se marca cuando *todas* las palabras del cue, nota incluida,
 * ya estan en la locucion de su propia ventana.
 */
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function tokens(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export default {
  id: 'shorts-onscreen-text-adds-information',
  run(context, rule) {
    const types = new Set(rule?.params?.types ?? ['chip', 'stat']);
    const windowSeconds = rule?.params?.windowSeconds ?? 1.5;
    const fps = context.format?.fps ?? 60;
    const margin = windowSeconds * fps;
    const issues = [];

    for (const scene of context.scenes ?? []) {
      const narration = (scene.captionPages ?? []).flatMap((page) => page.words ?? []);
      if (!narration.length) continue;
      for (const cue of scene.cues ?? []) {
        if (!types.has(cue.type) || !cue.text) continue;
        const from = cue.fromFrame - margin;
        const to = cue.fromFrame + cue.durationInFrames + margin;
        const spoken = new Set(
          narration
            .filter((word) => word.toFrame >= from && word.fromFrame <= to)
            .flatMap((word) => tokens(word.text))
        );
        const written = tokens(`${cue.text} ${cue.note ?? ''}`);
        if (!written.length) continue;
        if (!written.every((token) => spoken.has(token))) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `«${cue.text}» repite palabra por palabra lo que dice la locucion ` +
            'en esa misma ventana: lo cuenta ya el subtitulo. Cambia el texto por un ' +
            'dato que no se oiga, o retira el cue.'
        });
      }
    }
    return issues;
  }
};
