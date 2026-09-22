#!/usr/bin/env node
import {renderShortProject} from '../src/modules/shorts-studio/render-project.js';
const argv=process.argv.slice(2),args={},options=[];
for(let i=0;i<argv.length;i++){if(['--slug','--engine','--version'].includes(argv[i]))args[argv[i].slice(2)]=argv[++i];else if(!args.slug&&!argv[i].startsWith('--'))args.slug=argv[i];else options.push(argv[i]);}
if(!args.slug)throw Error('Uso: shorts:render --slug slug [--engine ffmpeg|remotion] [--version hash]');
console.log(JSON.stringify(await renderShortProject({...args,options})));
