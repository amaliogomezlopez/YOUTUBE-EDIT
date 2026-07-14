import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {persistEnvValues} from '../src/lib/utils.js';

test('persistEnvValues replaces and appends values without printing them', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-env-'));
  const file = path.join(dir, '.env');
  try {
    await writeFile(file, 'KEEP=value\nTOKEN=old\n', 'utf8');
    await persistEnvValues({TOKEN: 'new secret', SECOND: 'another'}, file);
    const saved = await readFile(file, 'utf8');
    assert.match(saved, /^KEEP=value/m);
    assert.match(saved, /^TOKEN="new secret"$/m);
    assert.match(saved, /^SECOND="another"$/m);
    assert.equal(process.env.TOKEN, 'new secret');
  } finally {
    delete process.env.TOKEN;
    delete process.env.SECOND;
    await rm(dir, {recursive: true, force: true});
  }
});
