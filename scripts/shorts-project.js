#!/usr/bin/env node
import {parseArgs} from 'node:util';import path from 'node:path';
import {readJson,writeJson} from '../src/lib/utils.js';import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {freezeProject} from '../src/modules/video-studio/project-lock.js';import {RENDER_ADAPTERS} from '../src/modules/video-studio/render-adapters.js';
import {adoptCameraProject} from '../src/modules/shorts-studio/camera-adopt.js';import {compareEditorialCandidates} from '../src/modules/video-studio/camera-review.js';
const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:{slug:{type:'string'},project:{type:'string'},input:{type:'string'},output:{type:'string'}}});
if(p[0]==='capabilities')console.log(JSON.stringify(RENDER_ADAPTERS,null,2));
else if(p[0]==='adopt-camera'){console.log(JSON.stringify(await adoptCameraProject(path.resolve(v.project),v.slug)));}
else if(p[0]==='freeze'){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug??''))throw Error('Slug invalido');const f=await freezeProject(projectDir(v.slug));console.log(JSON.stringify({version:f.id,dir:f.dir}));}
else if(p[0]==='compare'){const report=compareEditorialCandidates(await readJson(v.input));await writeJson(v.output,report);console.log(JSON.stringify(report));}
else throw Error('Uso: shorts:project capabilities|adopt-camera|freeze|compare');
