#!/usr/bin/env node
/**
 * ANM-I02 — Genera `editing-playbook.md` **desde** `editing-rules.json`.
 *
 * La prosa nunca puede desincronizarse del contrato: el markdown es una vista,
 * no una fuente. Editar el .md a mano no cambia nada; edita el JSON.
 *
 *   node scripts/render-editing-playbook.js --channel finance-cavaliers [--check]
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  auditRuleCoverage,
  loadCustomChecks
} from '../src/modules/editorial-video/visuals/rules-engine.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SEVERITY_BADGE = {
  error: '`error`',
  warning: '`warning`',
  review: '`review`'
};

export function renderPlaybook(ruleSet) {
  const lines = [];
  lines.push(`# ${ruleSet.title}`);
  lines.push('');
  lines.push('<!-- GENERADO por scripts/render-editing-playbook.js desde');
  lines.push('     channels/' + ruleSet.channelId + '/brand/editing-rules.json.');
  lines.push('     No editar a mano: los cambios se pierden en la siguiente generación. -->');
  lines.push('');
  lines.push(ruleSet.intro);
  lines.push('');
  lines.push('## Cómo leer este documento');
  lines.push('');
  lines.push('| Severidad | Efecto |');
  lines.push('| --- | --- |');
  for (const [severity, description] of Object.entries(ruleSet.severities)) {
    lines.push(`| ${SEVERITY_BADGE[severity] ?? severity} | ${description} |`);
  }
  lines.push('');
  lines.push('| Ámbito | Significado |');
  lines.push('| --- | --- |');
  for (const [scope, description] of Object.entries(ruleSet.scopes)) {
    lines.push(`| \`${scope}\` | ${description} |`);
  }
  lines.push('');
  const coverage = auditRuleCoverage(ruleSet);
  lines.push(
    `Reglas: **${coverage.total}** · con validador automático: ` +
    `**${coverage.automated - coverage.missingCheck.length}** · marcadas ` +
    `\`manual\`: **${coverage.manual}** · sin implementar: ` +
    `**${coverage.missingCheck.length}**.`
  );
  lines.push('');
  lines.push(ruleSet.promotionPolicy);
  lines.push('');

  const bySection = new Map();
  for (const rule of ruleSet.rules) {
    const list = bySection.get(rule.section) ?? [];
    list.push(rule);
    bySection.set(rule.section, list);
  }

  for (const section of [...ruleSet.sections].sort((a, b) => a.number - b.number)) {
    const rules = bySection.get(section.id) ?? [];
    if (!rules.length) continue;
    lines.push(`## ${section.number}. ${section.title}`);
    lines.push('');
    for (const note of section.notes ?? []) {
      lines.push(`- ${note}`);
    }
    if (section.notes?.length) lines.push('');
    for (const rule of rules) {
      lines.push(`### ${rule.id} · ${SEVERITY_BADGE[rule.severity]} · \`${rule.scope}\``);
      lines.push('');
      lines.push(rule.statement);
      lines.push('');
      if (rule.rationale) {
        lines.push(`**Por qué:** ${rule.rationale}`);
        lines.push('');
      }
      const checkLabel = rule.check === 'manual'
        ? 'revisión humana (sin comprobación geométrica posible)'
        : `\`${rule.check}\``;
      const params = rule.params
        ? ` · parámetros: \`${JSON.stringify(rule.params)}\``
        : '';
      lines.push(`**Validador:** ${checkLabel}${params}`);
      lines.push('');
    }
  }

  lines.push('## Ciclo de feedback');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run channel:feedback -- --channel ' + ruleSet.channelId +
    ' --note "el conector atraviesa la tarjeta" --section spatial-safety --severity error');
  lines.push('```');
  lines.push('');
  lines.push('El comando registra la corrección, crea la regla con id estable, ' +
    'genera el esqueleto del validador y el fixture que la incumple, y regenera ' +
    'este documento. Una corrección dada una vez queda aplicada para siempre y ' +
    'para cualquier agente.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const argv = process.argv.slice(2);
  const channelIndex = argv.indexOf('--channel');
  const channelId = channelIndex >= 0 ? argv[channelIndex + 1] : 'finance-cavaliers';
  const check = argv.includes('--check');
  const rulesFile = path.join(ROOT, 'channels', channelId, 'brand', 'editing-rules.json');
  const outputFile = path.join(ROOT, 'channels', channelId, 'brand', 'editing-playbook.md');
  await loadCustomChecks();
  const ruleSet = JSON.parse(await readFile(rulesFile, 'utf8'));
  const markdown = renderPlaybook(ruleSet);
  if (check) {
    const current = await readFile(outputFile, 'utf8').catch(() => '');
    if (current.trim() !== markdown.trim()) {
      console.error(
        `${path.relative(ROOT, outputFile)} está desincronizado con editing-rules.json. ` +
        'Ejecuta `npm run channel:playbook`.'
      );
      process.exitCode = 1;
      return;
    }
    console.log('El playbook está sincronizado con el contrato.');
    return;
  }
  await writeFile(outputFile, `${markdown}\n`, 'utf8');
  console.log(
    `${path.relative(ROOT, outputFile)} regenerado desde ${ruleSet.rules.length} reglas.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
