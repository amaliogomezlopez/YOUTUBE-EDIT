#!/usr/bin/env node
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import sharp from 'sharp';
import {run} from '../src/lib/utils.js';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {hashMedia} from '../src/modules/video-studio/folder-sounds.js';
const {values:v}=parseArgs({options:{render:{type:'string'},reference:{type:'string'},package:{type:'string'},output:{type:'string'}}});
try {
 for(const k of ['render','reference','package','output'])if(!v[k])throw Error('--'+k+' requerido');
 const pkg=JSON.parse(await readFile(v.package,'utf8')),props=pkg.payload.props;
 if(pkg.payload.provenance?.from===undefined)throw Error('QA comparativa requiere paquete de referencia con offset');
 await mkdir(v.output);
 const duration=props.durationInFrames/props.format.fps,offset=pkg.payload.provenance.from;
 const times=[0.02,.15,.45,.57,.75,.95].map(f=>Math.floor(duration*f*30)/30);
 const composites=[],frames=[];
 for(let i=0;i<times.length;i++){
  const time=times[i],files=[];
  for(const [name,file,at] of [['reference',v.reference,offset+time],['pilot',v.render,time]]){
    const dest=path.join(v.output,`${i}-${name}.png`);
    await run('ffmpeg',['-v','error','-n','-ss',String(at),'-i',file,'-frames:v','1','-vf','scale=640:360',dest]);files.push(dest);
  }
  const label=Buffer.from(`<svg width="1280" height="28"><rect width="1280" height="28" fill="#111"/><text x="12" y="20" fill="white" font-size="17">CapCut — ${(offset+time).toFixed(3)} s</text><text x="652" y="20" fill="white" font-size="17">Shortsmith — ${time.toFixed(3)} s</text></svg>`);
  composites.push({input:label,left:0,top:i*388},{input:files[0],left:0,top:i*388+28},{input:files[1],left:640,top:i*388+28});
  frames.push({time,referenceTime:offset+time,files});
 }
 const sheet=path.join(v.output,'comparison.jpg');
 await sharp({create:{width:1280,height:388*times.length,channels:3,background:'#111'}}).composite(composites).jpeg({quality:92}).toFile(sheet);
 const audio=[];
 for(const [name,file,start] of [['reference',v.reference,offset],['pilot',v.render,0]]){
  const pcm=path.join(v.output,`${name}.s16le`);
  const measured=await run('ffmpeg',['-hide_banner','-n','-ss',String(start),'-i',file,'-t',String(duration),'-vn','-af','volumedetect','-ar','16000','-ac','1','-f','s16le',pcm]);
  const b=await readFile(pcm),samples=new Float64Array(b.length/2);for(let j=0;j<samples.length;j++)samples[j]=b.readInt16LE(j*2)/32768;
  audio.push({name,samples,volume:measured.stderr.match(/(?:mean_volume|max_volume):[^\r\n]+/g)});
 }
 let best={correlation:-1,lagMs:0};
 for(let lag=-1600;lag<=1600;lag+=8){let ab=0,aa=0,bb=0;const n=Math.min(audio[0].samples.length,audio[1].samples.length);for(let i=1600;i<n-1600;i+=4){const a=audio[0].samples[i],b=audio[1].samples[i+lag];ab+=a*b;aa+=a*a;bb+=b*b;}const correlation=ab/Math.sqrt(aa*bb);if(correlation>best.correlation)best={correlation,lagMs:lag/16};}
 const probe=await ffprobe(v.render);
 const report={version:1,packageId:pkg.id,renderHash:await hashMedia(v.render),referenceHash:await hashMedia(v.reference),frames,contactSheet:sheet,
 technical:{duration:probe.duration,expectedDuration:duration,width:probe.width,height:probe.height,fps:probe.fps,streams:probe.raw.streams.map(s=>({type:s.codec_type,codec:s.codec_name,pixelFormat:s.pix_fmt,sampleRate:s.sample_rate,channels:s.channels}))},audio:{alignment:best,volume:audio.map(({name,volume})=>({name,volume})),note:'Correlacion diagnostica; no sustituye escucha ni prueba sincronizacion labial.'},limitations:pkg.payload.warnings,review:{visual:'pending',audioListening:'pending',editorial:'pending'}};
 await writeFile(path.join(v.output,'qa.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({sheet,technical:report.technical,audio:report.audio},null,2));
} catch(e){console.error(e.message,e.stderr??'');process.exitCode=1;}