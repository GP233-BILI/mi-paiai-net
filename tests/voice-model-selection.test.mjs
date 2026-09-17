import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVoiceCommand } from '../apps/web/dist/voice-control.js';

const state = {
  enabled: true,
  model: 'gpt-5.6-luna',
  models: ['gpt-5.6-luna', 'claude-sonnet-4-6', 'deepseek-v4-flash', 'gemini-3.8-flash-high'],
  thinkingLevel: 'medium',
};

test('switches model by fuzzy spoken name', () => {
  assert.equal(handleVoiceCommand('切换到 claude sonnet', state).model, 'claude-sonnet-4-6');
  assert.equal(handleVoiceCommand('换到第 3 个模型', state).model, 'deepseek-v4-flash');
  assert.equal(handleVoiceCommand('换成第二个模型', state).model, 'claude-sonnet-4-6');
  assert.equal(handleVoiceCommand('deepseek', state).model, 'deepseek-v4-flash');
});

test('lists models with their voice index', () => {
  const reply = handleVoiceCommand('有哪些模型', state).reply ?? '';
  assert.match(reply, /1 号 gpt-5\.6-luna/);
  assert.match(reply, /2 号 claude-sonnet-4-6/);
});

test('keeps thinking commands working and rejects unknown models', () => {
  assert.equal(handleVoiceCommand('切换思考等级 高', state).thinkingLevel, 'high');
  assert.equal(handleVoiceCommand('切换模型 not-installed', state).model, undefined);
  assert.equal(handleVoiceCommand('请帮我讲个笑话', state).handled, false);
});
