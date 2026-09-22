import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {extractJson} from './llm.js';

/**
 * Asks an installed agent CLI (Antigravity `agy`) for a single JSON answer.
 * The prompt goes through stdin (Windows caps arguments at 32k chars), the agent
 * runs in an empty temp folder in plan mode inside its sandbox, so it can read
 * the prompt but not touch the project.
 */
export function agyStreamMessage(prompt) {
  return JSON.stringify({event: 'user', message: {role: 'user', content: prompt}}) + '\n';
}

export function parseAgyResult(stdout) {
  const lines = String(stdout).split(/\r?\n/).filter((l) => l.startsWith('{'));
  const result = lines.map((l) => JSON.parse(l)).find((e) => e.event === 'result')?.result;
  if (!result) throw Error('agy no devolvio resultado');
  if (result.status !== 'SUCCESS') throw Error('agy: ' + (result.error || result.status));
  return {json: extractJson(result.response), usage: result.usage, seconds: result.duration_seconds};
}

export async function askAgy(prompt, {model = 'gemini-3.8-flash-medium', command = 'agy', timeoutSeconds = 300, spawnImpl = spawn} = {}) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'agy-'));
  try {
    const args = ['--input-format', 'stream-json', '--output-format', 'stream-json', '--model', model, '--mode', 'plan', '--sandbox',
      '--disable-slash-commands', '--print-timeout', `${timeoutSeconds}s`, '-p='];
    const stdout = await new Promise((resolve, reject) => {
      const child = spawnImpl(command, args, {cwd, windowsHide: true});
      let out = '', err = '';
      child.stdout.on('data', (c) => {out += c;});
      child.stderr.on('data', (c) => {err += c;});
      child.on('error', reject);
      child.on('close', (code) => (out.includes('"event":"result"') ? resolve(out) : reject(Error(`agy salio con ${code}: ${err.slice(-500)}`))));
      child.stdin.end(agyStreamMessage(prompt));
    });
    return parseAgyResult(stdout);
  } finally {
    await rm(cwd, {recursive: true, force: true});
  }
}
