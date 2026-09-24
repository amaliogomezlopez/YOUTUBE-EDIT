import {Video} from "@remotion/media";
import {AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {clamp} from "../motion/Toolkit";
import {MontageBeat} from "./schemas";

/**
 * Una visual del montaje: el asset a pantalla completa, su movimiento de camara y
 * su transicion de entrada.
 *
 * El planificador ya lo decidio todo en fracciones del cuadro; aqui solo se
 * interpolan keyframes. La camara escala con origen en `focus` y traslada en
 * fracciones acotadas por el planificador, de modo que el borde del asset nunca
 * entra en cuadro.
 */

const EASINGS: Record<string, (t: number) => number> = {
  "in-out-sine": Easing.inOut(Easing.sin),
  "out-expo": Easing.out(Easing.exp),
  linear: (t) => t,
};

type Key = MontageBeat["camera"]["keys"][number];

const sampleKeys = (keys: Key[], progress: number, easing: (t: number) => number) => {
  if (keys.length === 1) return keys[0];
  const index = Math.max(0, keys.findIndex((key, i) => i > 0 && progress <= key.t) - 1);
  const from = keys[index];
  const to = keys[Math.min(keys.length - 1, index + 1)];
  const local = to.t > from.t ? easing(Math.min(1, Math.max(0, (progress - from.t) / (to.t - from.t)))) : 1;
  const mix = (a: number, b: number) => a + (b - a) * local;
  return {t: progress, scale: mix(from.scale, to.scale), x: mix(from.x, to.x), y: mix(from.y, to.y)};
};

const Media: React.FC<{beat: MontageBeat; fit: "cover" | "contain"; background?: boolean}> = ({beat, fit, background}) => {
  const {fps} = useVideoConfig();
  const {visual} = beat;
  const style: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fit,
    objectPosition: `${visual.focus.x * 100}% ${visual.focus.y * 100}%`,
    ...(background ? {filter: "blur(38px) brightness(0.5) saturate(1.3)", transform: "scale(1.2)"} : {}),
  };
  return visual.kind === "video" ? (
    // El Video de @remotion/media pinta en un canvas: el ajuste va por su prop
    // `objectFit`, el `object-fit` del style no le llega.
    <Video
      loop={visual.loop}
      muted
      objectFit={fit}
      src={staticFile(visual.src)}
      style={style}
      trimBefore={Math.round(visual.trimSeconds * fps)}
    />
  ) : (
    <Img src={staticFile(visual.src)} style={style} />
  );
};

/** Estilo de la transicion de entrada en el frame local del beat. */
const transitionStyle = (kind: string, frames: number, frame: number): React.CSSProperties => {
  if (frames <= 0 || frame >= frames) return {};
  const p = interpolate(frame, [0, frames], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  switch (kind) {
    case "whip":
      return {transform: `translateX(${(1 - p) * 100}%)`, filter: `blur(${(1 - p) * 26}px)`};
    case "slide":
      return {transform: `translateY(${(1 - p) * 100}%)`};
    case "zoom-blur":
      return {transform: `scale(${1 + (1 - p) * 0.55})`, filter: `blur(${(1 - p) * 20}px)`, opacity: Math.min(1, p * 2.5)};
    case "glitch":
      // Aparece a saltos: tres frames visibles, uno no, con desplazamiento en bloques.
      return {
        opacity: frame % 3 === 1 ? 0.25 : 1,
        transform: `translateX(${Math.round((random(`glitch-${frame}`) - 0.5) * 12) * 6}px)`,
      };
    default:
      return {};
  }
};

export const VisualBeat: React.FC<{beat: MontageBeat; width: number; height: number}> = ({beat, width, height}) => {
  const frame = useCurrentFrame();
  const {camera, visual} = beat;
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, beat.durationInFrames)));
  const key = sampleKeys(camera.keys, progress, EASINGS[camera.easing] ?? EASINGS["in-out-sine"]);
  // Temblor de camara en mano: saltos cada 4 frames suavizados, no ruido por frame.
  const step = Math.floor(frame / 4);
  const blend = (frame % 4) / 4;
  const noise = (axis: string) =>
    (random(`${beat.id}-${axis}-${step}`) * (1 - blend) + random(`${beat.id}-${axis}-${step + 1}`) * blend - 0.5);
  const shakeX = camera.shake * noise("x") * 14;
  const shakeY = camera.shake * noise("y") * 10;

  return (
    <AbsoluteFill style={{overflow: "hidden", background: "#05070a", ...transitionStyle(beat.transitionIn.kind, beat.transitionIn.frames, frame)}}>
      <AbsoluteFill
        style={{
          transformOrigin: `${visual.focus.x * 100}% ${visual.focus.y * 100}%`,
          transform: `scale(${key.scale}) translate(${key.x * width + shakeX}px, ${key.y * height + shakeY}px)`,
        }}
      >
        {visual.fit === "contain-blur" ? (
          <>
            <AbsoluteFill><Media background beat={beat} fit="cover" /></AbsoluteFill>
            <AbsoluteFill style={{padding: Math.round(Math.min(width, height) * 0.04)}}>
              <Media beat={beat} fit="contain" />
            </AbsoluteFill>
          </>
        ) : (
          <Media beat={beat} fit="cover" />
        )}
      </AbsoluteFill>
      {/* Degradado inferior: los subtitulos se leen sobre cualquier imagen. */}
      <AbsoluteFill style={{background: "linear-gradient(to bottom, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)"}} />
    </AbsoluteFill>
  );
};
