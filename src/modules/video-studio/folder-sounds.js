import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {createReadStream, existsSync} from 'node:fs';
import {readdir, rename, rm} from 'node:fs/promises';
import {ffprobe} from '../../lib/ffmpeg.js';
import {ensureDir, readJson, run, writeJson} from '../../lib/utils.js';
import {AUDIO_EXTENSIONS} from './paths.js';

export async function hashMedia(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

/** Local drop-folder import, content addressed. Originals and old renders survive. */
export async function importFolderSounds({folder, publicRoot, manifestFile, log=()=>{}}) {
  await ensureDir(folder);
  await ensureDir(path.join(publicRoot,'sfx'));
  const previous = await readJson(manifestFile).catch(()=>({entries:[]}));
  const cache = new Map(previous.entries.map(e=>[e.hash,e]));
  const entries = [], errors = [], warnings = [], seen = new Set();
  async function walk(dir, relative='') {
    const files = (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'));
    for (const entry of files) {
      if (entry.isSymbolicLink()) continue;
      const name = path.join(relative,entry.name), file = path.join(dir,entry.name);
      if (entry.isDirectory()) {await walk(file,name);continue;}
      if (!entry.isFile() || !AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      try {
        const hash = await hashMedia(file);
        if (seen.has(hash)) continue;
        const output = 'sfx/user-reel-'+hash.slice(0,24)+'.wav';
        const target = path.join(publicRoot,output);
        let durationSeconds = cache.get(hash)?.durationSeconds;
        if (!existsSync(target)) {
          const info = await ffprobe(file);
          if (!info.raw.streams.some(s=>s.codec_type==='audio') || !Number.isFinite(info.duration) || info.duration<=0 || info.duration>30) throw new Error('Usa un efecto de entre 0 y 30 segundos');
          const measured = await run('ffmpeg',['-hide_banner','-i',file,'-vn','-af','volumedetect','-f','null','-']);
          const peak = Number(measured.stderr.match(/max_volume: (-?[\d.]+) dB/)?.[1]);
          if (!Number.isFinite(peak) || peak < -80) throw new Error('Audio vacio o practicamente mudo');
          const temp = path.join(publicRoot,'sfx','import-'+randomUUID()+'.wav');
          try {
            await run('ffmpeg',['-n','-i',file,'-vn','-af','volume='+(-3-peak)+'dB','-ar','48000','-ac','2','-c:a','pcm_s16le',temp]);
            // Another importer may have finished the same hash while ffmpeg ran.
            if (!existsSync(target)) await rename(temp,target);
          } finally {await rm(temp,{force:true});}
          log('Importado: '+name);
        }
        durationSeconds ??= (await ffprobe(target)).duration;
        if (durationSeconds>3) warnings.push(name+': efecto de '+durationSeconds.toFixed(2)+' s; revisar su cola en las transiciones.');
        const group = relative.split(path.sep)[0]?.toLowerCase();
        const family = ({entradas:'reveal',clicks:'ui',impactos:'impact'})[group] ?? 'whoosh';
        seen.add(hash);
        entries.push({hash,sourceName:name,file:output,family,durationSeconds,provenance:'user-provided'});
      } catch (error) {errors.push(name+': '+error.message);}
    }
  }
  await walk(folder);
  const report = {version:1,folder,entries,errors,warnings};
  await writeJson(manifestFile,report);
  if (errors.length) throw new Error('No se han podido preparar estos sonidos: '+errors.join('; ')+'. Detalles: '+manifestFile);
  const palette = {}, metadata = {};
  for (const e of entries) {
    (palette[e.family] ??= []).push(e.file);
    metadata[e.file] = {durationSeconds:e.durationSeconds};
  }
  return {...report,status:entries.length?'user-folder':'empty',families:Object.keys(palette),palette,metadata};
}
