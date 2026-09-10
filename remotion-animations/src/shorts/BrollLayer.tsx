import {Video} from "@remotion/media";
import {Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {SHORT_LAYOUT} from "./layout";
import {ShortCue} from "./schemas";

/** Recursos locales independientes del presentador. */
export const BrollLayer: React.FC<{cues: ShortCue[]}> = ({cues}) => <>
  {cues.filter(cue => cue.type === "broll").map((cue, index) => (
    <Sequence key={cue.id} from={index === 0 ? 0 : cue.fromFrame} durationInFrames={cue.durationInFrames + (index === 0 ? cue.fromFrame : 0) + (cue.mediaKind === "video" ? 0 : 12)} layout="none">
      <Broll cue={cue} first={index === 0} />
    </Sequence>
  ))}
</>;

const Broll: React.FC<{cue: ShortCue; first: boolean}> = ({cue, first}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!cue.src) return null;
  const progress = interpolate(frame, [0, Math.max(1, cue.durationInFrames)], [0, 1], {extrapolateRight: "clamp"});
  const entry = first || cue.mediaTransition === "cut" ? 1 : Math.min(1, frame / 12);
  const zoom = 1 + ((cue.mediaZoom ?? 1.04) - 1) * progress;
  const style: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: cue.mediaFit ?? "cover",
    transform: `scale(${zoom})`, display: "block",
  };
  return <div style={{position: "absolute", ...SHORT_LAYOUT.brollPanel, overflow: "hidden", background: "#101419",
    opacity: entry, transform: cue.mediaTransition === "slide" ? `translateX(${(1-entry)*70}px)` : undefined}}>
    {cue.mediaKind === "video"
      ? <Video src={staticFile(cue.src)} muted trimBefore={Math.round((cue.mediaTrimSeconds ?? 0)*fps)} style={style} />
      : <Img src={staticFile(cue.src)} style={style} />}
    {cue.sourceLabel ? <span style={{position:"absolute",left:28,top:24,fontFamily:"sans-serif",fontSize:23,color:"white",background:"rgba(0,0,0,.7)",padding:"7px 12px",borderRadius:4}}>{cue.sourceLabel}</span> : null}
  </div>;
};
