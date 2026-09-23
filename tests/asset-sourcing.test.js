import test from 'node:test';
import assert from 'node:assert/strict';
import {resourceTokens, spokenText, placeResources, sharesText, fetchXEmbed, xCardHtml} from '../src/modules/video-studio/asset-sourcing.js';

test('resource names read as spoken versions', () => {
  assert.deepEqual(resourceTokens('grok46.mkv'), ['grok', '4.6']);
  assert.equal(spokenText('Grok 4 .6 y 4,7, ¡genial!'), 'grok 4.6 y 4.7 genial');
});

test('resources go where the speaker announces them, together when named together', () => {
  const sentences = [
    {at: 3, take: 0, text: 'Grok 4.7 ya está aquí'},
    {at: 76, take: 5, text: 'el 4.6 no me lo comparan con Grok 4.7'},
    {at: 209, take: 12, text: 'A continuación os voy a mostrar los resultados con Grok 4.6 y 4.7,'}
  ];
  const {placements, pending} = placeResources([{id: 'a', sourceName: 'grok46.mkv'}, {id: 'b', sourceName: 'grok47.mkv'}, {id: 'c', sourceName: 'llama.mkv'}], sentences);
  assert.deepEqual(placements.map((p) => [p.at, p.layout, p.resources]), [[209, 'compare', ['a', 'b']]]);
  assert.deepEqual(pending.map((p) => p.resource), ['c']);
});

test('news captures flash on the first word that names them, announced or not', () => {
  const words = 'saque Claude Opus 5 .5 porque fijaos'.split(' ').map((text, i) => ({text, start: 3 + i * 0.4, end: 3.3 + i * 0.4}));
  const sentences = [{at: 3, take: 0, words, text: words.map((w) => w.text).join(' ')}, {at: 200, take: 4, text: 'os voy a mostrar Opus 5.5'}];
  const {placements} = placeResources([{id: 'n', kind: 'image', name: 'claude-opus-5-5', firstMention: true}], sentences);
  assert.deepEqual(placements.map((p) => [p.at, p.layout]), [[4.6, 'full']]);
  assert.deepEqual(resourceTokens('claude-opus-5-5'), ['claude', 'opus', '5.5']);
});

test('captured posts are placed where their words are quoted', () => {
  assert.ok(sharesText('Elon dice que Grok 4.7 necesita unos días más de cocción', 'Grok 4.7 needs a few more días cocción'));
  const {placements} = placeResources([{id: 'x', kind: 'image', text: 'Initial training complete, adding SpaceX engineering data'}],
    [{at: 12, take: 1, text: 'dijo que el training inicial está complete y añaden engineering data de SpaceX'}]);
  assert.deepEqual(placements.map((p) => [p.at, p.layout]), [[12, 'full']]);
});

test('X posts come from the official oEmbed and the card never renders markup from the post', async () => {
  const html = '<blockquote class="twitter-tweet"><p lang="en">a &amp; b <b>bold</b><br>line</p>&mdash; Jack (@jack) <a href="https://x.com/jack/status/20">March 21, 2006</a></blockquote>';
  const fetchImpl = async (url) => {
    assert.match(url, /^https:\/\/publish\.twitter\.com\/oembed\?/);
    return {ok: true, json: async () => ({html, author_name: 'Jack <script>', author_url: 'https://x.com/jack'})};
  };
  const post = await fetchXEmbed('https://x.com/jack/status/20', {fetchImpl});
  assert.equal(post.text, 'a & b bold\nline');
  assert.equal(post.date, 'March 21, 2006');
  assert.equal(post.handle, '@jack');
  assert.ok(!xCardHtml(post).includes('<script>'));
  await assert.rejects(fetchXEmbed('https://example.com/a', {fetchImpl}), /no valida/);
});
import {agyStreamMessage, parseAgyResult} from '../src/lib/agent-cli.js';

test('agy speaks NDJSON over stdin and only a SUCCESS result counts', () => {
  assert.deepEqual(JSON.parse(agyStreamMessage('hola "x"')), {event: 'user', message: {role: 'user', content: 'hola "x"'}});
  const result = {status: 'SUCCESS', response: '```json\n{"emphasis":[]}\n```', usage: {total_tokens: 5}, duration_seconds: 1};
  const ok = '{"event":"init"}\n' + JSON.stringify({event: 'result', result}) + '\n';
  assert.deepEqual(parseAgyResult(ok).json, {emphasis: []});
  assert.throws(() => parseAgyResult('{"event":"result","result":{"status":"ERROR","error":"sin cuota"}}'), /sin cuota/);
  assert.throws(() => parseAgyResult('{"event":"init"}'), /no devolvio/);
});
