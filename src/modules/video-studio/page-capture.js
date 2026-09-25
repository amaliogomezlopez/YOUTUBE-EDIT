/**
 * Captura de una noticia encuadrada en su titular.
 *
 * La imagen para compartir (og:image) de muchas noticias es una tarjeta con el titular
 * reescrito encima; en pantalla se lee como un rotulo generico. Una captura real de la
 * pagina, centrada en el titular, se lee como "esto se ha publicado". Se usa el Chrome
 * sin cabeza que ya trae Remotion, controlado por el protocolo de DevTools con el
 * WebSocket nativo de Node: sin dependencias nuevas.
 *
 * No se salta ninguna proteccion: una pagina con desafio anti-bots falla y el recurso
 * queda pendiente para capturarlo a mano.
 */
import {spawn} from 'node:child_process';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function launch(chrome, {width, height}) {
  return new Promise(async (resolve, reject) => {
    const profile = await mkdtemp(path.join(tmpdir(), 'shortsmith-cdp-'));
    const proc = spawn(chrome, [
      '--headless', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--mute-audio',
      '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank'
    ], {windowsHide: true});
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Chrome no abrio el puerto de DevTools')), 20000);
    proc.stderr.on('data', (chunk) => {
      buffer += chunk;
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);
      if (match) {
        clearTimeout(timer);
        resolve({proc, profile, port: new URL(match[1]).port});
      }
    });
    proc.on('error', reject);
  });
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const {ok, fail} = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) fail(new Error(message.error.message));
        else ok(message.result);
      } else if (message.method) {
        for (const listener of listeners) listener(message);
      }
    };
    ws.onerror = () => reject(new Error('No se pudo conectar con DevTools'));
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((ok, fail) => {
        pending.set(++id, {ok, fail});
        ws.send(JSON.stringify({id, method, params}));
      }),
      once: (method, timeoutMs) => new Promise((ok) => {
        const timer = setTimeout(ok, timeoutMs);
        listeners.push((message) => { if (message.method === method) { clearTimeout(timer); ok(); } });
      }),
      close: () => ws.close()
    });
  });
}

/** Script de pagina: oculta lo fijo (cabecera, banners) y mide el titular. */
const MEASURE = `(() => {
  for (const el of document.querySelectorAll('body *')) {
    const position = getComputedStyle(el).position;
    if (position === 'fixed' || position === 'sticky') el.style.setProperty('display', 'none', 'important');
  }
  const h1 = document.querySelector('main h1, article h1, h1');
  if (!h1) return null;
  const r = h1.getBoundingClientRect();
  const color = getComputedStyle(document.body).backgroundColor;
  return {x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height,
    pageWidth: document.documentElement.scrollWidth, title: h1.innerText.trim(), doc: document.title, background: color};
})()`;

/**
 * Captura `url` encuadrada en su titular y la guarda en `output` (PNG). Devuelve el
 * titular leido de la pagina y el color de fondo, para rellenar sin costuras.
 */
export async function captureHeadline(url, {chrome, output, width = 1440, height = 900, scale = 2, settleMs = 2500}) {
  if (!/^https:\/\//.test(url)) throw new Error('Solo URLs https publicas: ' + url);
  const browser = await launch(chrome, {width, height});
  let page;
  try {
    const target = await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, {method: 'PUT'}).then((r) => r.json());
    page = await connect(target.webSocketDebuggerUrl);
    await page.send('Page.enable');
    await page.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: scale, mobile: false});
    const loaded = page.once('Page.loadEventFired', 30000);
    await page.send('Page.navigate', {url});
    await loaded;
    await sleep(settleMs);
    const {result} = await page.send('Runtime.evaluate', {expression: MEASURE, returnByValue: true});
    const box = result.value;
    if (!box || /just a moment|attention required|access denied/i.test(box.doc ?? '')) {
      throw new Error('Pagina sin titular o protegida; capturala a mano');
    }
    // Encuadre: el titular centrado en horizontal, con su antetitulo y fecha encima y
    // el arranque del texto debajo. Nunca mas estrecho que 60 % del ancho de pagina.
    const minWidth = Math.min(box.pageWidth, width * 0.6);
    const clipWidth = Math.min(box.pageWidth, Math.max(minWidth, box.width + 200));
    const center = box.x + box.width / 2;
    const clipX = Math.max(0, Math.min(box.pageWidth - clipWidth, center - clipWidth / 2));
    const clip = {x: clipX, y: Math.max(0, box.y - 170), width: clipWidth, height: box.height + 170 + 300, scale: 1};
    const shot = await page.send('Page.captureScreenshot', {format: 'png', clip, captureBeyondViewport: true});
    await writeFile(output, Buffer.from(shot.data, 'base64'));
    return {file: output, title: box.title, background: box.background, clip};
  } finally {
    page?.close();
    browser.proc.kill();
    await sleep(300);
    await rm(browser.profile, {recursive: true, force: true}).catch(() => {});
  }
}
