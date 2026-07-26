import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPublishPayload, captureControlState, jobRenderSignatures, localDateTimeToIso, restoreControlState} from '../public/js/editor-state.js';

function fakeRoot() {
  const document = {activeElement: null};
  const title = {
    id: 'meta-title', name: '', dataset: {}, type: 'text', value: 'Borrador', checked: false,
    selectionStart: 3, selectionEnd: 6,
    focus() { document.activeElement = this; },
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  };
  const platform = {id: '', name: 'publishPlatform', dataset: {}, type: 'checkbox', value: 'youtube', checked: false};
  const details = {id: 'advanced', dataset: {}, open: true};
  const video = {currentSrc: '/clip.mp4', currentTime: 17.5, paused: true, readyState: 1};
  document.activeElement = title;
  const root = {
    ownerDocument: document,
    querySelectorAll(selector) {
      if (selector === 'input, textarea, select') return [title, platform];
      if (selector === 'details') return [details];
      if (selector === 'video') return [video];
      return [];
    }
  };
  return {root, document, title, platform, details, video};
}

test('editor state preserves unsaved controls, focus, details and playback position', () => {
  const fixture = fakeRoot();
  const draft = captureControlState(fixture.root);
  fixture.title.value = 'Reemplazado';
  fixture.title.selectionStart = 0;
  fixture.platform.checked = true;
  fixture.details.open = false;
  fixture.video.currentTime = 0;

  restoreControlState(fixture.root, draft);

  assert.equal(fixture.title.value, 'Borrador');
  assert.equal(fixture.title.selectionStart, 3);
  assert.equal(fixture.title.selectionEnd, 6);
  assert.equal(fixture.platform.checked, false);
  assert.equal(fixture.details.open, true);
  assert.equal(fixture.video.currentTime, 17.5);
  assert.equal(fixture.document.activeElement, fixture.title);
});

test('publish payload captures scheduled time before metadata rerenders', () => {
  const localValue = '2030-04-05T16:30';
  const payload = buildPublishPayload({
    clipId: 'clip-1',
    platforms: ['youtube', 'instagram'],
    idempotencyKey: 'publish-1',
    scheduledFor: localValue
  });
  assert.equal(payload.scheduledFor, localDateTimeToIso(localValue));
  assert.equal(payload.confirm, true);
  assert.deepEqual(payload.platforms, ['youtube', 'instagram']);
  assert.throws(() => localDateTimeToIso('not-a-date'), /fecha programada/i);
  assert.throws(() => buildPublishPayload({clipId: 'clip-1', platforms: [], idempotencyKey: 'publish-1'}), /plataforma/i);
});

test('render signatures change only for the affected dashboard sections', () => {
  const base = {
    id: 'job-1', status: 'done', media: {width: 1920, height: 1080}, webcamBox: null,
    clips: [{id: 'clip-1', status: 'ready', renderedAt: 'a', files: {video: true}, publishing: {title: 'Uno'}}],
    publishingMetadata: {summary: {short: 'Resumen'}}, metrics: [], publishRuns: []
  };
  const before = jobRenderSignatures(base, 'clip-1');
  const metadataChanged = jobRenderSignatures({...base, publishingMetadata: {summary: {short: 'Nuevo'}}}, 'clip-1');
  assert.equal(metadataChanged.layout, before.layout);
  assert.equal(metadataChanged.clips, before.clips);
  assert.notEqual(metadataChanged.metadata, before.metadata);

  const webcamChanged = jobRenderSignatures({...base, webcamBox: {x: 10, y: 10, w: 200, h: 100}}, 'clip-1');
  assert.notEqual(webcamChanged.layout, before.layout);
});
