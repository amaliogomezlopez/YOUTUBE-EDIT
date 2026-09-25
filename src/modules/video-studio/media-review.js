/**
 * Revision de un render, comun a las superficies: sonoridad integrada (EBU R128) y
 * hoja de fotogramas con marca de tiempo. La validacion tecnica no sustituye la
 * revision visual; estas dos piezas son lo que la hace rapida.
 */
import path from 'node:path';
import {mkdir, rm} from 'node:fs/promises';
import sharp from 'sharp';
import {run} from '../../lib/utils.js';

/** Resumen de `ebur128`: {integrated (LUFS), range (LU), truePeak (dBTP)}. */
export function parseEbur128(stderr) {
  const summary = String(stderr).split(/Summary:/).pop() ?? '';
  const number = (pattern) => {
    const match = pattern.exec(summary);
    return match ? Number(match[1]) : null;
  };
  return {
    integrated: number(/I:\s+(-?[\d.]+) LUFS/),
    range: number(/LRA:\s+(-?[\d.]+) LU/),
    truePeak: number(/Peak:\s+(-?[\d.]+) dBFS/)
  };
}

export async function measureLoudness(file) {
  const {stderr} = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {timeoutMs: 30 * 60_000});
  return parseEbur128(stderr);
}

const clock = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};

/**
 * Hoja de fotogramas: un fotograma por instante de `frames` ({seconds, label, file?})
 * en una rejilla de `columns`, con la marca de tiempo y la etiqueta encima de cada
 * celda. Un `file` por fotograma permite comparar versiones: una fila por render.
 */
export async function frameSheet({file, frames, output, columns = 5, cellWidth = 384}) {
  const cellHeight = Math.round(cellWidth * 9 / 16);
  const band = 26;
  const work = path.join(path.dirname(output), '.frames-' + path.basename(output, path.extname(output)));
  await mkdir(work, {recursive: true});
  try {
    const cells = [];
    for (const [index, frame] of frames.entries()) {
      const shot = path.join(work, `${String(index).padStart(3, '0')}.png`);
      await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', String(Math.max(0, frame.seconds)), '-i', frame.file ?? file,
        '-frames:v', '1', '-vf', `scale=${cellWidth}:${cellHeight}`, shot]);
      const text = `${clock(frame.seconds)}  ${frame.label ?? ''}`.replace(/[<&>]/g, ' ');
      const label = Buffer.from(`<svg width="${cellWidth}" height="${band}"><rect width="100%" height="100%" fill="#000"/>` +
        `<text x="8" y="18" font-family="Arial" font-size="15" fill="#fff">${text}</text></svg>`);
      cells.push({shot, label, index});
    }
    const rows = Math.ceil(cells.length / columns);
    const composite = [];
    for (const cell of cells) {
      const left = (cell.index % columns) * cellWidth;
      const top = Math.floor(cell.index / columns) * (cellHeight + band);
      composite.push({input: cell.label, left, top});
      composite.push({input: cell.shot, left, top: top + band});
    }
    await sharp({create: {width: columns * cellWidth, height: rows * (cellHeight + band), channels: 3, background: '#111111'}})
      .composite(composite).jpeg({quality: 82}).toFile(output);
    return output;
  } finally {
    await rm(work, {recursive: true, force: true});
  }
}
