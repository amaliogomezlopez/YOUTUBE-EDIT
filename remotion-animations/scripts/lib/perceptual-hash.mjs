/**
 * Hash perceptual para regresión visual.
 *
 * El render de Remotion no es bit-exacto entre ejecuciones (antialiasing,
 * versión de Chromium, subpíxel de fuentes), así que comparar sha256 daría un
 * falso positivo en cada corrida. Un dHash de 64 bits ignora ese ruido y sigue
 * distinguiendo un cambio de composición.
 */
import sharp from "sharp";

const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

/** dHash: compara cada píxel con su vecino derecho sobre una miniatura 9×8. */
export const perceptualHash = async (buffer) => {
  const {data} = await sharp(buffer)
    .greyscale()
    .resize(HASH_WIDTH, HASH_HEIGHT, {fit: "fill"})
    .raw()
    .toBuffer({resolveWithObject: true});
  let bits = "";
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let column = 0; column < HASH_WIDTH - 1; column++) {
      const left = data[row * HASH_WIDTH + column];
      const right = data[row * HASH_WIDTH + column + 1];
      bits += left > right ? "1" : "0";
    }
  }
  let hex = "";
  for (let index = 0; index < bits.length; index += 4) {
    hex += Number.parseInt(bits.slice(index, index + 4), 2).toString(16);
  }
  return hex;
};

/** Estadística de luminancia: caza el frame en negro que el hash no distingue. */
export const luminanceStats = async (buffer) => {
  const {data, info} = await sharp(buffer)
    .resize(64, 36, {fit: "fill"})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const values = [];
  for (let index = 0; index < data.length; index += info.channels) {
    values.push(
      0.2126 * data[index] +
        0.7152 * data[index + 1] +
        0.0722 * data[index + 2],
    );
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    luminanceMean: Number(mean.toFixed(3)),
    luminanceVariance: Number(variance.toFixed(3)),
  };
};

const HEX_BITS = new Map(
  Array.from({length: 16}, (_, value) => [
    value.toString(16),
    value.toString(2).padStart(4, "0").split("").filter((bit) => bit === "1")
      .length,
  ]),
);

/** Distancia de Hamming en bits entre dos hashes hexadecimales. */
export const hashDistance = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return 64;
  if (left.length !== right.length) return 64;
  let distance = 0;
  for (let index = 0; index < left.length; index++) {
    const xor = (
      Number.parseInt(left[index], 16) ^ Number.parseInt(right[index], 16)
    ).toString(16);
    distance += HEX_BITS.get(xor) ?? 4;
  }
  return distance;
};
