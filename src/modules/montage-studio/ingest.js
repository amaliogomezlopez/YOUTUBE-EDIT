import path from 'node:path';
import {access, copyFile, readFile, readdir, rm} from 'node:fs/promises';
import sharp from 'sharp';
import {ffprobe} from '../../lib/ffmpeg.js';
import {transcribeAudio} from '../../lib/stt.js';
import {ensureDir, readJson, round, run, TMP_DIR, writeJson} from '../../lib/utils.js';
import {resourceTokens} from '../video-studio/asset-sourcing.js';
import {flattenWords, toMp4} from '../video-studio/media-ingest.js';
import {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  mediaDir,
  naturalCompare,
  projectDir,
  slugify,
  staticPath
} from './constants.js';

/**
 * Ingesta de un montaje con voz en off.
 *
 * Entrada: una locucion (grabada o sintetica), una carpeta de imagenes y videos y,
 * opcionalmente, una cama musical y una transcripcion ya hecha.
 *
 * Salida:
 *   - `public/projects/montage/<slug>/`: voz normalizada, assets y musica.
 *   - `projects/montage-<slug>/manifest.json`: inventario con medidas, duraciones,
 *     tokens de nombre y procedencia de cada asset.
 *   - `projects/montage-<slug>/transcript.json`: palabras con tiempos, la unica
 *     fuente de verdad temporal del montaje.
 *   - `projects/montage-<slug>/montage-plan.json`: plan inicial si no existia.
 */

/** La voz se deja en -16 LUFS: los golpes de sonido suman encima y el master final renormaliza. */
const VOICE_FILTER = 'loudnorm=I=-16:TP=-1.5:LRA=11';

const MAX_IMAGE_SIDE = 2560;

/** Capturas de texto: recortarlas a pantalla completa se come el contenido. */
const CONTAIN_PROVIDERS = new Set(['x-oembed-card', 'web-screenshot']);

export async function ingestMontage({
  slug,
  voiceover,
  assetsDir,
  transcript = null,
  music = null,
  sttProvider = process.env.MONTAGE_STT_PROVIDER || 'faster-whisper',
  force = false,
  signal = null,
  log = () => {}
}) {
  const projectSlug = slugify(slug);
  if (!projectSlug) throw new Error('Falta --slug.');
  if (!voiceover) throw new Error('Falta --voiceover con la locucion.');
  if (!assetsDir) throw new Error('Falta --assets con la carpeta de imagenes y videos.');
  const media = mediaDir(projectSlug);
  const project = projectDir(projectSlug);
  if (force) await rm(media, {recursive: true, force: true});
  await ensureDir(path.join(media, 'assets'));
  await ensureDir(project);

  log(`voz: ${path.basename(voiceover)}`);
  const voiceFile = path.join(media, 'voiceover.wav');
  await run('ffmpeg', ['-y', '-i', voiceover, '-vn', '-af', VOICE_FILTER, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', voiceFile], {signal});
  const voiceProbe = await ffprobe(voiceFile, {signal});

  const transcriptFile = path.join(project, 'transcript.json');
  const words = transcript
    ? await wordsFromTranscript(transcript)
    : await transcribeVoice(voiceFile, {provider: sttProvider, signal, log});
  if (!words.length) throw new Error('La transcripcion no tiene palabras.');
  if (words.every((word) => word.timing === 'approximate')) {
    log('  aviso: la transcripcion no trae tiempos por palabra; el ritmo sera aproximado. Usa faster-whisper.');
  }
  await writeJson(transcriptFile, {source: transcript ? path.basename(transcript) : sttProvider, words});
  log(`  transcripcion: ${words.length} palabras`);

  const assets = await ingestAssets(assetsDir, {media, projectSlug, signal, log});
  if (!assets.length) throw new Error(`No hay imagenes ni videos en ${assetsDir}`);

  let musicEntry = null;
  if (music) {
    const target = path.join(media, `music${path.extname(music).toLowerCase()}`);
    await copyFile(music, target);
    const probe = await ffprobe(target, {signal});
    musicEntry = {src: staticPath(projectSlug, path.basename(target)), durationSeconds: round(probe.duration, 3), sourceName: path.basename(music)};
    log(`musica: ${path.basename(music)}`);
  }

  const manifest = {
    version: 1,
    slug: projectSlug,
    ingestedAt: new Date().toISOString(),
    voiceover: {src: staticPath(projectSlug, 'voiceover.wav'), durationSeconds: round(voiceProbe.duration, 3), sourceName: path.basename(voiceover)},
    transcript: 'transcript.json',
    assets,
    music: musicEntry
  };
  await writeJson(path.join(project, 'manifest.json'), manifest);

  const planFile = path.join(project, 'montage-plan.json');
  const hasPlan = await access(planFile).then(() => true, () => false);
  if (!hasPlan) {
    await writeJson(planFile, {
      version: 1,
      slug: projectSlug,
      profileId: 'viral-short',
      formats: ['9x16'],
      cut: {fromWord: 0, toWord: null},
      emphasis: [],
      overrides: [],
      textPops: []
    });
    log('plan inicial: montage-plan.json');
  }
  log(`ingesta: ${assets.length} assets, voz ${manifest.voiceover.durationSeconds}s`);
  return manifest;
}

async function wordsFromTranscript(file) {
  const data = await readJson(file);
  if (Array.isArray(data.words) && data.words.length && data.words[0].start !== undefined) {
    return data.words.map((word, index) => ({
      index,
      text: String(word.text ?? word.word).trim(),
      start: round(Number(word.start), 3),
      end: round(Number(word.end), 3),
      timing: word.timing ?? 'word'
    })).filter((word) => word.text);
  }
  return flattenWords(data.segments ?? data);
}

async function transcribeVoice(voiceFile, {provider, signal, log}) {
  const workspace = path.join(TMP_DIR, 'montage-stt');
  await ensureDir(workspace);
  const audio = path.join(workspace, `voice-${Date.now()}.wav`);
  try {
    await run('ffmpeg', ['-y', '-i', voiceFile, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', audio], {signal});
    log(`  transcribiendo con ${provider}`);
    return flattenWords(await transcribeAudio(audio, {provider, signal}));
  } finally {
    await rm(audio, {force: true});
  }
}

async function ingestAssets(assetsDir, {media, projectSlug, signal, log}) {
  const entries = (await readdir(assetsDir, {withFileTypes: true}))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => {
      const extension = path.extname(name).toLowerCase();
      return (IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension)) && extension !== '.svg';
    })
    .sort(naturalCompare);
  const assets = [];
  const ids = new Set();
  for (const name of entries) {
    signal?.throwIfAborted();
    const source = path.join(assetsDir, name);
    const extension = path.extname(name).toLowerCase();
    let id = slugify(path.basename(name, extension)) || `asset-${assets.length + 1}`;
    while (ids.has(id)) id += '-b';
    ids.add(id);
    const record = await readProvenance(source);
    const base = {id, sourceName: name, name, tokens: resourceTokens(name), provenance: record};
    if (record?.text) base.text = record.text;
    if (CONTAIN_PROVIDERS.has(record?.provider)) base.fit = 'contain';

    if (IMAGE_EXTENSIONS.has(extension)) {
      const target = path.join(media, 'assets', `${id}${extension}`);
      const original = await sharp(source).metadata();
      // Chrome decodifica la imagen entera en cada frame: una foto de stock de 8000 px
      // multiplica el tiempo de render sin ganar nitidez. 2560 px cubren el zoom
      // maximo del perfil sobre 1920 de ancho.
      if (extension !== '.gif' && Math.max(original.width, original.height) > MAX_IMAGE_SIDE) {
        await sharp(source).rotate().resize({width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside'}).toFile(target);
      } else {
        await copyFile(source, target);
      }
      const meta = await sharp(target).metadata();
      // Una imagen con transparencia es un logo: recortado a pantalla completa pierde
      // los bordes, y sin que nadie lo nombre no pinta nada en pantalla.
      if (meta.hasAlpha) {
        base.fit = 'contain';
        base.role = 'logo';
      }
      assets.push({...base, kind: 'image', src: staticPath(projectSlug, 'assets', path.basename(target)), width: meta.width, height: meta.height});
      log(`asset ${id}: imagen ${meta.width}x${meta.height}`);
    } else {
      const target = path.join(media, 'assets', `${id}.mp4`);
      await toMp4(source, target, {signal, normalizeAudio: false});
      const probe = await ffprobe(target, {signal});
      assets.push({...base, kind: 'video', src: staticPath(projectSlug, 'assets', `${id}.mp4`),
        width: probe.width, height: probe.height, durationSeconds: round(probe.duration, 3)});
      log(`asset ${id}: video ${probe.width}x${probe.height} ${round(probe.duration, 1)}s`);
    }
  }
  return assets;
}

async function readProvenance(file) {
  try {
    return JSON.parse(await readFile(`${file}.provenance.json`, 'utf8'));
  } catch {
    return null;
  }
}
