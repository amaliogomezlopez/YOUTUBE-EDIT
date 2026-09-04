import {ffprobe} from '../../lib/ffmpeg.js';
import {run} from '../../lib/utils.js';

export const VOICE_LOUDNESS = 'loudnorm=I=-14:TP=-1.5:LRA=11';
export async function finalizeShortAudio(input, output, {signal, duration} = {}) {
  // Solo se recodifica la mezcla final: el video conserva sus pixeles.
  await run('ffmpeg', ['-y','-i',input,...(Number.isFinite(duration)?['-t',String(duration)]:[]),'-map','0:v:0','-map','0:a:0','-c:v','copy','-af',VOICE_LOUDNESS,
    '-c:a','aac','-b:a','192k','-ar','48000','-movflags','+faststart',output], {signal});
}
export async function verifyShortMedia(file, {duration, signal} = {}) {
  const media = await ffprobe(file, {signal});
  const errors = [], warnings = [];
  const video = media.raw.streams.find(s => s.codec_type === 'video');
  const audio = media.raw.streams.find(s => s.codec_type === 'audio');
  if (media.width !== 1080 || media.height !== 1920) errors.push('Resolucion distinta de 1080x1920');
  if (video?.codec_name !== 'h264' || video?.pix_fmt !== 'yuv420p') errors.push('Formato de video incompatible');
  if (audio?.codec_name !== 'aac') errors.push('Falta audio AAC');
  if (Number.isFinite(duration) && Math.abs(media.duration - duration) > .15) errors.push('Duracion distinta al montaje');
  const measured = await run('ffmpeg',['-v','info','-i',file,'-af','loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json','-f','null','-'],{signal});
  const match = measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
  const loudness = match ? JSON.parse(match[0]) : null;
  if (!loudness) errors.push('No se pudo medir la mezcla final');
  else {
    if (Number(loudness.input_tp) > -0.5) errors.push('Picos de audio sin margen');
    if (Math.abs(Number(loudness.input_i) + 14) > 2) warnings.push('Volumen integrado fuera del objetivo de -14 LUFS');
  }
  return {passed: !errors.length, duration:media.duration, width:media.width, height:media.height, loudness, errors, warnings,
    visualReview: 'pending'};
}
