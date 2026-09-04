import {$, escapeHtml, formatTime} from './core.js';
import {editingControls, collectEditing} from './short-editing.js';
import {captionPreviewMarkup, wireCaptionStudios} from './caption-studio.js';
import {restoreControlState} from './editor-state.js';
import {CAPTION_PRESETS} from './caption-presets.js';

export function readyClips(job) {
  return (job?.clips || []).filter((clip) => clip.files?.video);
}

function wordCase(text, line, style) {
  if (line?.case === 'lower') return text.toLocaleLowerCase('es-ES');
  if (line?.case === 'upper' || style?.uppercase) return text.toLocaleUpperCase('es-ES');
  return text;
}

export function paintCaptionOverlay(overlay, plan, time) {
  if (!overlay || !plan?.pages?.length) return;
  const page = plan.pages.find((item) => time >= item.start && time < item.end);
  if (!page) {
    overlay.replaceChildren();
    return;
  }
  overlay.style.fontFamily = `"${String(plan.style?.font || 'Schibsted Grotesk').replace(/["\\]/g, '')}", Arial, sans-serif`;
  overlay.style.color = plan.style?.primary || '#fff';
  overlay.dataset.position = plan.style?.position || 'safe-lower';
  const anchorY = page.lines[0]?.y ?? plan.style?.anchorY;
  if (Number.isFinite(anchorY)) {
    overlay.style.top = `${(anchorY / 1920) * 100}%`;
    overlay.style.bottom = 'auto';
    overlay.style.transform = 'translateY(-50%)';
  }
  overlay.replaceChildren(...page.lines.map((line) => {
    const row = document.createElement('div');
    row.className = 'clip-caption-line';
    line.words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = wordCase(word.text, line, plan.style);
      const active = time >= word.start && time < (line.words[index + 1]?.start ?? word.end + 0.05);
      const future = time < word.start;
      span.className = active ? 'is-active' : (future ? 'is-future' : 'is-spoken');
      if (plan.style?.activeColor && active) span.style.color = plan.style.activeColor;
      if (index) row.append(' ');
      row.append(span);
    });
    return row;
  }));
}

function wireCaptionOverlays(container) {
  for (const article of container.querySelectorAll('[data-clip-id]')) {
    const video = article.querySelector('.clip-media video');
    const overlay = article.querySelector('[data-caption-overlay]');
    const node = article.querySelector('[data-caption-overlay-json]');
    if (!video || !overlay || !node) continue;
    let plan = null;
    try { plan = JSON.parse(node.value || node.textContent || 'null'); } catch { plan = null; }
    if (!plan?.pages) continue;
    const paint = () => paintCaptionOverlay(overlay, plan, video.currentTime || 0);
    video.addEventListener('timeupdate', paint);
    video.addEventListener('seeked', paint);
    paint();
  }
}

function decisionButtons(clip) {
  return `<div class="clip-decisions" role="group" aria-label="Decisión editorial">
    <button type="button" class="secondary-action compact ${clip.editorialStatus === 'accepted' ? 'is-selected' : ''}" data-clip-action="accepted">Aceptar clip</button>
    <button type="button" class="secondary-action compact ${clip.editorialStatus === 'discarded' ? 'is-selected' : ''}" data-clip-action="discarded">Descartar clip</button>
  </div>`;
}

function syncClipsToolbar(total, shown) {
  const toolbar = document.getElementById('clips-toolbar');
  if (!toolbar) return;
  toolbar.hidden = total === 0;
  const count = document.getElementById('clips-count');
  if (count) count.textContent = total ? (shown === total ? `${total} clips` : `${shown} de ${total} clips`) : '';
}

function visibleClips(clips) {
  const filter = document.getElementById('clips-filter')?.value || 'all';
  const sort = document.getElementById('clips-sort')?.value || 'score';
  let visible = clips;
  if (filter === 'pending') visible = visible.filter((clip) => !clip.editorialStatus);
  else if (filter !== 'all') visible = visible.filter((clip) => clip.editorialStatus === filter);
  if (sort === 'duration') visible = [...visible].sort((a, b) => (Number(b.duration) || 0) - (Number(a.duration) || 0));
  else if (sort === 'timeline') visible = [...visible].sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0));
  else visible = [...visible].sort((a, b) => (Number(b.viralScore) || 0) - (Number(a.viralScore) || 0));
  return visible;
}

export function renderClips(job, container, {drafts = {}} = {}) {
  const clips = readyClips(job);
  if (job.error) {
    syncClipsToolbar(0, 0);
    container.innerHTML = `<div class="empty-state"><span class="empty-index">!</span><div><strong>El proceso se detuvo</strong><p>${escapeHtml(job.error.message)}</p></div></div>`;
    return;
  }
  if (!clips.length) {
    syncClipsToolbar(0, 0);
    const terminal = ['done', 'failed', 'cancelled'].includes(job.status);
    container.innerHTML = `<div class="empty-state"><span class="empty-index">02</span><div><strong>${terminal ? 'No hay clips disponibles' : 'Procesamiento en curso'}</strong><p>${terminal ? 'Reintenta el trabajo o revisa la transcripción.' : 'Los clips aparecerán aquí a medida que termine cada render.'}</p></div></div>`;
    return;
  }
  const visible = visibleClips(clips);
  syncClipsToolbar(clips.length, visible.length);
  if (!visible.length) {
    container.innerHTML = '<div class="empty-state compact-empty"><div><strong>Ningún clip coincide con el filtro</strong><p>Cambia el filtro para volver a ver todos los clips.</p></div></div>';
    return;
  }
  container.innerHTML = visible.map((clip) => {
    const renderBusy = ['queued', 'running', 'cancelling'].includes(clip.renderQueue?.status);
    const renderSettings = clip.renderSettings || {};
    const captionStyle = renderSettings.subtitleStyle || {};
    const clipRenderMode = renderSettings.mode || job.renderMode || 'fit';
    const clipQuality = renderSettings.quality || 'high';
    const subtitleMode = renderSettings.subtitleMode || 'karaoke';
    const preset = CAPTION_PRESETS[captionStyle.preset] ? captionStyle.preset : 'karaoke-highlight';
    const defaults = CAPTION_PRESETS[preset];
    const position = captionStyle.position || defaults.position;
    const emphasis = captionStyle.emphasis || defaults.emphasis;
    const color = /^#[0-9a-f]{6}$/i.test(captionStyle.primary || '') ? captionStyle.primary : defaults.primary;
    const accent = /^#[0-9a-f]{6}$/i.test(captionStyle.accent || '') ? captionStyle.accent : defaults.accent;
    const outlineSize = Number.isFinite(Number(captionStyle.outlineSize)) ? Number(captionStyle.outlineSize) : defaults.outlineSize;
    const shadow = Number.isFinite(Number(captionStyle.shadow)) ? Number(captionStyle.shadow) : defaults.shadow;
    const align = captionStyle.align || defaults.align;
    const uppercase = String(captionStyle.uppercase ?? defaults.uppercase);
    const number = (key, fallback) => Number.isFinite(Number(captionStyle[key])) ? Number(captionStyle[key]) : fallback;
    const option = (value, current, label) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
    const overlayJson = clip.captionOverlay ? escapeHtml(JSON.stringify(clip.captionOverlay)) : '';
    return `<article class="clip" data-clip-id="${escapeHtml(clip.id)}" data-caption-preview-text="${escapeHtml(clip.text || clip.suggestedTitle || 'Vista previa del clip')}">
      <div class="clip-media">
        <video controls preload="metadata" aria-label="Vista previa del clip ${escapeHtml(String(clip.rank || clip.id))}" src="/api/jobs/${encodeURIComponent(job.id)}/clips/${encodeURIComponent(clip.id)}/video?v=${encodeURIComponent(clip.renderedAt || '')}">Tu navegador no puede reproducir este vídeo.</video>
        <div class="clip-caption-overlay" data-caption-overlay aria-hidden="true"></div>
        ${overlayJson ? `<textarea hidden data-caption-overlay-json>${overlayJson}</textarea>` : ''}
      </div>
      <div class="clip-body">
        <div class="clip-head"><h3>${escapeHtml(clip.suggestedTitle || clip.id)}</h3><span class="score" aria-label="Puntuación ${escapeHtml(clip.viralScore)} de 100">${escapeHtml(clip.viralScore)}</span></div>
        <p>${formatTime(clip.start)} a ${formatTime(clip.end)} · ${Math.round(clip.duration)} s</p>
        <div class="reasons">${(clip.reasons || []).slice(0, 4).map((reason) => `<span class="pill">${escapeHtml(reason)}</span>`).join('')}</div>
        ${clip.critique ? `<p class="clip-critique">${escapeHtml(clip.critique)}</p>` : ''}
        <details class="clip-editor" data-caption-studio ${renderBusy || clip.status === 'render_failed' ? 'open' : ''}>
          <summary>Editar corte, encuadre y subtítulos</summary>
          ${editingControls(clip)}
          ${captionPreviewMarkup({compact: true})}
          <div class="clip-editor-grid">
            <label><span>Entrada (s)</span><input name="clipStart" type="number" min="0" max="${job.media?.duration || 0}" step="0.1" value="${Number(clip.start).toFixed(1)}"></label>
            <label><span>Salida (s)</span><input name="clipEnd" type="number" min="1" max="${job.media?.duration || 0}" step="0.1" value="${Number(clip.end).toFixed(1)}"></label>
            <label><span>Composición</span><select name="clipRenderMode">${option('fit', clipRenderMode, 'Pantalla completa')}${option('crop', clipRenderMode, 'Crop vertical')}${option('pip', clipRenderMode, 'Webcam + pantalla')}</select></label>
            <label><span>Calidad</span><select name="clipQuality">${option('draft', clipQuality, 'Borrador')}${option('standard', clipQuality, 'Estándar')}${option('high', clipQuality, 'Alta')}</select></label>
            <label><span>Subtítulos</span><select name="clipSubtitleMode">${option('karaoke', subtitleMode, 'Karaoke · palabra activa')}${option('progressive', subtitleMode, 'Editorial progresivo')}${option('words', subtitleMode, 'Una palabra')}${option('lines', subtitleMode, 'Por frases')}</select></label>
            <label><span>Preset</span><select name="clipSubtitlePreset" data-caption-control="preset">${option('karaoke-highlight', preset, 'Karaoke')}${option('progressive-reference', preset, 'Referencia centrada')}${option('progressive-punchy', preset, 'Dinámico')}${option('progressive-editorial', preset, 'Editorial')}${option('progressive-clean', preset, 'Clean')}</select></label>
            <label><span>Fuente local</span><input name="clipSubtitleFont" data-caption-control="font" list="caption-font-options" maxlength="80" value="${escapeHtml(captionStyle.font || defaults.font)}"></label>
            <div class="caption-font-options is-compact" data-caption-font-options aria-label="Previsualizaciones de fuentes"><span>Cargando fuentes…</span></div>
            <label><span>Posición</span><select name="clipSubtitlePosition" data-caption-control="position">${option('safe-lower', position, 'Pecho / pantalla')}${option('lower', position, 'Abajo')}${option('lower-middle', position, 'Centro inferior')}${option('center', position, 'Centro')}${option('upper-middle', position, 'Centro superior')}</select></label>
            <label><span>Tamaño</span><input name="clipSubtitleSize" data-caption-control="baseFontSize" type="number" min="48" max="132" value="${Number(captionStyle.baseFontSize || defaults.baseFontSize)}"></label>
            <label><span>Jerarquía</span><select name="clipSubtitleEmphasis" data-caption-control="emphasis">${option('auto', emphasis, 'Palabra protagonista')}${option('off', emphasis, 'Uniforme')}</select></label>
            <label><span>Texto</span><input name="clipSubtitleColor" data-caption-control="primary" type="color" value="${escapeHtml(color)}"></label>
            <label><span>Acento</span><input name="clipSubtitleAccent" data-caption-control="accent" type="color" value="${escapeHtml(accent)}"></label>
            <label><span>Reborde (px)</span><input name="clipSubtitleOutlineSize" data-caption-control="outlineSize" type="number" min="0" max="12" step="0.5" value="${outlineSize}"></label>
            <label><span>Sombra (px)</span><input name="clipSubtitleShadow" data-caption-control="shadow" type="number" min="0" max="8" step="0.5" value="${shadow}"></label>
          </div>
          <details class="caption-fine-tune is-compact">
            <summary>Ritmo y composición avanzada</summary>
            <div class="clip-editor-grid caption-fine-grid">
              <label><span>Alineación</span><select name="clipSubtitleAlign" data-caption-control="align">${option('center', align, 'Centrada')}${option('left', align, 'Izquierda')}</select></label>
              <label><span>Capitalización</span><select name="clipSubtitleUppercase" data-caption-control="uppercase">${option('false', uppercase, 'Mixta')}${option('true', uppercase, 'Mayúsculas')}</select></label>
              <label><span>Escala protagonista</span><input name="clipSubtitleHeroScale" data-caption-control="heroScale" type="number" min="1" max="2.6" step="0.01" value="${number('heroScale', defaults.heroScale)}"></label>
              <label><span>Escala primera línea</span><input name="clipSubtitleLeadScale" data-caption-control="leadScale" type="number" min="0.7" max="1.5" step="0.01" value="${number('leadScale', defaults.leadScale)}"></label>
              <label><span>Escala última línea</span><input name="clipSubtitleTailScale" data-caption-control="tailScale" type="number" min="0.7" max="1.5" step="0.01" value="${number('tailScale', defaults.tailScale)}"></label>
              <label><span>Palabras por bloque</span><input name="clipSubtitleMaxWords" data-caption-control="maxWords" type="number" min="3" max="12" step="1" value="${number('maxWords', defaults.maxWords)}"></label>
              <label><span>Duración del bloque</span><input name="clipSubtitleMaxPageDuration" data-caption-control="maxPageDuration" type="number" min="1.2" max="6" step="0.05" value="${number('maxPageDuration', defaults.maxPageDuration)}"></label>
              <label><span>Corte por pausa</span><input name="clipSubtitlePauseBreak" data-caption-control="pauseBreak" type="number" min="0.12" max="1.5" step="0.01" value="${number('pauseBreak', defaults.pauseBreak)}"></label>
              <label><span>Caracteres por línea</span><input name="clipSubtitleMaxLineChars" data-caption-control="maxLineChars" type="number" min="10" max="30" step="1" value="${number('maxLineChars', defaults.maxLineChars)}"></label>
              <label><span>Margen lateral</span><input name="clipSubtitleMarginX" data-caption-control="marginX" type="number" min="70" max="260" step="1" value="${number('marginX', defaults.marginX)}"></label>
              <label><span>Espaciado de letras</span><input name="clipSubtitleTracking" data-caption-control="tracking" type="number" min="-2" max="12" step="0.1" value="${number('tracking', defaults.tracking)}"></label>
            </div>
          </details>
          <div class="clip-editor-actions">
            <span class="render-state">${escapeHtml(renderBusy ? `Render ${clip.renderQueue.status}` : clip.renderError || '')}</span>
            ${renderBusy ? `<button type="button" class="secondary-action compact" data-cancel-render="${escapeHtml(clip.renderQueueId)}">Cancelar render</button>` : `<button type="button" class="primary-action compact" data-rerender-clip>Volver a renderizar</button>`}
          </div>
        </details>
        ${decisionButtons(clip)}
        <div class="clip-output-actions"><a class="secondary-action compact" href="/api/jobs/${encodeURIComponent(job.id)}/clips/${encodeURIComponent(clip.id)}/video" download="${escapeHtml(`short-${clip.rank || clip.id}.mp4`)}">Descargar MP4</a></div>
      </div>
    </article>`;
  }).join('');
  wireCaptionStudios(container);
  wireCaptionOverlays(container);
  for (const article of container.querySelectorAll('[data-clip-id]')) restoreControlState(article, drafts[article.dataset.clipId]);
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

export function renderLayoutEditor(job, container, {draft = null} = {}) {
  if (!job.media || job.media.width <= job.media.height) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  const box = boxPercent(job);
  container.hidden = false;
  const sourceSrc = `/api/jobs/${encodeURIComponent(job.id)}/source/video`;
  container.innerHTML = `<div class="layout-preview">
      <video controls preload="metadata" aria-label="Vídeo fuente para ajustar la webcam" src="${sourceSrc}">Tu navegador no puede reproducir este vídeo.</video>
      <div id="pip-box-preview" class="pip-box-preview" role="slider" aria-label="Caja de webcam, arrastra para mover"></div>
    </div>
    <div class="pip-compose-preview" aria-hidden="true">
      <div class="pip-compose-frame">
        <video class="pip-compose-bg" muted playsinline preload="metadata" src="${sourceSrc}"></video>
        <div class="pip-compose-screen"><video muted playsinline preload="metadata" src="${sourceSrc}"></video></div>
        <div class="pip-compose-cam"><video muted playsinline preload="metadata" src="${sourceSrc}"></video></div>
      </div>
      <p>Previa 9:16</p>
    </div>
    <div class="layout-controls">
      <div><h3>Composición webcam + pantalla</h3><p>Arrastra la caja sobre el vídeo fuente. La previa vertical muestra la tarjeta y la pantalla.</p></div>
      <div class="pip-fields">
        ${[['pip-x', 'X', box.x], ['pip-y', 'Y', box.y], ['pip-w', 'Ancho', box.w], ['pip-h', 'Alto', box.h]].map(([id, label, value]) => `<label><span>${label} %</span><input id="${id}" type="number" min="0" max="100" step="0.5" value="${value}"></label>`).join('')}
      </div>
      <p class="field-help">Detección actual: ${escapeHtml(job.webcamBox?.method || 'sin webcam estable')}, confianza ${Math.round((job.webcamBox?.confidence || 0) * 100)}%.</p>
    </div>`;
  syncPipOverlay(container);
  restoreControlState(container, draft);
  syncPipOverlay(container);
  wirePipDrag(container);
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
  const cam = $('.pip-compose-cam video', root);
  if (cam) {
    cam.style.objectFit = 'cover';
    cam.style.objectPosition = `${x + w / 2}% ${y + h / 2}%`;
  }
}

export function wirePipDrag(root = document) {
  const overlay = $('#pip-box-preview', root);
  const stage = overlay?.parentElement;
  if (!overlay || !stage || overlay.dataset.dragWired === 'true') return;
  overlay.dataset.dragWired = 'true';
  let drag = null;
  overlay.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    overlay.setPointerCapture(event.pointerId);
    drag = {
      startX: event.clientX,
      startY: event.clientY,
      x: Number($('#pip-x', root)?.value) || 0,
      y: Number($('#pip-y', root)?.value) || 0
    };
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const rect = stage.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    const xInput = $('#pip-x', root);
    const yInput = $('#pip-y', root);
    if (xInput) xInput.value = String(Math.max(0, Math.min(100, Math.round((drag.x + dx) * 10) / 10)));
    if (yInput) yInput.value = String(Math.max(0, Math.min(100, Math.round((drag.y + dy) * 10) / 10)));
    xInput?.dispatchEvent(new Event('input', {bubbles: true}));
  });
  const endDrag = () => { drag = null; };
  overlay.addEventListener('pointerup', endDrag);
  overlay.addEventListener('pointercancel', endDrag);
}

export function collectRerenderEdits(article, layoutRoot) {
  const start = Number($('[name="clipStart"]', article).value);
  const end = Number($('[name="clipEnd"]', article).value);
  const renderMode = $('[name="clipRenderMode"]', article).value;
  const editing = collectEditing(article);
  const value = (id) => Number($(`#${id}`, layoutRoot)?.value) / 100;
  return {
    start,
    end,
    renderMode: editing ? 'auto' : renderMode,
    editing,
    renderQuality: $('[name="clipQuality"]', article).value,
    subtitleMode: $('[name="clipSubtitleMode"]', article).value,
    subtitleStyle: {
      preset: $('[name="clipSubtitlePreset"]', article).value,
      font: $('[name="clipSubtitleFont"]', article).value,
      position: $('[name="clipSubtitlePosition"]', article).value,
      baseFontSize: Number($('[name="clipSubtitleSize"]', article).value),
      emphasis: $('[name="clipSubtitleEmphasis"]', article).value,
      primary: $('[name="clipSubtitleColor"]', article).value,
      accent: $('[name="clipSubtitleAccent"]', article).value,
      outlineSize: Number($('[name="clipSubtitleOutlineSize"]', article).value),
      shadow: Number($('[name="clipSubtitleShadow"]', article).value),
      align: $('[name="clipSubtitleAlign"]', article).value,
      uppercase: $('[name="clipSubtitleUppercase"]', article).value,
      heroScale: Number($('[name="clipSubtitleHeroScale"]', article).value),
      leadScale: Number($('[name="clipSubtitleLeadScale"]', article).value),
      tailScale: Number($('[name="clipSubtitleTailScale"]', article).value),
      maxWords: Number($('[name="clipSubtitleMaxWords"]', article).value),
      maxPageDuration: Number($('[name="clipSubtitleMaxPageDuration"]', article).value),
      pauseBreak: Number($('[name="clipSubtitlePauseBreak"]', article).value),
      maxLineChars: Number($('[name="clipSubtitleMaxLineChars"]', article).value),
      marginX: Number($('[name="clipSubtitleMarginX"]', article).value),
      tracking: Number($('[name="clipSubtitleTracking"]', article).value)
    },
    ...(renderMode === 'pip' ? {webcamBox: {x: value('pip-x'), y: value('pip-y'), w: value('pip-w'), h: value('pip-h'), normalized: true}} : {})
  };
}
