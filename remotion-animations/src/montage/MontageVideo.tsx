import {Audio} from "@remotion/media";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {RgbSplitFilter, SceneEffects, sceneEffectStyle} from "../motion/HitEffects";
import {Soundtrack, duckGainAt} from "../motion/SoundDesign";
import {StyledCaptionTrack} from "../shorts/StyledCaptionTrack";
import {OverlayPop} from "./OverlayPop";
import {VisualBeat} from "./VisualBeat";
import {MontageVideoProps} from "./schemas";

/**
 * Montaje viral con voz en off. Mismo componente para 9:16 y 16:9: el formato y la
 * geometria llegan en las props del build.
 *
 * Orden de capas: visuales (cada beat se alarga lo que dura la transicion del
 * siguiente, que entra encima), golpes que deforman el cuadro, capas de golpe,
 * textos emergentes y subtitulos. Los textos quedan fuera de los golpes para que un
 * temblor no los haga ilegibles.
 */
export const montageVideoMetadata: CalculateMetadataFunction<MontageVideoProps> = ({props}) => ({
  durationInFrames: props.durationInFrames,
  fps: props.format.fps,
  width: props.format.width,
  height: props.format.height,
});

export const MontageVideo: React.FC<MontageVideoProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {width, height} = props.format;
  const effects = sceneEffectStyle(props.hitEffects, frame, props.slug);
  const splitting = effects.rgbSplitPx > 0.2;
  const filterId = `montage-rgb-${props.slug}`;

  return (
    <AbsoluteFill style={{background: "#05070a"}}>
      {splitting ? <RgbSplitFilter id={filterId} offsetPx={effects.rgbSplitPx} /> : null}
      <AbsoluteFill
        style={{
          transform: effects.transform,
          filter: [effects.filter, splitting ? `url(#${filterId})` : null].filter(Boolean).join(" ") || undefined,
        }}
      >
        {props.beats.map((beat, index) => {
          const overlap = props.beats[index + 1]?.transitionIn.frames ?? 0;
          return (
            <Sequence
              durationInFrames={Math.min(props.durationInFrames - beat.fromFrame, beat.durationInFrames + overlap)}
              from={beat.fromFrame}
              key={beat.id}
              name={`${beat.id} ${beat.camera.move} / ${beat.transitionIn.kind}`}
            >
              <VisualBeat beat={beat} height={height} width={width} />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      <SceneEffects accent={props.accentColor} effects={props.hitEffects} height={height} sceneId={props.slug} width={width} />

      {props.beats.flatMap((beat) => beat.overlays).map((overlay) => (
        <Sequence durationInFrames={overlay.durationInFrames} from={overlay.fromFrame} key={overlay.id} layout="none" name={overlay.id}>
          <OverlayPop accent={props.accentColor} overlay={overlay} rect={props.geometry.popRect} />
        </Sequence>
      ))}

      <StyledCaptionTrack
        appearance={{...props.captions.appearance, accent: props.accentColor}}
        mode={props.captions.mode}
        pages={props.captions.pages}
        rect={props.captions.rect}
      />

      <Audio
        src={staticFile(props.voiceover.src)}
        trimBefore={Math.round(props.voiceover.trimStartSeconds * fps)}
        volume={() => props.voiceover.volume}
      />
      {props.music ? (
        <Audio
          loop
          src={staticFile(props.music.src)}
          volume={(f) => props.music!.volume * duckGainAt(f / fps, props.duckWindows, 0.06, 0.18)}
        />
      ) : null}
      <Soundtrack cues={props.soundCues} enabled={props.soundEnabled} masterVolume={props.soundMix} />
    </AbsoluteFill>
  );
};
