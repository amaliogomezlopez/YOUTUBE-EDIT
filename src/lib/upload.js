import {createWriteStream} from 'node:fs';
import {mkdir, unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import Busboy from 'busboy';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
const TRANSCRIPT_EXTENSIONS = new Set(['.srt', '.vtt', '.json', '.txt']);

function extensionFor(field, filename, config) {
  const extension = path.extname(String(filename || '')).toLowerCase();
  const allowed = config?.extensions ?? (field === 'video' ? VIDEO_EXTENSIONS : TRANSCRIPT_EXTENSIONS);
  const fallback = config?.fallbackExtension ?? (field === 'video' ? '.mp4' : '.txt');
  return allowed.has(extension) ? extension : fallback;
}

async function removeFiles(files) {
  await Promise.allSettled(files.map((file) => unlink(file.path)));
}

export async function parseMultipartUpload(req, options = {}) {
  const uploadDir = options.uploadDir;
  if (!uploadDir) throw new Error('uploadDir is required.');
  const maxVideoBytes = Number(options.maxVideoBytes ?? 20 * 1024 * 1024 * 1024);
  const maxTranscriptBytes = Number(options.maxTranscriptBytes ?? 20 * 1024 * 1024);
  const fileFields = options.fileFields ?? {
    video: {extensions: VIDEO_EXTENSIONS, fallbackExtension: '.mp4', maxBytes: maxVideoBytes, label: 'El vídeo'},
    transcript: {extensions: TRANSCRIPT_EXTENSIONS, fallbackExtension: '.txt', maxBytes: maxTranscriptBytes, label: 'La transcripción'}
  };
  const acceptedFields = Object.keys(fileFields);
  if (!acceptedFields.length) throw new Error('At least one multipart file field is required.');
  const declaredLimit = Object.values(fileFields).reduce((total, config) => total + Number(config.maxBytes || 0), 0);
  const declared = Number(req.headers?.['content-length'] || 0);
  if (declared && declared > declaredLimit + 2 * 1024 * 1024) {
    throw new Error(`Upload demasiado grande. Límite de archivos: ${Math.round(declaredLimit / 1024 / 1024)} MB.`);
  }
  await mkdir(uploadDir, {recursive: true});
  const fields = {};
  const files = {};
  const created = [];
  const writes = [];
  let settled = false;

  return new Promise((resolve, reject) => {
    const fail = async (error) => {
      if (settled) return;
      settled = true;
      req.unpipe?.(parser);
      parser.destroy?.();
      await removeFiles(created);
      reject(error);
    };
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {fieldNameSize: 80, fieldSize: 2 * 1024 * 1024, fields: 20, files: Number(options.maxFiles || acceptedFields.length), parts: 24, headerPairs: 100}
      });
    } catch (error) {
      reject(new Error(`Multipart inválido: ${error.message}`));
      return;
    }

    parser.on('field', (name, value, info) => {
      if (info.valueTruncated) return void fail(new Error(`El campo ${name} supera el límite permitido.`));
      fields[name] = value;
    });
    parser.on('file', (name, stream, info) => {
      const config = fileFields[name];
      if (!config) {
        stream.resume();
        return;
      }
      if (files[name]) {
        stream.resume();
        return void fail(new Error(`Solo se admite un archivo para ${name}.`));
      }
      const maxBytes = Number(config.maxBytes || 0);
      const safeField = /^[a-z0-9_-]{1,40}$/i.test(name) ? name : 'file';
      const filename = `${safeField}-${Date.now()}-${randomUUID()}${extensionFor(name, info.filename, config)}`;
      const destination = path.join(uploadDir, filename);
      const record = {field: name, path: destination, originalName: path.basename(info.filename || filename), mimeType: info.mimeType, size: 0, temporary: true};
      created.push(record);
      files[name] = record;
      const output = createWriteStream(destination, {flags: 'wx'});
      const completion = new Promise((resolveWrite, rejectWrite) => {
        let limited = false;
        stream.on('data', (chunk) => {
          record.size += chunk.length;
          if (record.size > maxBytes && !limited) {
            limited = true;
            stream.unpipe(output);
            output.destroy();
            fail(new Error(`${config.label || `El archivo ${name}`} supera el límite permitido.`));
          }
        });
        stream.on('limit', () => {
          limited = true;
          fail(new Error(`${config.label || `El archivo ${name}`} supera el límite permitido.`));
        });
        stream.on('error', rejectWrite);
        output.on('error', rejectWrite);
        output.on('finish', () => limited ? undefined : resolveWrite());
      });
      writes.push(completion);
      stream.pipe(output);
    });
    parser.on('filesLimit', () => fail(new Error('Demasiados archivos en la petición.')));
    parser.on('fieldsLimit', () => fail(new Error('Demasiados campos en la petición.')));
    parser.on('partsLimit', () => fail(new Error('Demasiadas partes multipart.')));
    parser.on('error', (error) => fail(new Error(`Multipart inválido: ${error.message}`)));
    req.on?.('aborted', () => fail(new Error('Upload cancelado por el cliente.')));
    parser.on('close', async () => {
      if (settled) return;
      try {
        await Promise.all(writes);
        settled = true;
        resolve({fields, files, cleanup: () => removeFiles(created)});
      } catch (error) {
        await fail(error);
      }
    });
    req.pipe(parser);
  });
}
