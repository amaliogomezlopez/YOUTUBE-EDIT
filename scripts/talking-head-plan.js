#!/usr/bin/env node
import path from 'node:path';
import {loadTalkingHeadSounds} from '../src/modules/talking-head/sounds.js';
import {readJson,writeJson,parseCliArgs,run} from '../src/lib/utils.js';
import {projectDir,REMOTION_ROOT} from '../src/modules/shorts-studio/constants.js';
import {parseSilences} from '../src/modules/video-studio/visual-analysis.js';
import {planTalkingHead} from '../src/modules/talking-head/planner.js';
const args=parseCliArgs(process.argv.slice(2));
if(!args.slug || !args.editorial) throw new Error('Uso: npm run talking-head:plan -- --slug <slug> --editorial <editorial.json>');
const project=projectDir(args.slug), manifest=await readJson(path.join(project,'manifest.json'));
const editorial=await readJson(path.resolve(args.editorial));
const transcripts={}, silences={};
for(const clip of manifest.clips){
  transcripts[clip.id]=await readJson(path.join(project,clip.transcript));
  const audio=await run('ffmpeg',['-hide_banner','-i',path.join(REMOTION_ROOT,'public',clip.file),'-vn','-af','silencedetect=noise=-35dB:d=0.35','-f','null','-']);
  silences[clip.id]=parseSilences(audio.stderr,clip.durationSeconds);
}
const soundSelection=await loadTalkingHeadSounds({log:console.log});
const plan=planTalkingHead({manifest,transcripts,silences,...editorial,soundSelection});
const destination=path.join(project,'short-plan.json');
await writeJson(destination,plan);
await writeJson(path.join(project,'talking-head-analysis.json'),{silences,editorial,sourceDuration:manifest.totalClipSeconds});
console.log(destination+' ('+plan.scenes.length+' escenas)');
