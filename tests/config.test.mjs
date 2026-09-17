import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  loadConfig,
  publicConfig,
  saveConfig,
  saveSpeakerSelection,
} from '../apps/web/dist/config.js';

function temporaryConfig() {
  const directory = mkdtempSync(join(tmpdir(), 'migpt-config-'));
  return { directory, path: join(directory, 'default.yaml') };
}

function validConfig(overrides = {}) {
  return {
    provider: 'openai',
    openai: {
      model: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'api-key',
    },
    prompt: { system: 'test prompt' },
    callAIKeywords: ['请'],
    models: ['gpt-4o-mini', 'deepseek-chat'],
    speakers: [
      {
        id: 'living-room',
        name: '客厅音箱',
        enabled: true,
        userId: '10001',
        password: 'speaker-password',
        passToken: 'pass-token',
        did: '小爱音箱A',
        model: 'gpt-4o-mini',
        thinkingLevel: 'high',
        voiceControl: true,
      },
      {
        id: 'study-room',
        name: '书房音箱',
        enabled: true,
        userId: '20002',
        password: 'second-password',
        passToken: 'second-pass-token',
        did: '小爱音箱B',
        model: 'deepseek-chat',
        thinkingLevel: 'low',
        voiceControl: true,
      },
    ],
    ...overrides,
  };
}

test('creates a public-safe OpenAI default config without embedding secrets', () => {
  const { path } = temporaryConfig();
  const config = loadConfig(path);
  assert.equal(config.provider, 'openai');
  assert.equal(config.openai.baseURL, 'https://api.openai.com/v1');
  assert.equal(config.openai.model, 'gpt-4o-mini');
  assert.equal(config.speakers.length, 1);
  assert.equal(config.speakers[0].password, '');
  assert.equal(config.openai.apiKey, '');
  if (process.platform !== 'win32') {
    assert.equal(statSync(path).mode & 0o777, 0o600);
  }
});

test('keeps two speaker accounts fully separate and redacts every secret', () => {
  const { path } = temporaryConfig();
  saveConfig(path, validConfig());
  const raw = readFileSync(path, 'utf8');
  assert.match(raw, /speaker-password/);

  const saved = loadConfig(path);
  assert.equal(saved.speakers.length, 2);
  assert.equal(saved.speakers[0].did, '小爱音箱A');
  assert.equal(saved.speakers[1].did, '小爱音箱B');
  assert.notEqual(saved.speakers[0].userId, saved.speakers[1].userId);

  const result = publicConfig(saved);
  assert.equal(result.config.openai.apiKey, '');
  for (const speaker of result.config.speakers) {
    assert.equal(speaker.password, '');
    assert.equal(speaker.passToken, '');
  }
  assert.equal(result.secretsConfigured.speakers['living-room'].password, true);
  assert.equal(result.secretsConfigured.speakers['study-room'].password, true);
  assert.equal(result.secretsConfigured.speakers['study-room'].passToken, true);
  assert.doesNotMatch(JSON.stringify(result), /speaker-password|second-password|api-key/);
});

test('blank incoming secrets preserve each speaker independently', () => {
  const { path } = temporaryConfig();
  saveConfig(path, validConfig());
  const updated = saveConfig(path, {
    ...validConfig(),
    openai: { ...validConfig().openai, apiKey: '' },
    speakers: validConfig().speakers.map((speaker) => ({
      ...speaker,
      password: '',
      passToken: '',
    })),
  });
  assert.equal(updated.openai.apiKey, 'api-key');
  assert.equal(updated.speakers[0].password, 'speaker-password');
  assert.equal(updated.speakers[1].password, 'second-password');
});

test('voice selection changes only the requested speaker', () => {
  const { path } = temporaryConfig();
  saveConfig(path, validConfig());
  const updated = saveSpeakerSelection(path, 'study-room', {
    model: 'gpt-4o-mini',
    thinkingLevel: 'high',
  });
  assert.equal(updated.speakers[0].model, 'gpt-4o-mini');
  assert.equal(updated.speakers[0].thinkingLevel, 'high');
  assert.equal(updated.speakers[1].model, 'gpt-4o-mini');
  assert.equal(updated.speakers[1].thinkingLevel, 'high');
  assert.equal(updated.speakers[0].userId, '10001');
  assert.equal(updated.speakers[1].userId, '20002');
});

test('migrates the former single-speaker config without sharing context fields', () => {
  const { path } = temporaryConfig();
  saveConfig(path, {
    speaker: {
      userId: '10001',
      password: 'legacy-password',
      passToken: 'legacy-token',
      did: '旧音箱',
    },
    openai: {
      model: 'gpt-4o-mini',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'key',
    },
    prompt: { system: 'test' },
    callAIKeywords: ['请'],
    models: ['gpt-4o-mini'],
    thinkingLevel: 'medium',
    voiceControl: true,
  });
  const config = loadConfig(path);
  assert.equal(config.speakers.length, 1);
  assert.equal(config.speakers[0].id, 'speaker-1');
  assert.equal(config.speakers[0].did, '旧音箱');
  assert.equal(config.speakers[0].thinkingLevel, 'medium');
});

test('rejects malformed network values, duplicate IDs, and unsupported TTS', () => {
  const { path } = temporaryConfig();
  assert.throws(
    () => saveConfig(path, validConfig({ openai: { ...validConfig().openai, baseURL: 'file:///etc/passwd' } })),
    /must use http or https/,
  );
  assert.throws(
    () => saveConfig(path, validConfig({
      speakers: [
        validConfig().speakers[0],
        { ...validConfig().speakers[1], id: 'living-room' },
      ],
    })),
    /duplicate speaker id/,
  );
  assert.throws(
    () => saveConfig(path, { ...validConfig(), tts: { provider: 'edge' } }),
    /currently supports only volcano/,
  );
});
