import {mkdirSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const sourceRoot = path.resolve(
  "..",
  "assets",
  "audio-effects",
  "source-library",
  "SFX",
);
const outputRoot = path.resolve("public", "sfx");

mkdirSync(outputRoot, {recursive: true});

const runFfmpeg = (args) => {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const normalized = [
  {
    source: "Smooth Woosh.wav",
    output: "library-smooth-whoosh.wav",
    duration: 1.77,
  },
  {
    source: "Digital Counting.mp3",
    output: "library-digital-count.wav",
  },
  {
    source: "UI Data Loading Sound Effect.mp3",
    output: "library-data-loading.wav",
    start: 0.245,
    duration: 2.4,
  },
  {
    source: "Chime 1.mp3",
    output: "library-chime.wav",
  },
  {
    source: "Pop.mp3",
    output: "library-pop.wav",
  },
  {
    source: "Keyboard Typing 1.wav",
    output: "library-keyboard.wav",
  },
  {
    source: "01 Processing.wav",
    output: "library-processing.wav",
  },
  {
    source:
      "DSGNWhsh_Short Whip, Short Whoosh 1_Ocular Sounds_Quick Whips_The Complete Whooshes Collection.wav",
    output: "library-quick-whip.wav",
  },
];

for (const item of normalized) {
  const input = path.join(sourceRoot, item.source);
  const output = path.join(outputRoot, item.output);
  const args = [];
  if (item.start !== undefined) {
    args.push("-ss", String(item.start));
  }
  args.push("-i", input);
  if (item.duration !== undefined) {
    args.push("-t", String(item.duration));
  }
  args.push(
    "-vn",
    "-af",
    "aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo,loudnorm=I=-20:TP=-2:LRA=7,afade=t=in:st=0:d=0.008",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    output,
  );
  runFfmpeg(args);
}

const customEffects = [
  {
    output: "amaliometria-ui-pulse.wav",
    args: [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=760:sample_rate=48000:duration=0.22",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1140:sample_rate=48000:duration=0.22",
      "-filter_complex",
      "[0:a]volume=0.16,afade=t=in:st=0:d=0.006,afade=t=out:st=0.035:d=0.185[a0];[1:a]volume=0.07,afade=t=in:st=0:d=0.006,afade=t=out:st=0.025:d=0.195[a1];[a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.65,loudnorm=I=-20:TP=-7:LRA=7,aformat=channel_layouts=stereo[out]",
      "-map",
      "[out]",
    ],
  },
  {
    output: "amaliometria-data-tick.wav",
    args: [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=980:sample_rate=48000:duration=0.1",
      "-af",
      "volume=0.2,afade=t=in:st=0:d=0.003,afade=t=out:st=0.012:d=0.088,loudnorm=I=-22:TP=-8:LRA=7,aformat=channel_layouts=stereo",
    ],
  },
  {
    output: "amaliometria-soft-impact.wav",
    args: [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=112:sample_rate=48000:duration=0.58",
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=pink:sample_rate=48000:duration=0.58",
      "-filter_complex",
      "[0:a]volume=0.24,afade=t=out:st=0.04:d=0.54[a0];[1:a]lowpass=f=900,volume=0.035,afade=t=out:st=0.02:d=0.56[a1];[a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.7,loudnorm=I=-22:TP=-7:LRA=7,aformat=channel_layouts=stereo[out]",
      "-map",
      "[out]",
    ],
  },
  {
    output: "amaliometria-rise-whoosh.wav",
    args: [
      "-f",
      "lavfi",
      "-i",
      "anoisesrc=color=pink:sample_rate=48000:duration=0.78",
      "-af",
      "highpass=f=260,lowpass=f=5800,volume=0.12,afade=t=in:st=0:d=0.52,afade=t=out:st=0.56:d=0.22,loudnorm=I=-24:TP=-9:LRA=7,aformat=channel_layouts=stereo",
    ],
  },
  {
    output: "amaliometria-success-chime.wav",
    args: [
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=660:sample_rate=48000:duration=0.52",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:sample_rate=48000:duration=0.38",
      "-filter_complex",
      "[0:a]volume=0.1,afade=t=out:st=0.08:d=0.44[a0];[1:a]volume=0.08,adelay=140|140,afade=t=out:st=0.08:d=0.3[a1];[a0][a1]amix=inputs=2:normalize=0,alimiter=limit=0.6,loudnorm=I=-22:TP=-8:LRA=7,aformat=channel_layouts=stereo[out]",
      "-map",
      "[out]",
    ],
  },
];

for (const item of customEffects) {
  runFfmpeg([
    ...item.args,
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_s16le",
    path.join(outputRoot, item.output),
  ]);
}

const manifest = {
  version: 1,
  format: {
    codec: "pcm_s16le",
    sampleRate: 48000,
    channels: 2,
  },
  licenseWarning:
    "Los archivos library-* conservan la procedencia de la biblioteca local; verificar licencia antes de redistribuirlos aisladamente.",
  library: normalized.map(({source, output}) => ({source, output})),
  custom: customEffects.map(({output}) => ({
    output,
    provenance: "Síntesis local determinista con FFmpeg.",
  })),
};

writeFileSync(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Preparados ${normalized.length + customEffects.length} efectos en ${outputRoot}`);
