import {Audio} from "@remotion/media";
import {
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useVideoConfig,
} from "remotion";
import {AhorrarLimitesV2Props} from "../AhorrarLimitesV2";
import {clamp} from "./Toolkit";

export type SoundCue = {
  file: string;
  startSeconds: number;
  durationSeconds: number;
  volume: number;
  attackSeconds?: number;
  releaseSeconds?: number;
  /** ANM-D06 — Jitter tímbrico determinista decidido por el director. */
  playbackRate?: number;
};

/** ANM-D09 — Ventana en la que la locución domina y los efectos ceden. */
export type DuckWindow = {
  startSeconds: number;
  endSeconds: number;
  gainDb?: number;
};

export const SOUND_FILES = {
  dataLoading: "sfx/library-data-loading.wav",
  digitalCount: "sfx/library-digital-count.wav",
  keyboard: "sfx/library-keyboard.wav",
  pop: "sfx/library-pop.wav",
  processing: "sfx/library-processing.wav",
  quickWhip: "sfx/library-quick-whip.wav",
  smoothWhoosh: "sfx/library-smooth-whoosh.wav",
  dataTick: "sfx/amaliometria-data-tick.wav",
  riseWhoosh: "sfx/amaliometria-rise-whoosh.wav",
  softImpact: "sfx/amaliometria-soft-impact.wav",
  successChime: "sfx/amaliometria-success-chime.wav",
  uiPulse: "sfx/amaliometria-ui-pulse.wav",
  logoShimmer: "sfx/amaliometria-logo-shimmer.wav",
  tensionSwell: "sfx/amaliometria-tension-swell.wav",
  needleStrike: "sfx/amaliometria-needle-strike.wav",
  bubbleBurst: "sfx/amaliometria-bubble-burst.wav",
  rewindSweep: "sfx/amaliometria-rewind-sweep.wav",
  // ANM-D03 — `alert-sting` deja de compartir fichero con `soft-impact`.
  alertSting: "sfx/amaliometria-impact-05.wav",
} as const;

const soundCuesByScene: Record<
  AhorrarLimitesV2Props["scene"],
  SoundCue[]
> = {
  "input-share": [
    cue(SOUND_FILES.riseWhoosh, 0.05, 0.78, 0.82),
    cue(SOUND_FILES.dataLoading, 0.35, 2.4, 0.1, 0.08, 0.25),
    cue(SOUND_FILES.digitalCount, 2.15, 0.51, 0.16),
    cue(SOUND_FILES.softImpact, 5.05, 0.58, 0.9),
    cue(SOUND_FILES.successChime, 5.16, 0.52, 0.68),
  ],
  "harness-workshop": [
    cue(SOUND_FILES.riseWhoosh, 0.05, 0.78, 0.72),
    ...[1.0, 1.72, 2.44, 3.16, 3.88].map((start) =>
      cue(SOUND_FILES.uiPulse, start, 0.22, 0.68),
    ),
    cue(SOUND_FILES.softImpact, 5.05, 0.58, 0.72),
    cue(SOUND_FILES.successChime, 5.18, 0.52, 0.62),
  ],
  "harness-compare": [
    cue(SOUND_FILES.riseWhoosh, 0.05, 0.78, 0.7),
    cue(SOUND_FILES.quickWhip, 0.72, 0.12, 0.16),
    cue(SOUND_FILES.quickWhip, 1.02, 0.12, 0.14),
    cue(SOUND_FILES.uiPulse, 2.12, 0.22, 0.56),
    cue(SOUND_FILES.uiPulse, 2.42, 0.22, 0.56),
    cue(SOUND_FILES.softImpact, 4.35, 0.58, 0.75),
  ],
  "context-snowball": [
    cue(SOUND_FILES.smoothWhoosh, 0.05, 1.77, 0.1, 0.06, 0.3),
    cue(SOUND_FILES.softImpact, 1.22, 0.58, 0.48),
    cue(SOUND_FILES.softImpact, 2.22, 0.58, 0.58),
    cue(SOUND_FILES.softImpact, 3.22, 0.58, 0.68),
    cue(SOUND_FILES.softImpact, 4.42, 0.58, 0.92),
  ],
  "batch-prompts": [
    cue(SOUND_FILES.riseWhoosh, 0.08, 0.78, 0.72),
    cue(SOUND_FILES.pop, 1.72, 0.58, 0.1),
    ...[2.18, 2.62, 3.06, 3.5].map((start) =>
      cue(SOUND_FILES.uiPulse, start, 0.22, 0.62),
    ),
    cue(SOUND_FILES.successChime, 4.58, 0.52, 0.62),
  ],
  "skills-range": [
    cue(SOUND_FILES.riseWhoosh, 0.05, 0.78, 0.65),
    cue(SOUND_FILES.digitalCount, 0.82, 0.51, 0.28),
    cue(SOUND_FILES.digitalCount, 2.18, 0.51, 0.26),
    cue(SOUND_FILES.successChime, 3.42, 0.52, 1),
    cue(SOUND_FILES.processing, 4.72, 1.2, 0.12, 0.04, 0.22),
    cue(SOUND_FILES.quickWhip, 6.02, 0.12, 0.2),
  ],
  "fresh-chat": [
    cue(SOUND_FILES.keyboard, 0.12, 1.55, 0.1, 0.04, 0.2),
    cue(SOUND_FILES.pop, 2.22, 0.62, 0.16),
    cue(SOUND_FILES.riseWhoosh, 4.42, 0.78, 1),
    cue(SOUND_FILES.softImpact, 5.92, 0.58, 1),
    cue(SOUND_FILES.successChime, 6.72, 0.52, 1),
  ],
  subagents: [
    cue(SOUND_FILES.softImpact, 0.12, 0.58, 0.72),
    cue(SOUND_FILES.riseWhoosh, 1.72, 0.78, 0.72),
    ...[2.28, 2.54, 2.8].map((start) =>
      cue(SOUND_FILES.uiPulse, start, 0.22, 0.62),
    ),
    ...[4.1, 4.36, 4.62].map((start) =>
      cue(SOUND_FILES.quickWhip, start, 0.12, 0.13),
    ),
    cue(SOUND_FILES.successChime, 5.58, 0.52, 0.7),
    cue(SOUND_FILES.softImpact, 5.92, 0.58, 0.62),
  ],
};

function cue(
  file: string,
  startSeconds: number,
  durationSeconds: number,
  volume: number,
  attackSeconds = 0.015,
  releaseSeconds = 0.12,
): SoundCue {
  return {
    file,
    startSeconds,
    durationSeconds,
    volume,
    attackSeconds,
    releaseSeconds,
  };
}

/**
 * ANM-D09 — Atenuación de la capa de efectos mientras hay locución.
 * `offsetSeconds` traslada la ventana absoluta del episodio al tiempo local de
 * la escena, para que una `Sequence` anidada siga midiendo bien.
 *
 * Exportada porque la cama musical de los shorts se atenúa con la misma
 * mecánica de rampas (ataque 60 ms, salida 180 ms).
 */
export const duckGainAt = (
  seconds: number,
  windows: DuckWindow[],
  attackSeconds: number,
  releaseSeconds: number,
): number => {
  for (const window of windows) {
    if (seconds < window.startSeconds - attackSeconds) continue;
    if (seconds > window.endSeconds + releaseSeconds) continue;
    const depth = 10 ** ((window.gainDb ?? -5) / 20);
    if (seconds < window.startSeconds) {
      const progress = (seconds - (window.startSeconds - attackSeconds)) / attackSeconds;
      return 1 - (1 - depth) * Math.min(1, Math.max(0, progress));
    }
    if (seconds > window.endSeconds) {
      const progress = (seconds - window.endSeconds) / releaseSeconds;
      return depth + (1 - depth) * Math.min(1, Math.max(0, progress));
    }
    return depth;
  }
  return 1;
};

const CueAudio: React.FC<{
  cue: SoundCue;
  masterVolume: number;
  duckWindows?: DuckWindow[];
  duckOffsetSeconds?: number;
}> = ({cue: soundCue, masterVolume, duckWindows = [], duckOffsetSeconds = 0}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const from = Math.max(0, Math.round(soundCue.startSeconds * fps));
  const availableFrames = Math.max(1, durationInFrames - from);
  const cueFrames = Math.max(
    1,
    Math.min(
      availableFrames,
      Math.round(soundCue.durationSeconds * fps),
    ),
  );
  const attackFrames = Math.max(
    1,
    Math.round((soundCue.attackSeconds ?? 0.015) * fps),
  );
  const releaseFrames = Math.max(
    1,
    Math.round((soundCue.releaseSeconds ?? 0.12) * fps),
  );
  // A cue that reaches the end of a very short scene can be truncated to one
  // or two frames. Keep the release range strictly increasing in that case;
  // Remotion rejects an interpolation such as [1, 1].
  const releaseStart = cueFrames <= 1
    ? 0
    : Math.min(Math.max(0, cueFrames - 2), Math.max(0, cueFrames - releaseFrames));

  return (
    <Sequence
      durationInFrames={cueFrames}
      from={from}
      layout="none"
    >
      <Audio
        playbackRate={soundCue.playbackRate ?? 1}
        src={staticFile(soundCue.file)}
        volume={(audioFrame) => {
          const attack = interpolate(
            audioFrame,
            [0, attackFrames],
            [0, 1],
            {
              ...clamp,
              easing: Easing.out(Easing.cubic),
            },
          );
          const release = cueFrames <= 1
            ? 1
            : interpolate(
                audioFrame,
                [releaseStart, cueFrames - 1],
                [1, 0],
                {
                  ...clamp,
                  easing: Easing.in(Easing.cubic),
                },
              );
          const absoluteSeconds =
            duckOffsetSeconds + soundCue.startSeconds + audioFrame / fps;
          const duck = duckWindows.length
            ? duckGainAt(absoluteSeconds, duckWindows, 0.06, 0.18)
            : 1;
          return (
            Math.min(1, Math.max(0, masterVolume)) *
            soundCue.volume *
            duck *
            Math.min(attack, release)
          );
        }}
      />
    </Sequence>
  );
};

export const Soundtrack: React.FC<{
  cues: SoundCue[];
  masterVolume?: number;
  enabled?: boolean;
  duckWindows?: DuckWindow[];
  duckOffsetSeconds?: number;
}> = ({
  cues,
  masterVolume = 0.65,
  enabled = true,
  duckWindows,
  duckOffsetSeconds,
}) => {
  if (!enabled) {
    return null;
  }

  return (
    <>
      {cues.map((soundCue, index) => (
        <CueAudio
          cue={soundCue}
          duckOffsetSeconds={duckOffsetSeconds}
          duckWindows={duckWindows}
          key={`${soundCue.file}-${soundCue.startSeconds}-${index}`}
          masterVolume={masterVolume}
        />
      ))}
    </>
  );
};

export const AhorrarLimitesSoundDesign: React.FC<{
  scene: AhorrarLimitesV2Props["scene"];
  masterVolume?: number;
  enabled?: boolean;
}> = ({scene, masterVolume, enabled}) => (
  <Soundtrack
    cues={soundCuesByScene[scene]}
    enabled={enabled}
    masterVolume={masterVolume}
  />
);
