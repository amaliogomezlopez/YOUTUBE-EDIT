#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {extractCapcutReference} from '../src/modules/editorial-memory/capcut.js';
import {writeNew} from '../src/modules/youtube-studio/project.js';
try {
  const {values}=parseArgs({options:{input:{type:'string'},output:{type:'string'}}});
  if(!values.input||!values.output)throw Error('Uso: node scripts/import-capcut-reference.js --input draft_content.json --output referencia.json');
  const result=extractCapcutReference(await readFile(values.input));
  await writeNew(values.output,result);
  console.log(JSON.stringify({output:values.output,timelines:result.timelines.length,segments:result.timelines.map(t=>t.tracks.reduce((sum,tr)=>sum+tr.segments.length,0)),renderable:false}));
} catch(error){console.error(error.message);process.exitCode=1;}