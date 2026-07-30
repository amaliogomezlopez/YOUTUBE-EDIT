import {Video} from "@remotion/media";
import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";
import {clamp} from "../motion/Toolkit";
import {IntroBackdrop} from "./schemas";

/**
 * Fondo de la escena: una imagen o un video de apoyo detras de todo.
 *
 * Siempre se mueve, aunque sea poco. Un fondo quieto detras de un sujeto que se
 * mueve delata que es una foto pegada; con paralaje o un zoom lento los dos planos
 * se leen como un espacio. La opacidad por defecto la fija el perfil de estilo, no
 * este componente: en una intro sobria el fondo casi no se ve y en una de tecnologia
 * es protagonista.
 */
export const BackdropLayer: React.FC<{
  backdrop: IntroBackdrop;
  width: number;
  height: number;
  durationInFrames: number;
}> = ({backdrop, width, height, durationInFrames}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.ease),
  });

  // El sobredimensionado del 12% es lo que permite desplazar sin descubrir borde.
  const overscan = 1.12;
  const travel = (width * (overscan - 1)) / 2;
  const motion = (() => {
    switch (backdrop.motion) {
      case "parallax-left":
        return {scale: overscan, x: -travel * progress, y: 0};
      case "parallax-right":
        return {scale: overscan, x: travel * progress, y: 0};
      case "static":
        return {scale: 1, x: 0, y: 0};
      default:
        return {scale: 1 + 0.1 * progress, x: 0, y: 0};
    }
  })();

  const style: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width,
    height,
    objectFit: "cover",
    opacity: backdrop.opacity,
    transform: `scale(${motion.scale}) translate(${motion.x}px, ${motion.y}px)`,
  };

  return backdrop.kind === "video" ? (
    <Video loop muted src={staticFile(backdrop.src)} style={style} />
  ) : (
    <Img src={staticFile(backdrop.src)} style={style} />
  );
};
