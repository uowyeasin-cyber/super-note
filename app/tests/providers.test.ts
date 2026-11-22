import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detect, parseRing, pickModel, ringText } from '../src/lib/providers.ts';

test('detects the service from the key', () => {
  assert.equal(detect('AIzaSyX'), 'gemini');
  assert.equal(detect('gsk_abc'), 'groq');
  assert.equal(detect('sk-or-v1-abc'), 'openrouter');
  assert.equal(detect('sk-ant-abc'), 'anthropic');
  assert.equal(detect('xai-abc'), 'xai');
  assert.equal(detect('sk-proj-abc'), 'openai');
});

test('reads several keys, one per line, and writes them back', () => {
  const ring = parseRing('AIzaA\ngsk_B\ndeepseek|sk-C|deepseek-chat\ncustom|K|my-model|https://x.example/v1/\ncustom|nourl');
  assert.deepEqual(ring, [
    { provider: 'gemini', key: 'AIzaA' },
    { provider: 'groq', key: 'gsk_B' },
    { provider: 'deepseek', key: 'sk-C', model: 'deepseek-chat' },
    { provider: 'custom', key: 'K', model: 'my-model', url: 'https://x.example/v1' },
  ]);
  assert.deepEqual(parseRing(ringText(ring)), ring);
});

test('old single Gemini key still works', () => {
  assert.deepEqual(parseRing('AIzaSyOld'), [{ provider: 'gemini', key: 'AIzaSyOld' }]);
  assert.deepEqual(parseRing(''), []);
});

test('picks a chat model from the live list', () => {
  assert.equal(pickModel('groq', ['whisper-large-v3', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'meta-llama/llama-guard-4']), 'openai/gpt-oss-120b');
  assert.equal(pickModel('openai', ['text-embedding-3-small', 'gpt-5', 'gpt-5-mini', 'dall-e-3']), 'gpt-5-mini');
  assert.equal(pickModel('xai', ['grok-4', 'grok-4-fast', 'grok-2-image']), 'grok-4-fast');
});
