import {$, $$, api, escapeHtml} from './core.js';
import {CAPTION_PRESETS as CAPTION_UI_PRESETS} from './caption-presets.js';

export {CAPTION_UI_PRESETS};

const POSITION_LABELS = Object.freeze({
  'upper-middle': 'centro superior',
  center: 'centro',
  'lower-middle': 'centro inferior',
  lower: 'abajo'
});

let fontsPromise;
let dashboardFonts = [];
const previewTimers = new WeakMap();
const previewVersions = new WeakMap();

function clamp(value, min, max, fallback = min) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function control(root, key) {
  return $(`[data-caption-control="${key}"]`, root);
}

function value(root, key, fallback = '') {
  return control(root, key)?.value ?? fallback;
}

function setValue(root, key, next) {
  const input = control(root, key);
  if (input) input.value = String(next);
}

function cssFontFamily(font) {
  return `"${String(font || 'Arial').replace(/["\\]/g, '')}", Arial, sans-serif`;
}

export function captionPreviewMarkup({compact = false} = {}) {
  return `<figure class="caption-preview ${compact ? 'is-compact' : ''}" data-caption-preview>
    <div class="caption-preview-frame" data-caption-preview-frame data-position="lower-middle" data-align="center">
      <div class="caption-safe-area" aria-hidden="true"></div>
      <div class="caption-preview-copy" data-caption-preview-copy aria-label="Previsualización del subtítulo">
        <span class="caption-preview-lead" data-preview-line data-role="lead">así se verá</span>
        <strong class="caption-preview-hero" data-preview-line data-role="hero">PALABRA</strong>
        <span class="caption-preview-tail" data-preview-line data-role="tail">DESTACADA HOY</span>
      </div>
    </div>
    <figcaption data-caption-readout>Arial · 86 px · centro inferior</figcaption>
  </figure>`;
}

function readStyle(root) {
  const preset = value(root, 'preset', 'progressive-reference');
  const fallback = CAPTION_UI_PRESETS[preset] || CAPTION_UI_PRESETS['progressive-reference'];
  return {
    preset,
    font: value(root, 'font', fallback.font).trim() || fallback.font,
    position: value(root, 'position', fallback.position),
    primary: value(root, 'primary', fallback.primary),
    accent: value(root, 'accent', fallback.accent),
    baseFontSize: clamp(value(root, 'baseFontSize'), 48, 132, fallback.baseFontSize),
    outlineSize: clamp(value(root, 'outlineSize'), 0, 12, fallback.outlineSize),
    shadow: clamp(value(root, 'shadow'), 0, 8, fallback.shadow),
    emphasis: value(root, 'emphasis', fallback.emphasis),
    align: value(root, 'align', fallback.align),
    uppercase: value(root, 'uppercase', String(fallback.uppercase)) === 'true',
    heroScale: clamp(value(root, 'heroScale'), 1, 2.6, fallback.heroScale),
    leadScale: clamp(value(root, 'leadScale'), 0.7, 1.5, fallback.leadScale),
    tailScale: clamp(value(root, 'tailScale'), 0.7, 1.5, fallback.tailScale),
    maxWords: clamp(value(root, 'maxWords'), 3, 12, fallback.maxWords),
    maxPageDuration: clamp(value(root, 'maxPageDuration'), 1.2, 6, fallback.maxPageDuration),
    pauseBreak: clamp(value(root, 'pauseBreak'), 0.12, 1.5, fallback.pauseBreak),
    maxLineChars: clamp(value(root, 'maxLineChars'), 10, 30, fallback.maxLineChars),
    marginX: clamp(value(root, 'marginX'), 70, 260, fallback.marginX),
    tracking: clamp(value(root, 'tracking'), -2, 12, fallback.tracking)
  };
}

function previewText(root) {
  return String(root.dataset.captionPreviewText || root.closest?.('[data-caption-preview-text]')?.dataset.captionPreviewText || 'así se verá una palabra destacada hoy').trim().slice(0, 500);
}

function lineText(line) {
  const text = line.words.map((word) => word.text).join(' ');
  if (line.case === 'lower') return text.toLocaleLowerCase('es-ES');
  if (line.case === 'upper') return text.toLocaleUpperCase('es-ES');
  return text;
}

function applyPreviewPlan(root, plan) {
  const copy = $('[data-caption-preview-copy]', root);
  const page = plan?.pages?.[0];
  if (!copy || !page?.lines?.length) return;
  copy.replaceChildren(...page.lines.map((line) => {
    const element = document.createElement(line.role === 'hero' ? 'strong' : 'span');
    element.className = `caption-preview-${line.role === 'normal' ? 'lead' : line.role}`;
    element.dataset.previewLine = '';
    element.dataset.role = line.role;
    element.textContent = lineText(line);
    element.style.fontSize = `${line.fontSize / 10.8}cqw`;
    return element;
  }));
  copy.dataset.planned = 'true';
}

function requestPreviewPlan(root, style) {
  clearTimeout(previewTimers.get(root));
  const version = (previewVersions.get(root) || 0) + 1;
  previewVersions.set(root, version);
  previewTimers.set(root, setTimeout(async () => {
    try {
      const {plan} = await api('/api/captions/preview', {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({text: previewText(root), style}), timeout: 5000
      });
      if (previewVersions.get(root) !== version) return;
      applyPreviewPlan(root, plan);
      syncCaptionPreview(root, {requestPlan: false});
    } catch {
      // Keep the immediate local approximation while the server restarts.
    }
  }, 180));
}

export function syncCaptionPreview(root, {requestPlan = true} = {}) {
  const frame = $('[data-caption-preview-frame]', root);
  if (!frame) return;
  const style = readStyle(root);
  const copy = $('[data-caption-preview-copy]', frame);
  const lines = $$('[data-preview-line]', copy);
  const referenceLayout = style.preset === 'progressive-reference';
  const heroScale = style.emphasis === 'off' ? 1 : style.heroScale;
  const outline = style.outlineSize * 0.18;
  frame.dataset.position = style.position;
  frame.dataset.align = style.align;
  frame.style.fontFamily = cssFontFamily(style.font);
  copy.style.insetInline = `${(style.marginX / 1080) * 100}%`;
  copy.style.letterSpacing = `${style.tracking * 0.06}px`;
  for (const line of lines) {
    line.style.color = style.primary;
    line.style.webkitTextStroke = `${outline}px rgba(0, 0, 0, 0.92)`;
    line.style.textShadow = style.shadow > 0 ? `0 ${style.shadow * 0.18}px ${Math.max(0.5, style.shadow * 0.3)}px rgba(0, 0, 0, 0.86)` : 'none';
    if (!line.style.fontSize) {
      const scale = line.dataset.role === 'hero' ? heroScale : (line.dataset.role === 'tail' ? style.tailScale : style.leadScale);
      line.style.fontSize = `${(style.baseFontSize * scale) / 10.8}cqw`;
    }
  }
  const hero = lines.find((line) => line.dataset.role === 'hero');
  if (hero) hero.style.color = style.accent;
  if (copy.dataset.planned !== 'true' && lines.length >= 3) {
    lines[0].textContent = referenceLayout ? 'así se verá' : (style.uppercase ? 'ASÍ SE VERÁ' : 'Así se verá');
    lines[1].textContent = style.uppercase || referenceLayout ? 'PALABRA' : 'Palabra';
    lines[2].textContent = style.uppercase || referenceLayout ? 'DESTACADA HOY' : 'destacada hoy';
  }
  const readout = $('[data-caption-readout]', root);
  if (readout) readout.textContent = `${style.font} · ${Math.round(style.baseFontSize)} px · ${POSITION_LABELS[style.position] || style.position} · ${Math.round(style.maxWords)} palabras`;
  $$('[data-caption-font]', root).forEach((button) => button.classList.toggle('is-selected', button.dataset.captionFont === style.font));
  if (requestPlan) requestPreviewPlan(root, style);
}

export function applyCaptionPreset(root, presetName) {
  const preset = CAPTION_UI_PRESETS[presetName];
  if (!preset) return;
  for (const [key, next] of Object.entries(preset)) setValue(root, key, next);
  syncCaptionPreview(root);
}

function renderFontChoices(root) {
  const target = $('[data-caption-font-options]', root);
  if (!target || !dashboardFonts.length) return;
  target.innerHTML = dashboardFonts.map((font) => `<button type="button" data-caption-font="${escapeHtml(font.family)}" title="Usar ${escapeHtml(font.label || font.family)}">Aa<span>${escapeHtml(font.label || font.family)}</span></button>`).join('');
  $$('[data-caption-font]', target).forEach((button) => { button.style.fontFamily = cssFontFamily(button.dataset.captionFont); });
  syncCaptionPreview(root);
}

async function loadDashboardFonts() {
  if (!fontsPromise) {
    fontsPromise = api('/api/fonts').then(async ({fonts = []}) => {
      dashboardFonts = fonts;
      await Promise.all(fonts.filter((font) => font.url && 'FontFace' in window).map(async (font) => {
        try {
          const face = new FontFace(font.family, `url("${font.url}")`);
          await face.load();
          document.fonts.add(face);
        } catch {}
      }));
      const datalist = $('#caption-font-options');
      if (datalist) datalist.innerHTML = fonts.map((font) => `<option value="${escapeHtml(font.family)}">${escapeHtml(font.label || font.family)} · ${font.source === 'local' ? 'Archivo local' : 'Sistema'}</option>`).join('');
      return fonts;
    }).catch(() => {
      dashboardFonts = ['Arial', 'Arial Black', 'Bahnschrift', 'Segoe UI Black'].map((family) => ({family, source: 'system'}));
      return dashboardFonts;
    });
  }
  return fontsPromise;
}

export function wireCaptionStudio(root) {
  if (!root || root.dataset.captionStudioWired === 'true') return;
  root.dataset.captionStudioWired = 'true';
  root.addEventListener('input', () => syncCaptionPreview(root));
  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-caption-control="preset"]')) applyCaptionPreset(root, event.target.value);
    else syncCaptionPreview(root);
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-caption-font]');
    if (!button) return;
    setValue(root, 'font', button.dataset.captionFont);
    syncCaptionPreview(root);
  });
  syncCaptionPreview(root);
  loadDashboardFonts().then(() => renderFontChoices(root));
}

export function wireCaptionStudios(root = document) {
  $$('[data-caption-studio]', root).forEach(wireCaptionStudio);
}
