import path from 'node:path';
import {constants, existsSync} from 'node:fs';
import {copyFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ROOT, DATA_DIR, ensureDir, readJson, writeJson, run} from '../../lib/utils.js';
import {ffprobe} from '../../lib/ffmpeg.js';
import {getSttConfig, transcribeAudio} from '../../lib/stt.js';
import {importRemotionAsset} from '../../lib/remotion-assets.js';
import {ingestShortProject} from '../shorts-studio/ingest.js';
import {buildShort} from '../shorts-studio/build.js';
import {projectDir, mediaDir, REMOTION_ROOT, slugify, VIDEO_EXTENSIONS} from '../shorts-studio/constants.js';
import {compositionIdForSlug} from '../shorts-studio/registry.js';
import {toMp4, flattenWords} from '../video-studio/media-ingest.js';
import {hashMedia} from '../video-studio/folder-sounds.js';
import {parseSilences} from '../video-studio/visual-analysis.js';
import {finalizeShortAudio, verifyShortMedia} from '../video-studio/render-quality.js';
import {createRunDirectory, renderPathFor, previewPathFor, completeRun} from '../../../remotion-animations/scripts/lib/output-run.mjs';
import {planTalkingHead, profiles} from './planner.js';
import {scheduleShots, scheduleSelections, scheduleFingerprint} from './shot-schedule.js';
import {loadTalkingHeadSounds} from './sounds.js';

export function reelPaths(slug) {
  if (typeof slug !== 'string' || !/^talking-head-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Usa un slug talking-head-<nombre>, solo letras minusculas, numeros y guiones.');
  return {slug, project:projectDir(slug), work:path.join(DATA_DIR,'talking-head',slug), media:mediaDir(slug)};
}
const backup = async file => {
  if (existsSync(file)) await copyFile(file,file+'.'+Date.now()+'.bak',constants.COPYFILE_EXCL);
};
const publicFile = file => {
  if (!file || typeof file!=='string') throw new Error('Falta ruta de medio en manifest');
  const root = path.join(REMOTION_ROOT,'public'), target = path.resolve(root,file);
  const relative = path.relative(root,target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(target)) throw new Error('Medio local inexistente o fuera de public: '+file);
  return target;
};

export function auditWords(words, duration) {
  const issues = [];
  if (!words?.length) return [{index:null,message:'Falta transcripcion por palabras',blocking:true}];
  words.forEach((w,i)=>{
    if (![w.start,w.end].every(Number.isFinite) || w.start<0 || w.end<=w.start || w.end>duration+.05) issues.push({index:i,message:'Tiempos invalidos',blocking:true});
    if (w.timing==='approximate') issues.push({index:i,message:'Tiempo estimado; necesita transcripcion con word timestamps',blocking:true});
    if (i && w.start<words[i-1].start || i && w.start<words[i-1].end-.04) issues.push({index:i,message:'Palabras solapadas o fuera de orden',blocking:true});
    if (w.end-w.start>1.5) issues.push({index:i,message:'Palabra anormalmente larga: comprobar alineacion',blocking:false});
    if (w.confidence!=null && w.confidence<.5) issues.push({index:i,message:'Confianza baja: comprobar lo pronunciado',blocking:false});
  });
  return issues;
}

async function context(slug) {
  const paths = reelPaths(slug);
  const manifest = await readJson(path.join(paths.project,'manifest.json'));
  const transcripts = {}, silences = {}, issues = {};
  const cacheFile = path.join(paths.work,'audio-analysis.json');
  const cache = await readJson(cacheFile).catch(()=>({}));
  for (const clip of manifest.clips) {
    if (!clip.transcript) throw new Error('Falta transcripcion de '+clip.id+'. Repite start con STT configurado o --transcript <JSON>.');
    transcripts[clip.id] = await readJson(path.join(paths.project,clip.transcript));
    const source = publicFile(clip.file), hash = await hashMedia(source);
    if (cache[clip.id]?.hash!==hash) {
      const measured = await run('ffmpeg',['-hide_banner','-i',source,'-vn','-af','silencedetect=noise=-35dB:d=0.35','-f','null','-']);
      cache[clip.id]={hash,silences:parseSilences(measured.stderr,clip.durationSeconds)};
    }
    silences[clip.id]=cache[clip.id].silences;
    issues[clip.id]=auditWords(transcripts[clip.id].words,clip.durationSeconds);
  }
  await writeJson(cacheFile,cache);
  return {...paths, manifest, transcripts, silences, issues, budget:profiles.editorial};
}

export async function startReel({video, slug, transcript, faceTracking=true, log=()=>{}}) {
  if (!video || !existsSync(video)) throw new Error('Falta --video con una ruta existente');
  const source = path.resolve(video), sourceHash = await hashMedia(source);
  const name = slug ?? ('talking-head-'+slugify(path.basename(source,path.extname(source))).slice(0,55)+'-'+sourceHash.slice(0,6));
  const paths = reelPaths(name.startsWith('talking-head-')?name:'talking-head-'+name);
  const intakeFile = path.join(paths.work,'intake.json');
  const intake = await readJson(intakeFile).catch(()=>null);
  if ((intake && intake.sourceHash!==sourceHash) || (!intake && existsSync(path.join(paths.project,'manifest.json')))) throw new Error('Ese slug pertenece a otro proyecto. Elige uno nuevo; no se sobrescribe.');
  if (!transcript && getSttConfig().provider==='off' && !existsSync(path.join(paths.project,'transcripts','01.json'))) throw new Error('Configura TRANSCRIPTION_PROVIDER=faster-whisper en .env o aporta --transcript con palabras y tiempos.');
  const sourceDir=path.join(paths.work,'source');
  await ensureDir(sourceDir);
  const original=path.join(sourceDir,'presentador'+path.extname(source).toLowerCase());
  if (!existsSync(original)) await copyFile(source,original,constants.COPYFILE_EXCL);
  await writeJson(intakeFile,{version:1,sourceHash,original,sourcePath:source,styleId:profiles.editorial.styleId});
  if (transcript) {
    const supplied=await readJson(path.resolve(transcript));
    if (!supplied.words?.length) throw new Error('--transcript requiere JSON con words:[{text,start,end}]');
    const target=path.join(paths.project,'transcripts','01.json');
    await backup(target);
    await writeJson(target,supplied);
  }
  const existing=await readJson(path.join(paths.project,'manifest.json')).catch(()=>null);
  if (!existing?.clips.every(c=>c.transcript) || transcript) {
    await ingestShortProject({sourceDir,slug:paths.slug,faceTracking,reuseTranscripts:true,log});
  }
  const c=await context(paths.slug);
  const sourcePreviews=[];
  for (const clip of c.manifest.clips) {
    const preview=path.join(paths.work,'source-review-'+clip.id+'.jpg');
    if (!existsSync(preview)) await run('ffmpeg',['-n','-i',publicFile(clip.file),'-vf','fps=3/'+clip.durationSeconds+',scale=480:-1,tile=3x1','-frames:v','1',preview]);
    sourcePreviews.push(preview);
  }
  const reviewFile=path.join(paths.work,'selection.json');
  if (!existsSync(reviewFile)) await writeJson(reviewFile,{reviewed:false,reviewNotes:'',selections:c.manifest.clips.map(clip=>({clipId:clip.id,fromWord:0,toWord:c.transcripts[clip.id].words.length-1,reason:'Seleccion inicial: revisar tomas fallidas, repeticiones y cierre completo.'}))});
  await writeFile(path.join(paths.work,'transcript-indexed.txt'),c.manifest.clips.map(clip=>[
    'CLIP '+clip.id+' | '+clip.durationSeconds+' s | cara: '+clip.faceConfidence,
    ...c.transcripts[clip.id].words.map((w,i)=>`${i}\t${w.start.toFixed(3)}-${w.end.toFixed(3)}\t${w.text}`)
  ].join('\n')).join('\n\n'));
  await writeJson(path.join(paths.work,'review-context.json'),{issues:c.issues,sourcePreviews,clips:c.manifest.clips.map(clip=>({...clip,localFile:publicFile(clip.file)})),silences:c.silences,next:'Revisar transcript-indexed.txt y el video. Editar selection.json y marcar reviewed:true. Ejecutar prepare.'});
  log('Preparado: '+paths.work);
  return {slug:paths.slug,work:paths.work,next:`npm run talking-head -- prepare --slug ${paths.slug}`};
}

async function selectedContext(slug) {
  const c=await context(slug), selection=await readJson(path.join(c.work,'selection.json'));
  if (selection.reviewed!==true || !selection.reviewNotes?.trim()) throw new Error('El agente debe revisar las tomas, escribir reviewNotes y marcar reviewed:true en selection.json.');
  for (const s of selection.selections ?? []) {
    const invalid=c.issues[s.clipId]?.filter(i=>i.blocking && (i.index==null || i.index>=s.fromWord && i.index<=s.toWord)) ?? [];
    if (invalid.length) throw new Error('Corregir transcripcion del clip '+s.clipId+': '+JSON.stringify(invalid.slice(0,8)));
  }
  const selections=selection.selections;
  const schedule=scheduleShots({...c,selections});
  const fingerprint=scheduleFingerprint({...c,selections});
  return {...c,selections,schedule,fingerprint};
}

export async function prepareReel({slug}) {
  const c=await selectedContext(slug), file=path.join(c.work,'asset-requests.json');
  const existing=await readJson(file).catch(()=>null);
  if (existing?.fingerprint===c.fingerprint) return {file,reused:true,shots:existing.shots.length};
  await backup(file);
  await writeJson(file,{version:1,fingerprint:c.fingerprint,styleId:c.budget.styleId,
    instructions:'Rellena resource en cada visual. No edites id, anclas ni tiempos. Busca recursos reales relacionados con spokenText. El primer campo localFile es la captura o clip descargado, no la pagina HTML. Usa sourcePage para la URL de la pagina o post.',
    shots:c.schedule.shots.map(s=>({...s,resource:{localFile:'',sourcePage:'',kind:'',label:'',author:'',license:'',reason:'',trimSeconds:0,fit:'contain',soundUse:'',soundNote:''}}))});
  return {file,shots:c.schedule.shots.length,durationSeconds:c.schedule.durationInFrames/c.schedule.fps};
}

export function validateResource(resource, shot) {
  for (const field of ['localFile','sourcePage','kind','label','license','reason']) if (!resource?.[field]?.trim()) throw new Error(shot.id+': falta resource.'+field);
  let url;
  try {url=new URL(resource.sourcePage);} catch {throw new Error(shot.id+': sourcePage no es una URL');}
  if (url.protocol!=='https:' || url.username || url.password) throw new Error(shot.id+': sourcePage debe ser HTTPS sin credenciales');
  if (!['web-capture','source-image','source-video'].includes(resource.kind)) throw new Error(shot.id+': kind debe ser web-capture, source-image o source-video');
  if (!Number.isFinite(resource.trimSeconds??0) || (resource.trimSeconds??0)<0) throw new Error(shot.id+': trimSeconds invalido');
  if (!['contain','cover'].includes(resource.fit??'contain')) throw new Error(shot.id+': fit invalido');
}

async function importResources(c, requests) {
  const catalogFile=path.join(c.work,'asset-library.json');
  if (!existsSync(catalogFile)) await writeJson(catalogFile,{version:1,images:[]});
  const assets=[], resources={}, seen=new Map();
  for (const shot of c.schedule.shots) {
    const requested=requests.shots.find(s=>s.id===shot.id), r=requested?.resource;
    validateResource(r,shot);
    const local=path.isAbsolute(r.localFile)?r.localFile:path.resolve(c.work,r.localFile);
    if (!existsSync(local)) throw new Error(shot.id+': falta '+local);
    const sourceHash=await hashMedia(local);
    const id='real-'+sourceHash.slice(0,20);
    const video=VIDEO_EXTENSIONS.has(path.extname(local).toLowerCase());
    if (video !== (r.kind==='source-video')) throw new Error(shot.id+': kind no coincide con el tipo de archivo');
    let asset=seen.get(id);
    if (!asset) {
      if (video) {
        await ensureDir(path.join(c.media,'assets'));
        const target=path.join(c.media,'assets',id+'.mp4');
        if (!existsSync(target)) await toMp4(local,target,{normalizeAudio:false});
        const probe=await ffprobe(target);
        if (!probe.width || !probe.height) throw new Error(shot.id+': el archivo no contiene video');
        asset={id,kind:'video',file:path.relative(path.join(REMOTION_ROOT,'public'),target).replaceAll('\\','/'),durationSeconds:probe.duration,width:probe.width,height:probe.height};
      } else {
        const catalog=await readJson(catalogFile);
        let record=catalog.images.find(a=>a.id===id);
        if (!record || !existsSync(path.join(REMOTION_ROOT,'public',record.publicPath))) {
          record=(await importRemotionAsset({sourceFile:local,id,collection:c.slug,assetType:'screenshot',alt:r.reason,source:r.sourcePage,author:r.author,license:r.license,tags:['talking-head','source'],replace:Boolean(record)},{catalogFile})).record;
        }
        asset={id,kind:'image',file:record.publicPath,width:record.width,height:record.height};
      }
      asset.provenance={kind:r.kind,source:r.sourcePage,license:r.license,author:r.author,label:r.label,retrievedAt:new Date().toISOString(),sourceHash};
      seen.set(id,asset);assets.push(asset);
    }
    if (video && (r.trimSeconds??0)+shot.durationSeconds>asset.durationSeconds+1/60) throw new Error(shot.id+': clip de apoyo demasiado corto. Elegir otro tramo o recurso.');
    const previous=resources[c.schedule.shots[c.schedule.shots.indexOf(shot)-1]?.id];
    if (previous?.assetId===id) throw new Error(shot.id+': dos visuales consecutivas usan el mismo archivo; elige otra imagen o un extracto distinto.');
    resources[shot.id]={...r,assetId:id};
  }
  return {assets,resources};
}

export async function buildReel({slug,log=()=>{}}) {
  const c=await selectedContext(slug), file=path.join(c.work,'asset-requests.json');
  const requests=await readJson(file);
  if (requests.fingerprint!==c.fingerprint) throw new Error('La seleccion/transcripcion ha cambiado. Ejecuta prepare y completa el nuevo asset-requests.json. Se guarda copia del anterior.');
  if (requests.shots?.length!==c.schedule.shots.length || new Set(requests.shots.map(s=>s.id)).size!==requests.shots.length) throw new Error('Lista de visuales alterada; repetir prepare sin cambiar las anclas generadas.');
  const {assets,resources}=await importResources(c,requests);
  const selections=scheduleSelections(c.selections,c.schedule,resources);
  const soundSelection=await loadTalkingHeadSounds({log});
  const manifest={...c.manifest,assets};
  const plan=planTalkingHead({...c,manifest,selections,soundSelection});
  await writeJson(path.join(c.project,'manifest.json'),manifest);
  await writeJson(path.join(c.project,'short-plan.json'),plan);
  await writeJson(path.join(c.project,'talking-head-analysis.json'),{silences:c.silences,editorial:{profile:'editorial',selections},sourceDuration:manifest.totalClipSeconds});
  const build=await buildShort({slug,log});
  await run(process.execPath,[path.join(REMOTION_ROOT,'scripts','generate-capabilities-manifest.mjs')],{cwd:REMOTION_ROOT});
  await writeJson(path.join(c.work,'compiled-input.json'),{fingerprint:c.fingerprint,requestsHash:createHash('sha256').update(JSON.stringify(requests)).digest('hex'),buildHash:await hashMedia(path.join(c.project,'short-build.json'))});
  return {slug,durationSeconds:build.durationSeconds,visuals:c.schedule.shots.length,sounds:soundSelection.status,next:`npm run talking-head -- render --slug ${slug}`};
}

export async function renderReel({slug,log=()=>{}}) {
  // Rebuild to include current folder sounds and to reject stale research/captions.
  await buildReel({slug,log});
  return renderCompiledReel({slug,log});
}

/** Render an existing, validated plan without changing its editorial cuts. */
export async function renderCompiledReel({slug,log=()=>{}}) {
  const c=reelPaths(slug), build=await readJson(path.join(c.project,'short-build.json'));
  log('Renderizando '+build.durationSeconds+' s con el estilo aprobado...');
  const result=await run(process.execPath,[path.join(ROOT,'scripts','shorts-render.js'),'--slug',slug,'--concurrency=2','--pixel-format=yuv420p','--color-space=bt709','--image-format=png',...(process.platform==='win32'?['--gl=angle']:[])],{cwd:ROOT});
  const manifestFile=result.stdout.match(/^Manifest: (.+)$/m)?.[1]?.trim();
  if (!manifestFile) throw new Error('El renderer no devolvio el manifiesto de la ejecucion: '+result.stdout.slice(-1500));
  const raw=await readJson(manifestFile);
  if (raw.metadata?.compositionId!==compositionIdForSlug(slug) || raw.outputs.length!==1) throw new Error('El manifiesto de render no coincide con este Reel');
  const input=path.resolve(path.dirname(manifestFile),raw.outputs[0]);
  const delivery=createRunDirectory({project:slug,purpose:'delivery',outputRoot:path.join(REMOTION_ROOT,'out')});
  const output=renderPathFor(delivery,slug+'.mp4');
  await finalizeShortAudio(input,output,{duration:build.durationSeconds,overwrite:false});
  const qa=await verifyShortMedia(output,{duration:build.durationSeconds});
  const contact=previewPathFor(delivery,'contact-sheet.jpg');
  await run('ffmpeg',['-n','-i',output,'-vf','fps=1/'+(build.durationSeconds/8)+',scale=270:480,tile=4x2','-frames:v','1',contact]);
  const report={output,rawRender:input,technical:qa,visualReview:'pending',audioReview:'pending',contactSheet:contact,
    review:['Cara centrada y ojos/boca visibles','Ver cada cambio de imagen, incluido el ultimo','Palabra verde alineada con voz; sin nombres mal transcritos','Sin cortes de silabas, repeticion de tomas o silencios molestos','Fuentes pertinentes, reconocibles y legibles','Sonidos discretos y variados, sin solapar ni tapar voz'],project:c.project};
  await writeJson(path.join(delivery.directory,'review.json'),report);
  completeRun(delivery,{outputs:[output,contact,path.join(delivery.directory,'review.json')],metadata:{compositionId:compositionIdForSlug(slug),technicalPassed:qa.passed}});
  await writeJson(path.join(c.work,'latest-delivery.json'),report);
  if (!qa.passed) throw new Error('QA tecnico fallido: '+qa.errors.join('; ')+'. Informe: '+delivery.directory);
  return report;
}

export async function repairReelTranscript({slug,clipId='01',start,end,log=()=>{}}) {
  const c=await context(slug), clip=c.manifest.clips.find(s=>s.id===clipId);
  if (!clip || ![start,end].every(Number.isFinite) || start<0 || end<=start || end>clip.durationSeconds) throw new Error('Ventana de retranscripcion invalida');
  const original=c.transcripts[clipId];
  if (original.words.some(w=>w.start<start && w.end>start || w.start<end && w.end>end)) throw new Error('Elige limites entre palabras para no perder silabas');
  const audio=path.join(c.work,'repair-'+Date.now()+'.wav');
  await run('ffmpeg',['-n','-ss',String(start),'-i',publicFile(clip.file),'-t',String(end-start),'-vn','-ar','16000','-ac','1',audio]);
  const segments=await transcribeAudio(audio,{log});
  const repaired=flattenWords(segments).map(w=>({...w,start:w.start+start,end:w.end+start}));
  if (!repaired.length) throw new Error('STT no devolvio palabras; se conserva la transcripcion anterior');
  const words=[...original.words.filter(w=>w.end<=start),...repaired,...original.words.filter(w=>w.start>=end)].map((w,index)=>({...w,index}));
  const problems=auditWords(words,clip.durationSeconds).filter(i=>i.blocking);
  if (problems.length) throw new Error('STT devolvio tiempos invalidos: '+JSON.stringify(problems.slice(0,8)));
  const file=path.join(c.project,clip.transcript);
  await backup(file);
  await writeJson(file,{...original,segments:[],words,repair:{start,end,at:new Date().toISOString()}});
  const selectionFile=path.join(c.work,'selection.json');
  await backup(selectionFile);
  const selection=await readJson(selectionFile);
  await writeJson(selectionFile,{...selection,reviewed:false,reviewNotes:'La retranscripcion cambia indices: revisar selecciones antes de prepare.'});
  return {file,words:words.length,next:'Repetir start para actualizar transcript-indexed.txt; revisar selection.json y ejecutar prepare.'};
}
