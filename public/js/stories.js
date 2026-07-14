import {$, $$, api, escapeHtml} from './core.js';
import {store} from './store.js';

function safeSvg(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  $$('script, foreignObject', doc).forEach((node) => node.remove());
  $$('*', doc).forEach((node) => [...node.attributes].forEach((attribute) => {
    if (/^on/i.test(attribute.name) || ((attribute.name === 'href' || attribute.name.endsWith(':href')) && !/^(https:\/\/|#)/.test(attribute.value))) node.removeAttribute(attribute.name);
  }));
  return doc.documentElement.outerHTML;
}

async function renderSlides(form, preview, toolbar, note, story) {
  const handle = new FormData(form).get('handle');
  const svgs = [];
  for (let index = 0; index < story.slides.length; index += 1) {
    note.textContent = `Componiendo pieza ${index + 1} de ${story.slides.length}…`;
    const svg = await api('/api/stories/render', {
      method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({story, index, handle})
    }, 'text');
    svgs.push(safeSvg(svg));
  }
  preview.innerHTML = svgs.map((svg, index) => `<article class="story-slide" data-index="${index}">${svg}<button class="download-story" type="button" data-index="${index}">Descargar PNG ${String(index + 1).padStart(2, '0')}</button></article>`).join('');
  toolbar.innerHTML = `<strong>${escapeHtml(story.title)}</strong><span>${story.slides.length} piezas · ${story.llmUsed ? 'MiniMax M3' : 'Composición local'}</span>`;
  note.textContent = story.warning || 'Secuencia generada a 1080 × 1920.';
}

export function initStories() {
  const form = $('#story-form');
  const preview = $('#story-preview');
  const toolbar = $('#story-toolbar');
  const note = $('#story-note');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Estructurando historia…';
    try {
      const data = new FormData(form);
      store.story = await api('/api/stories/plan', {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({title: data.get('title'), source: data.get('source'), theme: data.get('theme'), useLlm: data.get('useLlm') === 'on'})
      });
      await renderSlides(form, preview, toolbar, note, store.story);
    } catch (error) {
      note.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Diseñar historias';
    }
  });
  preview.addEventListener('click', async (event) => {
    const button = event.target.closest('.download-story');
    if (!button || !store.story) return;
    try {
      const svg = button.closest('.story-slide').querySelector('svg').outerHTML;
      const url = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      canvas.getContext('2d').drawImage(image, 0, 0, 1080, 1920);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png', 1);
      link.download = `story-${String(Number(button.dataset.index) + 1).padStart(2, '0')}.png`;
      link.click();
    } catch {
      note.textContent = 'La imagen remota no permite exportar PNG. Usa una imagen HTTPS con CORS.';
    }
  });
}
