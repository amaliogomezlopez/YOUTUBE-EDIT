import {Video} from "@remotion/media";
import {staticFile, useVideoConfig} from "remotion";
import {ShortScene} from "./schemas";

type PipStageProps = {
  scene: ShortScene;
  volume: number;
};

/**
 * Composicion de los layouts `pip` y `fit`, hermanos del filtergraph de
 * `src/lib/ffmpeg.js`: mismo fondo desenfocado, misma pantalla a 1600 px y
 * misma tarjeta de cara con borde negro, pero compuestos en Remotion con los
 * rectangulos que el build precalcula en `pip-layout.js`.
 *
 * El clip suena UNA sola vez: la capa de pantalla lleva el volumen y el fondo
 * y la tarjeta de cara van mudos, porque las tres son el mismo video.
 *
 * La camara no aplica aqui: el encuadre ya lo fija el layout (el build fuerza
 * `static` y avisa si el plan pedia otra cosa).
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

  return (
    <>
      {/* Fondo: el propio clip cubriendo el frame, desenfocado y apagado. */}
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

      {/* Pantalla: la capa grande, y la unica que lleva el audio del clip. */}
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
          style={{width: "100%", height: "100%", display: "block", objectFit: "fill"}}
          trimBefore={trimBefore}
          volume={volume}
        />
      </div>

      {pip ? (
        <>
          {/* Mascara: tapa la webcam incrustada original en la pantalla. */}
          <div
            style={{
              position: "absolute",
              left: pip.mask.left,
              top: pip.mask.top,
              width: pip.mask.width,
              height: pip.mask.height,
              background: "#000000",
            }}
          />

          {/* Tarjeta de la cara: el borde negro de 6 px es el fondo de la
              tarjeta; dentro, el clip recortado al webcamBox. */}
          <div
            style={{
              position: "absolute",
              left: pip.camCard.left,
              top: pip.camCard.top,
              width: pip.camCard.width,
              height: pip.camCard.height,
              background: "#000000",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 6,
                top: 6,
                width: pip.camCard.width - 12,
                height: pip.camCard.height - 12,
                overflow: "hidden",
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
        </>
      ) : null}
    </>
  );
};
