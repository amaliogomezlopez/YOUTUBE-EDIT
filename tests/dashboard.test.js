import test from 'node:test';
import assert from 'node:assert/strict';
import {jobSummary, mergeClipPublishingEdits, mergePublishingEdits, publicJobState} from '../src/lib/dashboard.js';

test('metadata edits keep the contract and normalize hashtags', () => {
  const result = mergePublishingEdits({summary: {short: 'Anterior'}, platform_posts: {}}, {
    summary: {short: ' Nuevo resumen '},
    hashtags: '#Uno #Dos',
    timestamps: '00:00 Inicio\n01:20 Tema',
    platform_posts: {x: {text: 'x'.repeat(400)}}
  });
  assert.equal(result.summary.short, 'Nuevo resumen');
  assert.equal(result.hashtags.split(' ').length, 14);
  assert.deepEqual(result.timestamps, ['00:00 Inicio', '01:20 Tema']);
  assert.equal(result.platform_posts.x.text.length, 280);
});

test('public job state removes paths, queue payloads and remote session URLs', () => {
  const result = publicJobState({
    id: 'job-1', status: 'done', sourceVideo: 'D:\\private\\video.mp4', jobDir: 'D:\\private',
    clips: [{id: 'clip-1', files: {video: 'D:\\private\\clip.mp4'}}],
    publishRuns: [{id: 'run-1', platforms: {youtube: {status: 'uploading', asset: 'D:\\private\\clip.mp4', remote: {uploadUrl: 'https://secret-session', bytesUploaded: 10, videoId: 'abc'}}}}]
  }, {queue: {id: 'q1', status: 'running', payload: {secret: true}}});
  assert.equal(result.sourceName, 'video.mp4');
  assert.equal(result.clips[0].files.video, true);
  assert.equal('sourceVideo' in result, false);
  assert.equal('payload' in result.queue, false);
  assert.equal('uploadUrl' in result.publishRuns[0].platforms.youtube.remote, false);
  assert.equal(result.publishRuns[0].platforms.youtube.remote.videoId, 'abc');
});

test('metadata edits reject chapters without a zero timestamp', () => {
  assert.throws(() => mergePublishingEdits({}, {timestamps: ['00:12 Tema']}), /00:00/);
});

test('clip publishing edits only accept known fields', () => {
  const result = mergeClipPublishingEdits({instagram: {caption: 'Antes'}}, {
    title: ' Título final ',
    instagram: {caption: 'Después'},
    secret: 'ignored'
  });
  assert.equal(result.title, 'Título final');
  assert.equal(result.instagram.caption, 'Después');
  assert.equal('secret' in result, false);
});

test('job summary does not expose local paths', () => {
  const result = jobSummary({
    id: 'job-1',
    status: 'done',
    sourceVideo: 'D:\\private\\video.mp4',
    clips: [{files: {video: 'D:\\private\\short.mp4'}}]
  });
  assert.equal(result.sourceName, 'video.mp4');
  assert.equal('sourceVideo' in result, false);
  assert.equal('jobDir' in result, false);
});
