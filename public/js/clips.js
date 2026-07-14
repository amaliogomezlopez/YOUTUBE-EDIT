import {$, escapeHtml, formatTime} from './core.js';

export function readyClips(job) {
  return (job?.clips || []).filter((clip) => clip.files?.video);
}

function decisionButtons(clip) {
  return `<div class="clip-decisions" role="group" aria-label="Decisión editorial">
    <button type="button" class="secondary-action compact ${clip.editorialStatus === 'accepted' ? 'is-selected' : ''}" data-clip-action="accepted">Aceptar clip</button>
    <button type="button" class="secondary-action compact ${clip.editorialStatus === 'discarded' ? 'is-selected' : ''}" data-clip-action="discarded">Descartar clip</button>
  </div>`;
}

export function renderClips(job, container) {
  const clips = readyClips(job);
  if (job.error) {
    container.innerHTML = `<div class="empty-state"><span class="empty-index">!</span><div><strong>El proceso se detuvo</strong><p>${escapeHtml(job.error.message)}</p></div></div>`;
    return;
  }
  if (!clips.length) {
    const terminal = ['done', 'failed', 'cancelled'].includes(job.status);
    container.innerHTML = `<div class="empty-state"><span class="empty-index">02</span><div><strong>${terminal ? 'No hay clips disponibles' : 'Procesamiento en curso'}</strong><p>${terminal ? 'Reintenta el trabajo o revisa la transcripción.' : 'Los clips aparecerán aquí a medida que termine cada render.'}</p></div></div>`;
    return;
  }
  container.innerHTML = clips.map((clip) => {
    const renderBusy = ['queued', 'running', 'cancelling'].includes(clip.renderQueue?.status);
    return `<article class="clip" data-clip-id="${escapeHtml(clip.id)}">
      <video controls preload="metadata" src="/api/jobs/${encodeURIComponent(job.id)}/clips/${encodeURIComponent(clip.id)}/video?v=${encodeURIComponent(clip.renderedAt || '')}"></video>
      <div class="clip-body">
        <div class="clip-head"><h3>${escapeHtml(clip.suggestedTitle || clip.id)}</h3><span class="score" aria-label="Puntuación ${escapeHtml(clip.viralScore)} de 100">${escapeHtml(clip.viralScore)}</span></div>
        <p>${formatTime(clip.start)} a ${formatTime(clip.end)} · ${Math.round(clip.duration)} s</p>
        <div class="reasons">${(clip.reasons || []).slice(0, 4).map((reason) => `<span class="pill">${escapeHtml(reason)}</span>`).join('')}</div>
        ${clip.critique ? `<p class="clip-critique">${escapeHtml(clip.critique)}</p>` : ''}
        <details class="clip-editor" ${renderBusy || clip.status === 'render_failed' ? 'open' : ''}>
          <summary>Editar corte y render</summary>
          <div class="clip-editor-grid">
            <label><span>Entrada (s)</span><input name="clipStart" type="number" min="0" max="${job.media?.duration || 0}" step="0.1" value="${Number(clip.start).toFixed(1)}"></label>
            <label><span>Salida (s)</span><input name="clipEnd" type="number" min="1" max="${job.media?.duration || 0}" step="0.1" value="${Number(clip.end).toFixed(1)}"></label>
            <label><span>Composición</span><select name="clipRenderMode"><option value="fit" ${job.renderMode === 'fit' ? 'selected' : ''}>Pantalla completa</option><option value="crop" ${job.renderMode === 'crop' ? 'selected' : ''}>Crop vertical</option><option value="pip" ${job.renderMode === 'pip' ? 'selected' : ''}>Webcam + pantalla</option></select></label>
            <label><span>Calidad</span><select name="clipQuality"><option value="draft">Borrador</option><option value="standard">Estándar</option><option value="high" selected>Alta</option></select></label>
          </div>
          <div class="clip-editor-actions">
            <span class="render-state">${escapeHtml(renderBusy ? `Render ${clip.renderQueue.status}` : clip.renderError || '')}</span>
            ${renderBusy ? `<button type="button" class="secondary-action compact" data-cancel-render="${escapeHtml(clip.renderQueueId)}">Cancelar render</button>` : `<button type="button" class="primary-action compact" data-rerender-clip>Volver a renderizar</button>`}
          </div>
        </details>
        ${decisionButtons(clip)}
      </div>
    </article>`;
  }).join('');
}

function boxPercent(job) {
  const box = job.webcamBox;
  if (!box || !job.media?.width || !job.media?.height) return {x: 70, y: 5, w: 26, h: 34};
  return {
    x: Number(((box.x / job.media.width) * 100).toFixed(1)),
    y: Number(((box.y / job.media.height) * 100).toFixed(1)),
    w: Number(((box.w / job.media.width) * 100).toFixed(1)),
    h: Number(((box.h / job.media.height) * 100).toFixed(1))
  };
}

export function renderLayoutEditor(job, container) {
  if (!job.media || job.media.width <= job.media.height) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const box = boxPercent(job);
  container.hidden = false;
  container.innerHTML = `<div class="layout-preview">
      <video controls preload="metadata" src="/api/jobs/${encodeURIComponent(job.id)}/source/video"></video>
      <div id="pip-box-preview" class="pip-box-preview" aria-hidden="true"></div>
    </div>
    <div class="layout-controls">
      <div><h3>Composición webcam + pantalla</h3><p>Ajusta la caja sobre el vídeo fuente. Los valores se aplican al próximo rerender PIP.</p></div>
      <div class="pip-fields">
        ${[['pip-x', 'X', box.x], ['pip-y', 'Y', box.y], ['pip-w', 'Ancho', box.w], ['pip-h', 'Alto', box.h]].map(([id, label, value]) => `<label><span>${label} %</span><input id="${id}" type="number" min="0" max="100" step="0.5" value="${value}"></label>`).join('')}
      </div>
      <p class="field-help">Detección actual: ${escapeHtml(job.webcamBox?.method || 'sin webcam estable')}, confianza ${Math.round((job.webcamBox?.confidence || 0) * 100)}%.</p>
    </div>`;
  syncPipOverlay(container);
}

export function syncPipOverlay(root = document) {
  const overlay = $('#pip-box-preview', root);
  if (!overlay) return;
  const number = (id, fallback) => Math.max(0, Math.min(100, Number($(`#${id}`, root)?.value) || fallback));
  const x = number('pip-x', 70);
  const y = number('pip-y', 5);
  const w = Math.min(number('pip-w', 26), 100 - x);
  const h = Math.min(number('pip-h', 34), 100 - y);
  Object.assign(overlay.style, {left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`});
}

export function collectRerenderEdits(article, layoutRoot) {
  const start = Number($('[name="clipStart"]', article).value);
  const end = Number($('[name="clipEnd"]', article).value);
  const renderMode = $('[name="clipRenderMode"]', article).value;
  const value = (id) => Number($(`#${id}`, layoutRoot)?.value) / 100;
  return {
    start,
    end,
    renderMode,
    renderQuality: $('[name="clipQuality"]', article).value,
    subtitleMode: 'words',
    ...(renderMode === 'pip' ? {webcamBox: {x: value('pip-x'), y: value('pip-y'), w: value('pip-w'), h: value('pip-h'), normalized: true}} : {})
  };
}
