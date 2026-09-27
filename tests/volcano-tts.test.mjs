import assert from 'node:assert/strict';
import test from 'node:test';

const { buildVolcanoTtsRequest } = await import('../apps/web/dist/volcano-tts.js');

const base = {
  text: '你好',
  speaker: 'BV001',
  uid: '10001',
  requestId: 'req-1',
};

test('new console credentials go into the x-api-key header only', () => {
  const { headers, body } = buildVolcanoTtsRequest({
    ...base,
    credential: { apiKey: 'test-api-key' },
  });
  assert.equal(headers['x-api-key'], 'test-api-key');
  assert.equal(headers.Authorization, undefined);

  const payload = JSON.parse(body);
  assert.deepEqual(payload.app, { cluster: 'volcano_tts' });
  assert.equal(payload.app.token, undefined);
  assert.equal(payload.app.appid, undefined);
  assert.equal(payload.request.text, '你好');
  assert.equal(payload.request.operation, 'query');
  assert.equal(payload.audio.voice_type, 'BV001');
  assert.equal(payload.user.uid, '10001');
});

test('legacy credentials keep the app id, app token and Authorization header', () => {
  const { headers, body } = buildVolcanoTtsRequest({
    ...base,
    credential: { appId: 'app-1', accessToken: 'token-1' },
  });
  assert.equal(headers.Authorization, 'Bearer; token-1');
  assert.equal(headers['x-api-key'], undefined);

  const payload = JSON.parse(body);
  assert.equal(payload.app.appid, 'app-1');
  assert.equal(payload.app.token, 'token-1');
});

test('the API key wins when both credential styles are present', () => {
  const { headers, body } = buildVolcanoTtsRequest({
    ...base,
    credential: { apiKey: 'new-key', appId: 'app-1', accessToken: 'token-1' },
  });
  assert.equal(headers['x-api-key'], 'new-key');
  assert.equal(headers.Authorization, undefined);
  assert.equal(JSON.parse(body).app.token, undefined);
});

test('a custom cluster is forwarded and blank values fall back to defaults', () => {
  const custom = buildVolcanoTtsRequest({
    ...base,
    speaker: '  ',
    credential: { apiKey: 'k', cluster: 'custom_cluster' },
  });
  assert.equal(JSON.parse(custom.body).app.cluster, 'custom_cluster');
  assert.equal(JSON.parse(custom.body).audio.voice_type, 'BV001');

  const fallback = buildVolcanoTtsRequest({ ...base, credential: { apiKey: 'k' } });
  assert.equal(JSON.parse(fallback.body).app.cluster, 'volcano_tts');
});

test('missing credentials are rejected before any request is made', () => {
  assert.throws(
    () => buildVolcanoTtsRequest({ ...base, credential: {} }),
    /配置不完整/,
  );
  assert.throws(
    () => buildVolcanoTtsRequest({ ...base, credential: undefined }),
    /配置不完整/,
  );
});
