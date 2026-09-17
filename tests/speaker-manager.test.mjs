import assert from 'node:assert/strict';
import test from 'node:test';
import { SpeakerManager } from '../apps/web/dist/speaker-manager.js';

process.env.MIPAIAI_WORKER_TEST_MODE = '1';

function config() {
  return {
    provider: 'openai',
    openai: { model: 'model-a', baseURL: 'https://example.com/v1', apiKey: 'key' },
    prompt: { system: 'test' },
    callAIKeywords: ['请'],
    models: ['model-a', 'model-b'],
    speakers: [
      { id: 'living-room', name: '客厅音箱', enabled: true, userId: '1', password: 'p1', passToken: '', did: 'A', model: 'model-a', thinkingLevel: 'high', voiceControl: true },
      { id: 'study-room', name: '书房音箱', enabled: true, userId: '2', password: 'p2', passToken: '', did: 'B', model: 'model-b', thinkingLevel: 'low', voiceControl: true },
    ],
  };
}

test('runs each speaker in an isolated working directory', async (t) => {
  const events = [];
  const manager = new SpeakerManager({
    ttsSecretPath: '/test-tts-path',
    onEvent: (event) => events.push(event),
  });
  t.after(async () => { await manager.stop(); });
  await manager.start(config());
  const deadline = Date.now() + 5000;
  const isReady = () =>
    manager.getStatuses().filter((status) => status.state === 'running').length === 2 &&
    events.filter((event) => event.type === 'log' && event.content?.startsWith('TEST_CWD=')).length === 2;
  while (Date.now() < deadline && !isReady()) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  const statuses = manager.getStatuses();
  assert.deepEqual(statuses.map((status) => status.id).sort(), ['living-room', 'study-room']);
  assert.ok(statuses.every((status) => status.state === 'running'), JSON.stringify(statuses));
  const cwdLogs = events
    .filter((event) => event.type === 'log' && event.content?.startsWith('TEST_CWD='))
    .map((event) => event.content);
  assert.equal(cwdLogs.length, 2, JSON.stringify(events));
  assert.equal(new Set(cwdLogs).size, 2);
});
