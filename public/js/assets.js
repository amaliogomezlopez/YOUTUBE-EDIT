import {$, api} from './core.js';

function text(element, value) {
  element.textContent = value ?? '';
  return element;
}

function resultCard(item) {
  const card = document.createElement('article');
  card.className = `asset-result-card asset-result-${item.kind}`;

  const media = document.createElement('div');
  media.className = 'asset-result-media';
  const preview = document.createElement('img');
  preview.alt = item.title || '';
  preview.loading = 'lazy';
  preview.referrerPolicy = 'no-referrer';
  preview.src = item.previewUrl;
  media.append(preview);
  if (item.kind === 'video') {
    const badge = text(document.createElement('span'), item.durationSeconds
      ? `${Math.round(item.durationSeconds)} s · vídeo`
      : 'Vídeo');
    badge.className = 'asset-kind-badge';
    media.append(badge);
  }
  card.append(media);

  const body = document.createElement('div');
  body.className = 'asset-result-body';
  const eyebrow = text(
    document.createElement('span'),
    `${item.provider}${item.imported ? ' · local' : ''}`
  );
  eyebrow.className = 'section-label';
  body.append(eyebrow);
  body.append(text(document.createElement('h3'), item.title));
  body.append(text(
    document.createElement('p'),
    [item.author, item.license].filter(Boolean).join(' · ')
  ));

  const actions = document.createElement('div');
  actions.className = 'asset-result-actions';
  if (item.sourceUrl) {
    const source = text(document.createElement('a'), 'Ver fuente');
    source.className = 'secondary-action compact';
    source.href = item.sourceUrl;
    source.rel = 'noreferrer';
    source.target = '_blank';
    actions.append(source);
  }
  if (item.downloadUrl && !item.imported) {
    const isOfflineSvg = String(item.downloadUrl).startsWith('data:image/svg+xml');
    const copy = text(
      document.createElement('button'),
      isOfflineSvg ? 'Copiar SVG' : 'Copiar enlace'
    );
    copy.className = 'secondary-action compact';
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.downloadUrl);
        copy.textContent = isOfflineSvg ? 'SVG copiado' : 'Enlace copiado';
      } catch {
        copy.textContent = 'No se pudo copiar';
      }
    });
    actions.append(copy);
  }
  body.append(actions);
  card.append(body);
  return card;
}

export function initAssetSearch() {
  const form = $('#asset-search-form');
  const results = $('#asset-search-results');
  const note = $('#asset-search-note');
  if (!form || !results || !note) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const query = String(data.get('query') || '').trim();
    const kind = String(data.get('kind') || 'image');
    results.replaceChildren();
    note.textContent = 'Buscando en la biblioteca y proveedores configurados…';
    try {
      const payload = await api(
        `/api/editorial-assets/search?q=${encodeURIComponent(query)}&kind=${encodeURIComponent(kind)}&limit=18`,
        {timeout: 25_000}
      );
      if (!payload.items.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state compact-empty';
        const copy = document.createElement('div');
        copy.append(text(document.createElement('strong'), 'Sin coincidencias'));
        copy.append(text(document.createElement('p'), 'Prueba otro término o configura el proveedor remoto correspondiente.'));
        empty.append(copy);
        results.append(empty);
      } else {
        payload.items.forEach((item) => results.append(resultCard(item)));
      }
      note.textContent = payload.warnings.length
        ? payload.warnings.map((warning) => warning.message).join(' ')
        : `${payload.items.length} resultados con procedencia disponible.`;
    } catch (error) {
      note.textContent = error.message;
      const empty = document.createElement('div');
      empty.className = 'empty-state compact-empty';
      empty.append(text(document.createElement('strong'), 'No se pudo completar la búsqueda.'));
      results.append(empty);
    }
  });
}
