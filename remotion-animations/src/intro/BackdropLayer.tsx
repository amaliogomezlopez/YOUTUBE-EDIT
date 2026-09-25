import {Video} from "@remotion/media";
import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";
import {clamp, rgba} from "../motion/Toolkit";
import {IntroBackdrop} from "./schemas";

type Area = {left: number; top: number; width: number; height: number};

/**
 * Fondo de la escena: una imagen o un video de apoyo detras de todo.
 *
 * Siempre se mueve, aunque sea poco. Un fondo quieto detras de un sujeto que se
 * mueve delata que es una foto pegada; con paralaje o un zoom lento los dos planos
 * se leen como un espacio. La opacidad por defecto la fija el perfil de estilo, no
 * este componente: en una intro sobria el fondo casi no se ve y en una de tecnologia
 * es protagonista.
 *
 * Con `frame` (layout `card-left`) el recurso se ve entero en esa zona, a la derecha
 * de la cara, sin recortarse; una copia desenfocada y oscurecida llena el cuadro. A
 * sangre, la tarjeta grande de la cara taparia el texto de una captura.
 */
export const BackdropLayer: React.FC<{
  backdrop: IntroBackdrop;
  width: number;
  height: number;
  durationInFrames: number;
  frame?: Area;
}> = ({backdrop, width, height, durationInFrames, frame: area}) => {
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

  if (area) {
    const fill: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top: 0,
      width,
      height,
      objectFit: "cover",
      transform: "scale(1.15)",
      filter: "blur(34px) brightness(0.4)",
    };
    const framed: React.CSSProperties = {
      position: "absolute",
      left: area.left,
      top: area.top,
      width: area.width,
      height: area.height,
      objectFit: "contain",
      // Zoom lento mas contenido: el recurso entero tiene que leerse.
      transform: `scale(${1 + 0.04 * progress})`,
      filter: `drop-shadow(0 28px 60px ${rgba("#000000", 0.55)})`,
    };
    return (
      <>
        <Media backdrop={backdrop} style={fill} />
        <Media backdrop={backdrop} style={framed} />
      </>
    );
  }

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
  return <Media backdrop={backdrop} style={style} />;
};

const Media: React.FC<{backdrop: IntroBackdrop; style: React.CSSProperties}> = ({backdrop, style}) =>
  backdrop.kind === "video" ? (
    <Video loop muted src={staticFile(backdrop.src)} style={style} />
  ) : (
    <Img src={staticFile(backdrop.src)} style={style} />
  );
