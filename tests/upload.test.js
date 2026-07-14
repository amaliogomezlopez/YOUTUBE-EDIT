import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {parseMultipartUpload} from '../src/lib/upload.js';

function multipartRequest(parts, boundary = 'shortsmith-test-boundary') {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ''}\r\n${part.type ? `Content-Type: ${part.type}\r\n` : ''}\r\n`));
    chunks.push(Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value));
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);
  const request = Readable.from(Array.from({length: Math.ceil(body.length / 7)}, (_, index) => body.subarray(index * 7, (index + 1) * 7)));
  request.headers = {'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(body.length)};
  return request;
}

test('multipart upload streams files to disk and preserves fields', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-upload-'));
  try {
    const request = multipartRequest([
      {name: 'sourcePath', value: ''},
      {name: 'topN', value: '5'},
      {name: 'video', filename: '../../private.mp4', type: 'video/mp4', value: Buffer.from('video-bytes')},
      {name: 'transcript', filename: 'captions.srt', type: 'text/plain', value: Buffer.from('captions')}
    ]);
    const result = await parseMultipartUpload(request, {uploadDir: dir, maxVideoBytes: 1024, maxTranscriptBytes: 1024});
    assert.equal(result.fields.topN, '5');
    assert.equal(await readFile(result.files.video.path, 'utf8'), 'video-bytes');
    assert.equal(path.dirname(result.files.video.path), dir);
    assert.doesNotMatch(path.basename(result.files.video.path), /private/);
    await result.cleanup();
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('multipart upload rejects oversized declared bodies before parsing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-upload-limit-'));
  try {
    const request = multipartRequest([{name: 'video', filename: 'large.mp4', value: Buffer.alloc(64)}]);
    await assert.rejects(() => parseMultipartUpload(request, {uploadDir: dir, maxVideoBytes: 8, maxTranscriptBytes: 8}), /límite|grande/i);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
