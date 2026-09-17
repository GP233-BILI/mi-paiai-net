import assert from 'node:assert/strict';
import test from 'node:test';

const { OpenAI } = await import('../apps/web/node_modules/@mi-gpt/openai/dist/index.js');
const { applyOpenAISelection } = await import('../apps/web/dist/runtime-selection.js');

test('applies model and reasoning effort to the shared OpenAI client config', () => {
  OpenAI.init({ model: 'base-model', baseURL: 'https://example.com/v1', apiKey: 'test-key' });

  applyOpenAISelection({ model: 'gpt-5.6-sol', thinkingLevel: 'high' });
  assert.equal(OpenAI.config.model, 'gpt-5.6-sol');
  assert.equal(OpenAI.config.extra?.createParams?.reasoning_effort, 'high');

  applyOpenAISelection({ model: 'deepseek-v4-flash', thinkingLevel: 'default' });
  assert.equal(OpenAI.config.model, 'deepseek-v4-flash');
  assert.equal(OpenAI.config.extra?.createParams?.reasoning_effort, undefined);
});
