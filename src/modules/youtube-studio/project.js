import path from 'node:path';
import {realpath, mkdir, writeFile} from 'node:fs/promises';
import {readJson} from '../../lib/utils.js';
import {hashMedia} from '../video-studio/folder-sounds.js';
import {REMOTION_ROOT} from '../video-studio/paths.js';
import {compileYoutubePlan} from './plan.js';
import {snapshot} from './memory.js';

async function within(root,relative) {
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative))throw Error('Ruta relativa requerida');
  const base=await realpath(root),file=await realpath(path.resolve(base,relative));
  const rel=path.relative(base,file);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Ruta fuera del proyecto');
  return file;
}

export async function prepareYoutube({project,mediaRoot=path.join(REMOTION_ROOT,'public')}) {
  const plan=await readJson(path.join(project,'youtube-plan.json'));
  const manifest=await readJson(path.join(project,'manifest.json'));
  if(manifest.surface!=='youtube'||!Array.isArray(manifest.clips)||!manifest.clips.length)throw Error('Manifest youtube requerido');
  const profiles=await readJson(new URL('./profiles.json',import.meta.url));
  if(!Object.hasOwn(profiles,plan.profile))throw Error('Perfil desconocido');
  const clips=[];
  for(const clip of manifest.clips) {
    const sourceHash=await hashMedia(await within(mediaRoot,clip.file));
    const transcript=await readJson(await within(project,clip.transcript));
    clips.push({...clip,sourceHash,words:transcript.words});
  }
  const build=compileYoutubePlan({plan,clips,budget:profiles[plan.profile]});
  return snapshot({plan,clips,build});
}

export async function writeNew(file,value) {
  await mkdir(path.dirname(path.resolve(file)),{recursive:true});
  await writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
}
