import test from 'node:test';
import assert from 'node:assert/strict';
import {getLlmConfig} from '../src/lib/llm.js';
import {getSttConfig} from '../src/lib/stt.js';

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('LLM config falls through empty aliases to generic variables', () => {
  withEnvironment({
    LLM_PROVIDER: 'openai-compatible',
    OPENCODE_PROVIDER: undefined,
    MINIMAX_API_URL: undefined,
    OPENCODE_BASE_URL: '',
    LLM_BASE_URL: 'https://llm.example.test/v1',
    MINIMAX_API_KEY: '',
    OPENCODE_API_KEY: undefined,
    LLM_API_KEY: 'generic-key',
    OPENAI_API_KEY: undefined,
    MINIMAX_MODEL: undefined,
    OPENCODE_MODEL: '',
    LLM_MODEL: 'generic-model'
  }, () => {
    assert.deepEqual(getLlmConfig(), {
      provider: 'openai-compatible',
      baseUrl: 'https://llm.example.test/v1',
      apiKey: 'generic-key',
      model: 'generic-model'
    });
  });
});

test('LLM config uses documented defaults when aliases are absent', () => {
  withEnvironment({
    LLM_PROVIDER: undefined,
    OPENCODE_PROVIDER: undefined,
    MINIMAX_API_URL: undefined,
    OPENCODE_BASE_URL: undefined,
    LLM_BASE_URL: undefined,
    MINIMAX_API_KEY: undefined,
    OPENCODE_API_KEY: undefined,
    LLM_API_KEY: undefined,
    OPENAI_API_KEY: undefined,
    MINIMAX_MODEL: undefined,
    OPENCODE_MODEL: undefined,
    LLM_MODEL: undefined
  }, () => {
    const config = getLlmConfig();
    assert.equal(config.provider, 'off');
    assert.equal(config.baseUrl, 'https://api.openai.com/v1');
    assert.equal(config.apiKey, '');
    assert.equal(config.model, 'gpt-4o-mini');
  });
});

test('STT config falls through empty transcription aliases', () => {
  withEnvironment({
    TRANSCRIPTION_PROVIDER: '',
    STT_PROVIDER: 'faster-whisper',
    TRANSCRIPTION_MODEL: undefined,
    WHISPER_MODEL: 'small',
    TRANSCRIPTION_LANGUAGE: '',
    WHISPER_LANGUAGE: 'es'
  }, () => {
    assert.deepEqual(getSttConfig(), {
      provider: 'faster-whisper',
      model: 'small',
      language: 'es'
    });
  });
});

test('STT config defaults to off when no provider alias is set', () => {
  withEnvironment({
    TRANSCRIPTION_PROVIDER: undefined,
    STT_PROVIDER: undefined,
    TRANSCRIPTION_MODEL: undefined,
    WHISPER_MODEL: undefined,
    TRANSCRIPTION_LANGUAGE: undefined,
    WHISPER_LANGUAGE: undefined
  }, () => {
    assert.deepEqual(getSttConfig(), {provider: 'off', model: '', language: ''});
  });
});
