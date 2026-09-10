/** User's semantic exceptions are excluded from ordinary transition rotation. */
export function describeReelSound(name) {
  if (/money|dinero/i.test(name)) return {family:'chime',use:'money',description:'Dinero: precios, ingresos, ahorro, pagos o cifras economicas. Nunca transicion generica.'};
  if (/riser/i.test(name)) return {family:'riser',use:'intro',description:'Ascenso metalico para el arranque del video. Usar una vez al inicio, discretamente bajo la voz.'};
  if (/message|mensaje/i.test(name)) return {family:'ui',use:'message',description:'Notificacion cuando aparece un mensaje, chat, tuit o publicacion social. No basta con mencionar una red social.'};
  const description=/camera|shutter/i.test(name)?'Obturador/camara: entrada de captura, titular o cambio de visual.':/pop/i.test(name)?'Pop: entrada breve y ligera de una nueva visual.':/slice|ring/i.test(name)?'Slice Ring: cambio de visual con cola; revisar que no se solape con el siguiente golpe.':'Whip/whoosh: corte o entrada de una nueva imagen o clip.';
  return {family:'whoosh',use:'transition',description};
}
export function semanticSoundSelection(imported) {
  const palette={}, metadata={}, uses={};
  const entries=imported.entries.map(e=>({...e,...describeReelSound(e.sourceName)}));
  for(const e of entries) {
    (palette[e.family]??=[]).push(e.file);
    metadata[e.file]={durationSeconds:e.durationSeconds};
    uses[e.use]=e.family;
  }
  return {...imported,entries,palette,metadata,uses,families:uses.transition?[uses.transition]:[]};
}
export function chooseReelSound(selection, {use,first=false,note}={}) {
  if (!selection?.uses) return null;
  const purpose=(use||undefined)??(first && selection.uses.intro?'intro':'transition');
  if (!['intro','transition','money','message'].includes(purpose)) throw new Error('soundUse desconocido: '+purpose);
  if (purpose==='intro' && !first) throw new Error('El riser se reserva para el inicio del Reel');
  if (['money','message'].includes(purpose) && !note?.trim()) throw new Error('soundUse '+purpose+' requiere soundNote con el contexto visible o hablado');
  const family=selection.uses[purpose];
  if (!family) throw new Error('Falta sonido para '+purpose+' en SONIDOS-REELS. Usa transition si corresponde o declara silencio justificado.');
  return {family,use:purpose};
}
