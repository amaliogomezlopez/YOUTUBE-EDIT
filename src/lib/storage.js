import {readdir, rm, stat, statfs} from 'node:fs/promises';
import path from 'node:path';
import {DATA_DIR, JOBS_DIR, OUTPUT_DIR, TMP_DIR, UPLOADS_DIR} from './utils.js';

const GIB = 1024 ** 3;

export async function diskStatus(target = DATA_DIR) {
  const info = await statfs(target);
  const freeBytes = Number(info.bavail) * Number(info.bsize);
  const totalBytes = Number(info.blocks) * Number(info.bsize);
  return {freeBytes, totalBytes, usedBytes: Math.max(0, totalBytes - freeBytes), freePercent: totalBytes ? Math.round(freeBytes / totalBytes * 1000) / 10 : 0};
}

export async function assertDiskCapacity(requiredBytes, {target = DATA_DIR, reserveBytes = Number(process.env.SHORTSMITH_DISK_RESERVE_BYTES || 5 * GIB)} = {}) {
  const disk = await diskStatus(target);
  const required = Math.max(0, Number(requiredBytes) || 0);
  if (disk.freeBytes - required < reserveBytes) {
    const error = new Error(`Espacio insuficiente: se necesitan ${Math.ceil((required + reserveBytes) / GIB)} GB libres incluyendo la reserva de seguridad.`);
    error.code = 'INSUFFICIENT_STORAGE';
    error.status = 507;
    error.disk = disk;
    throw error;
  }
  return disk;
}

async function candidatesIn(directory, cutoff, {directories = false, exclude = new Set()} = {}) {
  const entries = await readdir(directory, {withFileTypes: true}).catch(() => []);
  const rows = [];
  for (const entry of entries) {
    if (entry.isDirectory() !== directories || exclude.has(entry.name) || entry.name === '.gitkeep') continue;
    const file = path.join(directory, entry.name);
    const info = await stat(file).catch(() => null);
    if (info && info.mtimeMs < cutoff) rows.push({path: file, name: entry.name, bytes: info.size, modifiedAt: info.mtime.toISOString(), directory: entry.isDirectory()});
  }
  return rows;
}

export async function cleanupStorage({
  dryRun = true,
  now = Date.now(),
  tempMaxAgeHours = Number(process.env.SHORTSMITH_TEMP_RETENTION_HOURS || 24),
  jobRetentionDays = Number(process.env.SHORTSMITH_JOB_RETENTION_DAYS || 0),
  activeJobIds = [],
  uploadDir = UPLOADS_DIR,
  tmpDir = TMP_DIR,
  jobsDir = JOBS_DIR,
  outputDir = OUTPUT_DIR
} = {}) {
  const candidates = [
    ...await candidatesIn(uploadDir, now - tempMaxAgeHours * 3600_000),
    ...await candidatesIn(tmpDir, now - tempMaxAgeHours * 3600_000)
  ];
  if (jobRetentionDays > 0) {
    const cutoff = now - jobRetentionDays * 86400_000;
    const exclude = new Set(activeJobIds);
    const jobs = await candidatesIn(jobsDir, cutoff, {directories: true, exclude});
    candidates.push(...jobs);
    for (const job of jobs) {
      const output = path.join(outputDir, job.name);
      const info = await stat(output).catch(() => null);
      if (info?.isDirectory()) candidates.push({path: output, name: job.name, bytes: info.size, modifiedAt: info.mtime.toISOString(), directory: true});
    }
  }
  if (!dryRun) await Promise.all(candidates.map((item) => rm(item.path, {recursive: item.directory, force: true})));
  return {
    dryRun,
    policy: {tempMaxAgeHours, jobRetentionDays},
    count: candidates.length,
    candidates: candidates.map((item) => ({name: item.name, kind: item.directory ? 'directory' : 'file', modifiedAt: item.modifiedAt}))
  };
}
