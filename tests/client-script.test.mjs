import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

process.env.AUTH_USERNAME = 'testadmin';
process.env.AUTH_PASSWORD = 'test-password-123';
process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.MIPAIAI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'migpt-client-'));

const { createApp } = await import('../apps/web/dist/index.js');

test('serves syntactically valid multi-speaker management JavaScript', async (t) => {
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
  const cookie = login.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  const html = await (await fetch(`${baseUrl}/`, { headers: { Cookie: cookie } })).text();
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));
  assert.match(html, /id="speakerList"/);
  assert.match(html, /onclick="fetchModels\(\)"/);
  assert.match(html, /id="goLatest"/);
  assert.match(html, /id="modelMultiMode"/);
  assert.match(html, /mi-paiai\.autoscroll/);
  assert.match(html, /function goToLatest\(\)/);
  assert.doesNotMatch(html, /beforeunload/);
});
