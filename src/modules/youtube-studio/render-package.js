import path from 'node:path';
import {mkdir,readFile,writeFile,copyFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {hashMedia} from '../video-studio/folder-sounds.js';
import {run} from '../../lib/utils.js';
import {fingerprint} from './memory.js';

export async function resolveInside(root,file) {
  if(typeof file!=='string'||path.isAbsolute(file))throw Error('Ruta relativa requerida');
  const base=await realpath(root),resolved=await realpath(path.resolve(base,file)),rel=path.relative(base,resolved);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Media fuera de public');
  return resolved;
}

export async function packageRender(plan,{publicRoot,packageName,allowIncomplete=false}) {
  if(!/^[a-z0-9][a-z0-9-]*$/i.test(packageName))throw Error('Nombre de paquete invalido');
  if(plan.kind!=='youtube-render-plan'||!plan.layers?.length)throw Error('Plan requerido');
  if(plan.warnings.length&&!allowIncomplete)throw Error('Hay incompatibilidades; revisar warnings y usar --allow-incomplete solo para calibracion');
  const relative=`projects/youtube/${packageName}`,dir=path.join(publicRoot,relative);
  await mkdir(path.dirname(dir),{recursive:true});await mkdir(dir);
  const props={version:1,format:plan.format,durationInFrames:plan.durationInFrames,layers:[],soundEnabled:true,soundMix:1};
  const assets=[],seen=new Map(),warnings=[...plan.warnings];
  for(const layer of plan.layers){
    if(layer.type==='text'){const {file,...data}=layer;props.layers.push({...data,src:''});continue;}
    const source=path.isAbsolute(layer.file)?await realpath(layer.file).catch(e=>{if(e.code==='ENOENT'&&allowIncomplete){warnings.push({segmentId:layer.id,message:'Recurso ausente: '+layer.name});return null;}throw e;}):await resolveInside(publicRoot,layer.file);
    if(!source)continue;
    let asset=seen.get(source);
    if(!asset){
      const sourceHash=await hashMedia(source);
      if(layer.expectedSourceHash&&layer.expectedSourceHash!==sourceHash)throw Error('Fuente modificada: '+layer.id);
      const ext=path.extname(source).toLowerCase(),remux=ext==='.mkv',audio=layer.type==='audio';
      const filename=`${assets.length.toString().padStart(3,'0')}${remux?'.mp4':audio?'.wav':ext}`;
      const output=path.join(dir,filename);
      if(remux)await run('ffmpeg',['-v','error','-n','-copyts','-i',source,'-map','0:v:0','-map','0:a:0?','-c','copy','-avoid_negative_ts','disabled','-movflags','+faststart',output]);
      else if(audio)await run('ffmpeg',['-v','error','-n','-i',source,'-vn','-ar','48000','-ac','2','-c:a','pcm_s16le',output]);
      else await copyFile(source,output,constants.COPYFILE_EXCL);
      if(await hashMedia(source)!==sourceHash)throw Error('Fuente cambio durante empaquetado');
      asset={source,sourceHash,file:`${relative}/${filename}`,hash:await hashMedia(output)};
      seen.set(source,asset);assets.push(asset);
    }
    if(layer.expectedSourceHash&&layer.expectedSourceHash!==asset.sourceHash)throw Error('Hash inconsistente entre escenas');
    const {file,expectedSourceHash,...data}=layer;
    props.layers.push({...data,src:asset.file});
  }
  if(!props.layers.some(l=>l.type==='video'))throw Error('Sin fuentes de video disponibles');
  const payload={version:1,kind:'youtube-render-package',props,assets,warnings,provenance:plan.provenance,
    review:{visual:'pending',audio:'pending',editorial:'pending'},incomplete:warnings.length>0,rendererSourceFrozen:false};
  return {id:fingerprint(payload),payload};
}

export async function verifyRenderPackage(pkg,publicRoot) {
  if(pkg?.payload?.kind!=='youtube-render-package'||pkg.id!==fingerprint(pkg.payload))throw Error('Paquete modificado');
  for(const asset of pkg.payload.assets)if(await hashMedia(await resolveInside(publicRoot,asset.file))!==asset.hash)throw Error('Media del paquete modificada');
  for(const layer of pkg.payload.props.layers)if(layer.type!=='text'&&!pkg.payload.assets.some(a=>a.file===layer.src))throw Error('Media no registrada');
  return pkg.payload.props;
}
export async function loadPackage(file){return JSON.parse(await readFile(file,'utf8'));}
export async function savePackage(file,pkg){await writeFile(file,JSON.stringify(pkg,null,2)+'\n',{flag:'wx'});}