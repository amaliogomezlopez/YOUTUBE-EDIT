const form = document.querySelector('#job-form');
const statusEl = document.querySelector('#status');
const jobIdEl = document.querySelector('#job-id');
const summaryEl = document.querySelector('#summary');
const warningsEl = document.querySelector('#warnings');
const publishingEl = document.querySelector('#publishing');
const clipsEl = document.querySelector('#clips');

let pollTimer = null;
let currentJob = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function metric(label, value) {
  return `<div class="metric"><span class="eyebrow">${label}</span><strong>${value}</strong></div>`;
}

function renderJob(job) {
  currentJob = job;
  jobIdEl.textContent = job.id ? job.id : '';
  setStatus(job.status || 'Esperando');

  if (job.media) {
    summaryEl.innerHTML = [
      metric('Duración', `${Math.round(job.media.duration)}s`),
      metric('Fuente', `${job.media.width}x${job.media.height}`),
      metric('Transcript', `${job.transcript?.segments ?? 0}`),
      metric('Clips', `${job.clips?.filter((clip) => clip.files?.video).length ?? 0}`)
    ].join('');
  }
  warningsEl.innerHTML = (job.warnings || []).map((warning) => (
    `<div class="warning">${escapeHtml(warning)}</div>`
  )).join('');
  renderPublishingMetadata(job);

  if (job.error) {
    clipsEl.innerHTML = `<div class="empty">${job.error.message}</div>`;
    return;
  }

  const readyClips = (job.clips || []).filter((clip) => clip.files?.video);
  if (!readyClips.length) {
    clipsEl.innerHTML = `<div class="empty">El pipeline está trabajando. Los clips aparecerán aquí al terminar cada render.</div>`;
    return;
  }

  clipsEl.innerHTML = readyClips.map((clip) => `
    <article class="clip">
      <video controls preload="metadata" src="/api/jobs/${job.id}/clips/${clip.id}/video"></video>
      <div class="clip-body">
        <div class="clip-head">
          <h2>${escapeHtml(clip.suggestedTitle || clip.id)}</h2>
          <span class="score">${clip.viralScore}</span>
        </div>
        <p>${formatTime(clip.start)} - ${formatTime(clip.end)} · ${Math.round(clip.duration)}s</p>
        <div class="reasons">
          ${(clip.reasons || []).slice(0, 4).map((reason) => `<span class="pill">${escapeHtml(reason)}</span>`).join('')}
        </div>
      </div>
    </article>
  `).join('');
}

function renderPublishingMetadata(job) {
  const metadata = job?.publishingMetadata;
  if (!metadata) {
    publishingEl.innerHTML = '';
    return;
  }
  const youtube = metadata.platform_posts?.youtube ?? {};
  const socials = {
    instagram: metadata.platform_posts?.instagram ?? {},
    tiktok: metadata.platform_posts?.tiktok ?? {},
    x: metadata.platform_posts?.x ?? {}
  };
  const readyClips = (job.clips || []).filter((clip) => clip.files?.video);
  const lastRun = (job.publishRuns || []).at(-1);
  const platformRows = ['youtube', 'instagram', 'tiktok', 'x'].map((platform) => {
    const result = lastRun?.platforms?.[platform];
    return `<div class="platform-row"><strong>${platformLabel(platform)}</strong><span class="pill">${escapeHtml(result?.status || 'pending')}</span><small>${escapeHtml(result?.reason || result?.error || 'Listo para validar')}</small></div>`;
  }).join('');
  publishingEl.innerHTML = `
    <section class="publish-card">
      <div class="publish-head">
        <div>
          <span class="eyebrow">Metadata</span>
          <h2>Paquete para publicar</h2>
        </div>
        <span class="pill">${metadata.llmUsed ? 'LLM' : 'Fallback local'}</span>
      </div>
      <div class="publish-action">
        <label><span>Clip a publicar</span><select id="publish-clip">
          ${readyClips.map((clip) => `<option value="${escapeHtml(clip.id)}">${escapeHtml(`${clip.rank || ''} ${clip.suggestedTitle || clip.id}`.trim())}</option>`).join('')}
        </select></label>
        <div class="platform-checks">
          ${['youtube', 'instagram', 'tiktok', 'x'].map((platform) => `<label><input type="checkbox" name="publishPlatform" value="${platform}" checked><span>${platformLabel(platform)}</span></label>`).join('')}
        </div>
        <button id="publish-all" type="button" ${readyClips.length ? '' : 'disabled'}>Publicar en 4 plataformas</button>
      </div>
      <div class="publish-status">${platformRows}</div>
      <label><span>Resumen corto</span><textarea rows="3">${escapeHtml(metadata.summary?.short || '')}</textarea></label>
      <label><span>14 hashtags</span><textarea rows="2">${escapeHtml(metadata.hashtags || '')}</textarea></label>
      <label><span>Timestamps YouTube</span><textarea rows="6">${escapeHtml((metadata.timestamps || []).join('\n'))}</textarea></label>
      <label><span>Descripcion YouTube</span><textarea rows="7">${escapeHtml(youtube.description || '')}</textarea></label>
      <label><span>Instagram / TikTok / X</span><textarea rows="7">${escapeHtml(JSON.stringify(socials, null, 2))}</textarea></label>
    </section>
  `;
}

function platformLabel(platform) {
  return {youtube: 'YouTube Shorts', instagram: 'Instagram Reels', tiktok: 'TikTok', x: 'X'}[platform] || platform;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

async function pollJob(id) {
  const response = await fetch(`/api/jobs/${id}`);
  const job = await response.json();
  renderJob(job);
  if (!['done', 'failed'].includes(job.status)) {
    pollTimer = setTimeout(() => pollJob(id), 1800);
  } else {
    form.querySelector('button').disabled = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearTimeout(pollTimer);
  form.querySelector('button').disabled = true;
  setStatus('Subiendo');
  clipsEl.innerHTML = '';
  summaryEl.innerHTML = '';
  warningsEl.innerHTML = '';
  publishingEl.innerHTML = '';

  const data = new FormData(form);
  if (data.get('sourcePath')) {
    data.delete('video');
  }
  if (data.get('transcriptPath')) {
    data.delete('transcript');
  }
  const response = await fetch('/api/jobs', {
    method: 'POST',
    body: data
  });
  const payload = await response.json();
  if (!response.ok) {
    form.querySelector('button').disabled = false;
    setStatus('Error');
    clipsEl.innerHTML = `<div class="empty">${escapeHtml(payload.error || 'No se pudo crear el job')}</div>`;
    return;
  }
  pollJob(payload.id);
});

publishingEl.addEventListener('click', async (event) => {
  const button = event.target.closest('#publish-all');
  if (!button || !currentJob?.id) return;
  button.disabled = true;
  button.textContent = 'Validando publicación...';
  const platforms = [...publishingEl.querySelectorAll('input[name="publishPlatform"]:checked')].map((input) => input.value);
  const clipId = publishingEl.querySelector('#publish-clip')?.value;
  try {
    const response = await fetch(`/api/jobs/${currentJob.id}/publish`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({clipId, platforms})
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudo preparar la publicación.');
    await pollJob(currentJob.id);
  } catch (error) {
    warningsEl.innerHTML += `<div class="warning">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
    button.textContent = 'Publicar en 4 plataformas';
  }
});

const storyForm = document.querySelector('#story-form');
const storyPreview = document.querySelector('#story-preview');
const storyToolbar = document.querySelector('#story-toolbar');
const storyNote = document.querySelector('#story-note');
let currentStory = null;

async function renderStorySlides(story) {
  const data = new FormData(storyForm);
  const svgs = await Promise.all(story.slides.map(async (_, index) => {
    const response = await fetch('/api/stories/render', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({story, index, handle: data.get('handle')})});
    return response.text();
  }));
  storyPreview.innerHTML = svgs.map((svg, index) => `<article class="story-slide" data-index="${index}">${svg}<button class="download-story" type="button" data-index="${index}">PNG ${String(index + 1).padStart(2, '0')} ↓</button></article>`).join('');
  storyToolbar.innerHTML = `<strong>${escapeHtml(story.title)}</strong><span>${story.slides.length} piezas · ${story.llmUsed ? 'MiniMax M3' : 'Composición local'}</span>`;
  storyNote.textContent = story.warning || 'Secuencia generada. Descarga cada SVG; mantiene calidad perfecta a 1080 × 1920.';
}

storyForm.addEventListener('submit', async (event) => {
  event.preventDefault(); const button = storyForm.querySelector('button[type="submit"]'); button.disabled = true; button.textContent = 'Dirigiendo arte…';
  try {
    const data = new FormData(storyForm);
    const response = await fetch('/api/stories/plan', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({title: data.get('title'), source: data.get('source'), theme: data.get('theme'), useLlm: data.get('useLlm') === 'on'})});
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'No se pudo crear la historia.'); currentStory = payload; await renderStorySlides(payload);
  } catch (error) { storyNote.textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Diseñar historias →'; }
});

storyPreview.addEventListener('click', async (event) => {
  const button = event.target.closest('.download-story'); if (!button || !currentStory) return;
  const svg = button.closest('.story-slide').querySelector('svg').outerHTML; const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920; canvas.getContext('2d').drawImage(image, 0, 0, 1080, 1920); URL.revokeObjectURL(url);
  const pngUrl = canvas.toDataURL('image/png', 1); const link = document.createElement('a'); link.href = pngUrl; link.download = `story-${String(Number(button.dataset.index) + 1).padStart(2, '0')}.png`; link.click();
});
