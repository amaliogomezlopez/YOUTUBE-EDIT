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
