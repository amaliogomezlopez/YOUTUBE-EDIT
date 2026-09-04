import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {DATA_FONT_FAMILY, FINANCE_FONT_FAMILY} from "../motion/fonts";
import {EditorialScene} from "./schemas";

import {EDITORIAL_COLORS as C} from "./palette";
const clamp = {extrapolateLeft:"clamp",extrapolateRight:"clamp"} as const;
const alpha = (hex:string,a:number) => {
  const v=hex.replace("#","");
  return `rgba(${parseInt(v.slice(0,2),16)},${parseInt(v.slice(2,4),16)},${parseInt(v.slice(4,6),16)},${a})`;
};
const ease=(frame:number,fps:number,a:number,b:number)=>interpolate(frame,[a*fps,b*fps],[0,1],{...clamp,easing:Easing.bezier(.16,1,.3,1)});
const cue=(scene:EditorialScene,id:string,frame:number,fps:number)=>{
  const c=scene.semanticCues.find((x)=>x.id===id);
  return c?ease(frame,fps,c.atSeconds,c.atSeconds+.35):0;
};
const Header:React.FC<{eyebrow:string;title:string}>=({eyebrow,title})=>(
  <>
    <div style={{color:C.gold,fontFamily:DATA_FONT_FAMILY,fontSize:18,fontWeight:900,left:180,letterSpacing:3,position:"absolute",right:180,textAlign:"center",top:58}}>{eyebrow}</div>
    <div style={{color:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:56,fontWeight:950,left:180,position:"absolute",right:180,textAlign:"center",top:94}}>{title}</div>
  </>
);
const Footer:React.FC<{children:React.ReactNode;color?:string}>=({children,color=C.white})=>(
  <div style={{bottom:68,color,fontFamily:FINANCE_FONT_FAMILY,fontSize:34,fontWeight:900,left:180,position:"absolute",right:180,textAlign:"center"}}>{children}</div>
);

const PastVsNow:React.FC<{scene:EditorialScene}>=({scene})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig();
  const y2000=cue(scene,"date-2000-744",f,fps), y2008=cue(scene,"date-2008-752",f,fps), turn=cue(scene,"turn-sin-753",f,fps);
  return <><Header eyebrow="DOS CRISIS · UN MATIZ DECISIVO" title="El pasado no basta para explicar el presente"/>
    <div style={{display:"flex",gap:46,left:150,position:"absolute",right:150,top:265}}>
      {[{year:"2000",p:y2000},{year:"2008",p:y2008}].map((x,i)=><div key={x.year} style={{background:alpha(C.red,.11),border:`5px solid ${x.p?C.red:alpha(C.red,.35)}`,borderRadius:22,flex:1,height:430,padding:38,transform:`scale(${1+x.p*.055})`}}>
        <div style={{color:C.red,fontFamily:DATA_FONT_FAMILY,fontSize:74,fontWeight:950}}>{x.year}</div>
        <svg height="235" viewBox="0 0 600 235" width="100%"><path d={i?"M20 35 C150 45 205 70 275 135 C350 205 450 185 580 218":"M20 45 C145 35 210 65 290 120 C370 178 460 190 580 220"} fill="none" stroke={C.red} strokeWidth="13"/><text fill={C.white} fontFamily={DATA_FONT_FAMILY} fontSize="25" x="20" y="220">BENEFICIOS ↓</text></svg>
      </div>)}
      <div style={{background:C.panel,border:`6px solid ${C.cyan}`,borderRadius:22,boxShadow:`0 0 45px ${alpha(C.cyan,turn*.35)}`,flex:1,height:430,opacity:.2+turn*.8,padding:38,transform:`translateX(${(1-turn)*90}px)`}}>
        <div style={{color:C.cyan,fontFamily:DATA_FONT_FAMILY,fontSize:64,fontWeight:950}}>HOY</div>
        <div style={{color:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:42,fontWeight:900,marginTop:82}}>PRECIO ≠ BENEFICIO</div>
        <div style={{color:C.green,fontFamily:DATA_FONT_FAMILY,fontSize:27,fontWeight:900,marginTop:40}}>LA FOTO FUNDAMENTAL ES DISTINTA</div>
      </div>
    </div><Footer color={turn?C.cyan:C.white}>COMPARAR EL MECANISMO, NO SOLO LA FORMA</Footer></>;
};

const PriceVsProfit:React.FC<{scene:EditorialScene}>=({scene})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),p=ease(f,fps,.4,7.5),flash=cue(scene,"earnings-record-flash",f,fps);
  return <><Header eyebrow="PRECIO Y NEGOCIO SE SEPARAN" title="Las acciones caen; los beneficios marcan máximos"/>
    <svg height="1080" viewBox="0 0 1920 1080" width="1920">
      <path d="M190 560 C440 480 610 450 820 510 C1040 575 1290 690 1730 745" fill="none" pathLength={1} stroke={C.red} strokeDasharray={`${p} 1`} strokeWidth="14"/>
      <path d="M190 690 C450 650 680 610 900 510 C1130 405 1390 335 1730 265" fill="none" pathLength={1} stroke={C.green} strokeDasharray={`${p} 1`} strokeWidth="14"/>
      <text fill={C.red} fontFamily={DATA_FONT_FAMILY} fontSize="30" fontWeight="900" x="1490" y="805">PRECIO ↓</text>
      <text fill={C.green} fontFamily={DATA_FONT_FAMILY} fontSize="30" fontWeight="900" x="1450" y="240">BENEFICIO · RÉCORD</text>
      <g opacity={flash}><circle cx="1540" cy="292" fill={alpha(C.white,.18)} r="150"/><path d="M1480 260 h120 v78 h-120z" fill={C.panel} stroke={C.white} strokeWidth="7"/><circle cx="1540" cy="299" fill="none" r="25" stroke={C.cyan} strokeWidth="7"/></g>
    </svg><Footer color={C.green}>LA CAÍDA DE COTIZACIÓN NO HA LLEGADO A LOS BENEFICIOS</Footer></>;
};

const EarningsEngine:React.FC<{scene:EditorialScene}>=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),m=ease(f,fps,.7,3.2),r=ease(f,fps,3.4,6.2),out=ease(f,fps,6.3,8.8);
  return <><Header eyebrow="QUÉ MANTIENE EL MOTOR" title="Márgenes récord e ingresos constantes"/>
    <div style={{alignItems:"center",display:"flex",gap:65,left:190,position:"absolute",right:190,top:320}}>
      {[{t:"MÁRGENES",s:"RÉCORD",p:m,c:C.gold},{t:"INGRESOS",s:"CRECIMIENTO",p:r,c:C.cyan}].map(x=><div key={x.t} style={{background:C.panel,border:`5px solid ${x.c}`,borderRadius:26,flex:1,opacity:.25+x.p*.75,padding:"60px 35px",textAlign:"center",transform:`translateY(${(1-x.p)*80}px)`}}><div style={{color:x.c,fontFamily:DATA_FONT_FAMILY,fontSize:34,fontWeight:950}}>{x.t}</div><div style={{color:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:48,fontWeight:950,marginTop:24}}>{x.s}</div></div>)}
      <div style={{color:C.gold,fontFamily:DATA_FONT_FAMILY,fontSize:64}}>→</div>
      <div style={{background:alpha(C.green,.14),border:`7px solid ${C.green}`,borderRadius:"50%",height:300,opacity:out,position:"relative",transform:`scale(${.7+out*.3})`,width:300}}><div style={{color:C.green,fontFamily:DATA_FONT_FAMILY,fontSize:32,fontWeight:950,left:20,position:"absolute",right:20,textAlign:"center",top:90}}>BENEFICIOS</div><div style={{color:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:46,fontWeight:950,left:10,position:"absolute",right:10,textAlign:"center",top:145}}>INTACTOS</div></div>
    </div><Footer>EL PRECIO SE ENFRÍA; EL MOTOR DEL NEGOCIO SIGUE ENCENDIDO</Footer></>;
};

const CollapseTest:React.FC<{scene:EditorialScene}>=({scene})=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),check=ease(f,fps,1,5.8),past=cue(scene,"date-2000-863",f,fps);
  return <><Header eyebrow="LA CONDICIÓN QUE CAMBIARÍA LA TESIS" title="Vigilar beneficios, no adivinar el desplome"/>
    <div style={{border:`7px solid ${C.green}`,bottom:210,height:480,left:320,position:"absolute",transform:`scale(${1-past*.03})`,width:520}}><div style={{background:C.green,color:C.bg,fontFamily:DATA_FONT_FAMILY,fontSize:28,fontWeight:950,padding:18,textAlign:"center"}}>EDIFICIO FUNDAMENTAL</div>{Array.from({length:12},(_,i)=><div key={i} style={{background:check>.3?C.green:alpha(C.cyan,.3),border:`3px solid ${C.green}`,height:54,left:55+(i%3)*150,position:"absolute",top:110+Math.floor(i/3)*82,width:94}}/>)}</div>
    <div style={{background:C.panel,border:`5px solid ${past?C.red:C.gold}`,borderRadius:24,padding:42,position:"absolute",right:270,top:345,width:590}}>
      <div style={{color:C.gold,fontFamily:DATA_FONT_FAMILY,fontSize:25,fontWeight:900}}>SEÑAL DE INVALIDACIÓN</div>
      <div style={{color:C.white,fontFamily:FINANCE_FONT_FAMILY,fontSize:42,fontWeight:950,lineHeight:1.2,marginTop:24}}>BENEFICIOS COLAPSAN DURANTE MESES</div>
      <div style={{color:past?C.red:C.green,fontFamily:DATA_FONT_FAMILY,fontSize:28,fontWeight:950,marginTop:36}}>{past?"COMO EN 2000":"TODAVÍA NO CONFIRMADO"}</div>
    </div><Footer color={past?C.red:C.green}>SIN DAÑO FUNDAMENTAL, LA ESTRUCTURA SIGUE EN PIE</Footer></>;
};

const OpportunityDoor:React.FC<{scene:EditorialScene}>=()=>{
  const f=useCurrentFrame(),{fps}=useVideoConfig(),open=ease(f,fps,2.2,6.5);
  return <><Header eyebrow="DEBILIDAD NO ES DESTRUCCIÓN" title="Una corrección puede abrir una oportunidad"/>
    <div style={{background:alpha(C.red,.14),border:`6px solid ${C.red}`,height:430,left:300,position:"absolute",top:285,transform:`perspective(900px) rotateY(${open*72}deg)`,transformOrigin:"left",width:420}}><div style={{color:C.red,fontFamily:DATA_FONT_FAMILY,fontSize:38,fontWeight:950,marginTop:165,textAlign:"center"}}>MIEDO</div></div>
    <div style={{background:`radial-gradient(circle,${alpha(C.gold,.55)},${alpha(C.gold,.04)} 65%)`,border:`6px solid ${C.gold}`,height:430,left:720,position:"absolute",top:285,width:650}}><div style={{color:C.gold,fontFamily:FINANCE_FONT_FAMILY,fontSize:60,fontWeight:950,marginTop:120,textAlign:"center"}}>VENTANA DE COMPRA</div><div style={{color:C.white,fontFamily:DATA_FONT_FAMILY,fontSize:25,fontWeight:900,marginTop:35,textAlign:"center"}}>SI LOS BENEFICIOS RESISTEN</div></div>
    <div style={{color:C.green,fontFamily:DATA_FONT_FAMILY,fontSize:120,fontWeight:950,opacity:open,position:"absolute",right:310,top:420,transform:`scale(${.6+open*.4})`}}>→</div>
    <Footer color={C.gold}>EL PRECIO CEDE; LA TESIS FUNDAMENTAL PERMANECE</Footer></>;
};

export const CurrentEarningsContrastScene:React.FC<{scene:EditorialScene}>=({scene})=>(
  <AbsoluteFill style={{background:"radial-gradient(circle at 62% 42%,rgba(232,192,74,.08),transparent 38%),linear-gradient(145deg,#0C0D0B,#141510 60%,#090A08)",overflow:"hidden"}}>
    {scene.id==="scene-030"?<PastVsNow scene={scene}/>:scene.id==="scene-031"?<PriceVsProfit scene={scene}/>:scene.id==="scene-032"?<EarningsEngine scene={scene}/>:scene.id==="scene-033"?<CollapseTest scene={scene}/>:<OpportunityDoor scene={scene}/>}
  </AbsoluteFill>
);
