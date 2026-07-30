import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Easing,
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
import {BackdropLayer} from "./BackdropLayer";
import {RgbSplitFilter, SceneEffects, sceneEffectStyle} from "./EffectLayer";
import {IntroCueLayer} from "./IntroCueLayer";
import {SubjectStage} from "./SubjectStage";
import {TitleCard} from "./TitleCard";
import {INTRO_LAYOUT, subjectRect} from "./layout";
import {IntroScene, IntroVideoProps} from "./schemas";

export const introVideoMetadata: CalculateMetadataFunction<IntroVideoProps> = ({props}) => ({
  durationInFrames: props.durationInFrames,
  fps: props.format.fps,
  width: props.format.width,
  height: props.format.height,
});

export const IntroVideo: React.FC<IntroVideoProps> = (props) => {
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const danger = props.dangerColor ?? theme.danger;
  const palette = {theme, accent, danger};

  return (
    <AbsoluteFill style={{background: theme.background}}>
      {props.scenes.map((scene) => (
        <Sequence
          durationInFrames={scene.durationInFrames}
          from={scene.from}
          key={scene.id}
          name={`${scene.id} (${scene.layout})`}
        >
          <SceneBlock palette={palette} scene={scene} volume={props.clipVolume} />
        </Sequence>
      ))}

      {props.titleCard ? (
        <Sequence
          durationInFrames={props.titleCard.durationInFrames}
          from={props.titleCard.fromFrame}
          layout="none"
          name="titulo"
        >
          <TitleCard accent={accent} theme={theme} title={props.titleCard} />
        </Sequence>
      ) : null}

      {props.music ? (
        <MusicBed duckWindows={props.duckWindows} music={props.music} />
      ) : null}

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
  scene: IntroScene;
  palette: {theme: ReturnType<typeof getMotionTheme>; accent: string; danger: string};
  volume: number;
}> = ({scene, palette, volume}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const transition = transitionStyle(scene.transitionIn, frame, fps);
  const subject = subjectRect(scene.layout);
  const effects = sceneEffectStyle(scene.effects, frame, scene.id);
  const filterId = `intro-rgb-${scene.id}`;
  const splitting = effects.rgbSplitPx > 0.2;

  // El halo solo tiene sentido cuando el layout deja fondo alrededor del sujeto: en
  // `hero` el clip llega a los bordes y un borde luminoso seria un marco decorativo.
  const glow = scene.layout === "frame" || scene.layout === "insert" ? palette.accent : null;

  return (
    <AbsoluteFill style={transition}>
      {splitting ? <RgbSplitFilter id={filterId} offsetPx={effects.rgbSplitPx} /> : null}
      <AbsoluteFill
        style={{
          transform: effects.transform,
          filter: [effects.filter, splitting ? `url(#${filterId})` : null]
            .filter(Boolean)
            .join(" ") || undefined,
        }}
      >
        {scene.backdrop ? (
          <BackdropLayer
            backdrop={scene.backdrop}
            durationInFrames={scene.durationInFrames}
            height={INTRO_LAYOUT.height}
            width={INTRO_LAYOUT.width}
          />
        ) : null}

        <IntroCueLayer cues={scene.cues} depth="back" palette={palette} />

        <SubjectStage
          glow={glow}
          height={subject.height}
          left={subject.left}
          radius={subject.radius}
          scene={scene}
          top={subject.top}
          volume={volume}
          width={subject.width}
        />

        <IntroCueLayer cues={scene.cues} depth="front" palette={palette} />

        {scene.label ? <SceneLabel accent={palette.accent} label={scene.label} /> : null}

        {scene.captionPages.length ? (
          <CaptionBand accent={palette.accent} pages={scene.captionPages} theme={palette.theme} />
        ) : null}
      </AbsoluteFill>

      <SceneEffects
        accent={palette.accent}
        effects={scene.effects}
        height={INTRO_LAYOUT.height}
        sceneId={scene.id}
        width={INTRO_LAYOUT.width}
      />
    </AbsoluteFill>
  );
};

/**
 * Musica de fondo. Cede contra la locucion con las mismas ventanas de ducking que
 * los efectos: si la mezcla no baja, la voz del clip se pelea con la pista y el
 * resultado es que no se entiende ninguna de las dos.
 */
const MusicBed: React.FC<{
  music: NonNullable<IntroVideoProps["music"]>;
  duckWindows: IntroVideoProps["duckWindows"];
}> = ({music, duckWindows}) => {
  const {fps} = useVideoConfig();
  const base = 10 ** (music.gainDb / 20);
  return (
    <Audio
      src={staticFile(music.file)}
      volume={(audioFrame) => {
        const seconds = audioFrame / fps;
        const inSpeech = duckWindows.some(
          (window) => seconds >= window.startSeconds && seconds <= window.endSeconds,
        );
        // Un decibelio extra sobre el ducking de los efectos: la voz compite peor
        // con una pista continua que con un golpe suelto.
        return base * (inSpeech ? 0.42 : 1);
      }}
    />
  );
};

const SceneLabel: React.FC<{label: string; accent: string}> = ({label, accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entry = spring({frame, fps, config: {damping: 16, mass: 0.5, stiffness: 140}});
  return (
    <div
      style={{
        position: "absolute",
        left: INTRO_LAYOUT.safeX,
        top: INTRO_LAYOUT.safeTop,
        paddingLeft: 22,
        borderLeft: `6px solid ${accent}`,
        fontFamily: MOTION_FONT_FAMILY,
        fontWeight: 800,
        fontSize: 42,
        lineHeight: 1.16,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        // El plan puede partir el rotulo con \n para controlar el corte de linea.
        whiteSpace: "pre-line",
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
 * Subtitulo de la intro, opcional y sin karaoke por palabra.
 *
 * Una intro se ve con sonido y su valor esta en el ritmo visual; el subtitulo esta
 * para que se entienda una frase concreta, no para acompanar toda la locucion, asi
 * que se mantiene en una banda fija por encima de la zona del reproductor.
 */
const CaptionBand: React.FC<{
  pages: IntroScene["captionPages"];
  theme: ReturnType<typeof getMotionTheme>;
  accent: string;
}> = ({pages, theme, accent}) => {
  const frame = useCurrentFrame();
  const band = INTRO_LAYOUT.captionBand;
  const page = pages.find(
    (candidate) => frame >= candidate.fromFrame && frame < candidate.fromFrame + candidate.durationInFrames,
  );
  if (!page) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: band.left,
        top: band.top,
        width: band.width,
        height: band.height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      {page.words.map((word, index) => {
        const active = frame >= word.fromFrame && frame <= word.toFrame;
        return (
          <span
            key={`${word.text}-${index}`}
            style={{
              fontFamily: MOTION_FONT_FAMILY,
              fontWeight: 900,
              fontSize: 62,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: active ? accent : theme.ink,
              textShadow: `0 6px 26px ${rgba("#000000", 0.75)}`,
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Transiciones de entrada de escena. Duran entre 5 y 10 frames a 60 fps: en una
 * intro, una transicion mas larga se come el golpe que la justifica.
 */
const transitionStyle = (
  transition: IntroScene["transitionIn"],
  frame: number,
  fps: number,
): React.CSSProperties => {
  switch (transition) {
    case "fade":
      return {opacity: interpolate(frame, [0, 8], [0, 1], clamp)};
    case "whip": {
      const progress = interpolate(frame, [0, 9], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      });
      return {
        opacity: interpolate(progress, [0, 0.4], [0, 1], clamp),
        transform: `translateX(${interpolate(progress, [0, 1], [260, 0])}px)`,
        filter: `blur(${interpolate(progress, [0, 1], [18, 0])}px)`,
      };
    }
    case "slide-up": {
      const entry = spring({frame, fps, config: {damping: 18, mass: 0.6, stiffness: 130}});
      return {
        transform: `translateY(${interpolate(entry, [0, 1], [INTRO_LAYOUT.height * 0.24, 0])}px)`,
      };
    }
    case "zoom-blur": {
      const progress = interpolate(frame, [0, 10], [0, 1], {
        ...clamp,
        easing: Easing.out(Easing.cubic),
      });
      return {
        opacity: interpolate(progress, [0, 0.3], [0, 1], clamp),
        transform: `scale(${interpolate(progress, [0, 1], [1.18, 1])})`,
        filter: `blur(${interpolate(progress, [0, 1], [12, 0])}px)`,
      };
    }
    case "flash-cut":
      // El corte ya ha ocurrido; lo que queda es el residuo de luz que lo tapa. El
      // fotograma blanco lo pone el efecto `flash` anclado al mismo beat.
      return {filter: `brightness(${interpolate(frame, [0, 5], [2.4, 1], clamp)})`};
    case "glitch-cut": {
      const progress = interpolate(frame, [0, 7], [0, 1], clamp);
      return {
        transform: `translateX(${Math.round(interpolate(progress, [0, 1], [26, 0]) / 6) * 6}px)`,
        opacity: interpolate(progress, [0, 0.25], [0.2, 1], clamp),
      };
    }
    default:
      return {};
  }
};
