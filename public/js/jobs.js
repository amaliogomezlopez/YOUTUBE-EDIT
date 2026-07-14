import {$, $$, api, escapeHtml, formatTime, platformLabel, uploadForm} from './core.js';
import {collectRerenderEdits, readyClips, renderClips, renderLayoutEditor, syncPipOverlay} from './clips.js';
import {metadataPayload, renderMetadata, selectedPlatforms} from './metadata.js';
import {store} from './store.js';

const TERMINAL = new Set(['done', 'failed', 'cancelled']);

function statusLabel(status) {
  return {
    queued: 'En cola', running: 'Iniciando', probing: 'Analizando vídeo', 'detecting-webcam': 'Detectando cámara',
    transcribing: 'Transcribiendo', 'generating-metadata': 'Preparando metadata', scoring: 'Seleccionando clips',
    rendering: 'Renderizando clips', done: 'Listo para revisar', failed: 'Necesita atención',
    cancel_requested: 'Cancelando', cancelling: 'Cancelando', cancelled: 'Cancelado'
  }[status] || status || 'Esperando vídeo';
}

export function initJobs() {
  const form = $('#job-form');
  const elements = {
    status: $('#status'), jobId: $('#job-id'), summary: $('#summary'), warnings: $('#warnings'), clips: $('#clips'),
    layout: $('#layout-editor'), publishing: $('#publishing'), workspace: $('#metadata-workspace'),
    saveMetadata: $('#save-metadata'), reviewPublish: $('#review-publish'), metadataNote: $('#metadata-action-note'),
    confirmation: $('#publish-confirmation'), confirmationSummary: $('#publish-confirmation-summary'),
    confirmPublish: $('#confirm-publish'), history: $('#job-history'), refreshHistory: $('#refresh-job-history'),
    cancelJob: $('#cancel-job'), retryJob: $('#retry-job'), uploadProgress: $('#upload-progress'),
    storageSummary: $('#storage-summary'), storagePreview: $('#storage-cleanup-preview'),
    previewCleanup: $('#preview-cleanup'), runCleanup: $('#run-cleanup')
  };

  const showWarning = (message, type = 'warning') => {
    const node = document.createElement('div');
    node.className = `warning is-${type}`;
    node.setAttribute('role', type === 'error' ? 'alert' : 'status');
    node.textContent = message;
    elements.warnings.append(node);
  };

  const setStatus = (status) => {
    elements.status.textContent = statusLabel(status);
    elements.status.dataset.status = status || 'idle';
  };

  const metric = (label, value) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;

  const renderJob = (job) => {
    store.setJob(job);
    elements.jobId.textContent = job.id || '';
    setStatus(job.status);
    elements.summary.innerHTML = job.media ? [
      metric('Duración', formatTime(job.media.duration)), metric('Fuente', `${job.media.width} × ${job.media.height}`),
      metric('Segmentos', job.transcript?.segments ?? 0), metric('Clips listos', readyClips(job).length)
    ].join('') : '';
    elements.warnings.innerHTML = '';
    (job.warnings || []).forEach((warning) => showWarning(warning));
    renderLayoutEditor(job, elements.layout);
    renderClips(job, elements.clips);
    renderMetadata(job, {container: elements.publishing, saveButton: elements.saveMetadata, reviewButton: elements.reviewPublish, note: elements.metadataNote});
    elements.workspace.hidden = false;
    const busy = !TERMINAL.has(job.status) || (job.clips || []).some((clip) => ['queued', 'running', 'cancelling'].includes(clip.renderQueue?.status));
    elements.cancelJob.disabled = !busy;
    elements.cancelJob.textContent = 'Cancelar proceso';
    elements.retryJob.hidden = !['failed', 'cancelled'].includes(job.status);
    form.querySelector('button[type="submit"]').disabled = busy;
  };

  const loadHistory = async () => {
    elements.refreshHistory.disabled = true;
    try {
      const {jobs} = await api('/api/jobs?limit=40', {timeout: 10_000});
      elements.history.innerHTML = jobs.length ? jobs.map((job) => `<article class="history-row"><div><strong>${escapeHtml(job.sourceName)}</strong><span>${escapeHtml(new Intl.DateTimeFormat('es-ES', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(job.createdAt)))}</span></div><div class="history-meta"><span class="status-chip is-${escapeHtml(job.status)}">${escapeHtml(statusLabel(job.status))}</span><span>${job.clipsReady} clips</span></div><button type="button" class="secondary-action compact" data-open-job="${escapeHtml(job.id)}">Abrir proyecto</button></article>`).join('')
        : '<div class="empty-state compact-empty"><span class="empty-index">00</span><div><strong>Todavía no hay proyectos</strong><p>El primer procesamiento aparecerá aquí automáticamente.</p></div></div>';
    } catch (error) {
      elements.history.innerHTML = `<div class="empty-state compact-empty"><div><strong>No se pudo cargar el historial</strong><p>${escapeHtml(error.message)}</p><button type="button" class="secondary-action compact" data-retry-history>Reintentar</button></div></div>`;
    } finally {
      elements.refreshHistory.disabled = false;
    }
  };

  const loadStorage = async () => {
    try {
      const data = await api('/api/storage', {timeout: 15_000});
      const freeGb = (data.disk.freeBytes / 1024 ** 3).toFixed(1);
      elements.storageSummary.textContent = `${freeGb} GB libres (${data.disk.freePercent}%). La limpieza automática solo afecta temporales antiguos; los proyectos requieren una retención configurada.`;
      elements.storagePreview.textContent = data.cleanup.count
        ? `${data.cleanup.count} elementos cumplen la política actual.`
        : 'No hay archivos pendientes de limpieza.';
      elements.runCleanup.disabled = data.cleanup.count === 0;
    } catch (error) {
      elements.storageSummary.textContent = `No se pudo consultar el almacenamiento: ${error.message}`;
    }
  };

  const pollJob = async (id) => {
    store.clearPolling();
    const tick = async () => {
      try {
        const job = await api(`/api/jobs/${encodeURIComponent(id)}`, {timeout: 15_000});
        renderJob(job);
        const rerendering = (job.clips || []).some((clip) => ['queued', 'running', 'cancelling'].includes(clip.renderQueue?.status));
        const publishing = ['queued', 'running', 'cancelling'].includes(job.publishQueue?.status);
        const pollDelay = job.publishQueue?.status === 'queued' && job.publishQueue?.runAfter
          && Date.parse(job.publishQueue.runAfter) > Date.now() + 10_000 ? 15_000 : 1400;
        if (!TERMINAL.has(job.status) || rerendering || publishing) store.pollTimer = setTimeout(tick, pollDelay);
        else await loadHistory();
      } catch (error) {
        setStatus('Conexión interrumpida');
        showWarning(error.message, 'error');
        store.pollTimer = setTimeout(tick, 4000);
      }
    };
    await tick();
  };

  const saveMetadata = async () => {
    if (!store.job?.id) return;
    elements.saveMetadata.disabled = true;
    elements.saveMetadata.textContent = 'Guardando…';
    try {
      const updated = await api(`/api/jobs/${encodeURIComponent(store.job.id)}/metadata`, {
        method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify(metadataPayload(elements.publishing))
      });
      updated.queue = store.job.queue;
      renderJob(updated);
      elements.metadataNote.textContent = 'Cambios guardados. La publicación usará este paquete.';
    } finally {
      elements.saveMetadata.disabled = false;
      elements.saveMetadata.textContent = 'Guardar metadata';
    }
  };

  const openPublishReview = () => {
    const platforms = selectedPlatforms(elements.publishing);
    if (!platforms.length) return showWarning('Selecciona al menos una plataforma.', 'error');
    const clip = readyClips(store.job).find((item) => item.id === store.selectedClipId);
    elements.confirmationSummary.innerHTML = `<p><strong>${escapeHtml(clip?.publishing?.title || clip?.suggestedTitle || 'Clip seleccionado')}</strong></p><p>${platforms.map(platformLabel).map(escapeHtml).join(' · ')}</p><p>Shortsmith guardará primero la metadata. Las plataformas sin permisos quedarán como acción manual.</p>`;
    store.publishKey = crypto.randomUUID();
    elements.confirmation.hidden = false;
    elements.confirmation.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest'});
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    store.clearPolling();
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    if (Number(data.get('minDuration')) > Number(data.get('maxDuration'))) return showWarning('La duración mínima no puede superar la máxima.', 'error');
    const video = data.get('video');
    if (!data.get('sourcePath') && (!video || !video.size)) return showWarning('Selecciona un vídeo o indica una ruta local.', 'error');
    if (data.get('sourcePath')) data.delete('video');
    if (data.get('transcriptPath')) data.delete('transcript');
    submit.disabled = true;
    elements.cancelJob.disabled = false;
    elements.uploadProgress.hidden = !video?.size || Boolean(data.get('sourcePath'));
    elements.uploadProgress.value = 0;
    setStatus('Subiendo 0%');
    elements.warnings.innerHTML = '';
    store.uploadController = new AbortController();
    try {
      const job = await uploadForm('/api/jobs', data, {
        signal: store.uploadController.signal,
        onProgress: ({percent}) => {
          elements.uploadProgress.value = percent;
          setStatus(`Subiendo ${percent}%`);
        }
      });
      elements.uploadProgress.hidden = true;
      store.uploadController = null;
      store.selectedClipId = null;
      await pollJob(job.id);
    } catch (error) {
      setStatus(error.code === 'ABORTED' ? 'Cancelado' : 'Error');
      showWarning(error.message, error.code === 'ABORTED' ? 'warning' : 'error');
      submit.disabled = false;
      elements.cancelJob.disabled = true;
      elements.uploadProgress.hidden = true;
      store.uploadController = null;
    }
  });

  elements.cancelJob.addEventListener('click', async () => {
    if (store.uploadController) {
      store.uploadController.abort();
      return;
    }
    if (!store.job?.id) return;
    elements.cancelJob.disabled = true;
    elements.cancelJob.textContent = 'Cancelando…';
    try {
      await api(`/api/jobs/${encodeURIComponent(store.job.id)}/cancel`, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
      await pollJob(store.job.id);
    } catch (error) {
      showWarning(error.message, 'error');
    }
  });

  elements.retryJob.addEventListener('click', async () => {
    elements.retryJob.disabled = true;
    try {
      await api(`/api/jobs/${encodeURIComponent(store.job.id)}/retry`, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
      elements.retryJob.hidden = true;
      await pollJob(store.job.id);
    } catch (error) {
      showWarning(error.message, 'error');
      elements.retryJob.disabled = false;
    }
  });

  elements.layout.addEventListener('input', () => syncPipOverlay(elements.layout));
  elements.clips.addEventListener('click', async (event) => {
    const article = event.target.closest('[data-clip-id]');
    if (!article || !store.job) return;
    const clipId = article.dataset.clipId;
    try {
      const decision = event.target.closest('[data-clip-action]')?.dataset.clipAction;
      if (decision) {
        await api(`/api/jobs/${encodeURIComponent(store.job.id)}/clips/${encodeURIComponent(clipId)}`, {method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify({editorialStatus: decision})});
        await pollJob(store.job.id);
        return;
      }
      if (event.target.closest('[data-rerender-clip]')) {
        const edits = collectRerenderEdits(article, elements.layout);
        await api(`/api/jobs/${encodeURIComponent(store.job.id)}/clips/${encodeURIComponent(clipId)}/rerender`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(edits)});
        await pollJob(store.job.id);
        return;
      }
      const cancelRender = event.target.closest('[data-cancel-render]')?.dataset.cancelRender;
      if (cancelRender) {
        await api(`/api/queue/${encodeURIComponent(cancelRender)}/cancel`, {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'});
        await pollJob(store.job.id);
      }
    } catch (error) {
      showWarning(error.message, 'error');
    }
  });

  elements.publishing.addEventListener('change', (event) => {
    if (event.target.id === 'publish-clip') {
      store.selectedClipId = event.target.value;
      renderMetadata(store.job, {container: elements.publishing, saveButton: elements.saveMetadata, reviewButton: elements.reviewPublish, note: elements.metadataNote});
    }
    if (event.target.id === 'metric-platform') {
      const metric = (store.job?.metrics || []).find((item) => item.clipId === store.selectedClipId && item.platform === event.target.value) || {};
      for (const field of ['views', 'likes', 'comments', 'shares']) {
        const input = $(`#metric-${field}`);
        if (input) input.value = Number(metric[field] || 0);
      }
    }
  });
  elements.publishing.addEventListener('input', (event) => {
    if (event.target.id === 'meta-x') $('#x-count').textContent = event.target.value.length;
  });
  elements.publishing.addEventListener('click', async (event) => {
    const saveMetrics = event.target.closest('[data-save-metrics]');
    if (saveMetrics) {
      saveMetrics.disabled = true;
      try {
        await api(`/api/jobs/${encodeURIComponent(store.job.id)}/metrics`, {
          method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify({
            clipId: store.selectedClipId,
            platform: $('#metric-platform').value,
            views: $('#metric-views').value,
            likes: $('#metric-likes').value,
            comments: $('#metric-comments').value,
            shares: $('#metric-shares').value
          })
        });
        elements.metadataNote.textContent = 'Métricas guardadas. Se usarán para comparar el rendimiento editorial de los clips.';
        await pollJob(store.job.id);
      } catch (error) {
        showWarning(error.message, 'error');
        saveMetrics.disabled = false;
      }
      return;
    }
    const cancel = event.target.closest('[data-cancel-publish-queue]');
    const retry = event.target.closest('[data-retry-publish-queue]');
    if (!cancel && !retry) return;
    const queueId = store.job?.publishQueue?.id;
    if (!queueId) return showWarning('No se encontró la operación de publicación.', 'error');
    const action = cancel ? 'cancel' : 'retry';
    event.target.disabled = true;
    try {
      await api(`/api/publishing-queue/${encodeURIComponent(queueId)}/${action}`, {method: 'POST'});
      await pollJob(store.job.id);
    } catch (error) {
      showWarning(error.message, 'error');
      event.target.disabled = false;
    }
  });
  elements.saveMetadata.addEventListener('click', () => saveMetadata().catch((error) => showWarning(error.message, 'error')));
  elements.reviewPublish.addEventListener('click', openPublishReview);
  $('#cancel-publish').addEventListener('click', () => { elements.confirmation.hidden = true; });
  elements.confirmPublish.addEventListener('click', async () => {
    elements.confirmPublish.disabled = true;
    elements.confirmPublish.textContent = 'Publicando…';
    const platforms = selectedPlatforms(elements.publishing);
    try {
      await saveMetadata();
      await api(`/api/jobs/${encodeURIComponent(store.job.id)}/publish`, {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          clipId: store.selectedClipId,
          platforms,
          confirm: true,
          idempotencyKey: store.publishKey,
          scheduledFor: $('#publish-scheduled-for')?.value ? new Date($('#publish-scheduled-for').value).toISOString() : null
        }), timeout: 20_000
      });
      elements.confirmation.hidden = true;
      elements.metadataNote.textContent = 'Publicación añadida a la cola. Puedes cerrar el navegador; el servidor continuará el trabajo.';
      await pollJob(store.job.id);
    } catch (error) {
      showWarning(error.message, 'error');
    } finally {
      elements.confirmPublish.disabled = false;
      elements.confirmPublish.textContent = 'Confirmar y publicar';
    }
  });

  elements.refreshHistory.addEventListener('click', loadHistory);
  elements.previewCleanup.addEventListener('click', loadStorage);
  elements.runCleanup.addEventListener('click', async () => {
    if (!confirm('Se eliminarán únicamente temporales y proyectos que cumplan la política configurada. ¿Continuar?')) return;
    elements.runCleanup.disabled = true;
    try {
      const result = await api('/api/storage/cleanup', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({confirm: true})});
      elements.storagePreview.textContent = `Limpieza terminada: ${result.count} elementos eliminados.`;
      await loadStorage();
    } catch (error) {
      showWarning(error.message, 'error');
      elements.runCleanup.disabled = false;
    }
  });
  elements.history.addEventListener('click', async (event) => {
    if (event.target.closest('[data-retry-history]')) return loadHistory();
    const button = event.target.closest('[data-open-job]');
    if (!button) return;
    location.hash = '#production-view';
    store.selectedClipId = null;
    await pollJob(button.dataset.openJob);
  });

  async function loadSystemStatus() {
    const list = $('#system-status-list');
    try {
      const state = await api('/api/system/status', {timeout: 8000});
      const rows = [
        ['Servidor local', true, `${state.app.runningJobs} procesos activos, ${state.app.queue?.counts?.queued || 0} en cola`],
        ['Almacenamiento', state.storage?.freePercent >= 10, state.storage ? `${state.storage.freePercent}% libre` : 'No disponible'],
        ['Transcripción', state.transcription.configured, state.transcription.configured ? state.transcription.provider : 'Usa transcript o configura STT'],
        ['IA editorial', state.llm.configured, state.llm.configured ? `${state.llm.provider} · ${state.llm.model}` : 'Fallback local disponible'],
        ...Object.entries(state.publishing).map(([platform, ready]) => [platformLabel(platform), ready, ready ? 'Cuenta preparada' : 'Requiere conexión'])
      ];
      list.innerHTML = rows.map(([label, ready, detail]) => `<li><span class="status-dot ${ready ? 'is-ready' : ''}" aria-hidden="true"></span><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></span></li>`).join('');
    } catch (error) {
      list.innerHTML = `<li><span class="status-dot"></span><span><strong>Servidor no disponible</strong><small>${escapeHtml(error.message)}</small></span></li>`;
    }
  }

  function activateView(hash = location.hash) {
    const target = ['#production-view', '#library-view', '#stories-view'].includes(hash) ? hash : '#production-view';
    $$('.view-section').forEach((view) => { view.hidden = `#${view.id}` !== target; });
    $$('.nav-item').forEach((item) => {
      const active = item.getAttribute('href') === target;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
    });
    if (target === '#library-view') loadHistory();
  }

  window.addEventListener('hashchange', () => activateView());
  activateView();
  loadSystemStatus();
  loadHistory();
  loadStorage();
}
