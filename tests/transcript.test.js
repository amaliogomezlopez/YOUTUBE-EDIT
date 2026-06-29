import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJsonTranscript, parseSrtTranscript, parseTranscriptText} from '../src/lib/transcript.js';

test('parses SRT captions with timestamps', () => {
  const captions = parseSrtTranscript(`1
00:00:01,000 --> 00:00:04,500
No sabes el error que casi nos cuesta todo.

2
00:00:04,500 --> 00:00:07,000
Por eso cambiamos el proceso.
`);
  assert.equal(captions.length, 2);
  assert.equal(captions[0].start, 1);
  assert.equal(captions[0].end, 4.5);
  assert.match(captions[0].text, /error/);
});

test('parses JSON captions in remotion-like shape', () => {
  const captions = parseJsonTranscript(JSON.stringify({
    captions: [
      {startMs: 0, endMs: 1200, text: 'Hola mundo'},
      {startMs: 1200, endMs: 2400, text: 'Clip dos'}
    ]
  }));
  assert.equal(captions.length, 2);
  assert.equal(captions[1].start, 1.2);
});

test('approximates plain text when no timestamps exist', () => {
  const captions = parseTranscriptText('Primera frase. Segunda frase importante.', 'transcript.txt', 20);
  assert.equal(captions.length, 2);
  assert.equal(captions.at(-1).end, 20);
});

test('cleans repeated youtube auto-caption overlap', () => {
  const captions = parseSrtTranscript(`1
00:00:01,000 --> 00:00:03,000
Hola a todos, ¿listos para las vitaminas de mañana?

2
00:00:03,000 --> 00:00:05,000
para las vitaminas de mañana? Hoy probamos Nemotron y Whisper.

3
00:00:05,000 --> 00:00:07,000
Hoy probamos Nemotron y Whisper. Whisper. Whisper.
`);
  assert.equal(captions.map((caption) => caption.text).join(' '), 'Hola a todos, ¿listos para las vitaminas de mañana? Hoy probamos Nemotron y Whisper.');
});

test('cleans shifted youtube overlap from nearby tail', () => {
  const captions = parseSrtTranscript(`1
00:00:01,000 --> 00:00:03,000
Seos solo refresca los precios una vez al día a las 10:15. ¿Cómo quieres que se

2
00:00:03,000 --> 00:00:05,000
las 10:15. ¿Cómo quieres que se la progresión de precios? actualice la progresión de precios?
`);
  assert.equal(captions.map((caption) => caption.text).join(' '), 'Seos solo refresca los precios una vez al día a las 10:15. ¿Cómo quieres que se la progresión de precios? actualice la progresión de precios?');
});
