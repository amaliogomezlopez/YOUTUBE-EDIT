#!/usr/bin/env node
import {parseCliArgs,loadDotEnv} from '../src/lib/utils.js';
import {startReel,prepareReel,buildReel,renderReel,repairReelTranscript} from '../src/modules/talking-head/workflow.js';
import {loadTalkingHeadSounds} from '../src/modules/talking-head/sounds.js';
const args=parseCliArgs(process.argv.slice(2));
await loadDotEnv();
const command=args._[0];
try {
  let result;
  const options={slug:args.slug,log:console.log};
  if (command==='start') result=await startReel({...options,video:args.video,transcript:args.transcript,faceTracking:!args['no-face']});
  else if (command==='prepare') result=await prepareReel(options);
  else if (command==='build') result=await buildReel(options);
  else if (command==='render') result=await renderReel(options);
  else if (command==='repair-transcript') result=await repairReelTranscript({...options,clipId:args.clip??'01',start:Number(args.start),end:Number(args.end)});
  else if (command==='sounds') {const s=await loadTalkingHeadSounds(options);result={folder:s.folder,status:s.status,files:Object.values(s.palette).flat().length,warnings:s.warnings??[]};}
  else if (!command || args.help) result={usage:['npm run talking-head -- start --video "<ruta>" --slug talking-head-mi-reel','Editar selection.json: revisar tomas y marcar reviewed:true con reviewNotes','npm run talking-head -- prepare --slug talking-head-mi-reel','Completar resource en asset-requests.json con imagenes/clips reales','npm run talking-head -- render --slug talking-head-mi-reel','npm run talking-head -- sounds'],guide:'docs/talking-head-reels.md'};
  else throw new Error('Comando desconocido: '+command);
  console.log(JSON.stringify(result,null,2));
} catch(error) {console.error(error.message);process.exitCode=1;}
