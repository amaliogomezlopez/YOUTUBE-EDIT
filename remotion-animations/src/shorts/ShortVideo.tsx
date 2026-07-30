import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {getMotionTheme} from "../motion/DesignSystem";
import {MOTION_FONT_FAMILY} from "../motion/fonts";
import {Soundtrack} from "../motion/SoundDesign";
import {clamp, rgba} from "../motion/Toolkit";
import {CaptionTrack} from "./CaptionTrack";
import {ClipStage} from "./ClipStage";
import {CueLayer} from "./CueLayer";
import {SHORT_LAYOUT, clipRect} from "./layout";
import {ShortScene, ShortVideoProps} from "./schemas";

export const shortVideoMetadata: CalculateMetadataFunction<ShortVideoProps> = ({props}) => ({
  durationInFrames: props.durationInFrames,
  fps: props.format.fps,
  width: props.format.width,
  height: props.format.height,
});

export const ShortVideo: React.FC<ShortVideoProps> = (props) => {
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const danger = props.dangerColor ?? theme.danger;
  const palette = {theme, accent, danger};
  const uppercase = props.captionStyle?.uppercase ?? true;

  return (
    <AbsoluteFill style={{background: theme.background}}>
      {props.backgroundImage ? (
        <Img
          src={staticFile(props.backgroundImage)}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
            filter: "saturate(0.7)",
          }}
        />
      ) : null}

      {props.scenes.map((scene) => (
        <Sequence
          durationInFrames={scene.durationInFrames}
          from={scene.from}
          key={scene.id}
          name={`${scene.id} (${scene.layout})`}
        >
          <SceneBlock palette={palette} scene={scene} uppercase={uppercase} volume={props.clipVolume} />
        </Sequence>
      ))}

      <Soundtrack
        cues={props.soundCues}
        duckWindows={props.duckWindows}
        enabled={props.soundEnabled}
        masterVolume={props.soundMix}
      />
    </AbsoluteFill>
  );
};

const SceneBlock: React.FC<{
  scene: ShortScene;
  palette: {theme: ReturnType<typeof getMotionTheme>; accent: string; danger: string};
  uppercase: boolean;
  volume: number;
}> = ({scene, palette, uppercase, volume}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const transition = transitionStyle(scene.transitionIn, frame, fps);
  const clip = clipRect(scene.layout);

  return (
    <AbsoluteFill style={transition}>
      <ClipStage
        height={clip.height}
        left={clip.left}
        radius={clip.radius}
        scene={scene}
        top={clip.top}
        volume={volume}
        width={clip.width}
      />

      {/* Degradado inferior: separa el video del escenario y sostiene el subtitulo
          sobre cualquier fondo del clip. En `stage` la cara es una tarjeta suelta,
          asi que no hay costura que disimular. */}
      {scene.layout === "stage" ? null : (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: clip.height - 220,
            width: SHORT_LAYOUT.width,
            height: 260,
            background: `linear-gradient(to bottom, ${rgba(palette.theme.background, 0)}, ${rgba(palette.theme.background, scene.layout === "full" ? 0.72 : 1)})`,
          }}
        />
      )}

      {scene.label ? (
        <SceneLabel accent={palette.accent} label={scene.label} layout={scene.layout} />
      ) : null}

      <CueLayer cues={scene.cues} layout={scene.layout} palette={palette} />

      <CaptionTrack
        accent={palette.accent}
        layout={scene.layout}
        pages={scene.captionPages}
        theme={palette.theme}
        uppercase={uppercase}
      />
    </AbsoluteFill>
  );
};

/**
 * Rotulo de escena. En `stage` no va arriba a la izquierda: ese hueco lo ocupa la
 * tarjeta de la cara, asi que el rotulo se coloca a su derecha y aprovecha la
 * banda superior, que de otro modo queda vacia.
 */
const SceneLabel: React.FC<{label: string; accent: string; layout: ShortScene["layout"]}> = ({
  label,
  accent,
  layout,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entry = spring({frame, fps, config: {damping: 16, mass: 0.5, stiffness: 140}});
  const clip = clipRect(layout);
  const beside = layout === "stage";
  return (
    <div
      style={{
        position: "absolute",
        left: beside ? clip.left + clip.width + 32 : SHORT_LAYOUT.safeX,
        top: beside ? clip.top + 26 : SHORT_LAYOUT.safeTop,
        maxWidth: beside
          ? SHORT_LAYOUT.width - SHORT_LAYOUT.safeX - (clip.left + clip.width + 32)
          : undefined,
        padding: beside ? 0 : "12px 26px",
        borderRadius: beside ? 0 : 999,
        background: beside ? undefined : rgba(accent, 0.2),
        border: beside ? undefined : `2px solid ${rgba(accent, 0.6)}`,
        borderLeft: beside ? `5px solid ${accent}` : undefined,
        paddingLeft: beside ? 22 : undefined,
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: 800,
        fontSize: beside ? 40 : 30,
        lineHeight: beside ? 1.16 : 1,
        letterSpacing: beside ? 0.6 : 2.2,
        textTransform: "uppercase",
        // El plan puede partir el rotulo con \n para controlar el corte de linea.
        whiteSpace: beside ? "pre-line" : "nowrap",
        color: "#FFFFFF",
        opacity: entry,
        transform: `translateY(${interpolate(entry, [0, 1], [-20, 0])}px)`,
      }}
    >
      {label}
    </div>
  );
};

/**
 * Transiciones de entrada de escena. Duran entre 6 y 10 frames a 60fps: en un
 * short, una transicion mas larga se come el ritmo de la locucion.
 */
const transitionStyle = (
  transition: ShortScene["transitionIn"],
  frame: number,
  fps: number,
): React.CSSProperties => {
  switch (transition) {
    case "fade": {
      const opacity = interpolate(frame, [0, 8], [0, 1], clamp);
      return {opacity};
    }
    case "whip": {
      const progress = interpolate(frame, [0, 9], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      });
      return {
        opacity: interpolate(progress, [0, 0.4], [0, 1], clamp),
        transform: `translateX(${interpolate(progress, [0, 1], [180, 0])}px)`,
        filter: `blur(${interpolate(progress, [0, 1], [14, 0])}px)`,
      };
    }
    case "slide-up": {
      const entry = spring({frame, fps, config: {damping: 18, mass: 0.6, stiffness: 130}});
      return {
        transform: `translateY(${interpolate(entry, [0, 1], [SHORT_LAYOUT.height * 0.28, 0])}px)`,
      };
    }
    case "zoom-blur": {
      const progress = interpolate(frame, [0, 10], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      });
      return {
        opacity: interpolate(progress, [0, 0.3], [0, 1], clamp),
        transform: `scale(${interpolate(progress, [0, 1], [1.16, 1])})`,
        filter: `blur(${interpolate(progress, [0, 1], [10, 0])}px)`,
      };
    }
    default:
      return {};
  }
};
