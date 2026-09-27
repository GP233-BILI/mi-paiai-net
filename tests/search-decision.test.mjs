import assert from 'node:assert/strict';
import test from 'node:test';

const { parseSearchRoute } = await import('../apps/web/dist/search-decision.js');
const { leaveWakeState, playMiOTWithFallback, prepareForSpeech, stopCurrentPlayback } = await import('../apps/web/dist/speech.js');

test('parses model search decisions and normalizes the query', () => {
  assert.deepEqual(parseSearchRoute('{"search":true,"query":"长鑫存储近期新闻"}', '长兴存储'), {
    shouldSearch: true,
    query: '长鑫存储近期新闻',
    source: 'model',
  });
  assert.deepEqual(parseSearchRoute('false', '帮我翻译这句话'), {
    shouldSearch: false,
    query: '帮我翻译这句话',
    source: 'model',
  });
  assert.equal(parseSearchRoute('false', '请搜索最新新闻').shouldSearch, true);
  assert.equal(parseSearchRoute('', '请搜索最新新闻').source, 'rule');
});

test('sends the whole reply as one play-text payload', () => {
  const text = '第一点。第二点！第三点？' + '补充说明。'.repeat(40);
  const spoken = prepareForSpeech(text);
  assert.ok(spoken.startsWith('第一点。第二点！第三点？'));
  assert.equal(spoken.includes('  '), false);
});

test('strips markdown, links and citation markers before speaking', () => {
  const spoken = prepareForSpeech('**重点** 见 https://example.com 以及 [1] 引用');
  assert.equal(spoken, '重点 见 以及 引用');
});

test('pauses MiNA before sending play-text', async () => {
  const calls = [];
  const result = await leaveWakeState({
    pauseMiNA: async () => { calls.push('pause'); return true; },
  });
  assert.equal(result, true);
  assert.deepEqual(calls, ['pause']);
});

test('falls back to MiNA text playback when MiOT returns false', async () => {
  const calls = [];
  const result = await playMiOTWithFallback({
    abortXiaoAI: async () => false,
    stopMiNA: async () => true,
    playText: async (text) => { calls.push(['mina', text]); return true; },
    playMiOT: async (service, action, text) => { calls.push(['miot', service, action, text]); return false; },
  }, 5, 3, 'AI 回复');
  assert.deepEqual(result, { mode: 'mina', miotResult: false, fallbackResult: true });
  assert.deepEqual(calls, [['miot', 5, 3, 'AI 回复'], ['mina', 'AI 回复']]);
});

test('stops MiNA and issues the device stop action', async () => {
  const calls = [];
  const stopped = await stopCurrentPlayback({
    abortXiaoAI: async () => { calls.push('abort'); return false; },
    stopMiNA: async () => { calls.push('stop'); return true; },
    stopMiOT: async () => { calls.push('stopMiOT'); return true; },
  });
  assert.equal(stopped, true);
  assert.deepEqual(calls, ['abort', 'stop', 'stopMiOT']);
});
