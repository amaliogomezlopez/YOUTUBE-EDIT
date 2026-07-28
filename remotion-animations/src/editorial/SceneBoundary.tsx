import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export const SceneBoundary: React.FC<{
  children: React.ReactNode;
}> = ({children}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const transitionFrames = Math.max(6, Math.round(fps * 0.28));
  const enter = interpolate(
    frame,
    [0, transitionFrames],
    [0, 1],
    {...clamp, easing: Easing.out(Easing.cubic)},
  );
  const exit = interpolate(
    frame,
    [Math.max(0, durationInFrames - transitionFrames), durationInFrames - 1],
    [1, 0],
    {...clamp, easing: Easing.in(Easing.cubic)},
  );
  const opacity = Math.min(enter, exit);
  const translate = interpolate(enter, [0, 1], [18, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${translate}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
