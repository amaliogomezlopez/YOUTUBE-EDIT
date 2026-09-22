import fs from 'node:fs/promises';import path from 'node:path';
import {ROOT,readJson,writeJson,run} from '../../lib/utils.js';
import {hashMedia} from './folder-sounds.js';import {contentHash} from '../shorts-studio/camera-project.js';
const publicRoot=path.join(ROOT,'remotion-animations/public');
function inside(root,relative){const dest=path.resolve(root,relative),rel=path.relative(root,dest);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Ruta fuera de proyecto: '+relative);return dest;}
async function files(root){const list=[];for(const entry of await fs.readdir(root,{withFileTypes:true})){if(entry.name==='registry.generated.ts')continue;const full=path.join(root,entry.name);if(entry.isDirectory())list.push(...await files(full));else if(/\.(js|mjs|ts|tsx|json|ttf|otf|woff|woff2)$/.test(entry.name))list.push(full);}return list.sort();}
export async function dependencyState(){
 const names=['package.json','package-lock.json','remotion-animations/package.json','remotion-animations/package-lock.json','remotion-animations/tsconfig.json','remotion-animations/remotion.config.ts'];
 const sourceFiles=(await Promise.all(['src','scripts','remotion-animations/src','remotion-animations/scripts','assets/fonts','remotion-animations/public/fonts','remotion-animations/catalog'].map(p=>files(path.join(ROOT,p))))).flat();
 const dependencies={};for(const file of [...names.map(p=>path.join(ROOT,p)),...sourceFiles])dependencies[path.relative(ROOT,file).replaceAll('\\','/')]=await hashMedia(file);
 const ffmpeg=(await run('ffmpeg',['-version'])).stdout.split(/\r?\n/)[0];
 return {node:process.version,platform:process.platform,arch:process.arch,ffmpeg,dependencies};
}
export async function freezeProject(project){
 const mutex=path.join(project,'.freeze.lock');let handle;
 try{handle=await fs.open(mutex,'wx');}catch(e){if(e.code==='EEXIST')throw Error('Otra congelacion esta en curso; reintentar al terminar');throw e;}
 try{return await freezeUnlocked(project);}finally{await handle.close();await fs.unlink(mutex);}
}
async function freezeUnlocked(project){
 const original=await readJson(path.join(project,'short-build.json')),build=structuredClone(original),assets={};
 async function pin(value){
  const source=inside(publicRoot,value),hash=await hashMedia(source),relative='projects/_locked/'+hash+path.extname(value).toLowerCase(),dest=inside(publicRoot,relative);
  await fs.mkdir(path.dirname(dest),{recursive:true});try{await fs.copyFile(source,dest,1);}catch(e){if(e.code!=='EEXIST')throw e;}
  if(await hashMedia(dest)!==hash)throw Error('Asset congelado corrupto: '+relative);assets[relative]=hash;return relative;
 }
 async function walk(node){if(!node||typeof node!=='object')return;for(const key of Object.keys(node)){if(['src','file','backgroundImage'].includes(key)&&typeof node[key]==='string'&&node[key])node[key]=await pin(node[key]);else await walk(node[key]);}}
 for(const scene of build.scenes??[])if(scene.screenCamera && await hashMedia(inside(publicRoot,scene.src))!==scene.screenCamera.sourceHash)throw Error('Fuente de camara cambio desde el build');
 await walk(build);
 for(const scene of build.scenes??[])if(scene.screenCamera && assets[scene.src]!==scene.screenCamera.sourceHash)throw Error('Fuente cambio durante la congelacion');
 const runtime=await dependencyState(),plan=await readJson(path.join(project,'short-plan.json')),manifest=await readJson(path.join(project,'manifest.json'));
 const transcripts={};for(const clip of manifest.clips)if(clip.transcript)transcripts[clip.id]=await readJson(inside(project,clip.transcript));
 if(original.projectInputsHash!==contentHash({plan,manifest,transcripts:manifest.clips.filter(c=>c.transcript).map(c=>[c.id,transcripts[c.id]])}))throw Error('Plan/manifest/transcripcion cambiaron: ejecutar shorts:build antes de congelar');
 const lock={version:1,build,assets,runtime,plan,manifest,transcripts};delete build.generatedAt;
 const id=contentHash(lock),dir=path.join(project,'versions',id);await fs.mkdir(dir,{recursive:true});
 // Exclusive files: never overwrite an existing version.
 for(const [name,value] of [['lock.json',lock],['short-build.json',build]]){try{await fs.writeFile(path.join(dir,name),JSON.stringify(value,null,2),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const stored=await readJson(path.join(dir,name));if(contentHash(stored)!==contentHash(value))throw Error('Version corrupta: '+id);}}
 // Archive the source and dependency manifests. No credentials or .env files.
 for(const name of Object.keys(runtime.dependencies)){const dest=inside(path.join(dir,'environment'),name);await fs.mkdir(path.dirname(dest),{recursive:true});try{await fs.copyFile(path.join(ROOT,name),dest,1);}catch(e){if(e.code!=='EEXIST')throw e;}if(await hashMedia(dest)!==runtime.dependencies[name])throw Error('Codigo/dependencias cambiaron durante la congelacion');}
 await fs.writeFile(path.join(dir,'READY'),id);
 await writeJson(path.join(project,'version-latest.json'),{id});return {id,dir,build,lock};
}
export async function loadFrozenProject(project,id){
 if(!/^[a-f0-9]{64}$/.test(id))throw Error('Version invalida');const dir=path.join(project,'versions',id),lock=await readJson(path.join(dir,'lock.json'));
 if(await fs.readFile(path.join(dir,'READY'),'utf8').catch(()=>'')!==id)throw Error('Version incompleta');
 if(contentHash(lock)!==id)throw Error('Lock modificado');
 if(contentHash(await readJson(path.join(dir,'short-build.json')))!==contentHash(lock.build))throw Error('Build congelado modificado');
 if(contentHash(await dependencyState())!==contentHash(lock.runtime))throw Error('Dependencias/codigo cambiaron: restaurar el entorno archivado o crear una version nueva');
 for(const [file,hash] of Object.entries(lock.assets))if(await hashMedia(inside(publicRoot,file))!==hash)throw Error('Asset congelado modificado: '+file);
 return {id,dir,build:lock.build,lock};
}
