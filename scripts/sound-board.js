#!/usr/bin/env node
/**
 * Pagina de escucha de SONIDOS-REELS para elegir y ordenar sonidos por situacion.
 *
 *   npm run sonidos:escucha
 *
 * Escribe `SONIDOS-REELS/ESCUCHA.html`: cada sonido con su reproductor y, por cada
 * situacion de montaje (toma nueva, entrar a un b-roll, golpe de palabra, dinero…),
 * tres puestos para elegir los favoritos en orden. El boton final genera
 * `preferencias.json`, que se guarda en SONIDOS-REELS (o se pega en el chat) y que
 * intro-studio aplica en el siguiente build. La pagina es local: los sonidos no salen
 * del equipo.
 */
import path from 'node:path';
import {readFile, writeFile} from 'node:fs/promises';
import {loadDotEnv} from '../src/lib/utils.js';
import {SOUND_DROP_FOLDER} from '../src/modules/talking-head/sounds.js';
import {SOUND_PREFERENCES_FILE, SOUND_SITUATIONS, loadUserSoundPalette, soundName} from '../src/modules/intro-studio/sound.js';

await loadDotEnv();
const palette = await loadUserSoundPalette();
const catalog = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'talking-head', 'sound-catalog.json'), 'utf8'));
const preferences = await readFile(SOUND_PREFERENCES_FILE, 'utf8').then(JSON.parse, () => null);

const sounds = catalog.entries.map((entry) => ({
  name: soundName(entry.sourceName),
  src: entry.sourceName.split(/[\\/]/).map(encodeURIComponent).join('/'),
  seconds: Math.round(entry.durationSeconds * 100) / 100,
  use: entry.use
})).sort((a, b) => a.name.localeCompare(b.name));

// Lo que suena hoy en cada situacion (o lo ya elegido en preferencias.json).
const current = Object.fromEntries(SOUND_SITUATIONS.map((situation) => {
  const chosen = preferences?.situaciones?.[situation.id];
  if (chosen?.length) return [situation.id, chosen];
  const files = situation.openingRiser ? [palette.openingRiser].filter(Boolean) : palette.palette[situation.families[0]] ?? [];
  return [situation.id, files.map((file) => palette.sources[file]).filter(Boolean).map(soundName)];
}));

const data = {sounds, situations: SOUND_SITUATIONS.map(({id, label}) => ({id, label})), current, discarded: preferences?.descartados ?? []};
const html = `<!doctype html>
<html lang="es"><meta charset="utf-8"><title>Escucha de sonidos</title>
<style>
:root{--bg:#111;--card:#1b1b1b;--ink:#eee;--muted:#999;--accent:#FFD60A}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,Segoe UI,sans-serif;padding:24px;max-width:1100px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}
p{color:var(--muted);margin:4px 0 12px}
table{border-collapse:collapse;width:100%}td,th{padding:6px 8px;border-bottom:1px solid #2a2a2a;text-align:left;vertical-align:middle}
th{color:var(--muted);font-weight:600}
button{background:#2a2a2a;color:var(--ink);border:1px solid #3a3a3a;border-radius:6px;padding:4px 10px;cursor:pointer}
button.main{background:var(--accent);color:#111;border:0;font-weight:700;padding:10px 18px}
select{background:#222;color:var(--ink);border:1px solid #3a3a3a;border-radius:6px;padding:4px;max-width:300px}
.sit{background:var(--card);border-radius:10px;padding:12px 14px;margin:10px 0}
.sit b{display:block;margin-bottom:6px}.slot{display:inline-flex;gap:4px;align-items:center;margin:4px 12px 4px 0}
textarea{width:100%;height:220px;background:#0b0b0b;color:#bfe;border:1px solid #333;border-radius:8px;font:12px monospace}
.use{color:var(--muted);font-size:13px}
</style>
<h1>Tus sonidos, por situación</h1>
<p>1. Escucha los sonidos (▶). 2. En cada situación elige los sonidos en orden: la rotación va 1º → 2º → 3º… y vuelve a empezar. Repite un sonido en varios puestos para que suene más (es lo que hace «abusar» de él). Deja puestos en «—» si quieres menos variedad. 3. Marca «no usar» en los que no quieras oír nunca. 4. Pulsa «Generar preferencias» y guarda <code>preferencias.json</code> en esta carpeta, o pega el texto en el chat.</p>
<h2>Sonidos de la carpeta</h2>
<table id="sounds"><tr><th></th><th>Sonido</th><th>Duración</th><th>Uso por nombre</th><th>No usar</th></tr></table>
<h2>Situaciones</h2>
<div id="situations"></div>
<p><button class="main" id="make">Generar preferencias</button> <button id="copy">Copiar</button> <a id="download" download="preferencias.json" style="color:var(--accent);margin-left:8px"></a></p>
<textarea id="out" readonly></textarea>
<script>
const DATA = ${JSON.stringify(data)};
const player = new Audio();
const play = (src) => { player.pause(); player.src = src; player.currentTime = 0; player.play(); };
const bySrc = Object.fromEntries(DATA.sounds.map((s) => [s.name, s]));
const table = document.getElementById('sounds');
for (const s of DATA.sounds) {
  const tr = document.createElement('tr');
  tr.innerHTML = '<td><button>▶</button></td><td></td><td>' + s.seconds + ' s</td><td class="use">' + s.use + '</td><td><input type="checkbox"></td>';
  tr.children[1].textContent = s.name;
  tr.querySelector('button').onclick = () => play(s.src);
  const box = tr.querySelector('input'); box.dataset.name = s.name; box.checked = DATA.discarded.includes(s.name);
  table.appendChild(tr);
}
const sits = document.getElementById('situations');
for (const sit of DATA.situations) {
  const div = document.createElement('div'); div.className = 'sit';
  const title = document.createElement('b'); title.textContent = sit.label; div.appendChild(title);
  const slots = Math.min(8, Math.max(4, (DATA.current[sit.id] ?? []).length + 1));
  for (let i = 0; i < slots; i++) {
    const wrap = document.createElement('span'); wrap.className = 'slot';
    const sel = document.createElement('select'); sel.dataset.sit = sit.id;
    sel.appendChild(new Option((i + 1) + 'º —', ''));
    for (const s of DATA.sounds) sel.appendChild(new Option((i + 1) + 'º ' + s.name, s.name));
    sel.value = DATA.current[sit.id]?.[i] ?? '';
    const btn = document.createElement('button'); btn.textContent = '▶';
    btn.onclick = () => sel.value && play(bySrc[sel.value].src);
    wrap.append(sel, btn); div.appendChild(wrap);
  }
  sits.appendChild(div);
}
document.getElementById('make').onclick = () => {
  const situaciones = {};
  for (const sel of document.querySelectorAll('select')) {
    if (!sel.value) continue;
    (situaciones[sel.dataset.sit] ??= []).push(sel.value);
  }
  const descartados = [...document.querySelectorAll('#sounds input:checked')].map((b) => b.dataset.name);
  const json = JSON.stringify({version: 1, generadoEn: new Date().toISOString(), situaciones, descartados}, null, 2);
  document.getElementById('out').value = json;
  const a = document.getElementById('download');
  a.href = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  a.textContent = 'Descargar preferencias.json';
};
document.getElementById('copy').onclick = () => navigator.clipboard.writeText(document.getElementById('out').value);
</script>
</html>
`;
const target = path.join(SOUND_DROP_FOLDER, 'ESCUCHA.html');
await writeFile(target, html);
console.log(`Pagina de escucha: ${target}`);
console.log(`${sounds.length} sonidos, ${SOUND_SITUATIONS.length} situaciones${preferences ? ' (con tus preferencias actuales)' : ''}`);
