import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {
  initiateYoutubeResumableUpload,
  publishToYoutube,
  uploadYoutubeVideo
} from '../src/lib/publishers/youtube.js';

function mockResponse({status, headers = {}, payload = {}, text = ''}) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: (name) => normalized.get(name.toLowerCase()) ?? null},
    json: async () => payload,
    text: async () => text
  };
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test('youtube resumable init sends metadata and retries transient failures', async () => {
  const calls = [];
  const delays = [];
  const uploadUrl = await initiateYoutubeResumableUpload({
    accessToken: 'secret-token',
    metadata: {snippet: {title: 'Video'}},
    videoSize: 1234,
    options: {
      retries: 1,
      sleep: async (delay) => delays.push(delay),
      fetch: async (url, options) => {
        calls.push({url, options});
        return calls.length === 1
          ? mockResponse({status: 503, text: 'busy'})
          : mockResponse({status: 200, headers: {location: 'https://upload.youtube.test/session'}});
      }
    }
  });

  assert.equal(uploadUrl, 'https://upload.youtube.test/session');
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /uploadType=resumable/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-token');
  assert.equal(calls[0].options.headers['x-upload-content-length'], '1234');
  assert.equal(calls[0].options.headers['x-upload-content-type'], 'video/mp4');
  assert.deepEqual(JSON.parse(calls[0].options.body), {snippet: {title: 'Video'}});
  assert.equal(delays.length, 1);
  assert.ok(delays[0] >= 500);
});

test('youtube uploader streams sequential chunks and reports acknowledged progress', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-stream-'));
  try {
    const chunkBytes = 256 * 1024;
    const contents = Buffer.alloc(chunkBytes + 3, 97);
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, contents);
    const calls = [];
    const progress = [];

    const payload = await uploadYoutubeVideo('https://upload.youtube.test/session', videoFile, contents.length, {
      chunkBytes,
      retries: 0,
      onProgress: (event) => progress.push(event),
      fetch: async (url, options) => {
        assert.equal(url, 'https://upload.youtube.test/session');
        assert.equal(options.duplex, 'half');
        assert.equal(Buffer.isBuffer(options.body), false);
        calls.push({
          range: options.headers['content-range'],
          length: options.headers['content-length'],
          body: await readStream(options.body)
        });
        return calls.length === 1
          ? mockResponse({status: 308, headers: {range: `bytes=0-${chunkBytes - 1}`}})
          : mockResponse({status: 200, payload: {id: 'youtube-1'}});
      }
    });

    assert.deepEqual(payload, {id: 'youtube-1'});
    assert.deepEqual(calls.map((call) => call.range), [
      `bytes 0-${chunkBytes - 1}/${contents.length}`,
      `bytes ${chunkBytes}-${contents.length - 1}/${contents.length}`
    ]);
    assert.equal(calls[0].body.length, chunkBytes);
    assert.equal(calls[1].body.length, 3);
    assert.deepEqual(progress.map((event) => event.bytesUploaded), [0, chunkBytes, contents.length]);
    assert.equal(progress.at(-1).percent, 100);
    assert.equal(progress.at(-1).phase, 'uploaded');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('youtube uploader queries acknowledged offset after network failure and resumes there', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-resume-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'abcdefghijklmnopqrst');
    const calls = [];
    let uploadAttempts = 0;
    const payload = await uploadYoutubeVideo('https://upload.youtube.test/session', videoFile, 20, {
      chunkBytes: 256 * 1024,
      retries: 2,
      sleep: async () => {},
      fetch: async (url, options) => {
        calls.push(options.headers['content-range']);
        if (options.headers['content-length'] === '0') {
          return mockResponse({status: 308, headers: {range: 'bytes=0-9'}});
        }
        uploadAttempts += 1;
        if (uploadAttempts === 1) throw new Error('socket reset');
        const body = await readStream(options.body);
        assert.equal(body.toString(), 'klmnopqrst');
        return mockResponse({status: 201, payload: {id: 'resumed-video'}});
      }
    });

    assert.deepEqual(payload, {id: 'resumed-video'});
    assert.deepEqual(calls, ['bytes 0-19/20', 'bytes */20', 'bytes 10-19/20']);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('youtube publisher wires token, session, disk size and upload result', async () => {
  const keys = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = `${key}-test`;
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-publish-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToYoutube({
      videoFile,
      metadata: {
        summary: {youtube_description: 'Descripcion'},
        titles: {youtube_shorts: [{title: 'Titulo'}]},
        platform_posts: {youtube_shorts: {title: 'Titulo', description: 'Descripcion', tags: ['#shorts']}}
      },
      options: {
        refreshAccessToken: async () => ({access_token: 'access-token'}),
        initiateUpload: async ({accessToken, metadata, videoSize}) => {
          assert.equal(accessToken, 'access-token');
          assert.equal(metadata.snippet.title, 'Titulo');
          assert.deepEqual(metadata.snippet.tags, ['shorts']);
          assert.equal(videoSize, 10);
          return 'https://upload.youtube.test/session';
        },
        uploadVideo: async (url, file, size) => {
          assert.equal(url, 'https://upload.youtube.test/session');
          assert.equal(file, videoFile);
          assert.equal(size, 10);
          return {id: 'published-video'};
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoId, 'published-video');
    assert.equal(result.url, 'https://www.youtube.com/watch?v=published-video');
    assert.match(result.officialApi, /resumable upload/);
  } finally {
    await rm(dir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('youtube uploader does not retry a permanent API error', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-error-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'video');
    let calls = 0;
    await assert.rejects(
      uploadYoutubeVideo('https://upload.youtube.test/session', videoFile, 5, {
        chunkBytes: 256 * 1024,
        retries: 5,
        sleep: async () => assert.fail('permanent errors must not back off'),
        fetch: async () => {
          calls += 1;
          return mockResponse({
            status: 400,
            payload: {error: {message: 'Invalid metadata', errors: [{reason: 'invalidVideoMetadata'}]}}
          });
        }
      }),
      (error) => {
        assert.equal(error.message, 'Invalid metadata');
        assert.deepEqual(error.details, ['invalidVideoMetadata']);
        return true;
      }
    );
    assert.equal(calls, 1);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('youtube progress callback failures do not invalidate a completed upload', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-progress-error-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'video');
    const payload = await uploadYoutubeVideo('https://upload.youtube.test/session', videoFile, 5, {
      chunkBytes: 256 * 1024,
      retries: 0,
      onProgress: async () => {
        throw new Error('observer unavailable');
      },
      fetch: async (url, options) => {
        await readStream(options.body);
        return mockResponse({status: 200, payload: {id: 'video-without-observer'}});
      }
    });
    assert.equal(payload.id, 'video-without-observer');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('youtube publisher rejects a completed response without videoId', async () => {
  const keys = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = `${key}-test`;
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-no-id-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToYoutube({
      videoFile,
      metadata: {summary: {}, titles: {}, platform_posts: {youtube_shorts: {title: 'Titulo'}}},
      options: {
        refreshAccessToken: async () => ({access_token: 'access-token'}),
        initiateUpload: async () => 'https://upload.youtube.test/session?upload_id=secret-session',
        uploadVideo: async () => ({})
      }
    });
    assert.equal(result.status, 'failed');
    assert.match(result.error, /sin devolver un videoId/);
    assert.doesNotMatch(result.error, /secret-session|access-token/);
  } finally {
    await rm(dir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});


test('youtube publisher resumes a persisted session without creating another upload', async () => {
  const keys = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = `${key}-test`;
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-persisted-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, '0123456789');
    const remoteUpdates = [];
    const result = await publishToYoutube({
      videoFile,
      metadata: {summary: {}, titles: {}, platform_posts: {youtube_shorts: {title: 'Titulo'}}},
      options: {
        resumeState: {uploadUrl: 'https://upload.youtube.test/existing', bytesUploaded: 5, videoSize: 10},
        refreshAccessToken: async () => ({access_token: 'token'}),
        initiateUpload: async () => assert.fail('must reuse persisted session'),
        uploadVideo: async (url, _file, size, options) => {
          assert.equal(url, 'https://upload.youtube.test/existing');
          assert.equal(size, 10);
          assert.equal(options.startOffset, 5);
          await options.onProgress({bytesUploaded: 10, totalBytes: 10, percent: 100, phase: 'uploaded'});
          return {id: 'resumed-id'};
        },
        onRemoteState: async (state) => remoteUpdates.push(state)
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoId, 'resumed-id');
    assert.equal(remoteUpdates.at(-1).remote.videoId, 'resumed-id');
  } finally {
    await rm(dir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});

test('youtube uploader recovers a completed persisted session without sending the file again', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-complete-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, 'complete');
    const calls = [];
    const payload = await uploadYoutubeVideo('https://upload.youtube.test/completed', videoFile, 8, {
      startOffset: 8,
      chunkBytes: 256 * 1024,
      retries: 0,
      fetch: async (_url, options) => {
        calls.push(options);
        assert.equal(options.headers['content-range'], 'bytes */8');
        assert.equal(options.headers['content-length'], '0');
        return mockResponse({status: 200, payload: {id: 'already-complete'}});
      }
    });
    assert.deepEqual(payload, {id: 'already-complete'});
    assert.equal(calls.length, 1);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('youtube publisher replaces an expired persisted session exactly once', async () => {
  const keys = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = `${key}-test`;
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-youtube-expired-'));
  try {
    const videoFile = path.join(dir, 'short.mp4');
    await writeFile(videoFile, '0123456789');
    const uploads = [];
    const remoteUpdates = [];
    let initiations = 0;
    const result = await publishToYoutube({
      videoFile,
      metadata: {summary: {}, titles: {}, platform_posts: {youtube_shorts: {title: 'Titulo'}}},
      options: {
        resumeState: {uploadUrl: 'https://upload.youtube.test/expired', bytesUploaded: 5},
        refreshAccessToken: async () => ({access_token: 'token'}),
        initiateUpload: async () => {
          initiations += 1;
          return 'https://upload.youtube.test/replacement';
        },
        uploadVideo: async (url, _file, _size, options) => {
          uploads.push({url, startOffset: options.startOffset});
          if (url.endsWith('/expired')) {
            const error = new Error('session expired');
            error.status = 410;
            throw error;
          }
          return {id: 'replacement-id'};
        },
        onRemoteState: async (state) => remoteUpdates.push(state)
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(initiations, 1);
    assert.deepEqual(uploads, [
      {url: 'https://upload.youtube.test/expired', startOffset: 5},
      {url: 'https://upload.youtube.test/replacement', startOffset: 0}
    ]);
    assert.equal(remoteUpdates.some((state) => state.phase === 'session-replaced'), true);
  } finally {
    await rm(dir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
});
