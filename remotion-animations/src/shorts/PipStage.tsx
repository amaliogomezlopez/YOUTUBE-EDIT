import {Video} from "@remotion/media";
import {interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {ShortScene} from "./schemas";

type PipStageProps = {
  scene: ShortScene;
  volume: number;
};

/**
 * Composicion de los layouts `pip` y `fit`. La geometria sale de
 * `src/lib/pip-layout.js`: tarjeta de cara con radio y trazo blanco, pantalla
 * en cover en el hueco inferior, mascara con blur sobre la webcam original.
 */
export const PipStage: React.FC<PipStageProps> = ({scene, volume}) => {
  const {fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const detailEntry = scene.screenEmphasis ? interpolate(frame, [0, Math.round(fps * .22)], [.985, 1], {extrapolateLeft:"clamp",extrapolateRight:"clamp"}) : 1;
  const trimBefore = Math.round(scene.trimStartSeconds * fps);
  const pip = scene.layout === "pip" ? scene.pip : null;
  const fit = scene.layout === "fit" ? scene.fit : null;
  if (!pip && !fit) return null;
  if (scene.comparison?.length) return <div style={{position:"absolute",inset:0,background:"#111720"}}>
    {scene.comparison.map((item,i)=><div key={i} style={{position:"absolute",...item.slot,overflow:"hidden",borderRadius:18,background:"#080c12"}}>
      <Video muted src={staticFile(scene.src)} trimBefore={trimBefore} style={{position:"absolute",...item.transform}} volume={0}/>
      <div style={{position:"absolute",left:16,top:12,padding:"8px 16px",background:"#080c12",color:"white",fontSize:28,fontWeight:700}}>{item.label}</div>
    </div>)}
  </div>;

  const backgroundFilter = pip
    ? "blur(28px) brightness(0.82) saturate(0.7)"
    : "blur(24px) brightness(0.92) saturate(0.75)";
  const screen = pip ? pip.screen : fit!.screen;
  const radius = pip?.camCard.radius ?? 28;
  const stroke = pip?.camCard.stroke ?? 3;

  return (
    <>
      <Video
        muted
        objectFit="cover"
        src={staticFile(scene.src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          filter: backgroundFilter,
        }}
        trimBefore={trimBefore}
        volume={0}
      />

      <div
        style={{
          position: "absolute",
          left: screen.left,
          top: screen.top,
          width: screen.width,
          height: screen.height,
          overflow: "hidden",
          background: "#10141b",
          borderRadius: scene.screenEmphasis ? 18 : 0,
          transform: `scale(${detailEntry})`,
        }}
      >
        <Video
          src={staticFile(scene.src)}
          objectFit={scene.screenTransform ? "fill" : "cover"}
          style={scene.screenTransform ? {position:"absolute",left:scene.screenTransform.left,top:scene.screenTransform.top,width:scene.screenTransform.width,height:scene.screenTransform.height,display:"block"} : {width: "100%", height: "100%", display: "block"}}
          trimBefore={trimBefore}
          volume={volume}
        />
        {pip?.mask && (pip.mask.visible ?? pip.mask.width > 8) ? (
          <div
            style={{
              position: "absolute",
              left: pip.mask.localLeft ?? pip.mask.left - screen.left,
              top: pip.mask.localTop ?? pip.mask.top - screen.top,
              width: pip.mask.width,
              height: pip.mask.height,
              backdropFilter: "blur(18px)",
              background: "rgba(8, 10, 14, 0.18)",
            }}
          />
        ) : null}
      </div>

      {pip ? (
        <div
          style={{
            position: "absolute",
            left: pip.camCard.left,
            top: pip.camCard.top,
            width: pip.camCard.width,
            height: pip.camCard.height,
            borderRadius: radius,
            background: "#ffffff",
            padding: stroke,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: Math.max(4, radius - stroke),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: pip.camCrop.offsetX,
                top: pip.camCrop.offsetY,
                width: pip.camCrop.videoWidth,
                height: pip.camCrop.videoHeight,
              }}
            >
              <Video
                muted
                src={staticFile(scene.src)}
                objectFit="fill"
                style={{width: "100%", height: "100%", display: "block"}}
                trimBefore={trimBefore}
                volume={0}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
