import assert from 'node:assert/strict';
import test from 'node:test';
import {buildCaptionPages, resolveCaptionStyle} from '../src/modules/shorts-studio/captions.js';
import {resolveSoundCue, soundFamilyIds} from '../src/modules/shorts-studio/sound.js';
import {naturalCompare, slugify, staticPath} from '../src/modules/shorts-studio/constants.js';
import {flattenWords} from '../src/modules/shorts-studio/ingest.js';
import {focusFromFace} from '../src/modules/shorts-studio/face-tracking.js';

const words = (entries) => entries.map(([text, start, end]) => ({text, start, end}));

test('slugify normaliza acentos, mayusculas y separadores', () => {
  assert.equal(slugify('Harness vs Modelo — Kimi K3'), 'harness-vs-modelo-kimi-k3');
  assert.equal(slugify('costs.PNG'), 'costs-png');
  assert.equal(slugify('  ¡Ahorrar Límites!  '), 'ahorrar-limites');
});

test('staticPath produce rutas con separador de URL', () => {
  assert.equal(staticPath('demo', 'clips', '01.mp4'), 'projects/shorts/demo/clips/01.mp4');
});

test('naturalCompare ordena 2 antes de 10', () => {
  assert.deepEqual(['10.mkv', '2.mkv', '1.mkv'].sort(naturalCompare), ['1.mkv', '2.mkv', '10.mkv']);
});

test('las paginas de subtitulo respetan el tope de caracteres', () => {
  const style = resolveCaptionStyle({});
  const pages = buildCaptionPages(
    words([
      ['Esto', 0, 0.3],
      ['es', 0.3, 0.5],
      ['Amaliometria,', 0.5, 1.1],
      ['sigueme', 1.1, 1.6],
      ['para', 1.6, 1.9],
      ['no', 1.9, 2.1],
      ['perderte', 2.1, 2.6],
      ['nada', 2.6, 3]
    ]),
    {startSeconds: 0, endSeconds: 3.2}
  );
  assert.ok(pages.length > 1);
  for (const page of pages) {
    const text = page.words.map((word) => word.text).join(' ');
    assert.ok(
      text.length <= Math.round(style.maxPageChars * 1.2),
      `pagina demasiado larga: "${text}" (${text.length})`
    );
  }
});

test('una pausa larga corta la pagina', () => {
  const pages = buildCaptionPages(
    words([['uno', 0, 0.3], ['dos', 0.35, 0.6], ['tres', 1.6, 1.9]]),
    {startSeconds: 0, endSeconds: 2.2}
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].words.map((word) => word.text), ['tres']);
});

test('la ultima palabra suelta se fusiona con la pagina anterior', () => {
  const pages = buildCaptionPages(
    words([['Deja', 0, 0.4], ['de', 0.4, 0.6], ['usar', 0.6, 1], ['Claude', 1.1, 1.5], ['Code', 1.6, 2]]),
    {startSeconds: 0, endSeconds: 2.2}
  );
  assert.equal(pages.length, 1, 'no debe quedar "Code" como pagina huerfana');
});

test('los tiempos de pagina son relativos al recorte de la escena', () => {
  const pages = buildCaptionPages(
    words([['antes', 0, 1], ['dentro', 8, 8.5]]),
    {startSeconds: 7.5, endSeconds: 10}
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].words[0].text, 'dentro');
  assert.equal(pages[0].words[0].start, 0.5);
});

test('el sonido se pide por familia y devuelve un fichero de la libreria', () => {
  const cue = resolveSoundCue('impact', 3.5, 1);
  assert.match(cue.file, /^sfx\/.+\.wav$/);
  assert.equal(cue.startSeconds, 3.5);
  assert.ok(cue.volume > 0 && cue.volume <= 1);
  assert.ok(soundFamilyIds.includes('impact'));
});

test('una familia de sonido inexistente falla con las opciones disponibles', () => {
  assert.throws(() => resolveSoundCue('inexistente', 0), /Familia de sonido desconocida/);
});

test('la intensidad de sonido nunca supera el techo', () => {
  assert.ok(resolveSoundCue('impact', 0, 10).volume <= 1);
});

test('flattenWords conserva los tiempos por palabra', () => {
  const flat = flattenWords([
    {start: 0, end: 1, text: 'hola mundo', words: [
      {word: 'hola', start: 0, end: 0.4, probability: 0.9},
      {word: 'mundo', start: 0.4, end: 1, probability: 0.8}
    ]}
  ]);
  assert.equal(flat.length, 2);
  assert.equal(flat[0].timing, 'word');
  assert.equal(flat[1].start, 0.4);
  assert.deepEqual(flat.map((word) => word.index), [0, 1]);
});

test('flattenWords reparte tiempos cuando el segmento no trae palabras', () => {
  const flat = flattenWords([{start: 0, end: 2, text: 'una dos'}]);
  assert.equal(flat.length, 2);
  assert.equal(flat[0].timing, 'approximate');
  assert.equal(flat[1].end, 2);
});

test('el punto focal deja aire sobre la cabeza', () => {
  const media = {width: 1920, height: 1080};
  const focus = focusFromFace({x: 800, y: 200, w: 300, h: 300}, media);
  assert.ok(focus.x > 0.4 && focus.x < 0.6);
  // Centro de cara en 0.324; el foco baja para encuadrar hasta el pecho.
  assert.ok(focus.y > 0.324, `esperaba un foco por debajo del centro de la cara, fue ${focus.y}`);
});
