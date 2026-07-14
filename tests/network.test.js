import assert from 'node:assert/strict';
import test from 'node:test';
import {abortableSleep, fetchWithTimeout} from '../src/lib/network.js';

test('fetchWithTimeout aborts a hanging request with a typed timeout', async () => {
  await assert.rejects(fetchWithTimeout('https://example.invalid', {}, {
    timeoutMs: 10,
    fetchImpl: async (_url, {signal}) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}))
  }), (error) => error.name === 'TimeoutError' && error.retryable === true);
});

test('abortableSleep stops immediately when the parent signal is cancelled', async () => {
  const controller = new AbortController();
  const waiting = abortableSleep(10_000, controller.signal);
  controller.abort(new DOMException('cancelled', 'AbortError'));
  await assert.rejects(waiting, /cancelled/);
});
