/** Capabilities are enforced before dispatch, never a silent fallback. */
export const RENDER_ADAPTERS={
 ffmpeg:{available:true,formats:['1080x1920@60'],effects:['screen-camera','karaoke','sound-families'],limitations:['one screen-camera scene','no overlays, music or scene transitions']},
 remotion:{available:true,formats:['1080x1920@60'],effects:['screen-camera','karaoke','sound-families','overlays','music','scene-transitions'],limitations:['browser render','typography and audio mixing differ from FFmpeg']},
 pixi:{available:false,formats:[],effects:[],limitations:['experimental candidate; no adapter implemented']}
};
export function assertRenderCapability(engine,build){
 const adapter=RENDER_ADAPTERS[engine];if(!adapter?.available)throw Error('Motor no disponible: '+engine);
 const {width,height,fps}=build.format;
 if(!adapter.formats.includes(width+'x'+height+'@'+fps))throw Error('Formato no soportado por '+engine);
 if(engine==='ffmpeg'){
  const s=build.scenes[0];
  if(build.scenes.length!==1||!s?.screenCamera||s.cues?.length||s.label||s.transitionIn!=='cut'||build.music||build.backgroundImage||s.camera!=='static')throw Error('FFmpeg requiere una escena screen-camera sin overlays, musica ni transiciones');
  if(build.captionStyle?.mode!=='karaoke'||build.captionStyle?.baseFontSize!==68||build.captionStyle?.primary!=='#FFFFFF'||build.captionStyle?.accent!=='#43F56C'||build.captionStyle?.uppercase!==true||build.captionStyle?.font!=='Schibsted Grotesk'||build.captionStyle?.renderer!=='styled'||build.captionStyle?.emphasis!=='color')throw Error('FFmpeg requiere el preset de subtitulos camera-green; usar Remotion para personalizar');
  if(build.clipVolume!==1||build.soundMix!==1)throw Error('FFmpeg requiere mezcla camera-green a volumen 1');
 }
 return adapter;
}
