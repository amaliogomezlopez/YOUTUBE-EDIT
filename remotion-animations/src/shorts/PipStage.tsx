import {Video} from "@remotion/media";
import {staticFile, useVideoConfig} from "remotion";
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
  const trimBefore = Math.round(scene.trimStartSeconds * fps);
  const pip = scene.layout === "pip" ? scene.pip : null;
  const fit = scene.layout === "fit" ? scene.fit : null;
  if (!pip && !fit) return null;

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
        src={staticFile(scene.src)}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
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
        }}
      >
        <Video
          src={staticFile(scene.src)}
          style={{width: "100%", height: "100%", display: "block", objectFit: "cover"}}
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
                style={{width: "100%", height: "100%", display: "block", objectFit: "fill"}}
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
