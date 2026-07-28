import {Audio} from "@remotion/media";
import {staticFile} from "remotion";

export const EpisodeAudio: React.FC<{
  audioPath: string;
  volume: number;
}> = ({audioPath, volume}) => {
  if (!audioPath) {
    return null;
  }
  return <Audio src={staticFile(audioPath)} volume={volume} />;
};
