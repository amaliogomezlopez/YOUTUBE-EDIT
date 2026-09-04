function controlKey(control, index) {
  const identity = control.id || control.name || control.dataset?.captionControl || `control-${index}`;
  const choice = ['checkbox', 'radio'].includes(control.type) ? `:${control.value}` : '';
  return `${identity}${choice}`;
}

function videoKey(video, index) {
  return video.currentSrc || video.getAttribute?.('src') || `video-${index}`;
}

export function captureControlState(root) {
  if (!root?.querySelectorAll) return null;
  const nodes = [...root.querySelectorAll('input, textarea, select')];
  const controls = nodes.map((control, index) => ({
    key: controlKey(control, index),
    value: control.value,
    checked: Boolean(control.checked),
    selectionStart: Number.isInteger(control.selectionStart) ? control.selectionStart : null,
    selectionEnd: Number.isInteger(control.selectionEnd) ? control.selectionEnd : null
  }));
  const details = [...root.querySelectorAll('details')].map((detail, index) => ({
    key: detail.id || detail.dataset?.draftKey || `details-${index}`,
    open: Boolean(detail.open)
  }));
  const videos = [...root.querySelectorAll('video')].map((video, index) => ({
    key: videoKey(video, index),
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    paused: video.paused !== false
  }));
  const active = root.ownerDocument?.activeElement;
  const activeIndex = nodes.indexOf(active);
  return {controls, details, videos, activeKey: activeIndex >= 0 ? controls[activeIndex].key : null};
}

export function restoreControlState(root, draft) {
  if (!root?.querySelectorAll || !draft) return;
  const controls = [...root.querySelectorAll('input, textarea, select')];
  const byKey = new Map((draft.controls || []).map((entry) => [entry.key, entry]));
  controls.forEach((control, index) => {
    const saved = byKey.get(controlKey(control, index));
    if (!saved) return;
    if (['checkbox', 'radio'].includes(control.type)) control.checked = saved.checked;
    else control.value = saved.value;
    if (draft.activeKey === saved.key && typeof control.focus === 'function') {
      control.focus({preventScroll: true});
      if (saved.selectionStart !== null && typeof control.setSelectionRange === 'function') {
        control.setSelectionRange(saved.selectionStart, saved.selectionEnd ?? saved.selectionStart);
      }
    }
  });
  const detailState = new Map((draft.details || []).map((entry) => [entry.key, entry.open]));
  [...root.querySelectorAll('details')].forEach((detail, index) => {
    const key = detail.id || detail.dataset?.draftKey || `details-${index}`;
    if (detailState.has(key)) detail.open = detailState.get(key);
  });
  const videoState = new Map((draft.videos || []).map((entry) => [entry.key, entry]));
  [...root.querySelectorAll('video')].forEach((video, index) => {
    const saved = videoState.get(videoKey(video, index));
    if (!saved || saved.currentTime <= 0) return;
    const restore = () => {
      try {
        video.currentTime = saved.currentTime;
        if (!saved.paused) video.play?.().catch?.(() => {});
      } catch {}
    };
    if (video.readyState >= 1) restore();
    else video.addEventListener?.('loadedmetadata', restore, {once: true});
  });
}

export function localDateTimeToIso(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const time = new Date(normalized).getTime();
  if (!Number.isFinite(time)) throw new Error('La fecha programada no es válida.');
  return new Date(time).toISOString();
}

export function buildPublishPayload({clipId, platforms, idempotencyKey, scheduledFor}) {
  if (!clipId) throw new Error('Selecciona el clip que quieres publicar.');
  if (!Array.isArray(platforms) || !platforms.length) throw new Error('Selecciona al menos una plataforma.');
  if (!idempotencyKey) throw new Error('Vuelve a abrir la revisión antes de publicar.');
  return {
    clipId,
    platforms: [...platforms],
    confirm: true,
    idempotencyKey,
    scheduledFor: localDateTimeToIso(scheduledFor)
  };
}

export function jobRenderSignatures(job, selectedClipId) {
  const clips = (job.clips || []).map((clip) => ({
    id: clip.id,
    start: clip.start,
    end: clip.end,
    status: clip.status,
    renderedAt: clip.renderedAt,
    editorialStatus: clip.editorialStatus,
    renderError: clip.renderError,
    renderQueue: clip.renderQueue,
    renderSettings: clip.renderSettings,
    editing: clip.editing,
    transcript: clip.transcript,
    qa: clip.qa,
    hasVideo: Boolean(clip.files?.video),
    publishing: clip.publishing
  }));
  return {
    header: JSON.stringify([job.id, job.status, job.media, job.transcript, job.warnings, clips.filter((clip) => clip.hasVideo).length]),
    layout: JSON.stringify([job.id, job.media, job.webcamBox]),
    clips: JSON.stringify([job.id, job.status, job.error, clips]),
    metadata: JSON.stringify([
      job.id,
      selectedClipId,
      job.publishingMetadata,
      job.metrics,
      job.publishQueue,
      job.publishRuns,
      clips.map(({id, status, editorialStatus, hasVideo, publishing}) => ({id, status, editorialStatus, hasVideo, publishing}))
    ])
  };
}
