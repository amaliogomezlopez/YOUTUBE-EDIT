import {readFile, stat} from 'node:fs/promises';

const cache = new Map();

function utf16be(buffer) {
  const swapped = Buffer.allocUnsafe(buffer.length - (buffer.length % 2));
  for (let index = 0; index < swapped.length; index += 2) {
    swapped[index] = buffer[index + 1];
    swapped[index + 1] = buffer[index];
  }
  return swapped.toString('utf16le').replace(/\0/g, '').trim();
}

function decodeName(buffer, platformId) {
  if (platformId === 0 || platformId === 3) return utf16be(buffer);
  return buffer.toString('latin1').replace(/\0/g, '').trim();
}

function sfntOffset(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'ttcf') return 0;
  if (buffer.length < 16 || buffer.readUInt32BE(8) < 1) throw new Error('La colección tipográfica está vacía.');
  return buffer.readUInt32BE(12);
}

export function parseFontMetadata(buffer) {
  const base = sfntOffset(buffer);
  if (buffer.length < base + 12) throw new Error('Archivo de fuente incompleto.');
  const tableCount = buffer.readUInt16BE(base + 4);
  let nameOffset = null;
  let nameLength = 0;
  for (let index = 0; index < tableCount; index += 1) {
    const record = base + 12 + index * 16;
    if (record + 16 > buffer.length) break;
    if (buffer.subarray(record, record + 4).toString('ascii') !== 'name') continue;
    nameOffset = buffer.readUInt32BE(record + 8);
    nameLength = buffer.readUInt32BE(record + 12);
    break;
  }
  if (nameOffset === null || nameOffset + nameLength > buffer.length || nameLength < 6) throw new Error('La fuente no contiene una tabla de nombres válida.');
  const count = buffer.readUInt16BE(nameOffset + 2);
  const strings = nameOffset + buffer.readUInt16BE(nameOffset + 4);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    const record = nameOffset + 6 + index * 12;
    if (record + 12 > buffer.length) break;
    const platformId = buffer.readUInt16BE(record);
    const languageId = buffer.readUInt16BE(record + 4);
    const nameId = buffer.readUInt16BE(record + 6);
    const length = buffer.readUInt16BE(record + 8);
    const offset = strings + buffer.readUInt16BE(record + 10);
    if (offset < 0 || offset + length > buffer.length) continue;
    const value = decodeName(buffer.subarray(offset, offset + length), platformId);
    if (value) names.push({platformId, languageId, nameId, value});
  }
  const pick = (ids) => names
    .filter((entry) => ids.includes(entry.nameId))
    .sort((a, b) => {
      const idOrder = ids.indexOf(a.nameId) - ids.indexOf(b.nameId);
      if (idOrder) return idOrder;
      const platformOrder = Number(b.platformId === 3) - Number(a.platformId === 3);
      if (platformOrder) return platformOrder;
      return Number(b.languageId === 0x0409) - Number(a.languageId === 0x0409);
    })[0]?.value;
  return {
    family: pick([16, 1]),
    subfamily: pick([17, 2]),
    fullName: pick([4]),
    postscriptName: pick([6])
  };
}

export async function readFontMetadata(file) {
  const info = await stat(file);
  const key = `${file}:${info.size}:${info.mtimeMs}`;
  if (cache.has(key)) return cache.get(key);
  const metadata = parseFontMetadata(await readFile(file));
  cache.set(key, metadata);
  return metadata;
}
