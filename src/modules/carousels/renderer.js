import {CAROUSEL_FORMATS, CAROUSEL_THEMES, carouselFormat} from './constants.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'}[character]));
}

function words(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

export function wrapText(value, maxChars, maxLines = 8) {
  const output = [];
  let row = '';
  let oversized = false;
  for (const word of words(value)) {
    if (word.length > maxChars) oversized = true;
    const next = `${row} ${word}`.trim();
    if (next.length > maxChars && row) {
      output.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  if (row) output.push(row);
  return {lines: output.slice(0, maxLines), truncated: output.length > maxLines, oversized};
}

export function fitText(value, {width, maxHeight, startSize, minSize = 28, maxLines = 8, weight = 700} = {}) {
  const text = String(value ?? '').trim();
  for (let size = startSize; size >= minSize; size = Math.max(minSize, size - 4)) {
    const lineHeight = Math.round(size * 1.08);
    const glyphFactor = weight >= 800 ? 0.68 : weight >= 650 ? 0.61 : 0.58;
    const maxChars = Math.max(8, Math.floor(width / (size * glyphFactor)));
    const wrapped = wrapText(text, maxChars, maxLines);
    if (!wrapped.truncated && !wrapped.oversized && wrapped.lines.length * lineHeight <= maxHeight) return {...wrapped, size, lineHeight};
    if (size === minSize) break;
  }
  const size = minSize;
  const lineHeight = Math.round(size * 1.08);
  const maxChars = Math.max(8, Math.floor(width / (size * (weight >= 800 ? 0.68 : 0.61))));
  return {...wrapText(text, maxChars, Math.max(1, Math.floor(maxHeight / lineHeight))), size, lineHeight, overflow: true};
}

function textRows(fitted, x, top, attributes = '') {
  const firstBaseline = top + Math.round(fitted.size * 0.82);
  return fitted.lines.map((line, index) => `<text x="${x}" y="${firstBaseline + index * fitted.lineHeight}" ${attributes}>${esc(line)}</text>`).join('');
}

function textBlock(value, box, options = {}) {
  const fitted = fitText(value, {
    width: box.width,
    maxHeight: box.height,
    startSize: options.size || 80,
    minSize: options.minSize || 28,
    maxLines: options.maxLines || 8,
    weight: options.weight || 700
  });
  return {
    svg: textRows(fitted, box.x, box.y, `fill="${options.color}" font-size="${fitted.size}" font-weight="${options.weight || 700}" letter-spacing="${options.letterSpacing || 0}"`),
    fitted,
    bounds: {...box, height: fitted.lines.length * fitted.lineHeight}
  };
}

function splitItems(value, maximum = 6) {
  const explicit = String(value || '').split(/\n|\s*[;•]\s*/).map((item) => item.trim()).filter(Boolean);
  if (explicit.length > 1) return explicit.slice(0, maximum);
  return String(value || '').split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean).slice(0, maximum);
}

function slideSlot(slide) {
  return (slide.assetSlots || []).find((slot) => slot.assetId) || (slide.assetSlots || [])[0] || null;
}

function focalAlignment(position = 'center') {
  const horizontal = position.includes('left') ? 'xMin' : position.includes('right') ? 'xMax' : 'xMid';
  const vertical = position.includes('top') ? 'YMin' : position.includes('bottom') ? 'YMax' : 'YMid';
  return `${horizontal}${vertical}`;
}

function assetFrame(assetDataUri, box, theme, options = {}) {
  const {x, y, width, height} = box;
  const radius = options.radius ?? 18;
  const clipId = `asset-${Math.round(x)}-${Math.round(y)}-${Math.round(width)}-${Math.round(height)}`;
  if (assetDataUri) {
    return `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/></clipPath></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${theme.soft}"/><image href="${assetDataUri}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${focalAlignment(options.subjectPosition)} ${options.fit === 'contain' ? 'meet' : 'slice'}" clip-path="url(#${clipId})"/><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="none" stroke="${theme.ink}" stroke-width="4"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${theme.soft}"/><path d="M${x + 50} ${y + height - 65} L${x + width * 0.42} ${y + height * 0.48} L${x + width * 0.62} ${y + height * 0.7} L${x + width - 45} ${y + height * 0.33}" fill="none" stroke="${theme.ink}" stroke-width="8" opacity=".3"/><circle cx="${x + width * 0.72}" cy="${y + height * 0.27}" r="32" fill="${theme.accent}" opacity=".75"/><text x="${x + 30}" y="${y + 52}" fill="${theme.ink}" font-size="23" font-weight="800" opacity=".68">IMAGEN PENDIENTE</text>`;
}

function createLayoutContext(slide, base) {
  const elements = [];
  const slot = slideSlot(slide);
  return {
    ...base,
    slot,
    subjectPosition: slot?.composition?.subjectPosition || 'center',
    bottom: base.h - 92,
    addText(id, value, box, options) {
      const block = textBlock(value, box, options);
      elements.push({id, type: 'text', ...block.bounds, overflow: Boolean(block.fitted.overflow || block.fitted.truncated)});
      return block;
    },
    addAsset(id, box, options = {}) {
      elements.push({id, type: 'asset', ...box});
      return assetFrame(base.assetDataUri, box, base.theme, {subjectPosition: this.subjectPosition, ...options});
    },
    elements
  };
}

function coverToken(slide) {
  return String(slide.stat || slide.accent || slide.headline || '').match(/\b\d+(?:\.\d+)?\b/)?.[0]?.slice(0, 4) || '';
}

function coverLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const assetY = vertical ? 720 : 610;
  const title = context.addText('headline', slide.headline, {x: m, y: 220, width: w - m * 2, height: vertical ? 430 : 330}, {size: vertical ? 128 : 104, minSize: 52, maxLines: 4, weight: 900, color: theme.ink, letterSpacing: -2});
  const assetBox = {x: m, y: assetY, width: w - m * 2, height: vertical ? 690 : bottom - assetY};
  const token = coverToken(slide);
  const tokenSvg = token ? `<rect x="${w - m - 190}" y="${assetY - 38}" width="190" height="142" rx="12" fill="${theme.accent}"/><text x="${w - m - 95}" y="${assetY + 70}" text-anchor="middle" fill="${theme.accentInk}" font-size="112" font-weight="900">${esc(token)}</text>` : '';
  let closing = '';
  if (vertical && slide.body) {
    const bandY = assetBox.y + assetBox.height + 55;
    const body = context.addText('body', slide.body, {x: m + 36, y: bandY + 42, width: w - m * 2 - 72, height: bottom - bandY - 55}, {size: 38, minSize: 27, maxLines: 5, weight: 650, color: theme.paper});
    closing = `<rect x="${m}" y="${bandY}" width="${w - m * 2}" height="${bottom - bandY}" rx="18" fill="${theme.ink}"/>${body.svg}`;
  }
  return `<rect x="${m}" y="198" width="210" height="14" fill="${theme.accent}"/>${title.svg}${context.addAsset('hero-image', assetBox)}${tokenSvg}${closing}`;
}

function photoAnnotationLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const contentTop = vertical ? 650 : 610;
  const photoWidth = 500;
  const title = context.addText('headline', slide.headline, {x: m, y: 220, width: w - m * 2, height: vertical ? 360 : 320}, {size: vertical ? 90 : 84, minSize: 44, maxLines: 3, weight: 900, color: theme.ink});
  if (vertical) {
    const imageBox = {x: m, y: contentTop, width: w - m * 2, height: 650};
    const bodyTop = imageBox.y + imageBox.height + 58;
    const body = context.addText('body', slide.body, {x: m, y: bodyTop, width: w - m * 2, height: bottom - bodyTop}, {size: 42, minSize: 28, maxLines: 7, weight: 700, color: theme.ink});
    return `${title.svg}${context.addAsset('support-image', imageBox)}<rect x="${m}" y="${imageBox.y + imageBox.height + 24}" width="120" height="10" fill="${theme.accent}"/>${body.svg}`;
  }
  const imageBox = {x: m, y: contentTop, width: photoWidth, height: bottom - contentTop};
  const bodyX = m + photoWidth + 98;
  const body = context.addText('body', slide.body, {x: bodyX, y: contentTop + 58, width: w - m - bodyX, height: Math.min(bottom - contentTop - 80, vertical ? 720 : 520)}, {size: vertical ? 42 : 40, minSize: 27, maxLines: 11, weight: 700, color: theme.ink});
  const connectorY = contentTop + 112;
  return `${title.svg}${context.addAsset('support-image', imageBox)}<line x1="${m + photoWidth + 16}" y1="${connectorY}" x2="${bodyX - 24}" y2="${connectorY}" stroke="${theme.accent}" stroke-width="9"/><circle cx="${bodyX - 15}" cy="${connectorY}" r="14" fill="${theme.accent}"/>${body.svg}`;
}

function semanticIcon(value, x, y, size, color) {
  const term = String(value || '').toLowerCase();
  const stroke = `fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  if (/razon|reason|precisi|objetiv/.test(term)) {
    return `<g ${stroke}><circle cx="${x}" cy="${y}" r="${size * 0.42}"/><circle cx="${x}" cy="${y}" r="${size * 0.18}"/><path d="M${x} ${y - size * 0.58}v${size * 0.26}M${x + size * 0.58} ${y}h-${size * 0.26}"/></g>`;
  }
  if (/herramient|tool|agente|automat/.test(term)) {
    return `<g ${stroke}><circle cx="${x}" cy="${y}" r="${size * 0.2}"/><path d="M${x} ${y - size * 0.55}v${size * 0.2}M${x} ${y + size * 0.35}v${size * 0.2}M${x - size * 0.55} ${y}h${size * 0.2}M${x + size * 0.35} ${y}h${size * 0.2}M${x - size * 0.39} ${y - size * 0.39}l${size * 0.14} ${size * 0.14}M${x + size * 0.25} ${y + size * 0.25}l${size * 0.14} ${size * 0.14}"/></g>`;
  }
  if (/program|código|codigo|code|terminal/.test(term)) {
    return `<g ${stroke}><path d="M${x - size * 0.1} ${y - size * 0.4}l-${size * 0.38} ${size * 0.4} ${size * 0.38} ${size * 0.4}M${x + size * 0.1} ${y - size * 0.4}l${size * 0.38} ${size * 0.4}-${size * 0.38} ${size * 0.4}"/></g>`;
  }
  if (/segur|riesgo|prote|safety/.test(term)) {
    return `<path d="M${x} ${y - size * 0.52}l${size * 0.42} ${size * 0.16}v${size * 0.3}c0 ${size * 0.32}-${size * 0.2} ${size * 0.53}-${size * 0.42} ${size * 0.68}-${size * 0.42}-${size * 0.15}-${size * 0.42}-${size * 0.36}-${size * 0.42}-${size * 0.68}v-${size * 0.3}z" ${stroke}/>`;
  }
  return `<g ${stroke}><path d="M${x - size * 0.42} ${y}l${size * 0.27} ${size * 0.28} ${size * 0.57}-${size * 0.62}"/></g>`;
}

function featureListLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const title = context.addText('headline', slide.headline, {x: m, y: 220, width: w - m * 2, height: 300}, {size: 92, minSize: 46, maxLines: 3, weight: 900, color: theme.ink});
  const items = splitItems(slide.body, 6);
  const listTop = vertical ? 710 : 585;
  const gap = vertical ? 30 : 20;
  const available = bottom - listTop - gap * Math.max(0, items.length - 1);
  const rowHeight = Math.min(vertical ? 190 : 142, Math.floor(available / Math.max(1, items.length)));
  const rows = items.map((item, index) => {
    const y = listTop + index * (rowHeight + gap);
    const numberWidth = 132;
    const textX = m + numberWidth + 22;
    const block = context.addText(`item-${index + 1}`, item, {x: textX + 22, y: y + 18, width: w - m - textX - 44, height: rowHeight - 36}, {size: vertical ? 43 : 39, minSize: 25, maxLines: 3, weight: 750, color: theme.ink});
    const iconX = m + 43;
    const centerY = y + rowHeight / 2;
    return `<rect x="${m}" y="${y}" width="${numberWidth}" height="${rowHeight}" rx="12" fill="${theme.accent}"/>${semanticIcon(item, iconX, centerY, 47, theme.accentInk)}<text x="${m + numberWidth - 16}" y="${centerY + 11}" fill="${theme.accentInk}" text-anchor="end" font-size="27" font-weight="900">${String(index + 1).padStart(2, '0')}</text><rect x="${textX}" y="${y}" width="${w - m - textX}" height="${rowHeight}" rx="12" fill="${theme.panel}" stroke="${theme.soft}" stroke-width="3"/>${block.svg}`;
  }).join('');
  return `${title.svg}${rows}`;
}

function customColumnLabels(slide, fallback) {
  const labels = String(slide.accent || '').split('|').map((item) => item.trim()).filter(Boolean);
  return labels.length === 2 ? labels : fallback;
}

function dualColumnLayout(slide, context, labels) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const title = context.addText('headline', slide.headline, {x: m, y: 220, width: w - m * 2, height: 310}, {size: 88, minSize: 43, maxLines: 3, weight: 900, color: theme.ink});
  const items = splitItems(slide.body, 6);
  const split = Math.ceil(items.length / 2);
  const columns = [items.slice(0, split), items.slice(split)];
  const gap = 26;
  const width = (w - m * 2 - gap) / 2;
  const panelTop = vertical ? 650 : 575;
  const maxRows = Math.max(1, ...columns.map((column) => column.length));
  const rowHeight = vertical ? 170 : 145;
  const panelHeight = Math.min(bottom - panelTop, 116 + maxRows * rowHeight + 36);
  const panels = columns.map((column, columnIndex) => {
    const x = m + columnIndex * (width + gap);
    const bulletRows = column.map((item, index) => {
      const rowTop = panelTop + 116 + index * rowHeight;
      const size = /^[$€£]\s*\d/.test(item) ? 50 : 38;
      const block = context.addText(`column-${columnIndex + 1}-item-${index + 1}`, item, {x: x + 62, y: rowTop + 8, width: width - 88, height: rowHeight - 24}, {size, minSize: 25, maxLines: 3, weight: 760, color: theme.ink});
      return `<circle cx="${x + 31}" cy="${rowTop + 31}" r="12" fill="${columnIndex ? theme.ink : theme.accent}"/>${block.svg}`;
    }).join('');
    const headerColor = columnIndex ? theme.ink : theme.accent;
    const headerInk = columnIndex ? theme.paper : theme.accentInk;
    return `<rect x="${x}" y="${panelTop}" width="${width}" height="${panelHeight}" rx="18" fill="${theme.panel}" stroke="${columnIndex ? theme.soft : theme.accent}" stroke-width="4"/><path d="M${x + 18} ${panelTop} H${x + width - 18} Q${x + width} ${panelTop} ${x + width} ${panelTop + 18} V${panelTop + 88} H${x} V${panelTop + 18} Q${x} ${panelTop} ${x + 18} ${panelTop}" fill="${headerColor}"/><text x="${x + 30}" y="${panelTop + 59}" fill="${headerInk}" font-size="32" font-weight="900">${esc(labels[columnIndex] || '')}</text>${bulletRows}`;
  }).join('');
  return `${title.svg}${panels}<circle cx="${w / 2}" cy="${panelTop + 44}" r="27" fill="${theme.paper}" stroke="${theme.soft}" stroke-width="3"/><text x="${w / 2}" y="${panelTop + 54}" text-anchor="middle" fill="${theme.ink}" font-size="24" font-weight="900">VS</text>`;
}

function splitStat(value) {
  const parts = String(value || '').split(/\s*\/\s*/).map((item) => item.trim()).filter(Boolean);
  return parts.length === 2 ? parts : null;
}

function statLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const panelY = vertical ? 340 : 260;
  const panelHeight = vertical ? 510 : 360;
  const stat = String(slide.stat || slide.accent || '—');
  const parts = splitStat(stat);
  let metricSvg;
  if (parts) {
    const labels = customColumnLabels(slide, ['VALOR A', 'VALOR B']);
    const cellWidth = (w - m * 2) / 2;
    metricSvg = parts.map((part, index) => {
      const x = m + index * cellWidth;
      const value = context.addText(`stat-${index + 1}`, part, {x: x + 38, y: panelY + (vertical ? 120 : 94), width: cellWidth - 76, height: vertical ? 245 : 180}, {size: vertical ? 220 : 180, minSize: 72, maxLines: 1, weight: 900, color: index ? theme.paper : theme.accent, letterSpacing: -5});
      return `<text x="${x + 38}" y="${panelY + 72}" fill="${theme.soft}" font-size="27" font-weight="800">${esc(labels[index])}</text>${value.svg}`;
    }).join('') + `<line x1="${w / 2}" y1="${panelY + 55}" x2="${w / 2}" y2="${panelY + panelHeight - 55}" stroke="${theme.soft}" stroke-width="3" opacity=".55"/>`;
  } else {
    metricSvg = context.addText('stat', stat, {x: m + 42, y: panelY + 80, width: w - m * 2 - 84, height: panelHeight - 110}, {size: vertical ? 260 : 220, minSize: 72, maxLines: 2, weight: 900, color: theme.accent, letterSpacing: -6}).svg;
  }
  const titleTop = panelY + panelHeight + (vertical ? 85 : 70);
  const title = context.addText('headline', slide.headline, {x: m, y: titleTop, width: w - m * 2, height: vertical ? 310 : 240}, {size: vertical ? 94 : 86, minSize: 42, maxLines: 3, weight: 900, color: theme.ink});
  const bodyTop = vertical ? 1320 : 1000;
  const body = context.addText('body', slide.body, {x: m, y: bodyTop, width: w - m * 2, height: bottom - bodyTop}, {size: 40, minSize: 27, maxLines: 5, weight: 550, color: theme.ink});
  return `<rect x="${m}" y="${panelY}" width="${w - m * 2}" height="${panelHeight}" rx="22" fill="${theme.ink}"/><circle cx="${w - m - 55}" cy="${panelY + 55}" r="24" fill="${theme.accent}"/>${metricSvg}${title.svg}${body.svg}`;
}

function stepsLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const title = context.addText('headline', slide.headline, {x: m, y: 220, width: w - m * 2, height: 310}, {size: 90, minSize: 44, maxLines: 3, weight: 900, color: theme.ink});
  const items = splitItems(slide.body, 4);
  const listTop = vertical ? 690 : 590;
  const rowHeight = Math.min(vertical ? 250 : 175, Math.floor((bottom - listTop) / Math.max(1, items.length)));
  const rows = items.map((item, index) => {
    const y = listTop + index * rowHeight;
    const block = context.addText(`step-${index + 1}`, item, {x: 225, y: y + 14, width: w - 310, height: rowHeight - 28}, {size: 42, minSize: 27, maxLines: 4, weight: 700, color: theme.ink});
    return `<circle cx="${m + 55}" cy="${y + 45}" r="52" fill="${theme.accent}"/><text x="${m + 55}" y="${y + 61}" text-anchor="middle" fill="${theme.accentInk}" font-size="43" font-weight="900">${index + 1}</text>${index < items.length - 1 ? `<line x1="${m + 55}" y1="${y + 98}" x2="${m + 55}" y2="${y + rowHeight - 8}" stroke="${theme.soft}" stroke-width="8"/>` : ''}${block.svg}`;
  }).join('');
  return `${title.svg}${rows}`;
}

function quoteLayout(slide, context) {
  const {w, h, m, theme} = context;
  const vertical = h > 1500;
  const quote = context.addText('quote', slide.body || slide.headline, {x: m + 36, y: vertical ? 640 : 470, width: w - m * 2 - 72, height: vertical ? 660 : 480}, {size: vertical ? 76 : 62, minSize: 34, maxLines: 8, weight: 800, color: theme.ink});
  const photo = context.assetDataUri ? context.addAsset('portrait', {x: w - m - 220, y: 210, width: 220, height: 220}, {fit: 'cover'}) : '';
  return `${photo}<text x="${m}" y="${vertical ? 590 : 430}" fill="${theme.accent}" font-size="210" font-family="Georgia, serif">“</text>${quote.svg}<line x1="${m}" y1="${vertical ? 1460 : 1080}" x2="${w - m}" y2="${vertical ? 1460 : 1080}" stroke="${theme.accent}" stroke-width="12"/>`;
}

function verdictLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const bandY = vertical ? 320 : 280;
  const bandHeight = vertical ? 390 : 315;
  const title = context.addText('headline', slide.headline, {x: m + 36, y: bandY + 35, width: w - m * 2 - 72, height: bandHeight - 70}, {size: vertical ? 90 : 82, minSize: 43, maxLines: 4, weight: 900, color: theme.accentInk});
  let content;
  if (context.assetDataUri && vertical) {
    const imageBox = {x: m, y: bandY + bandHeight + 65, width: w - m * 2, height: 620};
    const bodyTop = imageBox.y + imageBox.height + 58;
    const body = context.addText('body', slide.body, {x: m, y: bodyTop, width: w - m * 2, height: bottom - bodyTop}, {size: 40, minSize: 27, maxLines: 7, weight: 650, color: theme.ink});
    content = `${context.addAsset('verdict-image', imageBox)}${body.svg}`;
  } else if (context.assetDataUri) {
    const contentTop = bandY + bandHeight + 70;
    const imageBox = {x: m, y: contentTop, width: 390, height: bottom - contentTop};
    const bodyX = m + imageBox.width + 54;
    const body = context.addText('body', slide.body, {x: bodyX, y: contentTop + 25, width: w - m - bodyX, height: bottom - contentTop - 40}, {size: 39, minSize: 26, maxLines: 10, weight: 650, color: theme.ink});
    content = `${context.addAsset('verdict-image', imageBox)}${body.svg}`;
  } else {
    const bodyTop = bandY + bandHeight + 80;
    content = context.addText('body', slide.body, {x: m, y: bodyTop, width: w - m * 2, height: bottom - bodyTop}, {size: 44, minSize: 28, maxLines: 8, weight: 650, color: theme.ink}).svg;
  }
  return `<rect x="${m}" y="${bandY}" width="${w - m * 2}" height="${bandHeight}" rx="20" fill="${theme.accent}"/>${title.svg}${content}`;
}

function ctaLayout(slide, context) {
  const {w, h, m, theme, bottom} = context;
  const vertical = h > 1500;
  const title = context.addText('headline', slide.headline, {x: m, y: vertical ? 500 : 350, width: w - m * 2, height: vertical ? 650 : 500}, {size: vertical ? 116 : 100, minSize: 50, maxLines: 5, weight: 900, color: theme.ink, letterSpacing: -2});
  const bandY = vertical ? 1390 : 975;
  const body = context.addText('body', slide.body, {x: m + 40, y: bandY + 55, width: w - m * 2 - 80, height: bottom - bandY - 60}, {size: 42, minSize: 28, maxLines: 5, weight: 650, color: theme.paper});
  return `<circle cx="${w - m - 76}" cy="250" r="76" fill="${theme.accent}"/><path d="M${w - m - 112} 250h72m-28-28 28 28-28 28" fill="none" stroke="${theme.accentInk}" stroke-width="10"/>${title.svg}<rect x="${m}" y="${bandY}" width="${w - m * 2}" height="${bottom - bandY}" rx="18" fill="${theme.ink}"/>${body.svg}`;
}

const LAYOUT_RENDERERS = {
  'cover-hero': coverLayout,
  'photo-annotation': photoAnnotationLayout,
  'feature-list': featureListLayout,
  'pros-cons': (slide, context) => dualColumnLayout(slide, context, customColumnLabels(slide, ['A FAVOR', 'A VIGILAR'])),
  comparison: (slide, context) => dualColumnLayout(slide, context, customColumnLabels(slide, ['ANTES', 'AHORA'])),
  stat: statLayout,
  steps: stepsLayout,
  quote: quoteLayout,
  verdict: verdictLayout,
  cta: ctaLayout
};

function overlap(first, second, padding = 8) {
  return first.x < second.x + second.width + padding && first.x + first.width + padding > second.x && first.y < second.y + second.height + padding && first.y + first.height + padding > second.y;
}

export function inspectCarouselLayout(project, slideOrIndex, formatName = 'instagram-feed', {assetDataUri = null} = {}) {
  const format = carouselFormat(formatName);
  const slide = typeof slideOrIndex === 'number' ? project.slides[slideOrIndex] : project.slides.find((item) => item.id === slideOrIndex);
  if (!slide) throw new Error('Diapositiva no encontrada.');
  const theme = CAROUSEL_THEMES[project.theme] || CAROUSEL_THEMES.forge;
  const w = format.width;
  const h = format.height;
  const m = Math.round(w * 0.075);
  const context = createLayoutContext(slide, {w, h, m, theme, assetDataUri});
  const layout = LAYOUT_RENDERERS[slide.layout] || featureListLayout;
  const svg = layout(slide, context);
  const collisions = [];
  for (let firstIndex = 0; firstIndex < context.elements.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < context.elements.length; secondIndex += 1) {
      const first = context.elements[firstIndex];
      const second = context.elements[secondIndex];
      if (overlap(first, second)) collisions.push([first.id, second.id]);
    }
  }
  return {svg, elements: context.elements, overflows: context.elements.filter((item) => item.overflow).map((item) => item.id), collisions};
}

export function renderCarouselSvg(project, slideOrIndex, formatName = 'instagram-feed', {assetDataUri = null} = {}) {
  const format = carouselFormat(formatName);
  const slide = typeof slideOrIndex === 'number' ? project.slides[slideOrIndex] : project.slides.find((item) => item.id === slideOrIndex);
  if (!slide) throw new Error('Diapositiva no encontrada.');
  const index = project.slides.findIndex((item) => item.id === slide.id);
  const theme = CAROUSEL_THEMES[project.theme] || CAROUSEL_THEMES.forge;
  const w = format.width;
  const h = format.height;
  const m = Math.round(w * 0.075);
  const composition = inspectCarouselLayout(project, slide.id, formatName, {assetDataUri}).svg;
  const progressWidth = (w - m * 2) * ((index + 1) / project.slides.length);
  const labelWidth = Math.min(w - m * 2 - 170, Math.max(170, String(slide.label || '').length * 17 + 38));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" data-layout="${esc(slide.layout)}" data-format="${format.id}"><rect width="${w}" height="${h}" fill="${theme.paper}"/><defs><pattern id="dot-grid" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.4" fill="${theme.ink}" opacity=".055"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#dot-grid)"/><g font-family="Arial, Helvetica, sans-serif"><text x="${m}" y="72" fill="${theme.ink}" font-size="25" font-weight="800">@${esc(project.handle || 'shortsmith.ai')}</text><text x="${w - m}" y="72" text-anchor="end" fill="${theme.ink}" font-family="Consolas, monospace" font-size="23">${String(index + 1).padStart(2, '0')} / ${String(project.slides.length).padStart(2, '0')}</text><rect x="${m}" y="112" width="${labelWidth}" height="52" rx="7" fill="${theme.ink}"/><text x="${m + 18}" y="147" fill="${theme.paper}" font-family="Consolas, monospace" font-size="25" font-weight="700">${esc(slide.label)}</text>${composition}<rect x="${m}" y="${h - 48}" width="${w - m * 2}" height="9" rx="4" fill="${theme.soft}"/><rect x="${m}" y="${h - 48}" width="${progressWidth}" height="9" rx="4" fill="${theme.accent}"/></g></svg>`;
}

export {CAROUSEL_FORMATS, CAROUSEL_THEMES};
