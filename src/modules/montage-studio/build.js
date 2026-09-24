import path from 'node:path';
import {readFileSync} from 'node:fs';
import {readJson, writeJson} from '../../lib/utils.js';
import {MONTAGE_FORMATS, REMOTION_ROOT, projectDir} from './constants.js';
import {planMontage} from './planner.js';
import {profileBudget, resolveMontageProfile} from './profiles.js';
import {writeMontageRegistries} from './registry.js';
import {formatIssue, runMontageRules} from './rules/index.js';

export const MONTAGE_GEOMETRY = JSON.parse(readFileSync(path.join(REMOTION_ROOT, 'src', 'montage', 'geometry.json'), 'utf8'));

/**
 * Compila `montage-plan.json` contra el manifest y la transcripcion y escribe un
 * `montage-build.<formato>.json` por cada formato del plan. Las reglas se ejecutan
 * contra el build resuelto antes de escribirlo: un `error` no deja un build que
 * Remotion pueda renderizar.
 */
export async function buildMontage({slug, formats = null, log = () => {}}) {
  const project = projectDir(slug);
  const plan = await readJson(path.join(project, 'montage-plan.json'));
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const {words} = await readJson(path.join(project, manifest.transcript));
  const profile = resolveMontageProfile(plan.profileId);
  const formatIds = formats ?? plan.formats ?? ['9x16'];

  const builds = [];
  for (const formatId of formatIds) {
    const format = MONTAGE_FORMATS[formatId];
    if (!format) throw new Error(`Formato desconocido "${formatId}". Disponibles: ${Object.keys(MONTAGE_FORMATS).join(', ')}`);
    const geometry = MONTAGE_GEOMETRY.formats[formatId];
    const planned = planMontage({
      words,
      voiceDurationSeconds: manifest.voiceover.durationSeconds,
      assets: manifest.assets,
      plan,
      profile,
      format,
      geometry,
      musicAvailable: Boolean(manifest.music)
    });
    const build = {
      version: 1,
      slug,
      generatedAt: new Date().toISOString(),
      format,
      profileId: profile.id,
      durationInFrames: planned.durationInFrames,
      durationSeconds: planned.durationSeconds,
      window: planned.window,
      voiceover: {
        src: manifest.voiceover.src,
        trimStartSeconds: planned.window.startSeconds,
        volume: Number(plan.voiceVolume ?? profile.voiceVolume)
      },
      music: manifest.music ? {
        src: manifest.music.src,
        volume: Number(plan.music?.volume ?? profile.music.volume),
        durationSeconds: manifest.music.durationSeconds
      } : null,
      duckWindows: planned.duckWindows,
      soundEnabled: plan.sound?.enabled ?? true,
      soundMix: Number(plan.sound?.mix ?? profile.soundMix),
      soundCues: planned.soundCues,
      accentColor: plan.accentColor ?? profile.captions.activeColor,
      geometry,
      beats: planned.beats,
      hitEffects: planned.hitEffects,
      captions: planned.captions,
      budget: profileBudget(profile),
      warnings: planned.warnings
    };

    const {issues, summary} = await runMontageRules(build, {exceptions: plan.ruleExceptions ?? []});
    build.rules = {summary, issues};
    const blocking = issues.filter((issue) => issue.severity === 'error');
    for (const issue of issues.filter((issue) => issue.severity !== 'error')) build.warnings.push(formatIssue(issue));
    if (blocking.length) {
      throw new Error(
        `El montaje ${formatId} incumple ${blocking.length} regla(s):\n` +
        blocking.map((issue) => `  - ${formatIssue(issue)}`).join('\n')
      );
    }
    await writeJson(path.join(project, `montage-build.${formatId}.json`), build);
    const sounds = build.soundCues.length;
    log(`build ${formatId}: ${build.beats.length} beats, ${build.durationSeconds}s, ${sounds} sonidos, ` +
      `${build.beats.reduce((n, beat) => n + beat.overlays.length, 0)} textos, perfil ${profile.id}`);
    log(`  reglas: ${summary.passed}/${summary.total} pasan, ${summary.warnings} avisos, ${summary.skipped} no evaluables`);
    for (const warning of build.warnings) log(`  aviso: ${warning}`);
    builds.push(build);
  }
  const registered = await writeMontageRegistries();
  log(`registro: ${registered.map((entry) => entry.id).join(', ')}`);
  return builds;
}
