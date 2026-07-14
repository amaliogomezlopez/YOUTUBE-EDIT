import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchTikTokPostStatus, mapTikTokPostStatus, pollTikTokPostStatus} from '../src/lib/publishers/tiktok.js';

test('tiktok official terminal and processing statuses map to Shortsmith states', () => {
  assert.deepEqual(
    ['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD', 'SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE', 'FAILED']
      .map((status) => mapTikTokPostStatus({status}).status),
    ['processing', 'processing', 'requires_manual_action', 'published', 'failed']
  );
});

test('tiktok status fetch uses official endpoint and maps completed posts', async () => {
  let request;
  const data = await fetchTikTokPostStatus({
    accessToken: 'token-test',
    publishId: 'publish-42',
    fetchImpl: async (url, options) => {
      request = {url, options};
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {status: 'PUBLISH_COMPLETE', publicaly_available_post_id: ['123']},
          error: {code: 'ok'}
        })
      };
    }
  });
  assert.equal(request.url, 'https://open.tiktokapis.com/v2/post/publish/status/fetch/');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.authorization, 'Bearer token-test');
  assert.deepEqual(JSON.parse(request.options.body), {publish_id: 'publish-42'});
  assert.equal(mapTikTokPostStatus(data).status, 'published');
  assert.deepEqual(mapTikTokPostStatus(data).postIds, ['123']);
});

test('tiktok status polling backs off until inbox delivery', async () => {
  const statuses = ['PROCESSING_UPLOAD', 'PROCESSING_UPLOAD', 'SEND_TO_USER_INBOX'];
  const waits = [];
  let clock = 0;
  const result = await pollTikTokPostStatus({
    accessToken: 'token',
    publishId: 'publish',
    fetchStatus: async () => ({status: statuses.shift()}),
    timeoutMs: 10_000,
    initialDelayMs: 100,
    backoffFactor: 2,
    maxDelayMs: 500,
    now: () => clock,
    sleep: async (ms) => { waits.push(ms); clock += ms; }
  });
  assert.equal(result.status, 'requires_manual_action');
  assert.equal(result.tiktokStatus, 'SEND_TO_USER_INBOX');
  assert.equal(result.polls, 3);
  assert.deepEqual(waits, [100, 200]);
});

test('tiktok status polling returns processing on timeout and retries transient errors', async () => {
  let clock = 0;
  let calls = 0;
  const result = await pollTikTokPostStatus({
    accessToken: 'token',
    publishId: 'publish',
    timeoutMs: 250,
    initialDelayMs: 100,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    fetchStatus: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('rate limited');
        error.retryable = true;
        throw error;
      }
      return {status: 'PROCESSING_UPLOAD', uploaded_bytes: 50};
    }
  });
  assert.equal(result.status, 'processing');
  assert.equal(result.timedOut, true);
  assert.equal(result.uploadedBytes, 50);
  assert.ok(calls >= 2);
});

test('tiktok status polling is cancellable during backoff', async () => {
  const controller = new AbortController();
  const polling = pollTikTokPostStatus({
    accessToken: 'token',
    publishId: 'publish',
    timeoutMs: 10_000,
    initialDelayMs: 1000,
    fetchStatus: async () => ({status: 'PROCESSING_UPLOAD'}),
    sleep: async (_ms, signal) => {
      controller.abort();
      signal.throwIfAborted();
    },
    signal: controller.signal
  });
  await assert.rejects(polling, /aborted|abort|cancel/i);
});

test('tiktok terminal failure preserves official fail reason', async () => {
  const result = await pollTikTokPostStatus({
    accessToken: 'token',
    publishId: 'publish',
    fetchStatus: async () => ({status: 'FAILED', fail_reason: 'duration_check_failed'})
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.failReason, 'duration_check_failed');
  assert.equal(result.timedOut, false);
});

test('tiktok status fetch marks 429 responses retryable without exposing token', async () => {
  await assert.rejects(
    fetchTikTokPostStatus({
      accessToken: 'secret-token',
      publishId: 'publish',
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({error: {code: 'rate_limit_exceeded', message: 'Too many requests'}})
      })
    }),
    (error) => error.retryable === true && error.code === 'rate_limit_exceeded' && !error.message.includes('secret-token')
  );
});

test('tiktok status fetch converts request timeout into a retryable error', async () => {
  await assert.rejects(
    fetchTikTokPostStatus({
      accessToken: 'token',
      publishId: 'publish',
      requestTimeoutMs: 5,
      fetchImpl: async (_url, {signal}) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), {once: true});
      })
    }),
    (error) => error.retryable === true && /timed out/i.test(error.message)
  );
});
