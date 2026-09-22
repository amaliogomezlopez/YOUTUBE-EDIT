export function defaultQualityArgs(command, args, env = process.env) {
  if (command !== 'render') return [];
  const has = (name) => args.some(arg => arg === name || arg.startsWith(`${name}=`));
  return [
    ...(has('--codec') ? [] : ['--codec=h264']),
    ...(has('--crf') || has('--video-bitrate') || has('--hardware-acceleration')
      ? [] : [`--crf=${env.REMOTION_CRF ?? 17}`])
  ];
}
