/**
 * Usos de montaje que el nombre del fichero (prefijo) o su subcarpeta declaran. No
 * tienen familia en los Reels: su paleta se indexa por familia y `message` ya ocupa
 * `ui` y `money` ocupa `chime`, asi que un clic sonaria en un mensaje. Solo los
 * consume intro-studio (`userSoundPalette`), que los traduce a sus familias.
 */
export const EDIT_SOUND_USES = [
  {prefix:'impacto-grave',folder:'impactos',use:'impact-low',description:'Impacto grave y seco: zoom-punch en la palabra que pesa, logo que entra.'},
  {prefix:'remate',use:'impact-finisher',description:'Impacto de remate con cuerpo: shake al final de una frase fuerte.'},
  {prefix:'whoosh-in',use:'whoosh-in',description:'Whoosh inverso: crece hasta el corte y termina en el. Transicion zoom-blur.'},
  {prefix:'clic',folder:'clicks',use:'click',description:'Clic de interfaz: algo que se pulsa o aparece en una pantalla.'},
  {prefix:'ding-dato',use:'data',description:'Ding de dato: cifra en pantalla que no es dinero (+25 %, 2 motivos).'},
  {prefix:'glitch',use:'glitch',description:'Glitch corto: transicion glitch-cut.'},
  {prefix:'tecleo',use:'typing',description:'Tecleo: titular escrito letra a letra. Opcional; la palabra clave va muda.'},
  {prefix:'bajada',use:'drop',description:'Bajada de bajo: remate largo. Sin consumidor todavia; no entra en ninguna rotacion.'},
  {folder:'apertura',use:'library',description:'Efecto de la biblioteca del usuario para la apertura: solo suena donde lo pone preferencias.json.'}
];

const splitName = (name) => {
  const parts = String(name).toLowerCase().split(/[\\/]/);
  return {base: parts.at(-1), folder: parts.length > 1 ? parts[0] : null};
};
const prefixUse = (name) => {
  const {base} = splitName(name);
  return EDIT_SOUND_USES.find((u) => u.prefix && (base.startsWith(u.prefix + '_') || base.startsWith(u.prefix + '-'))) ?? null;
};
const folderUse = (name) => {
  const {folder} = splitName(name);
  return EDIT_SOUND_USES.find((u) => u.folder && u.folder === folder) ?? null;
};

/**
 * Uso de un sonido por su nombre: el prefijo manda; despues, las palabras que marcan
 * un uso semantico (dinero, riser, mensaje) aunque el fichero este en una subcarpeta;
 * despues, la subcarpeta; y lo demas es transicion.
 */
export function describeReelSound(name) {
  const edit = prefixUse(name);
  if (edit) return {family:null,use:edit.use,description:edit.description};
  const semantic = semanticUse(name);
  if (semantic) return semantic;
  const folder = folderUse(name);
  if (folder) return {family:null,use:folder.use,description:folder.description};
  const description=/camera|shutter/i.test(name)?'Obturador/camara: entrada de captura, titular o cambio de visual.':/pop/i.test(name)?'Pop: entrada breve y ligera de una nueva visual.':/slice|ring/i.test(name)?'Slice Ring: cambio de visual con cola; revisar que no se solape con el siguiente golpe.':'Whip/whoosh: corte o entrada de una nueva imagen o clip.';
  return {family:'whoosh',use:'transition',description};
}

/** User's semantic exceptions are excluded from ordinary transition rotation. */
function semanticUse(name) {
  if (/money|dinero/i.test(name)) return {family:'chime',use:'money',description:'Dinero: precios, ingresos, ahorro, pagos o cifras economicas. Nunca transicion generica.'};
  if (/riser/i.test(name)) return {family:'riser',use:'intro',description:'Ascenso metalico para el arranque del video. Usar una vez al inicio, discretamente bajo la voz.'};
  if (/message|mensaje/i.test(name)) return {family:'ui',use:'message',description:'Notificacion cuando aparece un mensaje, chat, tuit o publicacion social. No basta con mencionar una red social.'};
  return null;
}
export function semanticSoundSelection(imported) {
  const palette={}, metadata={}, uses={};
  const entries=imported.entries.map(e=>({...e,...describeReelSound(e.sourceName)}));
  for(const e of entries) {
    metadata[e.file]={durationSeconds:e.durationSeconds};
    if (!e.family) continue;
    (palette[e.family]??=[]).push(e.file);
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
