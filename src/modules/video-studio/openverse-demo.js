/**
 * Demo de escucha: un video 16:9 de ~20 s que pone el mejor candidato de Openverse
 * de cada situacion sobre el gesto de montaje al que acompana (arranque, toma
 * nueva, zoom de golpe, b-roll que entra, captura, glitch, zoom-blur, remate,
 * cifra, dinero, clic). No es un montaje: es una hoja de pruebas para decidir
 * que sonidos adoptar, por eso cada golpe lleva un rotulo con su situacion, el
 * titulo del sonido y su licencia.
 *
 * Usa las mismas reglas de colocacion que la apertura: los efectos normales empiezan
 * en el frame del cambio (se descuenta su silencio inicial) y los anclados por el
 * final (riser, whoosh inverso) colocan su pico en el corte.
 */
import path from 'node:path';
import {ROOT, ensureDir, run, writeJson} from '../../lib/utils.js';
import {OPENVERSE_STAGING_DIR, readCandidates} from './openverse-sounds.js';
import {SFX_LEVELS_LU, VOICE_TARGET_LUFS, measureLoudness, sfxGainDb} from './sound-loudness.js';

const FPS = 30;
const FONT = path.join(ROOT, 'assets', 'fonts', 'SchibstedGrotesk-ExtraBold.ttf');

/** Guion de la demo: segundo del golpe, situacion y rotulo. */
export const DEMO_BEATS = [
  {at: 2.2, situation: 'arranque', label: 'Arranque (riser hasta el primer corte)', anchor: 'end', maxSeconds: 3.2},
  {at: 2.2, situation: 'toma-nueva', label: 'Toma nueva', maxSeconds: 0.7},
  {at: 3.6, situation: 'golpe-palabra', label: 'Zoom de golpe en la palabra', maxSeconds: 0.9},
  {at: 5.0, situation: 'zoom', label: 'Zoom de camara (push-out)', maxSeconds: 0.7},
  {at: 6.4, situation: 'entrar-broll', label: 'Entrar a b-roll', maxSeconds: 0.9},
  {at: 8.0, situation: 'captura', label: 'Captura que aparece', maxSeconds: 0.5},
  {at: 9.6, situation: 'salir-broll', label: 'Volver a camara', maxSeconds: 0.6},
  {at: 11.0, situation: 'cifra', label: 'Cifra (no dinero)', maxSeconds: 0.8},
  {at: 12.4, situation: 'glitch', label: 'Transicion glitch', maxSeconds: 0.7},
  {at: 14.0, situation: 'zoom-inverso', label: 'Zoom-blur (whoosh inverso)', anchor: 'end', maxSeconds: 1.6},
  {at: 15.6, situation: 'remate', label: 'Remate con temblor', maxSeconds: 1.4},
  {at: 17.2, situation: 'dinero', label: 'Cifra de dinero', maxSeconds: 1.6},
  {at: 18.7, situation: 'clic', label: 'Clic de interfaz', maxSeconds: 0.4}
];
export const DEMO_SECONDS = 20.4;

/** Segundo de la pieza en que suena el primer sample util para que el golpe caiga en `beat.at`. */
export function soundStart(beat, audio) {
  if (beat.anchor !== 'end') return beat.at;
  const from = Math.max(audio.onsetSeconds, audio.peakSeconds - beat.maxSeconds);
  return Math.max(0, beat.at - (audio.peakSeconds - from));
}

const esc = (text) => String(text).replace(/\\/g, '\\\\').replace(/'/g, '\u2019').replace(/:/g, '\\:').replace(/%/g, '\\%').replace(/,/g, '\\,');
const fontPath = FONT.replace(/\\/g, '/').replace(/:/g, '\\:');
// Intervalo semiabierto: el rotulo de un golpe desaparece en el frame en que entra el siguiente.
const between = (a, b) => `gte(t\\,${a})*lt(t\\,${b})`;

function drawText(text, {at, until, size = 44, x = '80', y = '70', color = 'white', box = true, pop = false}) {
  const fontsize = pop ? `'${size}*(1+0.35*max(0\\,1-(t-${at})/0.14))'` : size;
  return `drawtext=fontfile='${fontPath}':text='${esc(text)}':fontsize=${fontsize}:fontcolor=${color}:x=${x}:y=${y}` +
    (box ? ':box=1:boxcolor=black@0.62:boxborderw=18' : ':borderw=6:bordercolor=black') +
    `:enable='${between(at, until)}'`;
}

/**
 * Elige el sonido de cada beat: `picks` ({situacion: id8}) manda; si no, el mejor
 * candidato medido de esa situacion.
 */
export async function pickDemoSounds({picks = {}, stagingDir = OPENVERSE_STAGING_DIR} = {}) {
  const chosen = [], used = new Set();
  for (const beat of DEMO_BEATS) {
    const report = await readCandidates(beat.situation, {stagingDir}).catch(() => null);
    if (!report?.candidates?.length) throw new Error(`Sin candidatos de ${beat.situation}: npm run sonidos:openverse -- buscar --situacion ${beat.situation}`);
    const wanted = picks[beat.situation];
    // Sin eleccion, el mejor que no haya sonado ya en otro beat (toma nueva y zoom comparten busqueda).
    const candidate = wanted ? report.candidates.find((c) => c.id.startsWith(wanted)) : report.candidates.find((c) => !used.has(c.id));
    if (!candidate) throw new Error(`${wanted} no esta entre los candidatos de ${beat.situation}`);
    used.add(candidate.id);
    chosen.push({...beat, candidate, startSeconds: soundStart(beat, candidate.audio)});
  }
  return chosen;
}

export async function renderSoundDemo({video, broll = [], out, start = 0, voiceLufs = VOICE_TARGET_LUFS, picks, stagingDir = OPENVERSE_STAGING_DIR, log = () => {}}) {
  const beats = await pickDemoSounds({picks, stagingDir});
  out ??= path.join(stagingDir, 'demo', 'demo-efectos-openverse.mp4');
  await ensureDir(path.dirname(out));
  const images = broll.filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  const clips = broll.filter((file) => /\.(mp4|mov|mkv|webm)$/i.test(file));
  if (images.length < 2) throw new Error('La demo necesita al menos dos imagenes de b-roll (--broll a.png,b.png[,c.mp4]).');

  const inputs = ['-ss', String(start), '-t', String(DEMO_SECONDS + 1), '-i', video,
    '-loop', '1', '-t', String(DEMO_SECONDS), '-i', images[0],
    '-loop', '1', '-t', String(DEMO_SECONDS), '-i', images[1]];
  const third = clips[0] ?? images[2] ?? images[0];
  inputs.push(...(clips[0] ? ['-stream_loop', '-1', '-t', String(DEMO_SECONDS), '-i', third] : ['-loop', '1', '-t', String(DEMO_SECONDS), '-i', third]));
  const firstSound = 4;
  for (const beat of beats) inputs.push('-i', beat.candidate.file);

  // Camara: punch-in de golpe, push-out suave, aterrizaje del zoom-blur y temblor.
  const zoom = [
    `if(lt(it\\,3.6)\\,1`,
    `\\,if(lt(it\\,5.0)\\,1.22`,
    `\\,if(lt(it\\,5.4)\\,1.22-0.22*(it-5.0)/0.4`,
    `\\,if(lt(it\\,14.0)\\,1`,
    `\\,if(lt(it\\,14.35)\\,1.35-0.27*(it-14.0)/0.35`,
    `\\,1.08)))))`
  ].join('');
  const shake = `if(between(it\\,15.6\\,15.95)\\,22*sin(it*95)*(1-(it-15.6)/0.35)\\,0)`;
  const cover = (label, out) => `[${label}]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x101014,setsar=1,fps=${FPS},format=yuv420p[${out}]`;
  const filters = [
    `[0:v]fps=${FPS},scale=2400:-2,zoompan=z='${zoom}':x='(iw-iw/zoom)/2+${shake}':y='(ih-ih/zoom)*0.42':d=1:s=1920x1080:fps=${FPS},setsar=1,format=yuv420p[face]`,
    cover('1:v', 'b1'),
    `[2:v]scale=860:-2,pad=iw+16:ih+16:8:8:color=white,scale=w='iw*min(1\\,0.55+0.45*(t-8.0)/0.12)':h=-2:eval=frame,format=yuva420p[card]`,
    cover('3:v', 'b3'),
    // b-roll 1 entra deslizando en 6.4 y sale hacia la izquierda con el latigazo de 9.6.
    `[face][b1]overlay=x='if(lt(t\\,6.62)\\,1920*(1-(t-6.4)/0.22)\\,if(lt(t\\,9.6)\\,0\\,-1920*(t-9.6)/0.15))':y=0:enable='${between(6.4, 9.75)}'[v1]`,
    `[v1][card]overlay=x='(W-w)/2':y='(H-h)/2':enable='${between(8.0, 9.6)}'[v2]`,
    `[v2][b3]overlay=0:0:enable='${between(12.4, 14.0)}'[v3]`,
    `[v3]rgbashift=rh=-28:bh=28:enable='${between(12.3, 12.55)}',gblur=sigma=26:enable='${between(13.86, 14.12)}',` +
      `drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='lt(t\\,2.2)',` +
      `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=fill:enable='${between(18.7, 18.76)}',` +
      [
        drawText('Efectos libres de Openverse', {at: 0.2, until: 2.2, size: 84, x: '(w-text_w)/2', y: '(h-text_h)/2-40', box: false}),
        drawText('CC0 / dominio publico, sin atribucion', {at: 0.5, until: 2.2, size: 46, x: '(w-text_w)/2', y: '(h-text_h)/2+70', color: '0xFFD60A', box: false}),
        drawText('+25 %', {at: 11.0, until: 12.4, size: 190, x: '(w-text_w)/2', y: '(h-text_h)/2', color: '0xFFD60A', box: false, pop: true}),
        drawText('1.000 M EUR', {at: 17.2, until: 18.6, size: 170, x: '(w-text_w)/2', y: '(h-text_h)/2', color: '0x3DDC84', box: false, pop: true}),
        ...beats.filter((beat) => beat.situation !== 'arranque').map((beat, index, list) => {
          const until = Math.min(list[index + 1]?.at ?? DEMO_SECONDS, beat.at + 1.6);
          const title = beat.candidate.title.replace(/\.(wav|mp3|aif+|flac|ogg)$/i, '').slice(0, 42);
          return [
            drawText(beat.label, {at: beat.at, until, size: 46}),
            drawText(`${title}  -  ${beat.candidate.license.toUpperCase()}`, {at: beat.at, until, size: 30, y: '150', color: '0xFFD60A'})
          ].join(',');
        })
      ].join(',') +
      `,fade=t=out:st=${DEMO_SECONDS - 0.4}:d=0.4[vout]`
  ];

  // Voz a la sonoridad de la ingesta (-14 LUFS) y cada efecto a su distancia en LU
  // por debajo (`SFX_LEVELS_LU`), medido sobre el tramo exacto que suena.
  const voice = await measureLoudness(video, {start: start + 2.2, duration: DEMO_SECONDS - 2.2});
  const voiceGain = Math.round((voiceLufs - voice.integratedLufs) * 10) / 10;
  const mix = [];
  filters.push(`[0:a]volume=${voiceGain}dB,volume=0:enable='lt(t\\,2.2)',atrim=0:${DEMO_SECONDS},aresample=48000[voice]`);
  mix.push('[voice]');
  const levels = [];
  for (const [index, beat] of beats.entries()) {
    const {audio} = beat.candidate;
    // Anclado por el final: se toma como mucho `maxSeconds` antes del pico y se deja
    // sonar 0,25 s despues. Normal: desde su ataque, recortado a `maxSeconds`.
    const from = beat.anchor === 'end' ? Math.max(audio.onsetSeconds, audio.peakSeconds - beat.maxSeconds) : audio.onsetSeconds;
    const length = beat.anchor === 'end' ? audio.peakSeconds - from + 0.25 : beat.maxSeconds;
    const delay = Math.round(beat.startSeconds * 1000);
    const measured = await measureLoudness(beat.candidate.file, {start: from, duration: length});
    const gain = sfxGainDb({situation: beat.situation, voiceLufs, momentaryLufs: measured.maxMomentaryLufs, peakDb: measured.truePeakDb});
    levels.push({situation: beat.situation, gainDb: gain, momentaryLufs: measured.maxMomentaryLufs, targetLufs: voiceLufs + (SFX_LEVELS_LU[beat.situation] ?? 0)});
    filters.push(`[${firstSound + index}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=${from}:${from + length},asetpts=PTS-STARTPTS,` +
      `volume=${gain}dB,afade=t=out:st=${Math.max(0, length - 0.12)}:d=0.12,adelay=${delay}|${delay}[s${index}]`);
    mix.push(`[s${index}]`);
  }
  filters.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,atrim=0:${DEMO_SECONDS},alimiter=limit=0.79[aout]`);

  log(`Renderizando ${path.basename(out)} con ${beats.length} efectos...`);
  await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...inputs, '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]', '-t', String(DEMO_SECONDS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out]);
  await writeJson(out.replace(/\.mp4$/i, '.json'), {
    video, broll, seconds: DEMO_SECONDS, voice: {measuredLufs: voice.integratedLufs, gainDb: voiceGain, targetLufs: voiceLufs}, levels,
    sounds: beats.map(({at, situation, label, candidate}) => ({at, situation, label, id: candidate.id, title: candidate.title, license: candidate.license, landingUrl: candidate.landingUrl, score: candidate.score}))
  });
  return out;
}
