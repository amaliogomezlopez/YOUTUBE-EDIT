import {$, api, escapeHtml, uploadForm} from './core.js';
import {store} from './store.js';

const layouts = ['cover-hero', 'photo-annotation', 'feature-list', 'pros-cons', 'comparison', 'stat', 'steps', 'quote', 'verdict', 'cta'];
const themes = ['forge', 'cobalt', 'signal', 'night'];

function selectedSlide() {
  return store.carousel?.slides?.find((slide) => slide.id === store.selectedCarouselSlideId) || store.carousel?.slides?.[0];
}

function validationMarkup(validation = {}) {
  const issues = [...(validation.errors || []), ...(validation.warnings || [])];
  return `<div class="carousel-validation ${validation.valid ? 'is-valid' : 'has-errors'}"><strong>${validation.valid ? 'Listo para exportar' : `${validation.errors?.length || 0} bloqueos`}</strong><span>${issues.length ? escapeHtml(issues.slice(0, 2).join(' · ')) : 'Contraste, overflow y evidencia verificados.'}</span></div>`;
}

let libraryItems = [];

function renderLibrary() {
  const root = $('#carousel-library');
  const search = ($('#carousel-search')?.value || '').trim().toLowerCase();
  const sort = $('#carousel-sort')?.value || 'recent';
  let items = libraryItems.filter((item) => !search || String(item.title || '').toLowerCase().includes(search));
  items = sort === 'title'
    ? [...items].sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'es'))
    : [...items].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  root.innerHTML = items.length ? items.map((item) => `<button class="carousel-project-card ${item.id === store.carousel?.id ? 'is-active' : ''}" type="button" data-carousel-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><span>${item.slideCount} piezas · ${escapeHtml(item.theme)}</span><small>${item.status === 'rendered' ? 'Exportado' : 'Borrador'}</small></button>`).join('')
    : libraryItems.length ? '<p class="carousel-library-empty">Sin resultados para esa búsqueda.</p>' : '<p class="carousel-library-empty">Aún no hay carruseles.</p>';
}

async function loadLibrary() {
  const data = await api('/api/carousels');
  libraryItems = data.carousels || [];
  renderLibrary();
}

function editorMarkup(project) {
  const slide = selectedSlide();
  if (!slide) return '<div class="carousel-empty"><h3>Proyecto sin piezas</h3></div>';
  store.selectedCarouselSlideId = slide.id;
  const format = $('#carousel-format')?.value || 'instagram-feed';
  const slot = slide.assetSlots?.[0];
  const rendered = project.renders?.outputs?.filter((item) => item.format === format) || [];
  return `<div class="carousel-editor-head">
    <div><span class="section-label">${escapeHtml(project.id)}</span><h3>${escapeHtml(project.title)}</h3><p>${project.slides.length} piezas · ${project.llmUsed ? 'guion IA' : 'guion local'}</p></div>
    <div class="carousel-global-controls"><label>Tema<select id="carousel-theme">${themes.map((item) => `<option value="${item}" ${item === project.theme ? 'selected' : ''}>${item}</option>`).join('')}</select></label><label>Formato<select id="carousel-format"><option value="instagram-feed" ${format === 'instagram-feed' ? 'selected' : ''}>Instagram 4:5</option><option value="vertical" ${format === 'vertical' ? 'selected' : ''}>Vertical 9:16</option></select></label><button id="export-carousel" class="primary-action compact" type="button">Exportar</button></div>
  </div>
  ${validationMarkup(project.validation)}
  <div class="carousel-slide-rail">${project.slides.map((item, index) => `<button type="button" class="carousel-slide-tab ${item.id === slide.id ? 'is-active' : ''}" data-slide-id="${item.id}"><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(item.label || item.layout)}</span></button>`).join('')}</div>
  <div class="carousel-workbench">
    <div class="carousel-canvas-wrap"><img id="carousel-preview" src="/api/carousels/${encodeURIComponent(project.id)}/preview/${encodeURIComponent(slide.id)}?format=${format}&v=${encodeURIComponent(project.updatedAt)}" alt="Previsualización de la pieza ${slide.order}"><div class="carousel-order-actions"><button type="button" data-move="-1" ${slide.role === 'cover' || slide.role === 'cta' || slide.order <= 2 ? 'disabled' : ''}>← Anterior</button><button type="button" data-move="1" ${slide.role === 'cover' || slide.role === 'cta' || slide.order >= project.slides.length - 1 ? 'disabled' : ''}>Siguiente →</button></div></div>
    <form id="carousel-slide-form" class="carousel-slide-form">
      <input type="hidden" name="id" value="${slide.id}">
      <label><span>Layout</span><select name="layout">${layouts.map((item) => `<option value="${item}" ${item === slide.layout ? 'selected' : ''}>${item}</option>`).join('')}</select></label>
      <label><span>Etiqueta</span><input name="label" maxlength="28" value="${escapeHtml(slide.label)}"></label>
      <label><span>Titular</span><textarea name="headline" rows="3" maxlength="110">${escapeHtml(slide.headline)}</textarea></label>
      <label><span>Cuerpo</span><textarea name="body" rows="6" maxlength="520">${escapeHtml(slide.body)}</textarea></label>
      <div class="grid2"><label><span>Acento</span><input name="accent" maxlength="40" value="${escapeHtml(slide.accent || '')}"></label><label><span>Dato</span><input name="stat" maxlength="24" value="${escapeHtml(slide.stat || '')}"></label></div>
      <p class="carousel-evidence">Evidencia: ${slide.evidenceRefs?.length ? slide.evidenceRefs.map(escapeHtml).join(', ') : 'CTA editorial'}</p>
      <button class="secondary-action" type="submit">Guardar pieza</button>
      ${slot ? `<div class="carousel-asset-box"><strong>${slot.assetId ? 'Imagen asignada' : 'Imagen pendiente'}</strong><p>${escapeHtml(slot.prompt)}</p><label class="file-action">Seleccionar PNG/JPEG/WebP<input id="carousel-asset-file" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="upload-carousel-asset" type="button" class="secondary-action compact" ${!slot ? 'disabled' : ''}>Asignar imagen</button></div>` : '<div class="carousel-asset-box is-muted"><strong>Layout tipográfico</strong><p>Esta pieza no necesita imagen.</p></div>'}
    </form>
  </div>
  ${project.renders?.contactSheetUrl ? `<div class="carousel-exports"><a href="${escapeHtml(project.renders.contactSheetUrl)}" target="_blank" rel="noopener">Abrir hoja de contacto</a><span>${rendered.length} archivos en ${format}</span></div>` : ''}`;
}

function renderEditor() {
  $('#carousel-editor').innerHTML = store.carousel ? editorMarkup(store.carousel) : '<div class="carousel-empty"><span>04</span><h3>Selecciona o crea un carrusel</h3></div>';
}

async function openProject(id) {
  store.carousel = await api(`/api/carousels/${encodeURIComponent(id)}`);
  if (!store.carousel.slides.some((slide) => slide.id === store.selectedCarouselSlideId)) store.selectedCarouselSlideId = store.carousel.slides[0]?.id;
  renderEditor();
  await loadLibrary();
}

async function saveProject(patch) {
  store.carousel = await api(`/api/carousels/${encodeURIComponent(store.carousel.id)}`, {method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify(patch)});
  renderEditor();
  await loadLibrary();
}

export function initCarousels() {
  const createForm = $('#carousel-create-form');
  const editor = $('#carousel-editor');
  const note = $('#carousel-note');
  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = createForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const data = new FormData(createForm);
      store.carousel = await api('/api/carousels', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({title: data.get('title'), source: data.get('source'), slideCount: Number(data.get('slideCount')), theme: data.get('theme'), useLlm: data.get('useLlm') === 'on'}), timeout: 90_000});
      store.selectedCarouselSlideId = store.carousel.slides[0]?.id;
      renderEditor();
      await loadLibrary();
      note.textContent = store.carousel.warning || 'Borrador creado. Revisa cada pieza antes de exportar.';
    } catch (error) { note.textContent = error.message; } finally { button.disabled = false; }
  });
  $('#refresh-carousels').addEventListener('click', () => loadLibrary().catch((error) => { note.textContent = error.message; }));
  $('#carousel-search').addEventListener('input', renderLibrary);
  $('#carousel-sort').addEventListener('change', renderLibrary);
  $('#carousel-library').addEventListener('click', (event) => {
    const button = event.target.closest('[data-carousel-id]');
    if (button) openProject(button.dataset.carouselId).catch((error) => { note.textContent = error.message; });
  });
  editor.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-slide-id]');
    if (tab) { store.selectedCarouselSlideId = tab.dataset.slideId; renderEditor(); return; }
    const move = event.target.closest('[data-move]');
    if (move) {
      const slide = selectedSlide();
      const order = store.carousel.slides.map((item) => item.id);
      const from = order.indexOf(slide.id); const to = from + Number(move.dataset.move);
      [order[from], order[to]] = [order[to], order[from]];
      await saveProject({slideOrder: order}).catch((error) => { note.textContent = error.message; }); return;
    }
    if (event.target.closest('#export-carousel')) {
      const button = event.target.closest('#export-carousel'); button.disabled = true;
      try { store.carousel = await api(`/api/carousels/${encodeURIComponent(store.carousel.id)}/render`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({formats: ['instagram-feed', 'vertical']}), timeout: 120_000}); renderEditor(); note.textContent = 'PNG, JPEG y hoja de contacto generados.'; } catch (error) { note.textContent = error.message; button.disabled = false; }
      return;
    }
    if (event.target.closest('#upload-carousel-asset')) {
      const uploadButton = event.target.closest('#upload-carousel-asset');
      const file = $('#carousel-asset-file')?.files?.[0]; const slide = selectedSlide(); const slot = slide.assetSlots?.[0];
      if (!file) { note.textContent = 'Selecciona una imagen primero.'; return; }
      const data = new FormData(); data.set('asset', file); data.set('slideId', slide.id); data.set('slotId', slot.id); data.set('prompt', slot.prompt); data.set('provider', 'uploaded');
      uploadButton.disabled = true;
      try { store.carousel = await uploadForm(`/api/carousels/${encodeURIComponent(store.carousel.id)}/assets`, data); renderEditor(); note.textContent = 'Imagen validada y asignada.'; } catch (error) { note.textContent = error.message; uploadButton.disabled = false; }
    }
  });
  editor.addEventListener('change', async (event) => {
    if (event.target.id === 'carousel-format') renderEditor();
    if (event.target.id === 'carousel-theme') await saveProject({theme: event.target.value}).catch((error) => { note.textContent = error.message; });
  });
  editor.addEventListener('submit', async (event) => {
    if (event.target.id !== 'carousel-slide-form') return;
    event.preventDefault(); const data = new FormData(event.target);
    try { await saveProject({slide: Object.fromEntries(data.entries())}); note.textContent = 'Pieza guardada y validada.'; } catch (error) { note.textContent = error.message; }
  });
  loadLibrary().catch((error) => { note.textContent = error.message; });
}
