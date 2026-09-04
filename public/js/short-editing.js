import {escapeHtml} from './core.js';

export function editingControls(clip) {
  if (!clip.editing?.enabled) return '';
  const scenes = clip.editing.scenes ?? [];
  return '<details class="short-editing"><summary>Revisar montaje por escenas</summary>' +
    '<p>Reproduce el vídeo para revisar cada tramo. Los cambios se aplican al volver a renderizar. Cambiar el estilo reconstruye las escenas y sus encuadres.</p>' +
    '<label>Estilo<select name="editingProfile">' + ['sobrio','dinamico','energico'].map(p => '<option value="'+p+'" '+(p===clip.editing.profile?'selected':'')+'>'+p+'</option>').join('') + '</select></label>' +
    scenes.map(s => '<fieldset data-edit-scene="'+escapeHtml(s.id)+'"><legend>'+escapeHtml(s.id)+' · '+Number(s.start??0).toFixed(1)+'–'+Number(s.end??0).toFixed(1)+' s de la fuente del corte</legend>' +
      '<p>'+escapeHtml(s.reason ?? '')+'</p><label>Composición<select data-scene-layout>'+
      [['pip','Webcam y pantalla'],['fit','Pantalla'],['full','Presentador']].map(([v,l])=>'<option value="'+v+'" '+(v===s.layout?'selected':'')+'>'+l+'</option>').join('')+
      '</select></label><label><input type="checkbox" data-scene-effects '+(clip.editing.sceneEdits?.find(e=>e.id===s.id)?.effects===false?'':'checked')+'> Efectos en esta escena</label>'+
      '<label>Centro del presentador (x, y entre 0 y 1)<input data-scene-focus value="'+escapeHtml(s.focus?[s.focus.x,s.focus.y].join(', '):'')+'" placeholder="Vacío: seguimiento automático"></label>'+
      '<label>Región de pantalla (x, y, ancho, alto en píxeles)<input data-scene-region value="'+escapeHtml(s.screenRegion?[s.screenRegion.x,s.screenRegion.y,s.screenRegion.w,s.screenRegion.h].join(', '):'')+'" placeholder="Vacío: conservar encuadre"></label></fieldset>').join('')+
    '<details><summary>Corregir palabras de los subtítulos</summary><div class="short-word-editor">'+
    (clip.transcript??[]).map(w=>'<label>'+Number(w.start).toFixed(1)+' s<input data-edit-word="'+w.index+'" data-original-word="'+escapeHtml(w.text)+'" value="'+escapeHtml(w.text)+'" maxlength="120"></label>').join('')+
    '</div></details></details>';
}
export function collectEditing(article) {
  const profile=article.querySelector('[name="editingProfile"]');
  if(!profile) return undefined;
  const sceneEdits=[...article.querySelectorAll('[data-edit-scene]')].map(row=>{
    const region=row.querySelector('[data-scene-region]').value.trim();
    const focusInput=row.querySelector('[data-scene-focus]').value.trim();
    let focus;
    if(focusInput) {
      const values=focusInput.split(',').map(Number);
      if(values.length!==2 || !values.every(v=>Number.isFinite(v)&&v>=0&&v<=1)) throw new Error('El centro necesita dos valores entre 0 y 1.');
      focus={x:values[0],y:values[1]};
    }
    let screenRegion;
    if(region) {
      const values=region.split(',').map(Number);
      if(values.length!==4 || !values.every(Number.isFinite) || values[2]<24 || values[3]<24) throw new Error('La region necesita x, y, ancho y alto validos.');
      screenRegion={x:values[0],y:values[1],w:values[2],h:values[3],confidence:1,method:'manual'};
    }
    return {id:row.dataset.editScene,layout:row.querySelector('[data-scene-layout]').value,
      effects:row.querySelector('[data-scene-effects]').checked,...(screenRegion?{screenRegion}:{}),...(focus?{focus}:{})};
  });
  const wordEdits=[...article.querySelectorAll('[data-edit-word]')].filter(i=>i.value!==i.dataset.originalWord)
    .map(i=>({index:Number(i.dataset.editWord),text:i.value}));
  return {enabled:true,profile:profile.value,sceneEdits,wordEdits};
}
