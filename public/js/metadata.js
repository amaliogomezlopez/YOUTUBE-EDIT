import {$, $$, escapeHtml, platformLabel} from './core.js';
import {readyClips} from './clips.js';
import {store} from './store.js';
import {restoreControlState} from './editor-state.js';

export function renderMetadata(job, elements, {draft = null} = {}) {
  const {container, saveButton, reviewButton, note} = elements;
  const metadata = job.publishingMetadata;
  const clips = readyClips(job).filter((clip) => clip.editorialStatus !== 'discarded');
  if (!metadata || !clips.length) {
    container.innerHTML = '<div class="empty-state compact-empty"><div><strong>Metadata pendiente</strong><p>Aparecerá cuando exista un clip no descartado.</p></div></div>';
    saveButton.disabled = true;
    reviewButton.disabled = true;
    return;
  }
  if (!clips.some((clip) => clip.id === store.selectedClipId)) store.selectedClipId = clips[0].id;
  const clip = clips.find((item) => item.id === store.selectedClipId);
  const publishing = clip.publishing || {};
  const metric = (job.metrics || []).find((item) => item.clipId === clip.id) || {};
  const lastRun = (job.publishRuns || []).at(-1);
  const queueStatus = job.publishQueue?.status;
  const statusRows = ['youtube', 'instagram', 'tiktok', 'x'].map((platform) => {
    const result = lastRun?.platforms?.[platform];
    const progress = Number(result?.progress?.percent ?? result?.percent);
    return `<div class="platform-row"><div><strong>${platformLabel(platform)}</strong><span class="status-chip is-${escapeHtml(result?.status || 'pending')}">${escapeHtml(result?.status || 'Sin publicar')}</span></div>
      ${Number.isFinite(progress) ? `<progress max="100" value="${progress}" aria-label="Progreso ${platformLabel(platform)}"></progress>` : ''}
      <small>${escapeHtml(result?.reason || result?.error || (queueStatus ? `Cola: ${queueStatus}` : 'Se validará antes de publicar'))}</small></div>`;
  }).join('');
  const queueActions = ['queued', 'running', 'cancelling'].includes(queueStatus)
    ? '<button type="button" class="secondary-action compact" data-cancel-publish-queue>Cancelar publicación</button>'
    : ['failed', 'cancelled'].includes(queueStatus)
      ? '<button type="button" class="secondary-action compact" data-retry-publish-queue>Reintentar publicación</button>'
      : '';
  container.innerHTML = `<div class="metadata-grid">
      <label><span>Clip que vas a preparar</span><select id="publish-clip" name="publishClip" autocomplete="off">${clips.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === store.selectedClipId ? 'selected' : ''}>${escapeHtml(`${item.rank || ''} · ${item.suggestedTitle || item.id}`)}</option>`).join('')}</select></label>
      <label><span>Título del Short</span><input id="meta-clip-title" name="clipTitle" maxlength="100" autocomplete="off" value="${escapeHtml(publishing.title || clip.suggestedTitle || '')}"><small class="field-help">Máximo 100 caracteres.</small></label>
      <label class="span-2"><span>Resumen corto</span><textarea id="meta-summary" name="summary" rows="3" autocomplete="off">${escapeHtml(metadata.summary?.short || '')}</textarea></label>
      <label class="span-2"><span>14 hashtags</span><textarea id="meta-hashtags" name="hashtags" rows="2" autocomplete="off">${escapeHtml(publishing.hashtags || metadata.hashtags || '')}</textarea></label>
      <label><span>Timestamps YouTube</span><textarea id="meta-timestamps" name="timestamps" rows="7" autocomplete="off">${escapeHtml((metadata.timestamps || []).join('\n'))}</textarea></label>
      <label><span>Descripción YouTube Shorts</span><textarea id="meta-youtube" name="youtubeDescription" rows="7" autocomplete="off">${escapeHtml(publishing.youtube_shorts?.description || '')}</textarea></label>
      <label><span>Caption Instagram</span><textarea id="meta-instagram" name="instagramCaption" rows="7" autocomplete="off">${escapeHtml(publishing.instagram?.caption || '')}</textarea></label>
      <label><span>Caption TikTok</span><textarea id="meta-tiktok" name="tiktokCaption" rows="7" autocomplete="off">${escapeHtml(publishing.tiktok?.caption || '')}</textarea></label>
      <label class="span-2"><span>Texto para X</span><textarea id="meta-x" name="xText" maxlength="280" rows="4" autocomplete="off">${escapeHtml(publishing.x?.text || '')}</textarea><small class="field-help"><span id="x-count">${String(publishing.x?.text || '').length}</span>/280 caracteres</small></label>
      <label class="span-2"><span>Programar publicación (opcional)</span><input id="publish-scheduled-for" name="scheduledFor" type="datetime-local" autocomplete="off"><small class="field-help">La cola local publicará a esta hora aunque cierres el navegador; Shortsmith debe estar ejecutándose.</small></label>
    </div>
    <fieldset class="platform-selector"><legend>Plataformas de esta publicación</legend>${['youtube', 'instagram', 'tiktok', 'x'].map((platform) => `<label><input type="checkbox" name="publishPlatform" value="${platform}" ${platform === 'x' ? '' : 'checked'}><span>${platformLabel(platform)}</span></label>`).join('')}</fieldset>
    <div class="publish-status">${statusRows}</div>${queueActions ? `<div class="publication-queue-actions">${queueActions}</div>` : ''}
    <details class="metrics-editor"><summary>Registrar rendimiento del clip</summary><div class="metrics-grid">
      <label><span>Plataforma</span><select id="metric-platform">${['youtube', 'instagram', 'tiktok', 'x'].map((platform) => `<option value="${platform}" ${metric.platform === platform ? 'selected' : ''}>${platformLabel(platform)}</option>`).join('')}</select></label>
      ${['views', 'likes', 'comments', 'shares'].map((field) => `<label><span>${{views: 'Visualizaciones', likes: 'Me gusta', comments: 'Comentarios', shares: 'Compartidos'}[field]}</span><input id="metric-${field}" type="number" min="0" step="1" value="${Number(metric[field] || 0)}"></label>`).join('')}
      <button type="button" class="secondary-action compact" data-save-metrics>Guardar métricas</button>
    </div></details>`;
  saveButton.disabled = false;
  reviewButton.disabled = false;
  note.textContent = 'Edita el paquete, guárdalo y revisa exactamente qué plataformas recibirán el clip.';
  restoreControlState(container, draft);
}

export function metadataPayload(root = document) {
  return {
    clipId: store.selectedClipId,
    metadata: {
      summary: {short: $('#meta-summary', root)?.value || ''},
      hashtags: $('#meta-hashtags', root)?.value || '',
      timestamps: $('#meta-timestamps', root)?.value || ''
    },
    clipPublishing: {
      title: $('#meta-clip-title', root)?.value || '',
      hashtags: $('#meta-hashtags', root)?.value || '',
      youtube_shorts: {description: $('#meta-youtube', root)?.value || ''},
      instagram: {caption: $('#meta-instagram', root)?.value || ''},
      tiktok: {caption: $('#meta-tiktok', root)?.value || ''},
      x: {text: $('#meta-x', root)?.value || ''}
    }
  };
}

export function selectedPlatforms(root = document) {
  return $$('input[name="publishPlatform"]:checked', root).map((input) => input.value);
}
