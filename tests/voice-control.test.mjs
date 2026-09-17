import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVoiceCommand } from '../apps/web/dist/voice-control.js';

const baseState = {
  enabled: true,
  model: 'gpt-5.6-luna',
  models: ['gpt-5.6-luna', 'gpt-5.6-sol', 'deepseek-v4-flash'],
  thinkingLevel: 'medium',
};

test('switches model by exact name, case-insensitively', () => {
  const result = handleVoiceCommand('小爱同学，请切换模型 Gpt-5.6-Sol', baseState);
  assert.equal(result.handled, true);
  assert.equal(result.model, 'gpt-5.6-sol');
  assert.match(result.reply ?? '', /gpt-5\.6-sol/);
});

test('switches model by numeric index', () => {
  const result = handleVoiceCommand('换模型 3', baseState);
  assert.equal(result.handled, true);
  assert.equal(result.model, 'deepseek-v4-flash');
});

test('reports an unknown model without changing state', () => {
  const result = handleVoiceCommand('切换模型 not-installed', baseState);
  assert.equal(result.handled, true);
  assert.equal(result.model, undefined);
  assert.match(result.reply ?? '', /没有找到模型/);
});

test('switches thinking levels and supports deep-thinking aliases', () => {
  assert.equal(handleVoiceCommand('切换思考等级 高', baseState).thinkingLevel, 'high');
  assert.equal(handleVoiceCommand('开启深度思考', baseState).thinkingLevel, 'high');
  assert.equal(handleVoiceCommand('设置思考等级为最低', baseState).thinkingLevel, 'minimal');
  assert.equal(handleVoiceCommand('关闭深度思考', baseState).thinkingLevel, 'default');
});

test('reports current state and available options', () => {
  const current = handleVoiceCommand('当前模型和思考等级', baseState);
  assert.equal(current.handled, true);
  assert.match(current.reply ?? '', /gpt-5\.6-luna/);
  assert.match(current.reply ?? '', /中/);

  const models = handleVoiceCommand('有哪些模型', baseState);
  assert.equal(models.handled, true);
  assert.match(models.reply ?? '', /deepseek-v4-flash/);

  const levels = handleVoiceCommand('有哪些思考等级', baseState);
  assert.equal(levels.handled, true);
  assert.match(levels.reply ?? '', /默认、最低、低、中、高/);
});

test('does nothing when voice control is disabled or text is ordinary', () => {
  assert.equal(handleVoiceCommand('切换模型 gpt-5.6-sol', { ...baseState, enabled: false }).handled, false);
  assert.equal(handleVoiceCommand('请帮我讲个笑话', baseState).handled, false);
});
