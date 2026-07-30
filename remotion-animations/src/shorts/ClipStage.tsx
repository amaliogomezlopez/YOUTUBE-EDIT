import {Video} from "@remotion/media";
import {Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {coverGeometry} from "../motion/Framing";
import {clamp} from "../motion/Toolkit";
import {ShortScene} from "./schemas";

export {coverGeometry};

type ClipStageProps = {
  scene: ShortScene;
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  volume: number;
};

/**
 * Recorte del clip 16:9 dentro de una ventana vertical, anclado al punto focal
 * que detecto YuNet durante la ingesta.
 *
 * El video se escala con `cover` calculado a mano en lugar de `objectFit` porque
 * hace falta desplazar el encuadre hacia la cara: con `object-fit: cover` el
 * navegador centra el recorte y en 9:16 eso deja la cabeza cortada.
 */
export const ClipStage: React.FC<ClipStageProps> = ({
  scene,
  left,
  top,
  width,
  height,
  radius,
  volume,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const camera = cameraTransform(scene, frame);

  // `cover` cubre exactamente la ventana; el zoom de camara solo puede crecer, y
  // los desplazamientos laterales viajan sobre el 5% de holgura que anade
  // `cameraTransform` para el modo drift.
  const cover = coverGeometry({
    width,
    height,
    focusX: scene.focus.x,
    focusY: scene.focus.y,
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: cover.left,
          top: cover.top,
          width: cover.width,
          height: cover.height,
          transform: `scale(${camera.scale}) translate(${camera.translateX}px, ${camera.translateY}px)`,
          transformOrigin: `${scene.focus.x * 100}% ${scene.focus.y * 100}%`,
        }}
      >
        <Video
          src={staticFile(scene.src)}
          trimBefore={Math.round(scene.trimStartSeconds * fps)}
          volume={volume}
          style={{width: "100%", height: "100%", display: "block"}}
        />
      </div>
    </div>
  );
};

const cameraTransform = (scene: ShortScene, frame: number) => {
  const progress = interpolate(frame, [0, scene.durationInFrames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.ease),
  });
  const intensity = scene.cameraIntensity;

  switch (scene.camera) {
    case "punch-in": {
      const amount = 0.1 * intensity;
      return {scale: 1 + amount * progress, translateX: 0, translateY: 0};
    }
    case "push-out": {
      const amount = 0.1 * intensity;
      return {scale: 1 + amount * (1 - progress), translateX: 0, translateY: 0};
    }
    case "drift-left": {
      const travel = 46 * intensity;
      return {scale: 1.05, translateX: -travel * progress, translateY: 0};
    }
    case "drift-right": {
      const travel = 46 * intensity;
      return {scale: 1.05, translateX: travel * progress, translateY: 0};
    }
    default:
      return {scale: 1, translateX: 0, translateY: 0};
  }
};
