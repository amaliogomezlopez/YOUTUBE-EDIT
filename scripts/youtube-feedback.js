#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {recordFeedback} from '../src/modules/youtube-studio/feedback.js';
import {writeNew} from '../src/modules/youtube-studio/project.js';
try {
 const {values:v}=parseArgs({options:{package:{type:'string'},frame:{type:'string'},category:{type:'string'},quote:{type:'string'},scope:{type:'string'},output:{type:'string'}}});
 if(!v.package||!v.output)throw Error('--package y --output requeridos');
 const result=recordFeedback(JSON.parse(await readFile(v.package,'utf8')),{frame:Number(v.frame),category:v.category,quote:v.quote,scope:v.scope});
 await writeNew(v.output,result);console.log(JSON.stringify({id:result.id,output:v.output,approval:'pending'}));
} catch(e){console.error(e.message);process.exitCode=1;}