import {Video} from "@remotion/media";
import {Easing, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {coverGeometry} from "../motion/Framing";
import {clamp, rgba} from "../motion/Toolkit";
import {IntroScene} from "./schemas";

type SubjectStageProps = {
  scene: IntroScene;
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  volume: number;
  /** Halo del sujeto: separa la silueta del fondo cuando el layout deja fondo visible. */
  glow: string | null;
};

/**
 * El sujeto: mi cara, mi cuerpo y la habitacion, encuadrado en la ventana de su
 * layout y anclado al punto focal que detecto YuNet en la ingesta.
 *
 * En `frame` e `insert` el clip es una tarjeta con borde y sombra sobre el fondo, y
 * es ahi donde el arte de la capa trasera se lee de verdad como "detras de mi": no
 * hay mascara de persona, hay un plano mas cerca que otro.
 */
export const SubjectStage: React.FC<SubjectStageProps> = ({
  scene,
  left,
  top,
  width,
  height,
  radius,
  volume,
  glow,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const camera = cameraTransform(scene, frame, fps);

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
        boxShadow: glow
          ? `0 0 0 3px ${rgba(glow, 0.5)}, 0 40px 90px ${rgba("#000000", 0.55)}`
          : undefined,
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

/**
 * Movimiento de camara. `handheld` y `snap-zoom` son propios de la intro:
 *
 * - `handheld` mete un temblor de amplitud baja con ruido determinista. Un plano
 *   fijo de busto parlante durante tres segundos se siente muerto, y un drift
 *   lineal se siente mecanico; el temblor lo resuelve sin narrar nada.
 * - `snap-zoom` salta de golpe a mitad de escena y se queda. Es el movimiento que
 *   se ancla a un beat: un zoom progresivo no tiene instante, y un salto si.
 */
const cameraTransform = (scene: IntroScene, frame: number, fps: number) => {
  const progress = interpolate(frame, [0, scene.durationInFrames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.ease),
  });
  const intensity = scene.cameraIntensity;

  switch (scene.camera) {
    case "punch-in":
      return {scale: 1 + 0.1 * intensity * progress, translateX: 0, translateY: 0};
    case "push-out":
      return {scale: 1 + 0.1 * intensity * (1 - progress), translateX: 0, translateY: 0};
    case "drift-left":
      return {scale: 1.05, translateX: -46 * intensity * progress, translateY: 0};
    case "drift-right":
      return {scale: 1.05, translateX: 46 * intensity * progress, translateY: 0};
    case "handheld": {
      // Dos frecuencias distintas por eje: con una sola el temblor tiene periodo
      // audible y se lee como un bucle.
      const seconds = frame / fps;
      const jitter = (seed: number, rate: number) =>
        (random(`${scene.id}-${seed}-${Math.floor(seconds * rate)}`) - 0.5) * 2;
      return {
        scale: 1.04,
        translateX: jitter(1, 3.1) * 7 * intensity,
        translateY: jitter(2, 2.3) * 5 * intensity,
      };
    }
    case "snap-zoom": {
      const at = Math.round(scene.durationInFrames * 0.45);
      return {
        scale: frame < at ? 1 : 1 + 0.12 * intensity,
        translateX: 0,
        translateY: 0,
      };
    }
    default:
      return {scale: 1, translateX: 0, translateY: 0};
  }
};
