import test from 'node:test';
import assert from 'node:assert/strict';
import {fallbackPlan, normalizeSlide} from '../src/lib/stories/planner.js';
import {renderStorySvg} from '../src/lib/stories/renderer.js';
import {getLlmConfig} from '../src/lib/llm.js';

test('fallback creates a complete story', () => {
  const story = fallbackPlan('Una noticia suficientemente larga sobre inteligencia artificial y nuevas herramientas para creadores.');
  assert.equal(story.slides.length, 3);
  assert.equal(story.slides[0].layout, 'cover');
  assert.match(renderStorySvg(story, 0), /width="1080" height="1920"/);
});

test('accepts openai-compatible label with a MiniMax endpoint', () => {
  const config = getLlmConfig({provider: 'openai-compatible', baseUrl: 'https://api.minimax.io/v1/text/chatcompletion_v2', apiKey: 'test', model: 'MiniMax-M3'});
  assert.equal(config.provider, 'openai-compatible');
  assert.match(config.baseUrl, /chatcompletion_v2$/);
});

test('normalizes untrusted layout and lengths', () => {
  const slide = normalizeSlide({layout: 'evil', headline: 'hola', body: 'x'.repeat(500)}, 1);
  assert.equal(slide.layout, 'statement');
  assert.equal(slide.body.length, 320);
});
