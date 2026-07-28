import {CalculateMetadataFunction} from "remotion";
import {AbsoluteFill, Sequence, useVideoConfig} from "remotion";
import {EpisodeAudio} from "./EpisodeAudio";
import {SceneBoundary} from "./SceneBoundary";
import {FinanceEditorialScene} from "./SceneRegistry";
import {
  EditorialEpisodeProps,
  editorialEpisodeSchema,
} from "./schemas";

export {editorialEpisodeSchema};

export const editorialEpisodeMetadata: CalculateMetadataFunction<
  EditorialEpisodeProps
> = ({props}) => ({
  durationInFrames: Math.max(1, Math.ceil(props.durationSeconds * 30)),
  fps: 30,
  width: 1920,
  height: 1080,
});

export const EditorialEpisode: React.FC<EditorialEpisodeProps> = (props) => {
  const {fps, durationInFrames} = useVideoConfig();
  const orderedScenes = [...props.scenes].sort(
    (left, right) => left.startSeconds - right.startSeconds,
  );
  return (
    <AbsoluteFill style={{backgroundColor: "#050817"}}>
      <EpisodeAudio
        audioPath={props.audioPath}
        volume={props.narrationVolume}
      />
      {orderedScenes.map((scene, index) => {
        const from = Math.max(0, Math.round(scene.startSeconds * fps));
        const nextScene = orderedScenes[index + 1];
        const until = nextScene
          ? Math.round(nextScene.startSeconds * fps)
          : durationInFrames;
        const duration = Math.max(1, Math.min(durationInFrames - from, until - from));
        return (
          <Sequence
            durationInFrames={duration}
            from={from}
            key={scene.id}
            name={scene.id}
          >
            <SceneBoundary>
              <FinanceEditorialScene
                accentColor={props.accentColor}
                logoPath={props.logoPath}
                previewMode={props.previewMode}
                scene={scene}
                soundEnabled={props.soundEnabled}
                soundMix={props.soundMix}
              />
            </SceneBoundary>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
