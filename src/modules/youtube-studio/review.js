import path from 'node:path';

const when = (d) => (Number.isFinite(d.at) ? `${d.at.toFixed(1)} s` : `toma ${d.clipId}${Number.isFinite(d.atSource) ? ` (${d.atSource.toFixed(2)} s de fuente)` : ''}`);

/** REVIEW.md for the editor: what was decided, why, and what still needs a human. */
export function reviewMarkdown({slug, steps, planFile, plan, video, qa}) {
  return [
    `# Primer montaje: ${slug}`,
    '',
    `Pasos: ${steps.join(' → ')}. Estado editorial: pendiente de tu revision.`,
    '',
    video ? `- Video: [${path.basename(video)}](${video.replace(/\\/g, '/')})` : '- Sin render (--no-render).',
    `- Plan: \`${planFile}\` (${plan.decisions.length} decisiones, ${plan.duration} s)`,
    qa ? `- QA: ${qa.passed ? 'sin errores' : qa.errors.length + ' errores'}, ${qa.warnings.length} avisos. Hoja: ${qa.reviewSheet ?? '—'}` : '',
    '',
    '## Decisiones',
    ...plan.decisions.filter((d) => d.type !== 'music').map((d) => `- ${when(d)} · ${d.type}${d.layout ? ' ' + d.layout : ''} — ${d.reason}`),
    '',
    '## Pendiente',
    ...(plan.pendingAssets?.length ? plan.pendingAssets.map((x) => `- ${x.name ?? x.resource ?? x.url}: ${x.reason}`) : ['- Nada.']),
    ...(qa ? [...qa.errors, ...qa.warnings].map((x) => `- ${x.at != null ? x.at + ' s: ' : ''}${x.message}`) : []),
    ...plan.warnings.map((w) => `- ${w}`),
    '',
    'Correcciones: `npm run youtube:feedback` sobre el paquete, o `youtube:autoplan export` y corregir en DaVinci.',
    ''
  ].join('\n');
}
