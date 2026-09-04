import {measureText} from "@remotion/layout-utils";
import {Sequence, useCurrentFrame} from "remotion";
import {CaptionPage} from "./schemas";
import {SHORT_LAYOUT} from "./layout";
import {MOTION_FONT_FAMILY} from "../motion/fonts";

export type CaptionAppearance = {
  font?:string;primary?:string;accent?:string;activeColor?:string;baseFontSize?:number;
  tracking?:number;outlineSize?:number;shadow?:number;align?:string;uppercase?:boolean;
  emphasis?:string;heroScale?:number;
};
type Rect={left:number;top:number;width:number;height:number};
type Props={pages:CaptionPage[];mode:string;appearance:CaptionAppearance;rect:Rect};
const textFor=(text:string,style:CaptionAppearance)=>style.uppercase?text.toLocaleUpperCase("es"):text;

export const StyledCaptionTrack:React.FC<Props> = ({pages,...props}) => <>
  {pages.map((page,i)=><Sequence key={i} from={page.fromFrame} durationInFrames={page.durationInFrames} layout="none">
    <StyledPage {...props} page={page}/>
  </Sequence>)}
</>;

const StyledPage:React.FC<Omit<Props,"pages">&{page:CaptionPage}> = ({page,mode,appearance:style,rect})=>{
  const frame=useCurrentFrame()+page.fromFrame;
  const font=style.font ?? MOTION_FONT_FAMILY;
  const gap=16;
  const tracking=style.tracking ?? 0;
  let size=Math.min(style.baseFontSize ?? 76,100);
  const widths=(s:number)=>page.words.map(w=>measureText({text:textFor(w.text,style),fontFamily:font,fontSize:s,fontWeight:900,letterSpacing:tracking+"px"}).width);
  let rowWidths:number[]=[];
  for(;size>=32;size-=2) {
    rowWidths=[];
    for(const width of widths(size)) {
      if(!rowWidths.length || rowWidths[rowWidths.length-1]+gap+width>rect.width-24) rowWidths.push(width);
      else rowWidths[rowWidths.length-1]+=gap+width;
    }
    if(Math.max(...rowWidths,0)<=rect.width-24 && rowWidths.length*size*1.25<=rect.height-12) break;
  }
  return <div style={{position:"absolute",...rect,display:"flex",alignContent:"center",alignItems:"center",
    justifyContent:style.align==="left"?"flex-start":"center",flexWrap:"wrap",gap:"3px "+gap+"px",
    padding:"6px 12px",boxSizing:"border-box",fontFamily:font,fontWeight:900,lineHeight:1.18,fontSize:size,letterSpacing:tracking}}>
    {page.words.map((word,i)=>{
      const active=frame>=word.fromFrame && frame<word.toFrame;
      const visible=mode!=="progressive" || frame>=word.fromFrame;
      const emphasis=active && style.emphasis!=="off" && mode!=="lines";
      return <span key={i} style={{whiteSpace:"nowrap",opacity:visible?1:0,
        color:emphasis?(style.activeColor??style.accent??"#B8F36B"):(style.primary??"#fff"),
        WebkitTextStroke:(style.outlineSize??2)+"px #10141b",paintOrder:"stroke fill",
        textShadow:"0 "+(style.shadow??3)+"px 9px #000",
        transform:emphasis?"translateY(-2px)":"none"}}>{textFor(word.text,style)}</span>;
    })}
  </div>;
};
export const defaultCaptionRect = (layout:keyof typeof SHORT_LAYOUT.captionBottom):Rect=>({
  left:54,top:SHORT_LAYOUT.captionBottom[layout]-Math.min(260,SHORT_LAYOUT.captionHeight[layout]),
  width:900,height:Math.min(260,SHORT_LAYOUT.captionHeight[layout])
});
