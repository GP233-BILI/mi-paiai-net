import assert from 'node:assert/strict';
import test from 'node:test';

const { createMessageDedupe } = await import('../apps/web/dist/message-dedupe.js');

test('treats the same utterance as a duplicate even with a different timestamp', () => {
  const dedupe = createMessageDedupe();
  assert.deepEqual(dedupe.check({ text: '请问老婆饼里为什么没有老婆', timestamp: 1000 }), { duplicate: false });
  assert.deepEqual(dedupe.check({ text: '请问老婆饼里为什么没有老婆', timestamp: 1005 }), {
    duplicate: true,
    firstTimestamp: 1000,
  });
  assert.equal(dedupe.size(), 1);
});

test('ignores whitespace differences when matching', () => {
  const dedupe = createMessageDedupe();
  assert.equal(dedupe.check({ text: '今天 天气 怎么样', timestamp: 1 }).duplicate, false);
  assert.equal(dedupe.check({ text: '今天  天气 怎么样 ', timestamp: 2 }).duplicate, true);
});

test('keeps different utterances apart', () => {
  const dedupe = createMessageDedupe();
  assert.equal(dedupe.check({ text: '问题一', timestamp: 1000 }).duplicate, false);
  assert.equal(dedupe.check({ text: '问题二', timestamp: 1000 }).duplicate, false);
  assert.equal(dedupe.size(), 2);
});

test('never blocks empty text', () => {
  const dedupe = createMessageDedupe();
  assert.equal(dedupe.check({ text: '   ', timestamp: 1 }).duplicate, false);
  assert.equal(dedupe.check({ text: '', timestamp: 2 }).duplicate, false);
  assert.equal(dedupe.size(), 0);
});

test('allows the same question again after the window passes', async () => {
  const dedupe = createMessageDedupe(30);
  assert.equal(dedupe.check({ text: '会过期的消息', timestamp: 1 }).duplicate, false);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(dedupe.check({ text: '会过期的消息', timestamp: 2 }).duplicate, false);
});

test('a deliberate repeat inside the window is briefly suppressed', () => {
  const dedupe = createMessageDedupe(10_000);
  assert.equal(dedupe.check({ text: '现在几点', timestamp: 1 }).duplicate, false);
  assert.equal(dedupe.check({ text: '现在几点', timestamp: 2 }).duplicate, true);
});
