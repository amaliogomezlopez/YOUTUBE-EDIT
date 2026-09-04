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
  const focus = focusAt(scene, scene.trimStartSeconds + frame / fps);

  // `cover` cubre exactamente la ventana; el zoom de camara solo puede crecer, y
  // los desplazamientos laterales viajan sobre el 5% de holgura que anade
  // `cameraTransform` para el modo drift.
  const cover = coverGeometry({
    width,
    height,
    sourceWidth: scene.sourceWidth,
    sourceHeight: scene.sourceHeight,
    focusX: focus.x,
    focusY: focus.y,
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
          transformOrigin: `${focus.x * 100}% ${focus.y * 100}%`,
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

/**
 * Punto focal en un instante del clip. Con dos o mas muestras de `focusTrack`
 * (el seguimiento de cara de la ingesta) se interpola linealmente entre
 * muestras y se clampa en los extremos; con menos, el foco estatico de siempre.
 */
const focusAt = (scene: ShortScene, seconds: number) => {
  const track = scene.focusTrack;
  if (!track || track.length < 2) return scene.focus;
  if (seconds <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (seconds >= last.t) return last;
  for (let index = 1; index < track.length; index += 1) {
    const next = track[index];
    if (seconds > next.t) continue;
    const previous = track[index - 1];
    const progress = (seconds - previous.t) / Math.max(0.001, next.t - previous.t);
    return {
      x: previous.x + (next.x - previous.x) * progress,
      y: previous.y + (next.y - previous.y) * progress,
    };
  }
  return last;
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
