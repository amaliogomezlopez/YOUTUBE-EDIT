import {fingerprint} from './memory.js';

/** A comment is evidence, not an automatically approved global editing rule. */
export function recordFeedback(pkg,{frame,category,quote,scope='this-example'}) {
 if(pkg?.payload?.kind!=='youtube-render-package'||pkg.id!==fingerprint(pkg.payload))throw Error('Paquete invalido');
 const {props}=pkg.payload;
 if(!Number.isInteger(frame)||frame<0||frame>=props.durationInFrames)throw Error('Frame fuera del montaje');
 if(!['camera','cut','layout','sound','asset','pacing'].includes(category))throw Error('Categoria de feedback invalida');
 if(typeof quote!=='string'||!quote.trim())throw Error('Guardar las palabras reales del usuario');
 if(!['this-example','candidate-preference'].includes(scope))throw Error('Alcance invalido');
 const active=props.layers.filter(l=>frame>=l.from&&frame<l.from+l.duration).map(l=>({id:l.id,type:l.type,sourceSeconds:l.sourceIn+(frame-l.from)/props.format.fps}));
 const payload={version:1,kind:'youtube-editorial-feedback',packageId:pkg.id,frame,seconds:frame/props.format.fps,category,quote:quote.trim(),scope,activeLayers:active,provenance:pkg.payload.provenance,ruleStatus:'proposed',approval:'pending'};
 return {id:fingerprint(payload),payload};
}