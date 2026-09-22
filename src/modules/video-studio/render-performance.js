import {run} from '../../lib/utils.js';

export function resolveRenderPerformance(options = {}) {
  const resolved = {encoder: 'auto', concurrency: 1, gl: process.platform === 'win32' ? 'angle' : null, ...options};
  if (!['auto', 'cpu', 'nvenc'].includes(resolved.encoder)) throw new Error('Encoder: auto, cpu o nvenc');
  if (!Number.isInteger(resolved.concurrency) || resolved.concurrency < 1 || resolved.concurrency > 16) throw new Error('Concurrencia: entero entre 1 y 16');
  if (resolved.gl !== null && !['angle', 'swangle', 'swiftshader', 'egl', 'vulkan', 'angle-egl'].includes(resolved.gl)) throw new Error('Backend GL no valido');
  return resolved;
}

let nvencProbe;
export async function resolveEncoder(encoder, {signal, probe = run, log = () => {}} = {}) {
  if (encoder === 'cpu') return 'cpu';
  signal?.throwIfAborted();
  const check = () => probe('ffmpeg', ['-v','error','-f','lavfi','-i','color=s=256x256:d=0.1','-frames:v','1','-c:v','h264_nvenc','-f','null','-'], {signal, timeoutMs: 15000});
  try {
    if (probe !== run) await check();
    else {
      nvencProbe ??= check().catch(error => {nvencProbe = undefined; throw error;});
      await nvencProbe;
    }
    return 'nvenc';
  } catch (error) {
    signal?.throwIfAborted();
    if (encoder === 'nvenc') throw new Error('NVENC no disponible: ' + error.message);
    log('NVENC no disponible; se usa CPU.');
    return 'cpu';
  }
}

export function remotionPerformanceArgs({encoder, concurrency, gl}, quality = 'high') {
  return ['--color-space=bt709', '--concurrency=' + concurrency, ...(gl ? ['--gl=' + gl] : []),
    ...(encoder === 'nvenc'
      ? ['--hardware-acceleration=required', '--video-bitrate=' + ({draft:'8M',standard:'16M',high:'24M'}[quality] ?? '24M')]
      : ['--hardware-acceleration=disable', '--crf=' + ({draft:23,standard:19,high:17}[quality] ?? 17)])];
}
