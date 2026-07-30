import {appendFile, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {CHECKS} from '../editorial-video/visuals/rules-engine.js';

/**
 * Intake de feedback: convierte una correccion del usuario en regla ejecutable.
 *
 * Una correccion dada una vez debe aplicarse siempre y por cualquier agente. El
 * mecanismo es identico en las tres superficies —registrar la nota, crear la regla
 * con id estable, dejar el esqueleto del validador y un fixture que la incumpla, y
 * regenerar el playbook— y solo cambian las rutas, el prefijo del id y la forma del
 * contexto que recibe el validador. Antes vivia duplicado en `channel-feedback.js`
 * y `shorts-feedback.js`; con una tercera superficie eso ya eran tres copias del
 * mismo bucle.
 */

/**
 * Siguiente id libre dentro del bloque de decenas de su seccion, de modo que el id
 * dice a que seccion pertenece la regla y no hace falta renumerar al insertar.
 */
export function nextRuleId(ruleSet, sectionId, {prefix = null} = {}) {
  const resolvedPrefix = prefix
    ?? ruleSet.rules[0]?.id?.split('-').slice(0, 2).join('-')
    ?? 'FC-R';
  const sectionNumber = ruleSet.sections.find((section) => section.id === sectionId)?.number ?? 0;
  const block = sectionNumber * 10;
  const used = ruleSet.rules
    .map((rule) => Number(rule.id.split('-').at(-1)))
    .filter((value) => Number.isFinite(value) && value >= block && value < block + 10);
  const next = used.length ? Math.max(...used) + 1 : block;
  return `${resolvedPrefix}-${String(next).padStart(3, '0')}`;
}

export function slugifyCheckId(value) {
  return String(value)
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/**
 * Esqueleto del validador. Devuelve una incidencia `todo` a proposito: mientras
 * este ahi, el test de regresion esta rojo y la regla no se puede dar por cerrada.
 */
function checkTemplate({checkId, statement, feedbackCommand, contextDoc}) {
  return `/**
 * Validador generado por \`${feedbackCommand}\`.
 *
 * Regla: ${statement}
 *
${contextDoc.split('\n').map((line) => ` * ${line}`.trimEnd()).join('\n')}
 *
 * Rellena \`run\` con la comprobación real. Mientras devuelva la incidencia TODO,
 * el fixture de regresión falla y la regla no se puede dar por cerrada.
 */
export default {
  id: ${JSON.stringify(checkId)},
  run(context, rule) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      // TODO: implementar la comprobación de ${checkId} sobre \`scene\`.
      void scene;
      void rule;
    }
    if (!issues.length) {
      return [{
        message: 'TODO: el validador ${checkId} aún no comprueba nada.',
        todo: true
      }];
    }
    return issues;
  }
};
`;
}

/**
 * Registra una correccion como regla.
 *
 * @param {object} options
 * @param {object} options.surface descriptor de la superficie: rutas, prefijo de
 *   id, comando de feedback, plantilla de contexto y fixture base.
 * @param {object} options.input `{note, section, severity, scope, check, statement, rationale}`
 * @returns {{ruleId: string, rule: object, created: string[], checkPending: boolean}}
 */
export async function recordFeedbackRule({surface, input, root}) {
  const ruleSet = await surface.loadRules();
  const sectionId = input.section || surface.defaultSection;
  if (!ruleSet.sections.some((section) => section.id === sectionId)) {
    throw new Error(
      `Sección desconocida «${sectionId}». Disponibles: ` +
      ruleSet.sections.map((section) => section.id).join(', ')
    );
  }

  const ruleId = nextRuleId(ruleSet, sectionId, {prefix: surface.idPrefix});
  const statement = input.statement || input.note;
  const checkId = input.check || `${surface.checkPrefix}${slugifyCheckId(input.note)}`;
  const isManual = checkId === 'manual';
  const known = isManual || Boolean(CHECKS[checkId]);

  const rule = {
    id: ruleId,
    section: sectionId,
    statement,
    rationale: input.rationale || input.note,
    scope: input.scope || 'catalog',
    severity: input.severity || 'warning',
    check: checkId,
    origin: {
      feedback: input.note,
      recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    },
    ...(isManual ? {} : {fixture: `${surface.fixturesRelativeDir}/${ruleId}.json`})
  };
  ruleSet.rules.push(rule);
  await writeFile(surface.rulesFile, `${JSON.stringify(ruleSet, null, 2)}\n`, 'utf8');

  const created = [];
  if (!known) {
    const checkFile = path.join(surface.checksDir, `${checkId}.js`);
    await mkdir(surface.checksDir, {recursive: true});
    await writeFile(checkFile, checkTemplate({
      checkId,
      statement,
      feedbackCommand: surface.feedbackCommand,
      contextDoc: surface.contextDoc
    }), 'utf8');
    created.push(path.relative(root, checkFile));
    // El playbook cuenta cuantas reglas tienen validador; sin releer el directorio
    // el esqueleto recien creado saldria como «sin implementar».
    await surface.loadChecks();
  }
  if (!isManual) {
    const fixtureFile = path.join(surface.fixturesDir, `${ruleId}.json`);
    await mkdir(surface.fixturesDir, {recursive: true});
    await writeFile(
      fixtureFile,
      `${JSON.stringify({
        ruleId,
        statement,
        check: checkId,
        expect: 'fail',
        note: 'Montaje mínimo que INCUMPLE la regla. El test verifica que el motor la detecta.',
        context: surface.fixtureContext()
      }, null, 2)}\n`,
      'utf8'
    );
    created.push(path.relative(root, fixtureFile));
  }

  await appendFile(
    surface.logFile,
    `${JSON.stringify({
      ruleId,
      ...rule.origin,
      severity: rule.severity,
      scope: rule.scope,
      check: checkId
    })}\n`,
    'utf8'
  );

  return {ruleId, rule, ruleSet, created, checkPending: !known};
}
