#!/usr/bin/env node
import path from 'node:path';
import {parseArgs} from 'node:util';
import {access} from 'node:fs/promises';
import {loadDotEnv,readJson} from '../src/lib/utils.js';
import {surfacePaths} from '../src/modules/video-studio/paths.js';
import {YOUTUBE_FORMAT} from '../src/modules/youtube-studio/plan.js';
import {prepareYoutube,writeNew} from '../src/modules/youtube-studio/project.js';
import {compareEdits} from '../src/modules/youtube-studio/memory.js';

const usage=`YouTube Studio: montaje horizontal. Render: npm run youtube:render.
  capabilities
  ingest --source DIR --slug SLUG [--assets DIR] [--no-transcribe] [--no-face]
  prepare --project DIR --output SNAPSHOT.json
  compare --before SNAPSHOT.json --after SNAPSHOT.json --output COMPARISON.json
Preparar youtube-plan.json siguiendo docs/youtube-studio.md. Cada output debe ser nuevo.`;
try {
  const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:{
    source:{type:'string'},slug:{type:'string'},assets:{type:'string'},
    project:{type:'string'},output:{type:'string'},before:{type:'string'},after:{type:'string'},
    'no-transcribe':{type:'boolean'},'no-face':{type:'boolean'},help:{type:'boolean'}
  }});
  if(v.help||!p.length)console.log(usage);
  else {
    if(p.length!==1)throw Error(usage);
    const required={capabilities:[],ingest:['source','slug'],prepare:['project','output'],compare:['before','after','output']};
    if(!Object.hasOwn(required,p[0]))throw Error(usage);
    for(const key of required[p[0]])if(!v[key])throw Error('Falta --'+key);
    if(p[0]==='capabilities')console.log(JSON.stringify({surface:'youtube',format:YOUTUBE_FORMAT,
      ingest:true,compile:true,compare:true,render:true,recordly:false,assetOverlays:false,learnStyle:false,renderer:'remotion',feedback:true,renderCommand:'npm run youtube:render'},null,2));
    if(p[0]==='ingest') {
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug))throw Error('Slug invalido');
      const dir=surfacePaths('youtube').projectDir(v.slug);
      try {await access(dir);throw Error('El proyecto ya existe; usar otro slug para conservar la referencia');}
      catch(error){if(error.code!=='ENOENT')throw error;}
      await loadDotEnv();
      const {ingestMediaProject}=await import('../src/modules/video-studio/media-ingest.js');
      const manifest=await ingestMediaProject({surface:'youtube',format:YOUTUBE_FORMAT,
        sourceDir:path.resolve(v.source),slug:v.slug,assetsDir:v.assets,
        transcribe:!v['no-transcribe'],faceTracking:!v['no-face'],log:console.log});
      console.log(JSON.stringify({project:dir,clips:manifest.clips.length,next:'crear youtube-plan.json'}));
    }
    if(p[0]==='prepare') {
      const result=await prepareYoutube({project:path.resolve(v.project)});
      await writeNew(v.output,result);
      console.log(JSON.stringify({id:result.id,output:v.output,render:false,warnings:result.payload.build.warnings}));
    }
    if(p[0]==='compare') {
      const result=compareEdits(await readJson(v.before),await readJson(v.after));
      await writeNew(v.output,result);
      console.log(JSON.stringify({output:v.output,changes:result.changes.length,editorial:'pending'}));
    }
  }
} catch(error){console.error(error.message);process.exitCode=1;}
