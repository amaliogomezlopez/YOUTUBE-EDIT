import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFontMetadata} from '../src/lib/fonts.js';

function utf16be(value) {
  const little = Buffer.from(value, 'utf16le');
  const output = Buffer.alloc(little.length);
  for (let index = 0; index < little.length; index += 2) {
    output[index] = little[index + 1];
    output[index + 1] = little[index];
  }
  return output;
}

function minimalFont(family) {
  const text = utf16be(family);
  const nameOffset = 28;
  const nameLength = 18 + text.length;
  const buffer = Buffer.alloc(nameOffset + nameLength);
  buffer.writeUInt32BE(0x00010000, 0);
  buffer.writeUInt16BE(1, 4);
  buffer.write('name', 12, 4, 'ascii');
  buffer.writeUInt32BE(nameOffset, 20);
  buffer.writeUInt32BE(nameLength, 24);
  buffer.writeUInt16BE(0, nameOffset);
  buffer.writeUInt16BE(1, nameOffset + 2);
  buffer.writeUInt16BE(18, nameOffset + 4);
  buffer.writeUInt16BE(3, nameOffset + 6);
  buffer.writeUInt16BE(1, nameOffset + 8);
  buffer.writeUInt16BE(0x0409, nameOffset + 10);
  buffer.writeUInt16BE(16, nameOffset + 12);
  buffer.writeUInt16BE(text.length, nameOffset + 14);
  buffer.writeUInt16BE(0, nameOffset + 16);
  text.copy(buffer, nameOffset + 18);
  return buffer;
}

test('font parser uses the internal typographic family instead of the filename', () => {
  assert.equal(parseFontMetadata(minimalFont('Geoparody Heavy')).family, 'Geoparody Heavy');
});

test('font parser rejects files without a valid name table', () => {
  assert.throws(() => parseFontMetadata(Buffer.alloc(32)), /tabla de nombres/i);
});
