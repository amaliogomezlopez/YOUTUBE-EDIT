const THEMES = {
  signal: {paper: '#f4f0e7', ink: '#11110f', accent: '#e45f35', soft: '#d8d0c1'},
  cobalt: {paper: '#e9f0ef', ink: '#10253c', accent: '#1769ff', soft: '#b9cbc8'},
  acid: {paper: '#eeff41', ink: '#111111', accent: '#f24b26', soft: '#c6d83a'},
  night: {paper: '#121212', ink: '#f4f0e7', accent: '#ff6b3d', soft: '#353535'}
};

function esc(value) { return String(value || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }
function lines(text, max = 16) {
  const words = String(text || '').split(/\s+/); const out = []; let row = '';
  for (const word of words) { const next = `${row} ${word}`.trim(); if (next.length > max && row) { out.push(row); row = word; } else row = next; }
  if (row) out.push(row); return out.slice(0, 5);
}
function tspans(rows, x, y, gap, attrs = '') { return rows.map((r, i) => `<text x="${x}" y="${y + i * gap}" ${attrs}>${esc(r)}</text>`).join(''); }

export function renderStorySvg(story, index, options = {}) {
  const s = story.slides[index]; if (!s) throw new Error('Diapositiva no encontrada.');
  const t = THEMES[story.theme] || THEMES.signal; const n = story.slides.length;
  const headline = lines(s.headline, s.layout === 'stat' ? 12 : 15);
  const body = lines(s.body, 35);
  const photo = s.imageUrl && /^https?:\/\//.test(s.imageUrl) ? `<image href="${esc(s.imageUrl)}" x="90" y="245" width="900" height="710" preserveAspectRatio="xMidYMid slice"/><rect x="90" y="245" width="900" height="710" fill="none" stroke="${t.ink}" stroke-width="5"/>` : '';
  let composition = '';
  if (s.layout === 'cover') composition = `${photo}<rect x="90" y="${photo ? 1010 : 380}" width="165" height="18" fill="${t.accent}"/>${tspans(headline, 86, photo ? 1165 : 590, 148, `fill="${t.ink}" font-size="138" font-weight="900" letter-spacing="-6"` )}`;
  else if (s.layout === 'stat') composition = `<text x="86" y="610" fill="${t.accent}" font-size="270" font-weight="900" letter-spacing="-12">${esc(s.stat || headline[0] || '01')}</text>${tspans(headline.slice(s.stat ? 0 : 1), 90, 800, 130, `fill="${t.ink}" font-size="120" font-weight="900" letter-spacing="-4"`)}${tspans(body, 92, 1230, 64, `fill="${t.ink}" font-size="49" font-weight="500"` )}`;
  else composition = `${tspans(headline, 86, 500, 145, `fill="${t.ink}" font-size="132" font-weight="900" letter-spacing="-6"`)}<line x1="90" y1="${560 + headline.length*145}" x2="990" y2="${560 + headline.length*145}" stroke="${t.accent}" stroke-width="14"/>${tspans(body, 92, 690 + headline.length*145, 66, `fill="${t.ink}" font-size="50" font-weight="500"` )}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="${t.paper}"/><defs><pattern id="grain" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="4" r="1" fill="${t.ink}" opacity=".06"/></pattern></defs><rect width="1080" height="1920" fill="url(#grain)"/><text x="86" y="92" fill="${t.ink}" font-family="Arial, sans-serif" font-size="27" font-weight="700" letter-spacing="2">@${esc(options.handle || 'shortsmith.ai')}</text><rect x="86" y="145" width="${Math.max(170, s.label.length * 19)}" height="58" fill="${t.ink}"/><text x="105" y="185" fill="${t.paper}" font-family="Consolas, monospace" font-size="28" letter-spacing="2">${esc(s.label)}</text><g font-family="Arial Narrow, Impact, sans-serif">${composition}</g><text x="86" y="1815" fill="${t.ink}" font-family="Consolas, monospace" font-size="25">${String(index + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</text><path d="M890 1798h100m-30-30 30 30-30 30" fill="none" stroke="${t.accent}" stroke-width="10"/><rect x="86" y="1865" width="${(908 / n) * (index + 1)}" height="10" fill="${t.accent}"/><rect x="86" y="1865" width="908" height="10" fill="none" stroke="${t.soft}" stroke-width="2"/></svg>`;
}

export {THEMES};
