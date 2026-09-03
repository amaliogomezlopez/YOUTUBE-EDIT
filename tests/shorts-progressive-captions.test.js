import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCaptionPages,
  chooseHeroIndex,
  compactCaptionCompounds
} from '../src/modules/video-studio/captions.js';

const words = (entries) => entries.map(([text, start, end]) => ({text, start, end}));

test('el hero es la palabra con carga: digitos y longitud mandan', () => {
  const pages = buildCaptionPages(
    words([['el', 0, 0.2], ['ingreso', 0.2, 0.6], ['2024', 0.6, 1], ['subio', 1, 1.4]]),
    {startSeconds: 0, endSeconds: 1.6},
    {mode: 'progressive'}
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].words[pages[0].heroIndex].text, '2024');
});

test('una stop-word nunca sale hero aunque sea la unica candidata', () => {
  const pages = buildCaptionPages(
    words([['uno', 0, 0.3], ['de', 0.3, 0.5], ['dos', 0.5, 0.9]]),
    {startSeconds: 0, endSeconds: 1.1},
    {mode: 'progressive'}
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].heroIndex, -1);
});

test('una pagina de menos de tres palabras no tiene hero', () => {
  const pages = buildCaptionPages(
    words([['hola', 0, 0.4], ['mundo', 0.5, 1]]),
    {startSeconds: 0, endSeconds: 1.2},
    {mode: 'progressive'}
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].heroIndex, -1);
  assert.equal(chooseHeroIndex([{text: 'unica'}]), -1);
});

test('el hero no puede abrir ni cerrar la pagina', () => {
  assert.equal(chooseHeroIndex(words([['de', 0, 0.2], ['crecimiento', 0.2, 0.8], ['de', 0.8, 1]])), 1);
  // Aunque la primera palabra sea la mas fuerte, el hero necesita lead y tail.
  const index = chooseHeroIndex(words([['increible', 0, 0.5], ['resultado', 0.5, 1], ['final', 1, 1.4]]));
  assert.ok(index === 1, `el hero cae en el centro, no en los bordes (salio ${index})`);
});

test('el modo karaoke produce exactamente la salida de siempre', () => {
  const input = words([
    ['Esto', 0, 0.3],
    ['es', 0.3, 0.5],
    ['Amaliometria,', 0.5, 1.1],
    ['sigueme', 1.1, 1.6],
    ['para', 1.6, 1.9],
    ['no', 1.9, 2.1],
    ['perderte', 2.1, 2.6],
    ['nada', 2.6, 3]
  ]);
  const window = {startSeconds: 0, endSeconds: 3.2};
  const karaoke = buildCaptionPages(input, window);
  const progressive = buildCaptionPages(input, window, {mode: 'progressive'});
  for (const page of karaoke) {
    assert.ok(!('heroIndex' in page), 'el karaoke no ensucia la salida con heroIndex');
  }
  // El progresivo solo anade heroIndex: paginacion y tiempos son los mismos.
  assert.deepEqual(
    progressive.map(({heroIndex, ...page}) => page),
    karaoke
  );
});

test('el nombre del modelo y su version decimal forman una unidad indivisible', () => {
  const compacted = compactCaptionCompounds(words([
    ['que', 0, 0.2],
    ['GLM', 0.2, 0.5],
    ['5', 0.5, 0.7],
    ['.2', 0.7, 0.9]
  ]));
  assert.deepEqual(compacted.map((word) => word.text), ['que', 'GLM\u00A05.2']);
  assert.equal(compacted[1].start, 0.2);
  assert.equal(compacted[1].end, 0.9);
});
