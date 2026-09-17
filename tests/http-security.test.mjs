import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

process.env.AUTH_USERNAME = 'testadmin';
process.env.AUTH_PASSWORD = 'test-password-123';
process.env.AUTH_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.MIPAIAI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'migpt-http-'));

const { createApp } = await import('../apps/web/dist/index.js');

async function startServer() {
  let statuses = [];
  const app = createApp({
    runtimeController: {
      start: async (config) => {
        statuses = config.speakers
          .filter((speaker) => speaker.enabled)
          .map((speaker) => ({
            id: speaker.id,
            name: speaker.name,
            enabled: true,
            state: 'running',
            model: speaker.model,
            thinkingLevel: speaker.thinkingLevel,
            voiceControl: speaker.voiceControl,
          }));
      },
      stop: async () => {
        statuses = statuses.map((status) => ({ ...status, state: 'stopped' }));
      },
      getStatuses: () => statuses,
    },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test('rate limits repeated failed logins', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl },
      body: JSON.stringify({ username: 'testadmin', password: 'incorrect-password' }),
    });
    assert.equal(response.status, 401);
  }

  const blocked = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'testadmin', password: 'incorrect-password' }),
  });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('requires authentication, masks secrets, and blocks CSRF', async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const unauthorised = await fetch(`${baseUrl}/api/status`);
  assert.equal(unauthorised.status, 401);

  const badLogin = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'testadmin', password: 'wrong-password' }),
  });
  assert.equal(badLogin.status, 401);

  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ username: 'testadmin', password: 'test-password-123' }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie') ?? '', /HttpOnly/i);
  assert.match(login.headers.get('set-cookie') ?? '', /SameSite=Lax/i);
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .join('; ');

  const configWrite = await fetch(`${baseUrl}/api/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: baseUrl },
    body: JSON.stringify({
      provider: 'openai',
      openai: { model: 'test-model', baseURL: 'https://example.com/v1', apiKey: 'api-key' },
      prompt: { system: 'test prompt' },
      callAIKeywords: ['请'],
      models: ['test-model', 'second-model'],
      speakers: [
        { id: 'living-room', name: '客厅音箱', enabled: true, userId: '10001', password: 'speaker-password', passToken: 'pass-token', did: 'LX04-A', model: 'test-model', thinkingLevel: 'high', voiceControl: true },
        { id: 'study-room', name: '书房音箱', enabled: true, userId: '20002', password: 'second-password', passToken: 'second-pass-token', did: 'LX04-B', model: 'second-model', thinkingLevel: 'low', voiceControl: true },
      ],
    }),
  });
  assert.equal(configWrite.status, 200);

  const configRead = await fetch(`${baseUrl}/api/config`, { headers: { Cookie: cookie } });
  assert.equal(configRead.status, 200);
  const configBody = await configRead.json();
  assert.equal(configBody.config.openai.apiKey, '');
  assert.equal(configBody.config.speakers.length, 2);
  assert.equal(configBody.config.speakers[0].password, '');
  assert.equal(configBody.config.speakers[1].password, '');
  assert.equal(configBody.secretsConfigured.speakers['living-room'].password, true);
  assert.equal(configBody.secretsConfigured.speakers['study-room'].passToken, true);
  assert.doesNotMatch(JSON.stringify(configBody), /speaker-password|second-password|api-key|pass-token/);

  const crossSite = await fetch(`${baseUrl}/api/stop`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site' },
  });
  assert.equal(crossSite.status, 403);

  const start = await fetch(`${baseUrl}/api/start`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl },
  });
  assert.equal(start.status, 202);
  const running = await (await fetch(`${baseUrl}/api/status`, { headers: { Cookie: cookie } })).json();
  assert.equal(running.running, true);
  assert.equal(running.speakers.length, 2);
  assert.deepEqual(running.speakers.map((speaker) => speaker.id), ['living-room', 'study-room']);

  const stop = await fetch(`${baseUrl}/api/stop`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl },
  });
  assert.equal(stop.status, 200);
  const stopped = await (await fetch(`${baseUrl}/api/status`, { headers: { Cookie: cookie } })).json();
  assert.equal(stopped.running, false);

  const logResponse = await fetch(`${baseUrl}/api/logs`, { headers: { Cookie: cookie } });
  assert.equal(logResponse.status, 200);
  const logBody = await logResponse.json();
  assert.ok(logBody.logs.length >= 2);
  assert.deepEqual(
    logBody.logs.map((entry) => entry.id),
    [...logBody.logs.map((entry) => entry.id)].sort((left, right) => left - right),
    'logs must be chronological so the newest entry is at the bottom',
  );
  assert.match(logBody.logs.at(-1).content, /停止/);

  const html = await fetch(`${baseUrl}/`, { headers: { Cookie: cookie } });
  assert.equal(html.status, 200);
  assert.equal(html.headers.get('x-frame-options'), 'DENY');
  assert.match(html.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);

  const logout = await fetch(`${baseUrl}/api/logout`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: baseUrl },
  });
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(`${baseUrl}/api/status`, { headers: { Cookie: cookie } });
  assert.equal(afterLogout.status, 401);
});
