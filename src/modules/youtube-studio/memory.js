import {createHash} from 'node:crypto';

export function fingerprint(value) {
  const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'
    ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}

/** Snapshots retain exact word context and decisions, never infer approval. */
export function snapshot({plan,clips,build}) {
  const payload={version:1,kind:'youtube-edit-example',plan,clips,build};
  return {id:fingerprint(payload),payload};
}

export function compareEdits(before,after) {
  for (const item of [before,after]) {
    if(item?.payload?.kind!=='youtube-edit-example'||item.payload.version!==1
      ||item.id!==fingerprint(item.payload)) throw Error('Snapshot modificado o invalido');
  }
  const identity=s=>s.payload.clips.map(c=>({id:c.id,sourceHash:c.sourceHash,words:c.words}))
    .sort((a,b)=>a.id.localeCompare(b.id));
  if(fingerprint(identity(before))!==fingerprint(identity(after))) throw Error('Fuentes/transcripciones distintas: no comparar como correccion de estilo');
  const changes=[];
  function diff(a,b,at) {
    if(fingerprint(a)===fingerprint(b))return;
    const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    if(obj(a)&&obj(b)) {
      for(const key of [...new Set([...Object.keys(a),...Object.keys(b)])].sort()) {
        const next=at+'/'+key.replaceAll('~','~0').replaceAll('/','~1');
        if(!Object.hasOwn(a,key))changes.push({path:next,operation:'add',after:b[key]});
        else if(!Object.hasOwn(b,key))changes.push({path:next,operation:'remove',before:a[key]});
        else diff(a[key],b[key],next);
      }
    } else changes.push({path:at,operation:'replace',before:a,after:b});
  }
  // Arrays remain whole so a reorder is not misreported as editing another scene.
  diff(before.payload.plan,after.payload.plan,'/plan');
  diff(before.payload.build.budget,after.payload.build.budget,'/budget');
  return {version:1,beforeId:before.id,afterId:after.id,changes,
    feedback:{userQuote:'',context:'',ruleRefs:[],visual:'pending',audio:'pending',editorial:'pending'},
    note:'Cambios estructurales; completar feedback real. No aplicar como regla ni marcar aprobado automaticamente.'};
}
