import {finalizeShortAudio,verifyShortMedia} from '../video-studio/render-quality.js';import path from 'node:path';import {shortCaptionPagesToAss} from '../../lib/subtitles.js';import {readJson,run,writeJson} from '../../lib/utils.js';
import {projectDir,REMOTION_ROOT} from './constants.js';import {compositionIdForSlug} from './registry.js';
import {freezeProject,loadFrozenProject} from '../video-studio/project-lock.js';import {assertRenderCapability} from '../video-studio/render-adapters.js';
import {reviewTransitions} from '../video-studio/camera-review.js';import {renderCameraProject} from './camera-render.js';
export async function renderShortProject({slug,engine='remotion',version,options=[]}){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Slug invalido');
 if(options.some(x=>/^--(props|frames|scale|fps|width|height|codec|pixel-format|color-space|image-format)(=|$)/.test(x)))throw Error('Un render versionado no admite overrides de props, frames ni formato');
 const project=projectDir(slug);
 const candidate=version?await loadFrozenProject(project,version):{build:await readJson(path.join(project,'short-build.json'))};assertRenderCapability(engine,candidate.build);
 const frozen=version?candidate:await freezeProject(project),build=frozen.build;
 let result;
 if(engine==='ffmpeg'){
  const scene=build.scenes[0],compiled=structuredClone(scene.screenCamera);
  if(compiled.captions)compiled.captions.ass=shortCaptionPagesToAss(scene.captionPages,{fps:build.format.fps,style:compiled.captions.plan.style,rect:scene.captionRect});
  compiled.soundCues=build.soundEnabled?build.soundCues:[];compiled.fingerprint=frozen.id;
  result=await renderCameraProject(project,{resolved:{compiled,manifest:{source:path.join(REMOTION_ROOT,'public',scene.src)},plan:frozen.lock.plan,regions:frozen.lock.plan.scenes[0].screenCamera.regions,transcript:frozen.lock.transcripts[scene.clipId],fontsDir:path.join(frozen.dir,'environment/assets/fonts')},log:console.log});
 }else{
  const rendered=await run(process.execPath,['scripts/render-safe.mjs','render','shorts-'+slug,compositionIdForSlug(slug),slug+'.mp4','--codec=h264','--pixel-format=yuv420p','--color-space=bt709','--image-format=png','--props',path.join(frozen.dir,'short-build.json'),...options],{cwd:REMOTION_ROOT,timeoutMs:1200000});
  const match=rendered.stdout.match(/Manifest: (.+)/);if(!match)throw Error('No se encontro manifiesto de render');
  const manifestPath=match[1].trim(),manifest=await readJson(manifestPath),dir=path.dirname(manifestPath);
  const output=manifest.outputs.find(p=>p.endsWith('.mp4'));if(!output)throw Error('Render sin MP4');result={output:path.resolve(dir,output),run:dir};
 }
 if(engine==='remotion'){
  const normalized=path.join(result.run,'final.mp4');await finalizeShortAudio(result.output,normalized,{duration:build.durationInFrames/build.format.fps,overwrite:false});result.output=normalized;
  result.qa=await verifyShortMedia(normalized,{duration:build.durationInFrames/build.format.fps});await writeJson(path.join(result.run,'qa.json'),result.qa);if(!result.qa.passed)throw Error('QA tecnico Remotion fallido: '+result.qa.errors.join('; '));
 }
 const review=await reviewTransitions(result.output,build,result.run);
 await writeJson(path.join(result.run,'project-version.json'),{version:frozen.id,engine,options,reviewPassed:review.passed});
 return {...result,version:frozen.id,review};
}
