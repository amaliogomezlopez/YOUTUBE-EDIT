import {fitText} from "@remotion/layout-utils";
import {zColor} from "@remotion/zod-types";
import React, {useId} from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {z} from "zod";
import {
  CHALK_FONT_FAMILY,
  DATA_FONT_FAMILY,
  FINANCE_FONT_FAMILY,
  MOTION_FONT_FAMILY,
} from "./fonts";
import {
  MOTION_FORMATS,
  getMotionProfile,
  getMotionTheme,
  getResponsiveLayout,
  isBoardTheme,
  motionFormatSchema,
  motionProfileSchema,
  motionThemeSchema,
} from "./DesignSystem";
import {ChalkBoard} from "./ChalkBoard";
import {SOUND_FILES, SoundCue, Soundtrack} from "./SoundDesign";
import {clamp, motionProgress, rgba} from "./Toolkit";

export const extendedPatternIdSchema = z.enum([
  "screenshot-spotlight",
  "before-after-wipe",
  "common-baseline",
  "timeline-milestones",
  "ranking",
  "accumulation",
  "funnel-filter",
  "branch-merge",
  "photo-parallax",
]);

const patternItemSchema = z.object({
  label: z.string(),
  value: z.number().optional(),
  detail: z.string().optional(),
});

export const extendedPatternSchema = z.object({
  pattern: extendedPatternIdSchema,
  format: motionFormatSchema,
  themeId: motionThemeSchema,
  motionProfile: motionProfileSchema,
  title: z.string(),
  supportingText: z.string().optional(),
  showHeader: z.boolean(),
  primaryLabel: z.string(),
  secondaryLabel: z.string(),
  callout: z.string(),
  items: z.array(patternItemSchema).min(2).max(8),
  imagePath: z.string(),
  beforeImagePath: z.string().optional(),
  afterImagePath: z.string().optional(),
  focalPoint: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
  }),
  accentColor: zColor().optional(),
  soundEnabled: z.boolean(),
  soundMix: z.number().min(0).max(1),
});

export type ExtendedPatternProps = z.infer<typeof extendedPatternSchema>;

export const defaultExtendedPatternProps = {
  pattern: "screenshot-spotlight",
  format: "landscape",
  themeId: "ink-lime",
  motionProfile: "editorial",
  title: "La evidencia ya está en la imagen",
  supportingText: "La animación dirige la mirada sin volver a dibujar la fuente.",
  showHeader: true,
  primaryLabel: "ANTES",
  secondaryLabel: "DESPUÉS",
  callout: "TRAMO CLAVE",
  items: [
    {label: "ENERO", value: 42},
    {label: "MARZO", value: 61},
    {label: "JUNIO", value: 78},
    {label: "DICIEMBRE", value: 93},
  ],
  imagePath: "assets/library/chart-samples/demo-index-2025.png",
  focalPoint: {x: 58, y: 49},
  accentColor: undefined,
  soundEnabled: false,
  soundMix: 0.62,
} satisfies ExtendedPatternProps;

const patternCues: Record<ExtendedPatternProps["pattern"], SoundCue[]> = {
  "screenshot-spotlight": [
    {
      file: SOUND_FILES.riseWhoosh,
      startSeconds: 0.2,
      durationSeconds: 0.78,
      volume: 0.68,
    },
    {
      file: SOUND_FILES.uiPulse,
      startSeconds: 3.2,
      durationSeconds: 0.22,
      volume: 0.62,
    },
  ],
  "before-after-wipe": [
    {
      file: SOUND_FILES.smoothWhoosh,
      startSeconds: 1,
      durationSeconds: 1.77,
      volume: 0.28,
    },
    {
      file: SOUND_FILES.softImpact,
      startSeconds: 4.3,
      durationSeconds: 0.58,
      volume: 0.72,
    },
  ],
  "common-baseline": [
    {
      file: SOUND_FILES.riseWhoosh,
      startSeconds: 0.35,
      durationSeconds: 0.78,
      volume: 0.54,
    },
    {
      file: SOUND_FILES.softImpact,
      startSeconds: 4.4,
      durationSeconds: 0.58,
      volume: 0.7,
    },
  ],
  "timeline-milestones": [
    {
      file: SOUND_FILES.riseWhoosh,
      startSeconds: 0.4,
      durationSeconds: 0.78,
      volume: 0.5,
    },
    ...[1.8, 2.6, 3.4, 4.2].map((startSeconds) => ({
      file: SOUND_FILES.dataTick,
      startSeconds,
      durationSeconds: 0.18,
      volume: 0.42,
    })),
  ],
  ranking: [
    {
      file: SOUND_FILES.dataLoading,
      startSeconds: 0.4,
      durationSeconds: 2.4,
      volume: 0.09,
    },
    {
      file: SOUND_FILES.successChime,
      startSeconds: 4.7,
      durationSeconds: 0.52,
      volume: 0.58,
    },
  ],
  accumulation: [
    ...[1, 1.45, 1.9, 2.35, 2.8].map((startSeconds) => ({
      file: SOUND_FILES.pop,
      startSeconds,
      durationSeconds: 0.58,
      volume: 0.11,
    })),
    {
      file: SOUND_FILES.softImpact,
      startSeconds: 4.5,
      durationSeconds: 0.58,
      volume: 0.62,
    },
  ],
  "funnel-filter": [
    {
      file: SOUND_FILES.processing,
      startSeconds: 1.1,
      durationSeconds: 1.2,
      volume: 0.14,
    },
    {
      file: SOUND_FILES.successChime,
      startSeconds: 4.2,
      durationSeconds: 0.52,
      volume: 0.58,
    },
  ],
  "branch-merge": [
    {
      file: SOUND_FILES.riseWhoosh,
      startSeconds: 0.45,
      durationSeconds: 0.78,
      volume: 0.48,
    },
    {
      file: SOUND_FILES.softImpact,
      startSeconds: 4.1,
      durationSeconds: 0.58,
      volume: 0.68,
    },
  ],
  "photo-parallax": [
    {
      file: SOUND_FILES.smoothWhoosh,
      startSeconds: 0.2,
      durationSeconds: 1.77,
      volume: 0.2,
    },
    {
      file: SOUND_FILES.uiPulse,
      startSeconds: 4.2,
      durationSeconds: 0.22,
      volume: 0.48,
    },
  ],
};

const resolveMediaSource = (source: string) =>
  /^(?:https?:)?\/\//i.test(source) || source.startsWith("/")
    ? source
    : staticFile(source);

const usePatternMotion = (profileId: ExtendedPatternProps["motionProfile"]) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const profile = getMotionProfile(profileId);
  return {
    profile,
    intro: motionProgress(
      frame,
      fps,
      0.08,
      Math.max(0.42, 0.68 / profile.tempo),
      Easing.bezier(0.16, 1, 0.3, 1),
    ),
    resolve: motionProgress(
      frame,
      fps,
      Math.max(2.4, 3.1 / profile.tempo),
      Math.max(3.7, 4.45 / profile.tempo),
      Easing.bezier(0.16, 1, 0.3, 1),
    ),
  };
};

const PatternFrame: React.FC<
  Pick<
    ExtendedPatternProps,
    | "title"
    | "supportingText"
    | "showHeader"
    | "themeId"
    | "motionProfile"
    | "accentColor"
  > & {children: React.ReactNode}
> = ({
  title,
  supportingText,
  showHeader,
  themeId,
  motionProfile,
  accentColor,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames, width, height} = useVideoConfig();
  const theme = getMotionTheme(themeId);
  const layout = getResponsiveLayout(width, height);
  const profile = getMotionProfile(motionProfile);
  const accent = accentColor ?? theme.accent;
  const board = isBoardTheme(themeId);
  const displayFont = board ? FINANCE_FONT_FAMILY : MOTION_FONT_FAMILY;
  const intro = motionProgress(frame, fps, 0, 0.52 / profile.tempo);
  const outro = interpolate(
    frame,
    [durationInFrames - fps * 0.45, durationInFrames - 1],
    [1, 0],
    clamp,
  );
  const hasHeader = showHeader && Boolean(title || supportingText);
  const maxTitleWidth = width - layout.safeX * 2;
  const fittedTitleSize = title
    ? Math.max(
        layout.portrait ? 42 : 34,
        Math.min(
          layout.headlineSize,
          fitText({
            text: title,
            withinWidth: maxTitleWidth,
            fontFamily: displayFont,
            fontWeight: board ? "600" : "820",
          }).fontSize,
        ),
      )
    : layout.headlineSize;

  return (
    <AbsoluteFill
      style={{
        background: board
          ? theme.background
          : `radial-gradient(circle at 52% 52%, ${rgba(accent, 0.07)}, transparent 46%), ${theme.background}`,
        color: theme.ink,
        fontFamily: displayFont,
        opacity: outro,
        overflow: "hidden",
      }}
    >
      {board ? <ChalkBoard accentColor={accent} /> : (
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${rgba(theme.grid, 0.17)} 1px, transparent 1px), linear-gradient(90deg, ${rgba(theme.grid, 0.17)} 1px, transparent 1px)`,
          backgroundSize: `${Math.round(width * 0.045)}px ${Math.round(width * 0.045)}px`,
          maskImage:
            "linear-gradient(to bottom, rgba(0,0,0,.6), transparent 86%)",
          opacity: themeId === "signal-cobalt" ? 0.46 : 0.25,
        }}
      />
      )}
      {hasHeader ? (
        <header
          style={{
            left: layout.safeX,
            opacity: intro,
            position: "absolute",
            right: layout.safeX,
            textAlign: "center",
            top: layout.safeY,
            transform: `translateY(${interpolate(intro, [0, 1], [-profile.travel, 0])}px)`,
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontSize: fittedTitleSize,
              fontFamily: displayFont,
              fontWeight: board ? 600 : 820,
              fontOpticalSizing: "auto",
              letterSpacing: board ? 0.2 : -Math.max(1, fittedTitleSize * 0.025),
              lineHeight: 0.98,
            }}
          >
            {title}
          </div>
          {supportingText ? (
            <div
              style={{
                color: theme.muted,
                fontFamily: board ? CHALK_FONT_FAMILY : MOTION_FONT_FAMILY,
                fontSize: board ? layout.bodySize + 6 : layout.bodySize,
                fontWeight: board ? 500 : 540,
                lineHeight: 1.25,
                margin: `${Math.round(layout.gap * 0.45)}px auto 0`,
                maxWidth: Math.min(maxTitleWidth, layout.portrait ? 820 : 1180),
              }}
            >
              {supportingText}
            </div>
          ) : null}
        </header>
      ) : null}
      <div
        style={{
          bottom: layout.safeY,
          left: layout.safeX,
          position: "absolute",
          right: layout.safeX,
          top: hasHeader ? layout.contentTop : layout.safeY,
        }}
      >
        {children}
      </div>
      {board ? (
        <div
          style={{
            background: accent,
            bottom: layout.safeY * 0.48,
            height: 2,
            left: "50%",
            opacity: intro * 0.7,
            position: "absolute",
            transform: "translateX(-50%) rotate(-0.4deg)",
            width: Math.min(124, width * 0.11),
          }}
        />
      ) : (
        <div
          style={{
            background: accent,
            bottom: layout.safeY * 0.42,
            height: 3,
            left: "50%",
            opacity: intro * 0.8,
            position: "absolute",
            transform: "translateX(-50%)",
            width: Math.min(90, width * 0.09),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const ScreenshotSpotlight: React.FC<ExtendedPatternProps> = (props) => {
  const {width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const focusWidth = portrait ? 46 : 31;
  const focusHeight = portrait ? 24 : 34;
  const focusLeft = Math.min(92 - focusWidth, Math.max(2, props.focalPoint.x - focusWidth / 2));
  const focusTop = Math.min(92 - focusHeight, Math.max(2, props.focalPoint.y - focusHeight / 2));
  return (
    <div
      style={{
        height: "100%",
        opacity: intro,
        position: "relative",
        transform: `translateY(${(1 - intro) * profile.travel}px)`,
      }}
    >
      <Img
        src={resolveMediaSource(props.imagePath)}
        style={{
          height: "100%",
          objectFit: "contain",
          opacity: 0.72 + resolve * 0.18,
          width: "100%",
        }}
      />
      <div
        style={{
          backdropFilter: `blur(${resolve * 1.6}px)`,
          background: rgba(theme.background, 0.12 + resolve * 0.56),
          clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${focusLeft}% ${focusTop}%,${focusLeft}% ${focusTop + focusHeight}%,${focusLeft + focusWidth}% ${focusTop + focusHeight}%,${focusLeft + focusWidth}% ${focusTop}%,${focusLeft}% ${focusTop}%)`,
          inset: 0,
          position: "absolute",
        }}
      />
      <div
        style={{
          border: `${Math.max(3, width * 0.0025)}px solid ${accent}`,
          height: `${focusHeight}%`,
          left: `${focusLeft}%`,
          opacity: resolve,
          position: "absolute",
          top: `${focusTop}%`,
          width: `${focusWidth}%`,
        }}
      />
      <div
        style={{
          background: accent,
          color: theme.background,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: portrait ? 22 : 18,
          fontWeight: 850,
          left: `${focusLeft}%`,
          letterSpacing: 1,
          opacity: resolve,
          padding: "10px 14px",
          position: "absolute",
          top: `${Math.max(1, focusTop - 7)}%`,
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const BeforeAfterWipe: React.FC<ExtendedPatternProps> = (props) => {
  const {width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const split = interpolate(resolve, [0, 1], [18, 72]);
  const before = props.beforeImagePath ?? props.imagePath;
  const after = props.afterImagePath ?? props.imagePath;
  const imageStyle: React.CSSProperties = {
    height: "100%",
    objectFit: "cover",
    position: "absolute",
    width: "100%",
  };
  return (
    <div
      style={{
        background: theme.surface,
        height: "100%",
        opacity: intro,
        overflow: "hidden",
        position: "relative",
        transform: `scale(${interpolate(intro, [0, 1], [0.985, 1])})`,
      }}
    >
      <Img
        src={resolveMediaSource(before)}
        style={{...imageStyle, filter: "grayscale(1) contrast(.82) brightness(.62)"}}
      />
      <div
        style={{
          clipPath: `inset(0 ${100 - split}% 0 0)`,
          inset: 0,
          position: "absolute",
        }}
      >
        <Img
          src={resolveMediaSource(after)}
          style={{...imageStyle, filter: "saturate(1.08) contrast(1.05)"}}
        />
      </div>
      <div
        style={{
          background: accent,
          bottom: 0,
          left: `${split}%`,
          position: "absolute",
          top: 0,
          transform: "translateX(-50%)",
          width: Math.max(4, width * 0.004),
        }}
      />
      {[
        {label: props.primaryLabel, left: 4},
        {label: props.secondaryLabel, right: 4},
      ].map((labelProps) => (
        <div
          key={labelProps.label}
          style={{
            background: rgba(theme.background, 0.88),
            color: theme.ink,
            fontFamily: DATA_FONT_FAMILY,
            fontSize: height > width ? 22 : 18,
            fontWeight: 850,
            letterSpacing: 1.2,
            padding: "10px 14px",
            position: "absolute",
            top: 18,
            ...("left" in labelProps
              ? {left: `${labelProps.left}%`}
              : {right: `${labelProps.right}%`}),
          }}
        >
          {labelProps.label}
        </div>
      ))}
      <div
        style={{
          background: accent,
          bottom: 22,
          color: theme.background,
          fontSize: height > width ? 24 : 20,
          fontWeight: 820,
          left: "50%",
          opacity: resolve,
          padding: "12px 18px",
          position: "absolute",
          transform: `translate(-50%, ${(1 - resolve) * profile.travel}px)`,
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const CommonBaseline: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const values = props.items.slice(0, portrait ? 4 : 6);
  const max = Math.max(...values.map((item) => item.value ?? 1), 1);
  return (
    <div
      style={{
        alignItems: "end",
        display: "grid",
        gap: portrait ? 18 : 30,
        gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
        height: "100%",
        opacity: intro,
        position: "relative",
      }}
    >
      <div
        style={{
          background: theme.muted,
          bottom: portrait ? 96 : 70,
          height: 2,
          left: 0,
          opacity: 0.55,
          position: "absolute",
          right: 0,
        }}
      />
      {values.map((item, index) => {
        const itemProgress = motionProgress(
          frame,
          fps,
          0.4 + index * profile.staggerSeconds,
          2.2 / profile.tempo + index * profile.staggerSeconds,
        );
        const value = item.value ?? index + 1;
        const barHeight = 16 + (value / max) * (portrait ? 55 : 65);
        return (
          <div
            key={`${item.label}-${index}`}
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              height: "100%",
              justifyContent: "flex-end",
              minWidth: 0,
              paddingBottom: portrait ? 98 : 72,
            }}
          >
            <div
              style={{
                color: index === values.length - 1 ? accent : theme.ink,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: portrait ? 34 : 42,
                fontWeight: 900,
                marginBottom: 10,
              }}
            >
              {Math.round(value * itemProgress)}
            </div>
            <div
              style={{
                background:
                  index === values.length - 1
                    ? accent
                    : rgba(theme.muted, 0.56),
                height: `${barHeight * itemProgress}%`,
                minHeight: 4,
                width: portrait ? "68%" : "58%",
              }}
            />
            <div
              style={{
                color: theme.muted,
                fontSize: portrait ? 18 : 21,
                fontWeight: 720,
                lineHeight: 1.05,
                marginTop: 18,
                overflow: "hidden",
                textAlign: "center",
                textOverflow: "ellipsis",
                width: "100%",
              }}
            >
              {item.label}
            </div>
          </div>
        );
      })}
      <div
        style={{
          background: accent,
          bottom: 0,
          color: theme.background,
          fontWeight: 820,
          left: "50%",
          opacity: resolve,
          padding: "10px 16px",
          position: "absolute",
          transform: `translate(-50%, ${(1 - resolve) * profile.travel}px)`,
          whiteSpace: "nowrap",
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const TimelineMilestones: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const items = props.items.slice(0, 6);
  const lineProgress = motionProgress(frame, fps, 0.35, 3.4 / profile.tempo);
  return (
    <svg
      height="100%"
      style={{opacity: intro, overflow: "visible"}}
      viewBox={`0 0 ${width - getResponsiveLayout(width, height).safeX * 2} ${height * (portrait ? 0.62 : 0.66)}`}
      width="100%"
    >
      {portrait ? (
        <line
          pathLength={1}
          stroke={accent}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
          strokeWidth={5}
          x1="74"
          x2="74"
          y1="36"
          y2={height * 0.55}
        />
      ) : (
        <line
          pathLength={1}
          stroke={accent}
          strokeDasharray={1}
          strokeDashoffset={1 - lineProgress}
          strokeWidth={5}
          x1="54"
          x2={width - 170}
          y1={height * 0.31}
          y2={height * 0.31}
        />
      )}
      {items.map((item, index) => {
        const itemProgress = motionProgress(
          frame,
          fps,
          0.72 + index * profile.staggerSeconds * 1.4,
          1.25 + index * profile.staggerSeconds * 1.4,
        );
        const x = portrait
          ? 74
          : 54 + (index / Math.max(1, items.length - 1)) * (width - 224);
        const y = portrait
          ? 38 + (index / Math.max(1, items.length - 1)) * (height * 0.5)
          : height * 0.31;
        return (
          <g
            key={`${item.label}-${index}`}
            opacity={itemProgress}
            transform={`translate(${x} ${y})`}
          >
            <circle fill={theme.background} r={18} stroke={accent} strokeWidth={5} />
            <circle fill={accent} r={7} />
            <text
              fill={theme.ink}
              fontFamily={MOTION_FONT_FAMILY}
              fontSize={portrait ? 25 : 22}
              fontWeight={820}
              textAnchor={portrait ? "start" : "middle"}
              x={portrait ? 42 : 0}
              y={portrait ? -3 : index % 2 ? 70 : -54}
            >
              {item.label}
            </text>
            {item.detail ? (
              <text
                fill={theme.muted}
                fontFamily={MOTION_FONT_FAMILY}
                fontSize={portrait ? 18 : 17}
                textAnchor={portrait ? "start" : "middle"}
                x={portrait ? 42 : 0}
                y={portrait ? 25 : index % 2 ? 98 : -28}
              >
                {item.detail}
              </text>
            ) : null}
          </g>
        );
      })}
      <text
        fill={accent}
        fontFamily={DATA_FONT_FAMILY}
        fontSize={portrait ? 24 : 21}
        fontWeight={850}
        opacity={resolve}
        textAnchor="end"
        x={portrait ? width - 190 : width - 170}
        y={portrait ? height * 0.59 : height * 0.62}
      >
        {props.callout}
      </text>
    </svg>
  );
};

const Ranking: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const items = [...props.items]
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, height > 1400 ? 7 : 6);
  const max = Math.max(...items.map((item) => item.value ?? 1), 1);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: height > 1400 ? 24 : 16,
        height: "100%",
        justifyContent: "center",
        opacity: intro,
      }}
    >
      {items.map((item, index) => {
        const progress = motionProgress(
          frame,
          fps,
          0.35 + index * profile.staggerSeconds,
          1.35 + index * profile.staggerSeconds,
        );
        const value = item.value ?? 0;
        return (
          <div
            key={`${item.label}-${index}`}
            style={{
              alignItems: "center",
              display: "grid",
              gap: 18,
              gridTemplateColumns: height > 1400 ? "56px 180px 1fr 80px" : "48px 220px 1fr 92px",
              opacity: progress,
              transform: `translateX(${(1 - progress) * -profile.travel}px)`,
            }}
          >
            <div
              style={{
                color: index === 0 ? accent : theme.muted,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: height > 1400 ? 26 : 24,
                fontWeight: 900,
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
            <div
              style={{
                color: theme.ink,
                fontSize: height > 1400 ? 26 : 24,
                fontWeight: 760,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </div>
            <div style={{background: rgba(theme.grid, 0.42), height: 18}}>
              <div
                style={{
                  background: index === 0 ? accent : rgba(theme.muted, 0.68),
                  height: "100%",
                  width: `${(value / max) * progress * 100}%`,
                }}
              />
            </div>
            <div
              style={{
                color: index === 0 ? accent : theme.ink,
                fontFamily: DATA_FONT_FAMILY,
                fontSize: height > 1400 ? 28 : 26,
                fontWeight: 900,
                textAlign: "right",
              }}
            >
              {Math.round(value * progress)}
            </div>
          </div>
        );
      })}
      <div
        style={{
          color: accent,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: 19,
          fontWeight: 850,
          letterSpacing: 1,
          marginTop: 12,
          opacity: resolve,
          textAlign: "right",
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const Accumulation: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const count = Math.min(18, Math.max(6, Math.round(props.items.reduce((sum, item) => sum + (item.value ?? 1), 0) / 10)));
  const dots = Array.from({length: count}, (_, index) => index);
  return (
    <div style={{height: "100%", opacity: intro, position: "relative"}}>
      <div
        style={{
          background: props.imagePath
            ? rgba(theme.background, 0.38)
            : undefined,
          border: `3px solid ${rgba(theme.muted, 0.48)}`,
          bottom: portrait ? "12%" : "8%",
          height: portrait ? "64%" : "70%",
          left: "50%",
          position: "absolute",
          transform: "translateX(-50%)",
          width: portrait ? "72%" : "54%",
        }}
      >
        {props.imagePath ? (
          <>
            <Img
              src={staticFile(props.imagePath)}
              style={{
                height: "100%",
                objectFit: "cover",
                opacity: 0.56,
                position: "absolute",
                width: "100%",
              }}
            />
            <AbsoluteFill
              style={{
                background: `linear-gradient(180deg, ${rgba(
                  theme.background,
                  0.08,
                )}, ${rgba(theme.background, 0.82)})`,
              }}
            />
          </>
        ) : null}
        {dots.map((dot) => {
          const column = dot % (portrait ? 4 : 6);
          const row = Math.floor(dot / (portrait ? 4 : 6));
          const progress = motionProgress(
            frame,
            fps,
            0.45 + dot * profile.staggerSeconds * 0.42,
            1.1 + dot * profile.staggerSeconds * 0.42,
          );
          const left = portrait ? 10 + column * 22 : 7 + column * 17;
          const bottom = 7 + row * (portrait ? 15 : 22);
          return (
            <div
              key={dot}
              style={{
                background: dot === dots.length - 1 ? accent : rgba(theme.muted, 0.78),
                borderRadius: "50%",
                bottom: `${bottom}%`,
                height: portrait ? 58 : 64,
                left: `${left}%`,
                opacity: progress,
                position: "absolute",
                transform: `translateY(${(1 - progress) * -profile.travel * 2}px) scale(${0.72 + progress * 0.28})`,
                width: portrait ? 58 : 64,
              }}
            />
          );
        })}
        <div
          style={{
            background: accent,
            bottom: 0,
            height: `${Math.max(2, resolve * 8)}%`,
            left: 0,
            opacity: 0.82,
            position: "absolute",
            right: 0,
          }}
        />
      </div>
      <div
        style={{
          color: accent,
          fontFamily: DATA_FONT_FAMILY,
          fontSize: portrait ? 34 : 38,
          fontWeight: 900,
          left: "50%",
          opacity: resolve,
          position: "absolute",
          textAlign: "center",
          top: "8%",
          transform: "translateX(-50%)",
          width: "80%",
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const FunnelFilter: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const clipId = `funnel-${useId().replace(/:/g, "")}`;
  const travel = motionProgress(frame, fps, 0.6, 4 / profile.tempo);
  const canvasWidth = width * 0.9;
  const canvasHeight = height * (portrait ? 0.55 : 0.62);
  const funnel = portrait
    ? `M ${canvasWidth * 0.08} 50 L ${canvasWidth * 0.92} 50 L ${canvasWidth * 0.61} ${canvasHeight * 0.55} L ${canvasWidth * 0.61} ${canvasHeight * 0.82} L ${canvasWidth * 0.39} ${canvasHeight * 0.82} L ${canvasWidth * 0.39} ${canvasHeight * 0.55} Z`
    : `M 50 ${canvasHeight * 0.16} L ${canvasWidth * 0.56} ${canvasHeight * 0.16} L ${canvasWidth * 0.73} ${canvasHeight * 0.39} L ${canvasWidth * 0.56} ${canvasHeight * 0.62} L 50 ${canvasHeight * 0.62} Z`;
  return (
    <svg
      height="100%"
      style={{opacity: intro, overflow: "visible"}}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      width="100%"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={funnel} />
        </clipPath>
      </defs>
      <path
        d={funnel}
        fill={rgba(theme.surfaceRaised, 0.82)}
        stroke={accent}
        strokeWidth={4}
      />
      {props.items.slice(0, 7).map((item, index) => {
        const startX = portrait
          ? canvasWidth * (0.14 + (index % 5) * 0.18)
          : 75;
        const startY = portrait
          ? 92 + Math.floor(index / 5) * 64
          : canvasHeight * (0.22 + index * 0.055);
        const endX = portrait
          ? canvasWidth * 0.5
          : canvasWidth * 0.64;
        const endY = portrait
          ? canvasHeight * 0.9
          : canvasHeight * 0.39;
        const local = Math.max(0, Math.min(1, travel * 1.25 - index * 0.08));
        const x = interpolate(local, [0, 1], [startX, endX]);
        const y = interpolate(local, [0, 1], [startY, endY]);
        const accepted = index < Math.max(1, Math.ceil(props.items.length / 3));
        return (
          <g
            key={`${item.label}-${index}`}
            opacity={accepted ? 1 : 1 - resolve * 0.72}
            transform={`translate(${x} ${y})`}
          >
            <circle
              fill={accepted ? accent : theme.muted}
              opacity={accepted ? 1 : 0.46}
              r={accepted ? 16 : 12}
            />
          </g>
        );
      })}
      <text
        fill={theme.ink}
        fontFamily={MOTION_FONT_FAMILY}
        fontSize={portrait ? 24 : 22}
        fontWeight={760}
        x={portrait ? canvasWidth * 0.5 : 80}
        y={portrait ? 32 : canvasHeight * 0.1}
        textAnchor={portrait ? "middle" : "start"}
      >
        {props.primaryLabel}
      </text>
      <text
        fill={accent}
        fontFamily={DATA_FONT_FAMILY}
        fontSize={portrait ? 28 : 25}
        fontWeight={900}
        opacity={resolve}
        textAnchor="middle"
        x={portrait ? canvasWidth * 0.5 : canvasWidth * 0.8}
        y={portrait ? canvasHeight * 0.97 : canvasHeight * 0.43}
      >
        {props.callout}
      </text>
    </svg>
  );
};

const BranchMerge: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const portrait = height > width * 1.15;
  const items = props.items.slice(0, 5);
  const viewWidth = width * 0.9;
  const viewHeight = height * (portrait ? 0.58 : 0.62);
  const target = portrait
    ? {x: viewWidth * 0.5, y: viewHeight * 0.83}
    : {x: viewWidth * 0.82, y: viewHeight * 0.48};
  return (
    <svg
      height="100%"
      style={{opacity: intro, overflow: "visible"}}
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
    >
      {items.map((item, index) => {
        const source = portrait
          ? {
              x:
                viewWidth *
                (0.12 + (index / Math.max(1, items.length - 1)) * 0.76),
              y: viewHeight * 0.13,
            }
          : {
              x: viewWidth * 0.14,
              y:
                viewHeight *
                (0.13 + (index / Math.max(1, items.length - 1)) * 0.7),
            };
        const pathProgress = motionProgress(
          frame,
          fps,
          0.45 + index * profile.staggerSeconds * 0.6,
          3.3 / profile.tempo + index * profile.staggerSeconds * 0.6,
        );
        const control = portrait
          ? `${source.x} ${viewHeight * 0.48}, ${target.x} ${viewHeight * 0.5}`
          : `${viewWidth * 0.47} ${source.y}, ${viewWidth * 0.55} ${target.y}`;
        const d = `M ${source.x} ${source.y} C ${control} ${target.x} ${target.y}`;
        return (
          <g key={`${item.label}-${index}`}>
            <path
              d={d}
              fill="none"
              pathLength={1}
              stroke={index === 0 ? accent : rgba(theme.muted, 0.58)}
              strokeDasharray={1}
              strokeDashoffset={1 - pathProgress}
              strokeWidth={index === 0 ? 5 : 3}
            />
            <circle
              cx={source.x}
              cy={source.y}
              fill={theme.surfaceRaised}
              r={22}
              stroke={index === 0 ? accent : theme.muted}
              strokeWidth={3}
            />
            <text
              fill={theme.ink}
              fontFamily={MOTION_FONT_FAMILY}
              fontSize={portrait ? 18 : 19}
              fontWeight={720}
              textAnchor={portrait ? "middle" : "end"}
              x={portrait ? source.x : source.x - 34}
              y={portrait ? source.y - 38 : source.y + 7}
            >
              {item.label}
            </text>
          </g>
        );
      })}
      <circle
        cx={target.x}
        cy={target.y}
        fill={accent}
        opacity={resolve}
        r={interpolate(resolve, [0, 1], [18, 46])}
      />
      <text
        fill={theme.background}
        fontFamily={DATA_FONT_FAMILY}
        fontSize={17}
        fontWeight={900}
        opacity={resolve}
        textAnchor="middle"
        x={target.x}
        y={target.y + 6}
      >
        OK
      </text>
      <text
        fill={accent}
        fontFamily={MOTION_FONT_FAMILY}
        fontSize={portrait ? 25 : 23}
        fontWeight={850}
        opacity={resolve}
        textAnchor="middle"
        x={target.x}
        y={target.y + 88}
      >
        {props.callout}
      </text>
    </svg>
  );
};

const PhotoParallax: React.FC<ExtendedPatternProps> = (props) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const theme = getMotionTheme(props.themeId);
  const accent = props.accentColor ?? theme.accent;
  const {profile, intro, resolve} = usePatternMotion(props.motionProfile);
  const pan = motionProgress(frame, fps, 0.2, 6.4 / profile.tempo, Easing.inOut(Easing.cubic));
  const x = interpolate(pan, [0, 1], [-2.5, 2.5]);
  const y = interpolate(pan, [0, 1], [1.8, -1.8]);
  return (
    <div
      style={{
        height: "100%",
        opacity: intro,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Img
        src={resolveMediaSource(props.imagePath)}
        style={{
          filter: "saturate(.9) contrast(1.06)",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${x}%, ${y}%) scale(${1.05 + pan * (profile.scale - 1)})`,
          width: "100%",
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(90deg, ${rgba(theme.background, 0.88)} 0%, ${rgba(theme.background, 0.16)} 64%, transparent 100%)`,
        }}
      />
      <div
        style={{
          borderLeft: `4px solid ${accent}`,
          bottom: "9%",
          color: theme.ink,
          fontSize: height > width ? 28 : 30,
          fontWeight: 820,
          left: "6%",
          lineHeight: 1.05,
          maxWidth: height > width ? "78%" : "42%",
          opacity: resolve,
          padding: "6px 0 6px 18px",
          position: "absolute",
          transform: `translateX(${(1 - resolve) * -profile.travel}px)`,
        }}
      >
        {props.callout}
      </div>
    </div>
  );
};

const PATTERN_COMPONENTS: Record<
  ExtendedPatternProps["pattern"],
  React.FC<ExtendedPatternProps>
> = {
  "screenshot-spotlight": ScreenshotSpotlight,
  "before-after-wipe": BeforeAfterWipe,
  "common-baseline": CommonBaseline,
  "timeline-milestones": TimelineMilestones,
  ranking: Ranking,
  accumulation: Accumulation,
  "funnel-filter": FunnelFilter,
  "branch-merge": BranchMerge,
  "photo-parallax": PhotoParallax,
};

export const ExtendedPatternScene: React.FC<ExtendedPatternProps> = (props) => {
  const Pattern = PATTERN_COMPONENTS[props.pattern];
  return (
    <>
      <PatternFrame {...props}>
        <Pattern {...props} />
      </PatternFrame>
      <Soundtrack
        cues={patternCues[props.pattern]}
        enabled={props.soundEnabled}
        masterVolume={props.soundMix}
      />
    </>
  );
};

export const contextualPreviewSchema = extendedPatternSchema.extend({
  sourceVideo: z.string().optional(),
  contextMode: z.enum(["overlay", "picture-in-picture", "replace"]),
  sourceOpacity: z.number().min(0).max(1),
  trimBeforeSeconds: z.number().min(0),
  showSafeZones: z.boolean(),
});

export type ContextualPreviewProps = z.infer<typeof contextualPreviewSchema>;

export const defaultContextualPreviewProps = {
  ...defaultExtendedPatternProps,
  sourceVideo: undefined,
  contextMode: "overlay",
  sourceOpacity: 0.5,
  trimBeforeSeconds: 0,
  showSafeZones: true,
} satisfies ContextualPreviewProps;

export const ContextualPatternPreview: React.FC<ContextualPreviewProps> = (
  props,
) => {
  const {fps, width, height} = useVideoConfig();
  const layout = getResponsiveLayout(width, height);
  const hasVideo = Boolean(props.sourceVideo);
  return (
    <AbsoluteFill style={{background: "#03070A"}}>
      {hasVideo ? (
        <OffthreadVideo
          muted
          src={resolveMediaSource(props.sourceVideo as string)}
          trimBefore={Math.round(props.trimBeforeSeconds * fps)}
          style={{
            height: "100%",
            objectFit: "cover",
            opacity: props.sourceOpacity,
            width: "100%",
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(135deg, #101820 0%, #192733 50%, #0B1117 100%)",
          }}
        >
          <div
            style={{
              color: "#6E8293",
              fontFamily: DATA_FONT_FAMILY,
              fontSize: Math.max(18, width * 0.018),
              left: "50%",
              letterSpacing: 1.4,
              position: "absolute",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            CONTEXTO DE VÍDEO
          </div>
        </AbsoluteFill>
      )}
      <div
        style={{
          inset:
            props.contextMode === "picture-in-picture"
              ? `${height * 0.42}px ${width * 0.04}px ${height * 0.04}px ${width * 0.48}px`
              : 0,
          opacity:
            props.contextMode === "replace"
              ? 1
              : props.contextMode === "overlay"
                ? 0.82
                : 0.96,
          position: "absolute",
        }}
      >
        <ExtendedPatternScene {...props} />
      </div>
      {props.showSafeZones ? (
        <div
          style={{
            border: "2px dashed rgba(198,255,74,.55)",
            bottom: layout.safeY,
            left: layout.safeX,
            pointerEvents: "none",
            position: "absolute",
            right: layout.safeX,
            top: layout.safeY,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

export const extendedPatternMetadata = ({
  props,
}: {
  props: ExtendedPatternProps;
}) => {
  const format = MOTION_FORMATS[props.format];
  return {
    width: format.width,
    height: format.height,
    durationInFrames: 8 * 60,
    fps: 60,
  };
};
