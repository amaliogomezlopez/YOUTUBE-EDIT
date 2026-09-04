import test from 'node:test';
import {mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {classifyDetection, validSourceBox, smoothFocusTrack, regionTransform} from '../src/modules/video-studio/framing.js';
import {isCornerWebcamFace, parsePpm} from '../src/lib/webcam.js';
import {speechEdits, planAdaptiveShort, editingBudget, applySceneEdits} from '../src/modules/shorts-studio/editing-plan.js';
import {parseSilences, stabilizeShots, textRegion, contextualRegion} from '../src/modules/video-studio/visual-analysis.js';
import {buildShortPlanForCandidate, locateRunOutput} from '../src/modules/shorts-studio/from-long-video.js';
import {buildVerticalFilter} from '../src/lib/ffmpeg.js';
import {validateJobOptions} from '../src/lib/job-request.js';
import {buildCaptionPages} from '../src/modules/video-studio/captions.js';

import {scoreCandidate} from '../src/lib/scoring.js';

const media={width:1920,height:1080};
test('un render nuevo sin salida no devuelve un MP4 anterior',async()=>{
  const slug='test-stale-'+randomUUID();
  const root=path.resolve('remotion-animations/out/shorts-'+slug);
  try {
    await mkdir(path.join(root,'runs/old'),{recursive:true});
    await mkdir(path.join(root,'runs/new'),{recursive:true});
    await writeFile(path.join(root,'runs/old/run-result.json'),JSON.stringify({outputs:['anterior.mp4']}));
    await assert.rejects(locateRunOutput(slug,['old']),/salida .mp4/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('el perfil general no puntua por pertenecer al sector de IA',()=>{
  const common={start:0,end:20,cleanStart:true,cleanEnd:true};
  const a=scoreCandidate({...common,text:'Este modelo es mejor porque ahorra tiempo. Recomiendo probar y comparar el precio.'},{topicProfile:'general'});
  const b=scoreCandidate({...common,text:'Este huerto es mejor porque ahorra tiempo. Recomiendo probar y comparar el precio.'},{topicProfile:'general'});
  assert.equal(a.viralScore,b.viralScore);
  assert.ok(a.reasons.every(r=>!r.includes('modelos/IA')));
});
test('una cara a pantalla completa nunca se convierte en caja pip',()=>{
  const d=classifyDetection({method:'talking-head-face',layout:'crop',faceBox:{x:500,y:100,w:400,h:500}},media);
  assert.equal(d.mode,'crop'); assert.equal(d.webcamBox,null);
  assert.equal(validSourceBox({x:0,y:0,w:NaN,h:100},media),false);
});
test('webcam admitida en las cuatro esquinas',()=>{
  for(const x of [50,1700]) for(const y of [50,900]) assert.ok(isCornerWebcamFace({x,y,w:100,h:100},media));
  assert.equal(isCornerWebcamFace({x:860,y:440,w:150,h:150},media),false);
});
test('PPM conserva pixeles cuyo primer byte parece espacio',()=>{
  const frame=parsePpm(Buffer.concat([Buffer.from('P6\n1 1\n255\n'),Buffer.from([10,32,13])]));
  assert.deepEqual([...frame.data],[10,32,13]);
});
test('el seguimiento elimina temblor y limita desplazamientos',()=>{
  const t=smoothFocusTrack([{t:0,x:.5,y:.5},{t:1,x:.501,y:.501},{t:2,x:.9,y:.5}]);
  assert.equal(t[1].x,.5); assert.ok(t[2].x<=.62);
});
test('region contain no recorta texto al encajar',()=>{
  const r={x:300,y:200,w:800,h:400};
  const t=regionTransform(r,media,{width:900,height:800});
  assert.ok(t.left+r.x*t.scale>=0); assert.ok(t.top+r.y*t.scale>=0);
  assert.ok(t.left+(r.x+r.w)*t.scale<=900+.001);
});
test('FFmpeg recibe posicion facial y normaliza el movimiento',()=>{
  const f=buildVerticalFilter({mode:'crop',focus:{x:.8,y:.3}});
  assert.ok(f.includes('iw*(0.8)')); assert.ok(f.includes('ih*(0.3)'));
});
test('solo se recortan silencios corroborados y se conservan las palabras',()=>{
  const words=[{index:0,text:'Hola.',start:.2,end:1},{index:1,text:'Resultado.',start:3,end:4}];
  const budget=editingBudget();
  assert.equal(speechEdits(words,5,[],budget).length,1);
  const ranges=speechEdits(words,5,[{start:1,end:3}],budget);
  assert.equal(ranges.length,2);
  for(const w of words) assert.ok(ranges.some(r=>r.start<=w.start && r.end>=w.end));
});
test('una perdida facial aislada no cambia el layout',()=>{
  const s=stabilizeShots([{t:0,mode:'pip'},{t:1,mode:'fit'},{t:2,mode:'pip'},{t:3,mode:'fit'},{t:4,mode:'fit'}],5);
  assert.deepEqual(s.map(x=>x.mode),['pip','fit']); assert.equal(s[1].start,3);
});
test('el OCR elige texto mencionado y no inventa una region sin coincidencia',()=>{
  const lines=[{text:'Tokens',x:100,y:100,w:150,h:40}];
  assert.equal(textRegion(lines,'otra cosa',media),null);
  assert.equal(textRegion(lines,'menos tokens',media).method,'texto-mencionado');
});
test('plan conserva sourceMap despues de quitar pausa y usa ROI con evidencia',()=>{
  const words=[{index:0,text:'Mira',start:.2,end:.7},{index:1,text:'resultado.',start:.7,end:1},{index:2,text:'Concluye.',start:3,end:4}];
  const p=planAdaptiveShort({words,duration:5,source:media,analysis:{silences:[{start:1,end:3}],shots:[{start:0,mode:'fit',region:{x:200,y:200,w:600,h:400,confidence:.8}}]}});
  assert.equal(p.scenes.length,2); assert.ok(p.sourceMap[1].outputStart<3); assert.ok(p.scenes[0].screenEmphasis);
  applySceneEdits(p,[{id:'scene-1',effects:false}]); assert.equal(p.scenes[0].transitionSound,false);
});
test('modo de subtitulos llega al plan y words no fusiona el ultimo token',()=>{
  const p=buildShortPlanForCandidate({renderMode:'fit',subtitleMode:'progressive',subtitleStyle:{uppercase:false}});
  assert.equal(p.captions.mode,'progressive'); assert.equal(p.captionStyle.uppercase,false);
  const pages=buildCaptionPages([{text:'uno',start:0,end:.4},{text:'dos',start:.4,end:.8}],{startSeconds:0,endSeconds:1},{maxWords:1});
  assert.equal(pages.length,2);
});
test('perfil invalido falla y formulario activa Remotion',()=>{
  assert.throws(()=>editingBudget('inventado'));
  const opts=validateJobOptions({editingProfile:'sobrio'});
  assert.equal(opts.renderEngine,'remotion'); assert.equal(opts.editing.profile,'sobrio');
});
test('una etiqueta ampliada conserva el contexto y nunca sale de la fuente',()=>{
  const r=contextualRegion({x:1700,y:900,w:100,h:50,confidence:.8},media);
  assert.ok(r.w>=media.width*.56); assert.ok(r.h>=media.height*.8);
  assert.ok(r.x>=0 && r.y>=0 && r.x+r.w<=media.width && r.y+r.h<=media.height);
});
test('silencios al final quedan acotados a la duracion',()=>{
  assert.deepEqual(parseSilences('silence_start: 4',5),[{start:4,end:5}]);
});
