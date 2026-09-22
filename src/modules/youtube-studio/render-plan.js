import {fingerprint} from './memory.js';

export const IDENTITY={x:0,y:0,scaleX:1,scaleY:1,rotation:0,opacity:1};
export function fromSnapshot(snapshot) {
  if(snapshot?.payload?.kind!=='youtube-edit-example'||snapshot.id!==fingerprint(snapshot.payload))throw Error('Snapshot invalido');
  const {build,clips}=snapshot.payload;
  if(build.surface!=='youtube'||build.format.fps!==30)throw Error('Snapshot horizontal requerido');
  const warnings=[];
  const layers=build.scenes.map(scene=>{
    const clip=clips.find(c=>c.id===scene.clipId);
    if(!clip?.file||clip.sourceHash!==scene.sourceHash)throw Error('Fuente no coincide');
    if(scene.track.events.some(e=>e.sound))throw Error('Resolver sonido por familia antes de renderizar este snapshot');
    return {id:scene.id,type:'video',file:clip.file,expectedSourceHash:clip.sourceHash,
      from:scene.fromFrame,duration:scene.durationInFrames,sourceIn:scene.sourceIn,volume:1,
      width:clip.width,height:clip.height,transform:{...IDENTITY},curves:{},camera:scene.track};
  });
  return {version:1,kind:'youtube-render-plan',format:build.format,durationInFrames:build.durationInFrames,layers,warnings,provenance:{snapshotId:snapshot.id},review:{visual:'pending',audio:'pending',editorial:'pending'}};
}

/** Explicit calibration adapter for one selected timeline, never silently flattens compounds. */
export function fromCapcut(reference,{timelineId,from=0,to,keyframeClock}) {
  if(reference?.kind!=='capcut-editorial-reference'||reference.timeUnit!=='microseconds')throw Error('Referencia CapCut requerida');
  if(keyframeClock!=='source')throw Error('Declarar keyframeClock source tras revisar el draft');
  const t=reference.timelines.find(x=>x.id===timelineId);
  if(!t||!(to>from)||from<0||to>t.duration/1e6+.001)throw Error('Timeline o intervalo invalido');
  const fps=30,frame=v=>Math.round(v*fps),warnings=[],layers=[];
  const materials=new Map(Object.entries(t.materials).flatMap(([kind,items])=>items.map(({native})=>[native.id,{...native,kind}])));
  for(const track of t.tracks)for(const {native:s} of track.segments){
    const start=s.target_timerange.start/1e6,end=start+s.target_timerange.duration/1e6;
    const a=Math.max(from,start),b=Math.min(to,end);
    if(a>=b||s.visible===false)continue;
    const warn=message=>warnings.push({segmentId:s.id,from:a-from,to:b-from,message});
    const m=materials.get(s.material_id);
    if(!m||(track.type!=='text'&&!m.path)||!['video','audio','text'].includes(track.type)){warn(`No soportado: pista ${track.type} / material ${m?.type??'desconocido'}`);continue;}
    if(s.speed!==1||s.reverse||s.is_loop)throw Error('Velocidad, inverso o loop no soportado: '+s.id);
    const sourceIn=(s.source_timerange?.start??0)/1e6+(a-start);
    const clip=s.clip??{},transform={x:clip.transform?.x??0,y:clip.transform?.y??0,scaleX:clip.scale?.x??1,scaleY:clip.scale?.y??1,rotation:clip.rotation??0,opacity:clip.alpha??1};
    const curves={};
    const propertyMap={KFTypePositionX:'x',KFTypePositionY:'y',KFTypeScaleX:'scaleX',KFTypeScaleY:'scaleY',KFTypeRotation:'rotation',KFTypeAlpha:'opacity'};
    for(const channel of s.common_keyframes??[]){
      const property=propertyMap[channel.property_type];
      if(!property)throw Error('Keyframe no soportado: '+channel.property_type);
            const keys=channel.keyframe_list;
      for(let i=1;i<keys.length;i++){
        const a=keys[i-1],b=keys[i],span=b.time_offset-a.time_offset;
        for(const control of [a.right_control,b.left_control])if(control&&!Object.values(control).every(Number.isFinite))throw Error('Control Bezier invalido');
        if((a.right_control?.x??0)<0||(a.right_control?.x??0)>span||(b.left_control?.x??0)>0||-(b.left_control?.x??0)>span)throw Error('Reloj Bezier no monotono');
      }
      if(keys.some((k,i)=>!['Line','FreeCurveInOut'].includes(k.curveType)||k.values?.length!==1||!Number.isFinite(k.values[0])||(i&&k.time_offset<=keys[i-1].time_offset)))throw Error('Curva no lineal o invalida: '+s.id);
      curves[property]=keys.map(k=>({time:k.time_offset/1e6-sourceIn,value:k.values[0],easing:k.curveType==='Line'?'linear':'bezier',inControl:{time:(k.left_control?.x??0)/1e6,value:k.left_control?.y??0},outControl:{time:(k.right_control?.x??0)/1e6,value:k.right_control?.y??0}}));
    }
    if(s.uniform_scale?.on&&curves.scaleX&&!curves.scaleY)curves.scaleY=structuredClone(curves.scaleX);
    if(clip.flip?.horizontal||clip.flip?.vertical)throw Error('Flip no soportado');
    for(const id of s.extra_material_refs??[]){const extra=materials.get(id);if(['transitions','common_mask'].includes(extra?.kind)||extra?.animations?.length)warn(extra.kind==='common_mask'?'Mascara rectangular: geometria recuperada, borde y feather aproximados':`Efecto nativo pendiente: ${extra.name??extra.kind}`);}
        let mask;
    for(const id of s.extra_material_refs??[]){const extra=materials.get(id);if(extra?.kind==='common_mask'){
      const c=extra.config;
      if(extra.name!=='Rectángulo'||c.invert||c.rotation)throw Error('Mascara no soportada');
      mask={left:(1-c.width)/2+c.centerX,right:(1-c.width)/2-c.centerX,top:Math.max(0,(1-c.height)/2-c.centerY),bottom:Math.max(0,(1-c.height)/2+c.centerY),round:c.roundCorner,feather:c.feather};
    }}
    let text;
    if(track.type==='text'){
      const content=JSON.parse(m.content);const color=content.styles?.[0]?.fill?.content?.solid?.color??[1,1,1];
      text={value:content.text,fontSize:m.font_size*12,color:`rgb(${color.map(c=>Math.round(c*255)).join(',')})`};
      warn('Texto: geometria recuperada; fuente y sombra aproximadas, revisar contra referencia');
    }
    const crop=m.crop;
    if(crop&&['upper_left_x','upper_left_y','upper_right_y','lower_left_x'].some(k=>crop[k]!==undefined&&crop[k]!==0))warn('Recorte de material pendiente de conversion');
    layers.push({id:s.id,type:track.type==='text'?'text':track.type==='audio'?'audio':m.type==='photo'?'image':'video',file:m.path??'',mask,text,
      from:frame(a-from),duration:frame(b-from)-frame(a-from),sourceIn,volume:s.volume??1,
      width:m.width||1920,height:m.height||1080,transform,curves,
      z:s.render_index??0,trackIndex:s.track_render_index??0,name:m.material_name||m.name||m.id});
  }
  layers.sort((a,b)=>a.trackIndex-b.trackIndex||a.z-b.z);
  if(!layers.some(l=>l.type==='video'))throw Error('No hay video en el intervalo');
  return {version:1,kind:'youtube-render-plan',format:{width:1920,height:1080,fps},durationInFrames:frame(to-from),layers,warnings,
    provenance:{sourceSha256:reference.sourceSha256,timelineId,from,to,keyframeClock,geometry:'CapCut center normalized; y up; scale relative to contain'},review:{visual:'pending',audio:'pending',editorial:'pending'}};
}