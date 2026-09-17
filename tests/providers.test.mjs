import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_PRESETS, PROVIDER_GROUPS, isKnownProviderId, getProviderPreset } from '../apps/web/dist/providers.js';

test('ships a broad set of provider presets', () => {
  assert.ok(PROVIDER_PRESETS.length >= 30, 'expected at least 30 presets');
  const ids = PROVIDER_PRESETS.map((preset) => preset.id);
  for (const id of ['sub2api', 'openai', 'deepseek', 'gemini', 'grok', 'glm', 'qwen', 'newapi', 'oneapi', 'opencode', 'custom']) {
    assert.ok(ids.includes(id), `missing provider preset: ${id}`);
  }
  assert.equal(new Set(ids).size, ids.length, 'preset ids must be unique');
});

test('every preset has a usable address (except custom) and a group', () => {
  for (const preset of PROVIDER_PRESETS) {
    assert.ok(preset.group, `missing group for ${preset.id}`);
    if (preset.id === 'custom') continue;
    assert.match(preset.baseURL, /^https?:\/\//u, `bad baseURL for ${preset.id}`);
  }
  assert.ok(PROVIDER_GROUPS.length >= 3);
});

test('accepts known providers and future slugs, rejects junk', () => {
  assert.equal(isKnownProviderId('deepseek'), true);
  assert.equal(isKnownProviderId('some-new-provider-2027'), true);
  assert.equal(isKnownProviderId('Bad Provider!'), false);
  assert.equal(isKnownProviderId(''), false);
  assert.equal(getProviderPreset('gemini')?.baseURL.includes('googleapis'), true);
});
