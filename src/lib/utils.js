import {spawn} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const DATA_DIR = path.resolve(process.env.SHORTSMITH_DATA_DIR || path.join(ROOT, 'data'));
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const JOBS_DIR = path.join(DATA_DIR, 'jobs');
export const OUTPUT_DIR = path.join(DATA_DIR, 'output');
export const TMP_DIR = path.join(DATA_DIR, 'tmp');
export const CAROUSELS_DIR = path.join(DATA_DIR, 'carousels');
export const FONTS_DIR = path.join(DATA_DIR, 'fonts');

export async function ensureDir(dir) {
  await mkdir(dir, {recursive: true});
}

export async function ensureDataDirs() {
  await Promise.all([UPLOADS_DIR, JOBS_DIR, OUTPUT_DIR, TMP_DIR, CAROUSELS_DIR, FONTS_DIR].map(ensureDir));
}

export async function loadDotEnv(file = path.join(ROOT, '.env')) {
  if (!existsSync(file)) return;
  const externalEnv = new Set(Object.keys(process.env));
  const raw = await readFile(file, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, valueRaw] = match;
    if (externalEnv.has(key)) continue;
    const value = valueRaw.replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

export async function persistEnvValues(values, file = path.join(ROOT, '.env')) {
  const current = existsSync(file) ? await readFile(file, 'utf8') : '';
  const pending = new Map(Object.entries(values).filter(([, value]) => value !== undefined && value !== null && String(value).length));
  const lines = current.split(/\r?\n/).map((line) => {
    const key = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = String(pending.get(key));
    pending.delete(key);
    return `${key}=${JSON.stringify(value)}`;
  });
  for (const [key, value] of pending) lines.push(`${key}=${JSON.stringify(String(value))}`);
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${lines.join('\n').replace(/\n+$/g, '')}\n`, {encoding: 'utf8', mode: 0o600});
  await rename(temp, file);
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && String(value).length) process.env[key] = String(value);
  }
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function makeId(prefix = 'job') {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
}

export function sha1(input) {
  return createHash('sha1').update(input).digest('hex');
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function secondsToAssTime(seconds) {
  const totalCentis = Math.max(0, Math.round(seconds * 100));
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function secondsToSrtTime(seconds) {
  const totalMillis = Math.max(0, Math.round(seconds * 1000));
  const millis = totalMillis % 1000;
  const totalSeconds = Math.floor(totalMillis / 1000);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const spawnOptions = {
      cwd: options.cwd ?? ROOT,
      env: {...process.env, ...(options.env ?? {})},
      windowsHide: true
    };
    if (options.signal) spawnOptions.signal = options.signal;
    const child = spawn(command, args, spawnOptions);
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = Number(options.timeoutMs) > 0
      ? setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGKILL');
        const error = new Error(`${command} timed out after ${options.timeoutMs} ms`);
        error.code = 'ETIMEDOUT';
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }, Number(options.timeoutMs))
      : null;
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
      options.onStdout?.(chunk.toString());
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
      options.onStderr?.(chunk.toString());
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (code === 0) {
        resolve({stdout, stderr});
        return;
      }
      const error = new Error(`${command} exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

export function parseCliArgs(argv) {
  const args = {_: []};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export function safeFilename(name) {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}
