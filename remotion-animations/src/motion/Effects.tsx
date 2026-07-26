import type {CSSProperties, ReactNode} from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {clamp, motionProgress} from "./Toolkit";

export type ProgressiveTextMode = "auto" | "words" | "letters";
export type ProgressiveTextRevealStyle =
  | "auto"
  | "slice"
  | "fade-words";

export type ProgressiveTextProps = {
  text: string;
  startSeconds: number;
  endSeconds: number;
  mode?: ProgressiveTextMode;
  revealStyle?: ProgressiveTextRevealStyle;
  wordFadeSeconds?: number;
  wordOffsetY?: number;
  style?: CSSProperties;
};

const wordCount = (text: string) =>
  text.trim().split(/\s+/u).filter(Boolean).length;

export const resolveProgressiveTextMode = (
  text: string,
  mode: ProgressiveTextMode = "auto",
): Exclude<ProgressiveTextMode, "auto"> => {
  if (mode !== "auto") {
    return mode;
  }
  return wordCount(text) <= 3 ? "letters" : "words";
};

const splitTextUnits = (
  text: string,
  mode: Exclude<ProgressiveTextMode, "auto">,
) => {
  if (mode === "letters") {
    return Array.from(text);
  }
  return text.match(/\S+(?:\s+|$)/gu) ?? [];
};

export const ProgressiveText: React.FC<ProgressiveTextProps> = ({
  text,
  startSeconds,
  endSeconds,
  mode = "auto",
  revealStyle = "auto",
  wordFadeSeconds,
  wordOffsetY = 12,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const resolvedMode = resolveProgressiveTextMode(text, mode);
  const units = splitTextUnits(text, resolvedMode);
  const safeEndSeconds = Math.max(startSeconds + 1 / fps, endSeconds);
  const resolvedRevealStyle =
    revealStyle === "auto"
      ? resolvedMode === "words"
        ? "fade-words"
        : "slice"
      : revealStyle;
  const visibleCount = Math.floor(
    interpolate(
      frame,
      [startSeconds * fps, safeEndSeconds * fps],
      [0, units.length],
      clamp,
    ),
  );
  const visibleText = units.slice(0, visibleCount).join("");
  const fadeDuration = Math.min(
    0.5,
    Math.max(
      1 / fps,
      wordFadeSeconds ??
        Math.min(
          0.34,
          Math.max(
            0.16,
            (safeEndSeconds - startSeconds) / Math.max(2, units.length),
          ),
        ),
    ),
  );
  const fadeStagger =
    units.length <= 1
      ? 0
      : (safeEndSeconds - startSeconds - fadeDuration) /
        (units.length - 1);

  if (resolvedRevealStyle === "fade-words" && resolvedMode === "words") {
    return (
      <div
        aria-label={text}
        style={{
          ...style,
          display: style?.display ?? "block",
          position: style?.position ?? "relative",
          whiteSpace: style?.whiteSpace ?? "pre-wrap",
        }}
      >
        {units.map((unit, index) => {
          const unitStart = startSeconds + index * Math.max(0, fadeStagger);
          const progress = motionProgress(
            frame,
            fps,
            unitStart,
            unitStart + fadeDuration,
            Easing.bezier(0.16, 1, 0.3, 1),
          );
          return (
            <span
              aria-hidden
              key={`${unit}-${index}`}
              style={{
                display: "inline-block",
                opacity: progress,
                transform: `translateY(${interpolate(
                  progress,
                  [0, 1],
                  [wordOffsetY, 0],
                )}px)`,
                whiteSpace: "pre-wrap",
              }}
            >
              {unit}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      aria-label={text}
      style={{
        ...style,
        display: style?.display ?? "block",
        position: style?.position ?? "relative",
        whiteSpace: style?.whiteSpace ?? "pre-wrap",
      }}
    >
      <span aria-hidden style={{visibility: "hidden"}}>
        {text}
      </span>
      <span
        aria-hidden
        style={{
          inset: 0,
          position: "absolute",
          whiteSpace: "inherit",
        }}
      >
        {visibleText}
      </span>
    </div>
  );
};

export type NarrativeCameraCue = {
  atSeconds: number;
  focusX: number;
  focusY: number;
  scale: number;
  anchorX?: number;
  anchorY?: number;
};

export type NarrativeCameraProps = {
  children: ReactNode;
  cues: NarrativeCameraCue[];
  anchorX?: number;
  anchorY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  style?: CSSProperties;
};

const safeCameraCue = (
  cue: NarrativeCameraCue,
  defaultAnchorX: number,
  defaultAnchorY: number,
) => ({
  ...cue,
  atSeconds: Math.max(0, cue.atSeconds),
  focusX: clampUnit(cue.focusX),
  focusY: clampUnit(cue.focusY),
  scale: Math.min(3, Math.max(1, cue.scale)),
  anchorX: clampUnit(cue.anchorX ?? defaultAnchorX),
  anchorY: clampUnit(cue.anchorY ?? defaultAnchorY),
});

export const NarrativeCamera: React.FC<NarrativeCameraProps> = ({
  children,
  cues,
  anchorX = 0.5,
  anchorY = 0.5,
  canvasWidth,
  canvasHeight,
  style,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = canvasWidth ?? config.width;
  const height = canvasHeight ?? config.height;
  const currentSeconds = frame / config.fps;
  const safeCues = (
    cues.length > 0
      ? [...cues]
      : [
          {
            atSeconds: 0,
            focusX: 0.5,
            focusY: 0.5,
            scale: 1,
          },
        ]
  )
    .sort((left, right) => left.atSeconds - right.atSeconds)
    .map((cue) => safeCameraCue(cue, anchorX, anchorY));
  const nextIndex = safeCues.findIndex(
    (cue) => currentSeconds <= cue.atSeconds,
  );
  const toIndex = nextIndex === -1 ? safeCues.length - 1 : nextIndex;
  const fromIndex = Math.max(0, toIndex - 1);
  const fromCue = safeCues[fromIndex];
  const toCue = safeCues[toIndex];
  const progress =
    fromIndex === toIndex
      ? nextIndex === -1
        ? 1
        : 0
      : motionProgress(
          frame,
          config.fps,
          fromCue.atSeconds,
          toCue.atSeconds,
          Easing.bezier(0.45, 0, 0.55, 1),
        );
  const focusX = interpolate(
    progress,
    [0, 1],
    [fromCue.focusX, toCue.focusX],
  );
  const focusY = interpolate(
    progress,
    [0, 1],
    [fromCue.focusY, toCue.focusY],
  );
  const scale = interpolate(
    progress,
    [0, 1],
    [fromCue.scale, toCue.scale],
  );
  const resolvedAnchorX = interpolate(
    progress,
    [0, 1],
    [fromCue.anchorX, toCue.anchorX],
  );
  const resolvedAnchorY = interpolate(
    progress,
    [0, 1],
    [fromCue.anchorY, toCue.anchorY],
  );
  const translateX = resolvedAnchorX * width - focusX * width * scale;
  const translateY = resolvedAnchorY * height - focusY * height * scale;

  return (
    <div
      style={{
        height,
        left: 0,
        position: "absolute",
        top: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
        transformOrigin: "0 0",
        width,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export type TrackingZoomPoint = {
  x: number;
  y: number;
};

export type TrackingZoomProps = {
  children: ReactNode;
  points: TrackingZoomPoint[];
  startSeconds: number;
  endSeconds: number;
  startScale?: number;
  endScale?: number;
  anchorX?: number;
  anchorY?: number;
  activationSeconds?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  style?: CSSProperties;
};

const pointOnPolyline = (
  points: TrackingZoomPoint[],
  progress: number,
): TrackingZoomPoint => {
  const safePoints =
    points.length >= 2
      ? points
      : [
          points[0] ?? {x: 0.5, y: 0.5},
          points[0] ?? {x: 0.5, y: 0.5},
        ];
  const lengths = safePoints.slice(1).map((point, index) => {
    const previous = safePoints[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  const totalLength = Math.max(
    Number.EPSILON,
    lengths.reduce((sum, length) => sum + length, 0),
  );
  let remaining = clampUnit(progress) * totalLength;

  for (let index = 0; index < lengths.length; index++) {
    const segmentLength = Math.max(Number.EPSILON, lengths[index]);
    if (remaining <= segmentLength || index === lengths.length - 1) {
      const localProgress = clampUnit(remaining / segmentLength);
      return {
        x: interpolate(
          localProgress,
          [0, 1],
          [safePoints[index].x, safePoints[index + 1].x],
        ),
        y: interpolate(
          localProgress,
          [0, 1],
          [safePoints[index].y, safePoints[index + 1].y],
        ),
      };
    }
    remaining -= segmentLength;
  }

  return safePoints[safePoints.length - 1];
};

export const TrackingZoom: React.FC<TrackingZoomProps> = ({
  children,
  points,
  startSeconds,
  endSeconds,
  startScale = 1.12,
  endScale = 1.75,
  anchorX = 0.5,
  anchorY = 0.55,
  activationSeconds = 0.45,
  canvasWidth,
  canvasHeight,
  style,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = canvasWidth ?? config.width;
  const height = canvasHeight ?? config.height;
  const safeEndSeconds = Math.max(startSeconds + 1 / config.fps, endSeconds);
  const trackingProgress = motionProgress(
    frame,
    config.fps,
    startSeconds,
    safeEndSeconds,
    Easing.bezier(0.45, 0, 0.55, 1),
  );
  const activation = motionProgress(
    frame,
    config.fps,
    startSeconds,
    Math.min(
      safeEndSeconds,
      startSeconds + Math.max(1 / config.fps, activationSeconds),
    ),
  );
  const point = pointOnPolyline(points, trackingProgress);
  const targetScale = interpolate(
    trackingProgress,
    [0, 1],
    [
      Math.min(3, Math.max(1, startScale)),
      Math.min(3, Math.max(1, endScale)),
    ],
  );
  const scale = interpolate(activation, [0, 1], [1, targetScale]);
  const focusPixelX = clampUnit(point.x) * width;
  const focusPixelY = clampUnit(point.y) * height;
  const anchorPixelX = clampUnit(anchorX) * width;
  const anchorPixelY = clampUnit(anchorY) * height;
  const desiredTranslateX = anchorPixelX - focusPixelX * scale;
  const desiredTranslateY = anchorPixelY - focusPixelY * scale;
  const translateX = desiredTranslateX * activation;
  const translateY = desiredTranslateY * activation;

  return (
    <div
      style={{
        height,
        left: 0,
        position: "absolute",
        top: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
        transformOrigin: "0 0",
        width,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export type ProgressiveRevealProps = {
  children: ReactNode;
  startSeconds: number;
  endSeconds: number;
  fromY?: number;
  fromScale?: number;
  style?: CSSProperties;
};

export const ProgressiveReveal: React.FC<ProgressiveRevealProps> = ({
  children,
  startSeconds,
  endSeconds,
  fromY = 24,
  fromScale = 0.96,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const safeEndSeconds = Math.max(startSeconds + 1 / fps, endSeconds);
  const progress = motionProgress(
    frame,
    fps,
    startSeconds,
    safeEndSeconds,
    Easing.bezier(0.16, 1, 0.3, 1),
  );

  return (
    <div
      style={{
        ...style,
        opacity: progress,
        transform: `translateY(${interpolate(
          progress,
          [0, 1],
          [fromY, 0],
        )}px) scale(${interpolate(
          progress,
          [0, 1],
          [fromScale, 1],
        )})`,
      }}
    >
      {children}
    </div>
  );
};

export const useStaggeredReveal = ({
  index,
  startSeconds,
  staggerSeconds = 0.14,
  revealSeconds = 0.5,
}: {
  index: number;
  startSeconds: number;
  staggerSeconds?: number;
  revealSeconds?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const itemStart = startSeconds + Math.max(0, index) * staggerSeconds;
  return motionProgress(
    frame,
    fps,
    itemStart,
    itemStart + Math.max(1 / fps, revealSeconds),
  );
};

export type FocusZoomProps = {
  children: ReactNode;
  startSeconds: number;
  endSeconds: number;
  focusX: number;
  focusY: number;
  zoomScale?: number;
  anchorX?: number;
  anchorY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  style?: CSSProperties;
};

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

export const FocusZoom: React.FC<FocusZoomProps> = ({
  children,
  startSeconds,
  endSeconds,
  focusX,
  focusY,
  zoomScale = 1.65,
  anchorX = 0.5,
  anchorY = 0.5,
  canvasWidth,
  canvasHeight,
  style,
}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const width = canvasWidth ?? config.width;
  const height = canvasHeight ?? config.height;
  const safeEndSeconds = Math.max(startSeconds + 1 / config.fps, endSeconds);
  const progress = motionProgress(
    frame,
    config.fps,
    startSeconds,
    safeEndSeconds,
    Easing.bezier(0.16, 1, 0.3, 1),
  );
  const scale = interpolate(
    progress,
    [0, 1],
    [1, Math.min(3, Math.max(1, zoomScale))],
  );
  const focusPixelX = clampUnit(focusX) * width;
  const focusPixelY = clampUnit(focusY) * height;
  const anchorPixelX = clampUnit(anchorX) * width;
  const anchorPixelY = clampUnit(anchorY) * height;
  const targetPixelX = interpolate(
    progress,
    [0, 1],
    [focusPixelX, anchorPixelX],
  );
  const targetPixelY = interpolate(
    progress,
    [0, 1],
    [focusPixelY, anchorPixelY],
  );
  const translateX = targetPixelX - focusPixelX * scale;
  const translateY = targetPixelY - focusPixelY * scale;

  return (
    <div
      style={{
        height,
        left: 0,
        position: "absolute",
        top: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
        transformOrigin: "0 0",
        width,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
