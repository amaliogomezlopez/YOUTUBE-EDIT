import {open, readFile, unlink} from 'node:fs/promises';

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

export async function acquireInstanceLock(file, {pid = process.pid} = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify({pid, startedAt: new Date().toISOString()})}\n`, 'utf8');
      await handle.close();
      let released = false;
      return async () => {
        if (released) return;
        released = true;
        const saved = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
        if (saved.pid === pid) await unlink(file).catch(() => {});
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const saved = JSON.parse(await readFile(file, 'utf8').catch(() => '{}'));
      if (processAlive(Number(saved.pid))) {
        const lockError = new Error(`Shortsmith ya está ejecutándose (PID ${saved.pid}).`);
        lockError.code = 'INSTANCE_ALREADY_RUNNING';
        throw lockError;
      }
      await unlink(file).catch(() => {});
    }
  }
  throw new Error('No se pudo adquirir el bloqueo de instancia de Shortsmith.');
}
