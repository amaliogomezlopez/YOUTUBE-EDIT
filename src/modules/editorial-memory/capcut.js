import {createHash} from 'node:crypto';

const select=(value,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,structuredClone(value[k])]));
const segmentKeys=['id','material_id','source_timerange','target_timerange','render_timerange','speed','reverse','volume','last_nonzero_volume','clip','uniform_scale','visible','render_index','track_render_index','extra_material_refs','common_keyframes','keyframe_refs','is_loop'];
const materialKeys=['id','type','name','material_name','path','duration','width','height','has_audio','crop','crop_ratio','crop_scale','audio_fade','content','base_content','font_name','font_path','font_size','alignment','config','position_info','animations','effect_id','resource_id','is_overlap','speed','mode','channel_mapping'];

/** Read-only evidence adapter, not a renderer or a lossless CapCut converter. */
export function extractCapcutReference(input) {
  const bytes=Buffer.isBuffer(input)?input:Buffer.from(input);
  let root;
  try {root=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));}
  catch {throw Error('Se requiere un draft_content.json legible; no se descifra CapCut.');}
  const timelines=[];
  function visit(draft,location,parent=null,depth=0) {
    if(depth>32)throw Error('Anidamiento CapCut excesivo');
    if(!draft||!Array.isArray(draft.tracks)||!draft.materials||typeof draft.materials!=='object')throw Error('Timeline CapCut no reconocida: '+location);
    const materials={};
    for(const [kind,items] of Object.entries(draft.materials)) {
      if(kind==='drafts'||!Array.isArray(items))continue;
      materials[kind]=items.map(m=>({native:select(m,materialKeys),omittedFields:Object.keys(m).filter(k=>!materialKeys.includes(k))}));
    }
    const tracks=draft.tracks.map(track=>{
      if(!Array.isArray(track.segments))throw Error('Track sin segmentos');
      return {...select(track,['id','type','attribute','flag']),segments:track.segments.map(segment=>{
        for(const field of ['source_timerange','target_timerange']) {
          const r=segment[field];
          if(r!=null&&(!Number.isSafeInteger(r.start)||r.start<0||!Number.isSafeInteger(r.duration)||r.duration<0))throw Error('Rango temporal invalido: '+field);
        }
        return {native:select(segment,segmentKeys),omittedFields:Object.keys(segment).filter(k=>!segmentKeys.includes(k))};
      })};
    });
    timelines.push({location,parent,...select(draft,['id','duration','fps','canvas_config','version','new_version']),tracks,materials});
    for(const [index,wrapper] of (draft.materials.drafts||[]).entries()) {
      if(!wrapper.draft)throw Error('Subdraft sin contenido embebido');
      visit(wrapper.draft,`${location}/materials/drafts/${index}/draft`,{timelineLocation:location,materialId:wrapper.id},depth+1);
    }
  }
  visit(root,'$');
  return {version:1,kind:'capcut-editorial-reference',sourceSha256:createHash('sha256').update(bytes).digest('hex'),
    timeUnit:'microseconds',timelines,renderable:false,styleApproved:false,
    limitations:['Solo campos enumerados; omittedFields identifica campos no exportados. Conservar el original privado junto a su hash.',
      'Las timelines conservan su reloj local; no se aplanan composiciones ni subdrafts externos.',
      'Fotogramas clave y geometria son valores nativos; su reloj y curvas requieren validacion antes de convertir.',
      'Los presets, fuentes y recursos externos no se descargan ni reproducen. No equivale a revision visual o auditiva.']};
}
/** GIF of a CapCut InfoSticker cache directory, or null when it is not a GIF sticker. */
export async function resolveStickerGif(dir,{readFile}) {
  const config=JSON.parse(await readFile(dir+'/config.json','utf8').catch(()=>'null'));
  const link=config?.effect?.Link?.find(l=>l.type==='InfoSticker'&&l.format==='gif');
  return link&&!/[\/]|\.\./.test(link.path)?dir+'/'+link.path:null;
}

/** Resolve CapCut InfoSticker GIFs from their cache directories; only GIF links are accepted. */
export async function resolveCapcutStickers(reference,timelineId,{readFile,probe}) {
  const timeline=reference.timelines.find(t=>t.id===timelineId);
  if(!timeline)throw Error('Timeline no encontrada: '+timelineId);
  const stickers={};
  for(const {native:m} of timeline.materials.stickers??[]){
    const file=m.path&&await resolveStickerGif(m.path,{readFile});
    if(!file)continue;
    const {width,height}=await probe(file);
    stickers[m.id]={file,width,height};
  }
  return stickers;
}
