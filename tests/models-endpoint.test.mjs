import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

process.env.AUTH_USERNAME = 'testadmin';
process.env.AUTH_PASSWORD = 'test-password-123';
process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.MIPAIAI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'migpt-models-'));

const { createApp } = await import('../apps/web/dist/index.js');

test('fetches models from the configured OpenAI-compatible upstream', async (t) => {
  let receivedAuthorization = '';
  const upstream = createServer((req, res) => {
    receivedAuthorization = req.headers.authorization || '';
    if (req.url !== '/v1/models') {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'model-b' }, { id: 'model-a' }] }));
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => upstream.close());
  const upstreamPort = upstream.address().port;

  const app = createApp({
    runtimeController: {
      start: async () => undefined,
      stop: async () => undefined,
      getStatuses: () => [],
    },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'testadmin', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ');

  const response = await fetch(`${baseUrl}/api/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: baseUrl },
    body: JSON.stringify({
      baseURL: `http://127.0.0.1:${upstreamPort}/v1`,
      apiKey: 'temporary-test-key',
    }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).models, ['gpt-4o-mini', 'model-a', 'model-b']);
  assert.equal(receivedAuthorization, 'Bearer temporary-test-key');
  const configResponse = await fetch(`${baseUrl}/api/config`, { headers: { Cookie: cookie } });
  assert.deepEqual((await configResponse.json()).config.models, ['gpt-4o-mini', 'model-a', 'model-b']);
});
