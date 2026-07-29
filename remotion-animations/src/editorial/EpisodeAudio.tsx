import {Audio} from "@remotion/media";
import {Easing, Loop, Sequence, interpolate, staticFile, useVideoConfig} from "remotion";

export const EpisodeAudio: React.FC<{
  audioPath: string;
  volume: number;
}> = ({audioPath, volume}) => {
  if (!audioPath) {
    return null;
  }
  return <Audio src={staticFile(audioPath)} volume={volume} />;
};

export type BedSegment = {
  act: string;
  startSeconds: number;
  endSeconds: number;
  file: string;
  volume: number;
  fadeSeconds: number;
};

/**
 * ANM-D07 — Lecho continuo por acto.
 * El silencio total deja de ser un hueco: cada acto tiene su textura, con
 * transición en las fronteras narrativas.
 */
export const EpisodeBedTrack: React.FC<{
  segments: BedSegment[];
  masterVolume: number;
  enabled: boolean;
}> = ({segments, masterVolume, enabled}) => {
  const {fps, durationInFrames} = useVideoConfig();
  if (!enabled || !segments.length) {
    return null;
  }
  return (
    <>
      {segments.map((segment, index) => {
        const from = Math.max(0, Math.round(segment.startSeconds * fps));
        const frames = Math.max(
          1,
          Math.min(
            durationInFrames - from,
            Math.round((segment.endSeconds - segment.startSeconds) * fps),
          ),
        );
        const fadeFrames = Math.max(1, Math.round(segment.fadeSeconds * fps));
        return (
          <Sequence
            durationInFrames={frames}
            from={from}
            key={`${segment.file}-${segment.startSeconds}-${index}`}
            layout="none"
            name={`bed-${segment.act}`}
          >
            <Loop durationInFrames={Math.max(1, Math.round(6 * fps))} layout="none">
              <Audio
                src={staticFile(segment.file)}
                volume={(frame) =>
                  Math.min(1, Math.max(0, masterVolume)) *
                  segment.volume *
                  Math.min(
                    interpolate(frame, [0, fadeFrames], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: Easing.out(Easing.cubic),
                    }),
                    interpolate(
                      frame,
                      [Math.max(fadeFrames, frames - fadeFrames), frames],
                      [1, 0],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                        easing: Easing.in(Easing.cubic),
                      },
                    ),
                  )
                }
              />
            </Loop>
          </Sequence>
        );
      })}
    </>
  );
};
