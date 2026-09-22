import path from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {run} from '../../lib/utils.js';

/**
 * Finds where each resource belongs in the talk and fetches web material with
 * its provenance. Nothing is invented: a resource without a clear moment, or a
 * URL that cannot be captured, goes to the pending queue for the editor.
 */

// Strong: the speaker announces a visual. Weak: deictics that also appear in passing.
const SHOW_STRONG = /\b(os voy a (mostrar|ensenar|poner)|te voy a (mostrar|ensenar)|vamos a ver|os ensen|os muestro|aqui teneis|aqui tenemos)\b/;
const SHOW_WEAK = /\b(podeis ver|podemos ver|vemos|veis|mira|mirad|fijaos|fijate|aqui|como veis|dice|dijo|publico|anuncio)\b/;
const WINDOW_WORDS = 25;
const TEXT_MATCH_WORDS = 3;
const fold = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "grok46" -> ["grok", "4.6"]: letters stay words, trailing digits read as a version. */
export function resourceTokens(name) {
  const base = fold(path.basename(name, path.extname(name))).replace(/[_-]+/g, ' ');
  return base.split(/\s+/).filter(Boolean).flatMap((part) => {
    const m = /^([a-z]+)(\d+)$/.exec(part);
    if (!m) return [part];
    const digits = m[2].length > 1 ? `${m[2][0]}.${m[2].slice(1)}` : m[2];
    return [m[1], digits];
  });
}

/** Normalizes spoken numbers so "4 .7", "4,7" and "4.7" compare equal. */
export function spokenText(text) {
  return fold(text).replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2').replace(/[^a-z0-9.ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mentions(sentence, tokens) {
  const text = ` ${spokenText(sentence)} `;
  const words = tokens.filter((t) => !/^\d/.test(t));
  const numbers = tokens.filter((t) => /^\d/.test(t));
  // A version number alone ("y 4.7") names the resource: speakers drop the family name on repeats.
  return numbers.length ? numbers.every((n) => text.includes(` ${n} `)) : words.every((w) => text.includes(` ${w} `));
}

const contentWords = (text) => new Set(spokenText(text).split(' ').filter((w) => w.length > 3));

/** A captured post or page is placed where the speaker says several of its words. */
export function sharesText(sentence, assetText) {
  const own = contentWords(assetText);
  let shared = 0;
  for (const w of contentWords(sentence)) if (own.has(w)) shared++;
  return shared >= Math.min(TEXT_MATCH_WORDS, own.size);
}

/** Run-on transcripts have no full stops; long sentences are cut into comma-bounded windows. */
function windows(sentences) {
  return sentences.flatMap((s) => {
    const words = s.words ?? String(s.text).split(/\s+/).map((text) => ({text, start: s.at}));
    if (words.length <= WINDOW_WORDS) return [s];
    const out = [];
    let start = 0;
    for (let i = 1; i <= words.length; i++) {
      if (i === words.length || (i - start >= WINDOW_WORDS / 2 && /,$/.test(words[i - 1].text)) || i - start >= WINDOW_WORDS) {
        out.push({...s, at: words[start].start ?? s.at, text: words.slice(start, i).map((w) => w.text).join(' ')});
        start = i;
      }
    }
    return out;
  });
}

/**
 * sentences: [{at, text, take, words?}] on the edit clock. Picks the sentence that
 * announces something visible most clearly and names the most resources together.
 * Named clips need an announcement; a captured text only needs to be quoted.
 */
export function placeResources(resources, sentences) {
  const placements = [], pending = [];
  const tokens = new Map(resources.map((r) => [r.id, resourceTokens(r.sourceName ?? r.name ?? '')]));
  const named = (s, r) => (r.text ? sharesText(s.text, r.text) : mentions(s.text, tokens.get(r.id)));
  const scored = windows(sentences).map((s) => {
    const text = spokenText(s.text);
    return {...s, named: resources.filter((r) => named(s, r)), shows: SHOW_STRONG.test(text) ? 2 : SHOW_WEAK.test(text) ? 1 : 0};
  });
  const used = new Set();
  const eligible = scored.filter((x) => x.named.length && (x.shows || x.named.every((r) => r.text)));
  for (const s of eligible.sort((a, b) => b.shows - a.shows || b.named.length - a.named.length || a.at - b.at)) {
    const fresh = s.named.filter((r) => !used.has(r.id));
    if (!fresh.length) continue;
    fresh.forEach((r) => used.add(r.id));
    placements.push({resources: fresh.map((r) => r.id), at: s.at, take: s.take, text: s.text,
      layout: fresh.length > 1 ? 'compare' : fresh[0].kind === 'image' ? 'full' : 'side'});
  }
  for (const r of resources) if (!used.has(r.id)) pending.push({resource: r.id, name: r.sourceName ?? r.name, reason: 'No hay una frase que lo nombre y anuncie algo visible'});
  return {placements: placements.sort((a, b) => a.at - b.at), pending};
}

export function provenance({file, bytes, url, provider, license, attribution, extra = {}}) {
  return {version: 1, file: path.basename(file), sha256: createHash('sha256').update(bytes).digest('hex'), url, provider,
    retrievedAt: new Date().toISOString(), license, attribution, ...extra};
}

async function saveWithProvenance(file, bytes, meta) {
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, bytes, {flag: 'wx'});
  const record = provenance({file, bytes, ...meta});
  await writeFile(file + '.provenance.json', JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  return record;
}

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', mdash: '—', nbsp: ' ', '#39': "'"};
const decode = (html) => String(html).replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1))) : m));
const escapeHtml = (text) => String(text ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

/** Official X embed (oEmbed): public, no login, no scraping of x.com. Returns the post's own fields. */
export async function fetchXEmbed(url, {fetchImpl = fetch} = {}) {
  if (!/^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+/.test(url)) throw Error('URL de post de X no valida: ' + url);
  const response = await fetchImpl(`https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`);
  if (!response.ok) throw Error(`oEmbed de X respondio ${response.status}`);
  const json = await response.json();
  const html = String(json.html ?? '');
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
  const text = decode(paragraph.replace(/<br\s*\/?>/g, '\n').replace(/<a[^>]*>(pic\.twitter\.com[^<]*)<\/a>/g, '').replace(/<[^>]+>/g, '')).trim();
  const date = decode(/<a[^>]*>([^<]*)<\/a>\s*<\/blockquote>/.exec(html)?.[1] ?? '');
  const handle = '@' + String(json.author_url ?? '').split('/').filter(Boolean).pop();
  if (!text) throw Error('El embed de X no trae texto');
  return {author: json.author_name, handle, authorUrl: json.author_url, text, date, url: json.url ?? url};
}

/**
 * Post card drawn from the oEmbed fields in the dark look of the editor's own X
 * captures. Media and avatars are not part of oEmbed: they are left out, never faked.
 */
export function xCardHtml(post) {
  const initial = escapeHtml([...String(post.author ?? '?')][0] ?? '?');
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:12px;background:#000;font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#e7e9ea}
.card{width:560px;padding:20px 22px;border:1px solid #2f3336;border-radius:16px;box-sizing:border-box}
.head{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.avatar{width:44px;height:44px;border-radius:50%;background:#1d9bf0;display:grid;place-items:center;font-weight:700;font-size:20px;color:#fff}
.name{font-weight:700;font-size:16px}.handle{color:#71767b;font-size:15px}
.text{font-size:19px;line-height:1.35;white-space:pre-wrap;overflow-wrap:break-word}
.date{color:#71767b;font-size:15px;margin-top:14px}
</style><div class="card"><div class="head"><div class="avatar">${initial}</div><div><div class="name">${escapeHtml(post.author)}</div><div class="handle">${escapeHtml(post.handle)}</div></div></div>
<div class="text">${escapeHtml(post.text)}</div><div class="date">${escapeHtml(post.date)}</div></div>`;
}

/** Screenshot of a local HTML file or a public page with the headless Chrome Remotion already ships. */
export async function screenshot({chrome, target, output, width = 1280, height = 1600, waitMs = 6000}) {
  await mkdir(path.dirname(output), {recursive: true});
  await run(chrome, ['--headless', '--hide-scrollbars', '--disable-gpu', `--window-size=${width},${height}`,
    `--virtual-time-budget=${waitMs}`, '--force-device-scale-factor=2', `--screenshot=${output}`, target], {timeoutMs: waitMs + 60_000});
  return output;
}

export async function captureXPost(url, {dir, chrome, sharp, fetchImpl}) {
  const post = await fetchXEmbed(url, {fetchImpl});
  const id = /status\/(\d+)/.exec(url)[1];
  const page = path.join(dir, `x-${id}.html`);
  await mkdir(dir, {recursive: true});
  await writeFile(page, xCardHtml(post));
  const raw = path.join(dir, `x-${id}.raw.png`);
  await screenshot({chrome, target: 'file:///' + page.replace(/\\/g, '/'), output: raw, width: 600, height: 1400, waitMs: 1500});
  // The card sits on black inside its border; trimming keeps the card only.
  const bytes = await sharp(raw).trim({background: '#000000', threshold: 10}).png().toBuffer();
  const {width, height} = await sharp(bytes).metadata();
  if (width < 400 || height < 150) throw Error(`Captura de X incompleta (${width}x${height})`);
  const file = path.join(dir, `x-${id}.png`);
  const record = await saveWithProvenance(file, bytes, {url, provider: 'x-oembed-card',
    license: 'Texto de un post de terceros obtenido con el oEmbed oficial de X; revisar uso antes de publicar',
    attribution: `${post.author} (${post.authorUrl})`, extra: {text: post.text, date: post.date}});
  return {file, kind: 'image', text: post.text, provenance: record};
}

export async function captureWebPage(url, {dir, chrome}) {
  if (!/^https:\/\//.test(url)) throw Error('Solo URLs https publicas: ' + url);
  const name = 'web-' + createHash('sha256').update(url).digest('hex').slice(0, 12) + '.png';
  const raw = path.join(dir, name.replace('.png', '.raw.png'));
  await screenshot({chrome, target: url, output: raw, width: 1280, height: 900});
  const bytes = await readFile(raw);
  const file = path.join(dir, name);
  const record = await saveWithProvenance(file, bytes, {url, provider: 'web-screenshot', license: 'Captura de pagina publica; revisar derechos antes de publicar', attribution: new URL(url).hostname});
  return {file, kind: 'image', text: '', provenance: record};
}
