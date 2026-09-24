import {measureText} from "@remotion/layout-utils";
import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {clamp} from "../motion/Toolkit";
import {MontageBeat} from "./schemas";

type Overlay = MontageBeat["overlays"][number];
type Rect = {left: number; top: number; width: number; height: number};

/**
 * Texto que salta a pantalla: una cifra (`stat`) sobre placa de color o una palabra
 * gancho (`pop`) en blanco con contorno. Entra con muelle y un giro leve, se sostiene
 * y sale encogiendo en los ultimos frames: el golpe lo marca la entrada.
 */
export const OverlayPop: React.FC<{overlay: Overlay; rect: Rect; accent: string}> = ({overlay, rect, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({frame, fps, config: {damping: 11, stiffness: 190, mass: 0.7}});
  const exitFrames = Math.min(8, Math.floor(overlay.durationInFrames / 3));
  const exit = interpolate(frame, [overlay.durationInFrames - exitFrames, overlay.durationInFrames], [1, 0], clamp);
  const scale = interpolate(enter, [0, 1], [0.3, 1]) * interpolate(exit, [0, 1], [0.6, 1]);
  const rotate = interpolate(enter, [0, 1], [-9, overlay.kind === "stat" ? -3 : 2]);
  const stat = overlay.kind === "stat";
  const text = overlay.text.toLocaleUpperCase("es");

  // La tipografia se ajusta al rectangulo midiendo el texto, no con un tamano fijo.
  let fontSize = stat ? 190 : 150;
  const maxWidth = rect.width - (stat ? 120 : 40);
  while (fontSize > 48 && measureText({text, fontFamily: MOTION_FONT_FAMILY, fontSize, fontWeight: 900}).width > maxWidth) {
    fontSize -= 6;
  }
  fontSize = Math.min(fontSize, rect.height * 0.7);

  return (
    <div
      style={{
        position: "absolute",
        ...rect,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: exit,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          fontFamily: MOTION_FONT_FAMILY,
          fontWeight: 900,
          fontSize,
          lineHeight: 1,
          letterSpacing: -2,
          whiteSpace: "nowrap",
          color: stat ? "#0B0D10" : "#FFFFFF",
          background: stat ? accent : "transparent",
          padding: stat ? "18px 44px 24px" : 0,
          borderRadius: stat ? 18 : 0,
          boxShadow: stat ? "0 18px 50px rgba(0,0,0,0.55)" : "none",
          WebkitTextStroke: stat ? "0px" : "6px #0B0D10",
          paintOrder: "stroke fill",
          textShadow: stat ? "none" : `0 10px 28px rgba(0,0,0,0.7), 0 0 2px ${accent}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
