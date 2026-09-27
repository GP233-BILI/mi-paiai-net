import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import YAML from 'yaml';
import { DEFAULT_PROVIDER_ID, isKnownProviderId } from './providers.js';
import type { WebSearchConfig } from './web-search.js';

export type TtsProvider = 'edge' | 'volcano' | 'openai';
export type ThinkingLevel = 'default' | 'minimal' | 'low' | 'medium' | 'high';
// Any lowercase slug is accepted so new providers work without a code change.
export type AiProvider = string;

export interface SpeakerConfig {
  id: string;
  name: string;
  enabled: boolean;
  userId: string;
  password: string;
  passToken: string;
  did: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  voiceControl: boolean;
}

export interface WebConfig {
  provider: AiProvider;
  openai: {
    model: string;
    baseURL: string;
    apiKey: string;
  };
  prompt: { system: string };
  callAIKeywords: string[];
  models: string[];
  speakers: SpeakerConfig[];
  ttsCommand: [number, number] | null;
  wakeUpCommand: [number, number] | null;
  tts?: {
    provider: TtsProvider;
    edge?: { secretKey: string; trustedToken: string };
    volcano?: { apiKey?: string; appId?: string; accessToken?: string; cluster?: string };
    openai?: { apiKey: string; model: string };
    defaultSpeaker?: string;
  };
  publicURL?: string;
  webSearch: WebSearchConfig;
}

export interface SecretStatus {
  openaiApiKey: boolean;
  webSearchApiKey: boolean;
  ttsEdgeSecretKey: boolean;
  ttsEdgeTrustedToken: boolean;
  ttsVolcanoAccessToken: boolean;
  ttsVolcanoApiKey: boolean;
  ttsOpenaiApiKey: boolean;
  speakers: Record<string, { password: boolean; passToken: boolean }>;
}

const THINKING_LEVELS = new Set<ThinkingLevel>([
  'default',
  'minimal',
  'low',
  'medium',
  'high',
]);
const SPEAKER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_SHORT = 200;
const MAX_SECRET = 4096;
const MAX_PROMPT = 10_000;
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_SEARCH_ENDPOINT = 'https://api.tavily.com/search';
const DEFAULT_SEARCH_CONFIG: WebSearchConfig = {
  enabled: false,
  decision: 'model',
  endpoint: DEFAULT_SEARCH_ENDPOINT,
  apiKey: '',
  maxResults: 5,
  timeoutMs: 8000,
  cacheTtlSeconds: 600,
};

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(
  value: unknown,
  field: string,
  maxLength = MAX_SHORT,
  required = false,
): string {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const result = value.trim();
  if (required && !result) throw new Error(`${field} is required`);
  if (result.length > maxLength) throw new Error(`${field} is too long`);
  return result;
}

function readOptionalUrl(value: unknown, field: string): string | undefined {
  const raw = readString(value, field, 2048);
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${field} must use http or https`);
  }
  if (url.username || url.password) {
    throw new Error(`${field} must not contain credentials`);
  }
  return url.toString().replace(/\/$/, '');
}

function readBoolean(value: unknown, field: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${field} must be a boolean`);
  return value;
}

function readThinkingLevel(value: unknown): ThinkingLevel {
  const level = readString(value, 'thinkingLevel', 20) || 'default';
  if (!THINKING_LEVELS.has(level as ThinkingLevel)) {
    throw new Error('thinkingLevel must be default, minimal, low, medium, or high');
  }
  return level as ThinkingLevel;
}

function readCommand(
  value: unknown,
  field: 'ttsCommand' | 'wakeUpCommand',
  fallback: [number, number] | null,
): [number, number] | null {
  if (value === undefined) return fallback;
  if (value === null) return null;
  if (field === 'ttsCommand' && Array.isArray(value) && value.length === 2 && value[0] === 5 && value[1] === 1) {
    return [5, 3];
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${field} must contain exactly two numbers`);
  }
  const values = value.map((item) => {
    if (!Number.isInteger(item) || Number(item) < 0 || Number(item) > 10_000) {
      throw new Error(`${field} values must be integers between 0 and 10000`);
    }
    return Number(item);
  });
  return [values[0], values[1]];
}

function readWebSearch(value: unknown): WebSearchConfig {
  if (value === undefined || value === null) return { ...DEFAULT_SEARCH_CONFIG };
  const source = asRecord(value, 'webSearch');
  const endpoint = readOptionalUrl(source.endpoint, 'webSearch.endpoint') ?? DEFAULT_SEARCH_ENDPOINT;
  const endpointUrl = new URL(endpoint);
  if (endpointUrl.protocol !== 'https:' || endpointUrl.hostname !== 'api.tavily.com') {
    throw new Error('webSearch.endpoint must be https://api.tavily.com/search');
  }
  const decision = readString(source.decision, 'webSearch.decision', 20) || 'model';
  if (decision !== 'model') throw new Error('webSearch.decision must be model');
  const maxResults = source.maxResults === undefined ? 5 : source.maxResults;
  const timeoutMs = source.timeoutMs === undefined ? 8000 : source.timeoutMs;
  const cacheTtlSeconds = source.cacheTtlSeconds === undefined ? 600 : source.cacheTtlSeconds;
  if (!Number.isInteger(maxResults) || Number(maxResults) < 1 || Number(maxResults) > 10) {
    throw new Error('webSearch.maxResults must be an integer between 1 and 10');
  }
  if (!Number.isInteger(timeoutMs) || Number(timeoutMs) < 2000 || Number(timeoutMs) > 15000) {
    throw new Error('webSearch.timeoutMs must be an integer between 2000 and 15000');
  }
  if (!Number.isInteger(cacheTtlSeconds) || Number(cacheTtlSeconds) < 0 || Number(cacheTtlSeconds) > 3600) {
    throw new Error('webSearch.cacheTtlSeconds must be an integer between 0 and 3600');
  }
  return {
    enabled: readBoolean(source.enabled, 'webSearch.enabled', false),
    decision: 'model',
    endpoint,
    apiKey: readString(source.apiKey, 'webSearch.apiKey', MAX_SECRET),
    maxResults: Number(maxResults),
    timeoutMs: Number(timeoutMs),
    cacheTtlSeconds: Number(cacheTtlSeconds),
  };
}

function readKeywords(value: unknown): string[] {
  if (value === undefined || value === null) return ['请', '你'];
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new Error('callAIKeywords must contain between 1 and 20 items');
  }
  return value.map((item, index) =>
    readString(item, `callAIKeywords[${index}]`, 50, true),
  );
}

function readProvider(value: unknown): AiProvider {
  const provider = readString(value, 'provider', 40) || DEFAULT_PROVIDER_ID;
  if (!isKnownProviderId(provider)) {
    throw new Error('provider must be a lowercase id such as openai, deepseek, gemini, glm, qwen or custom');
  }
  return provider;
}

function readSpeaker(
  value: unknown,
  index: number,
  defaultModel: string,
  legacy: Record<string, unknown>,
): SpeakerConfig {
  const source = Object.keys(asRecord(value, `speakers[${index}]`)).length
    ? asRecord(value, `speakers[${index}]`)
    : {};
  const id = readString(source.id, `speakers[${index}].id`, 64) || `speaker-${index + 1}`;
  if (!SPEAKER_ID_PATTERN.test(id)) {
    throw new Error(`speakers[${index}].id contains unsupported characters`);
  }
  const legacyModel = readString(legacy.model, 'speakers[${index}].model', MAX_SHORT);
  const model = readString(source.model, `speakers[${index}].model`, MAX_SHORT) || legacyModel || defaultModel;
  return {
    id,
    name: readString(source.name, `speakers[${index}].name`, 100) || `音箱 ${index + 1}`,
    enabled: readBoolean(source.enabled, `speakers[${index}].enabled`, true),
    userId: readString(source.userId, `speakers[${index}].userId`, 100),
    password: readString(source.password, `speakers[${index}].password`, MAX_SECRET),
    passToken: readString(source.passToken, `speakers[${index}].passToken`, MAX_SECRET),
    did: readString(source.did, `speakers[${index}].did`, MAX_SHORT),
    model,
    thinkingLevel: readThinkingLevel(source.thinkingLevel ?? legacy.thinkingLevel),
    voiceControl: readBoolean(source.voiceControl, `speakers[${index}].voiceControl`, true),
  };
}

function normalizeSpeakers(root: Record<string, unknown>, defaultModel: string): SpeakerConfig[] {
  const legacySpeaker = root.speaker === undefined ? {} : asRecord(root.speaker, 'speaker');
  const legacy = {
    ...legacySpeaker,
    model: root.openai && typeof root.openai === 'object'
      ? (root.openai as Record<string, unknown>).model
      : defaultModel,
    thinkingLevel: root.thinkingLevel,
  };

  const rawSpeakers = Array.isArray(root.speakers)
    ? root.speakers
    : [{ ...legacySpeaker, id: 'speaker-1' }];
  if (rawSpeakers.length === 0 || rawSpeakers.length > 10) {
    throw new Error('speakers must contain between 1 and 10 items');
  }

  const speakers = rawSpeakers.map((speaker, index) =>
    readSpeaker(speaker, index, defaultModel, legacy),
  );
  const ids = new Set<string>();
  for (const speaker of speakers) {
    if (ids.has(speaker.id)) throw new Error(`duplicate speaker id: ${speaker.id}`);
    ids.add(speaker.id);
  }
  return speakers;
}

function readModels(value: unknown, defaultModel: string, speakers: SpeakerConfig[]): string[] {
  const raw = value === undefined || value === null
    ? []
    : Array.isArray(value)
      ? value
      : (() => { throw new Error('models must be an array'); })();
  if (raw.length > 100) throw new Error('models must contain at most 100 items');
  const models = raw.map((item, index) => readString(item, `models[${index}]`, 200, true));
  for (const speaker of speakers) models.push(speaker.model);
  models.push(defaultModel);
  return [...new Set(models)];
}

export function defaultConfig(): WebConfig {
  return {
    provider: DEFAULT_PROVIDER_ID,
    openai: { model: DEFAULT_MODEL, baseURL: DEFAULT_BASE_URL, apiKey: '' },
    prompt: { system: '你是一个智能助手小爱同学。' },
    callAIKeywords: ['请', '你'],
    models: [DEFAULT_MODEL],
    speakers: [
      {
        id: 'speaker-1',
        name: '我的音箱',
        enabled: true,
        userId: '',
        password: '',
        passToken: '',
        did: '',
        model: DEFAULT_MODEL,
        thinkingLevel: 'default',
        voiceControl: true,
      },
    ],
    ttsCommand: [5, 3],
    wakeUpCommand: [5, 1],
    webSearch: { ...DEFAULT_SEARCH_CONFIG },
  };
}

function normalizeConfig(input: unknown): WebConfig {
  const root = asRecord(input, 'config');
  const openai = asRecord(root.openai, 'openai');
  const prompt = root.prompt === undefined ? {} : asRecord(root.prompt, 'prompt');
  const defaultModel = readString(openai.model, 'openai.model', MAX_SHORT) || DEFAULT_MODEL;
  const baseURL = readOptionalUrl(openai.baseURL, 'openai.baseURL') ?? DEFAULT_BASE_URL;
  const speakers = normalizeSpeakers(root, defaultModel);

  const config: WebConfig = {
    provider: readProvider(root.provider),
    openai: {
      model: defaultModel,
      baseURL,
      apiKey: readString(openai.apiKey, 'openai.apiKey', MAX_SECRET),
    },
    prompt: {
      system:
        readString(prompt.system, 'prompt.system', MAX_PROMPT) ||
        '你是一个智能助手小爱同学。',
    },
    callAIKeywords: readKeywords(root.callAIKeywords),
    models: [],
    speakers,
    ttsCommand: readCommand(root.ttsCommand, 'ttsCommand', [5, 3]),
    wakeUpCommand: readCommand(root.wakeUpCommand, 'wakeUpCommand', [5, 1]),
    webSearch: readWebSearch(root.webSearch),
  };
  config.models = readModels(root.models, defaultModel, speakers);

  if (root.tts !== undefined && root.tts !== null) {
    const tts = asRecord(root.tts, 'tts');
    const provider = readString(tts.provider, 'tts.provider', 20);
    if (provider && provider !== 'volcano') {
      throw new Error('tts.provider currently supports only volcano');
    }
    if (provider) {
      config.tts = { provider: provider as TtsProvider };
      if (tts.edge !== undefined) {
        const edge = asRecord(tts.edge, 'tts.edge');
        config.tts.edge = {
          secretKey: readString(edge.secretKey, 'tts.edge.secretKey', MAX_SECRET),
          trustedToken: readString(edge.trustedToken, 'tts.edge.trustedToken', MAX_SECRET),
        };
      }
      if (tts.volcano !== undefined) {
        const volcano = asRecord(tts.volcano, 'tts.volcano');
        config.tts.volcano = {
          apiKey: readString(volcano.apiKey, 'tts.volcano.apiKey', MAX_SECRET),
          appId: readString(volcano.appId, 'tts.volcano.appId', MAX_SHORT),
          accessToken: readString(volcano.accessToken, 'tts.volcano.accessToken', MAX_SECRET),
          cluster: readString(volcano.cluster, 'tts.volcano.cluster', MAX_SHORT) || 'volcano_tts',
        };
      }
      if (tts.openai !== undefined) {
        const ttsOpenai = asRecord(tts.openai, 'tts.openai');
        config.tts.openai = {
          apiKey: readString(ttsOpenai.apiKey, 'tts.openai.apiKey', MAX_SECRET),
          model: readString(ttsOpenai.model, 'tts.openai.model', MAX_SHORT) || 'tts-1',
        };
      }
      config.tts.defaultSpeaker = readString(
        tts.defaultSpeaker,
        'tts.defaultSpeaker',
        MAX_SHORT,
      ) || undefined;
      config.publicURL = readOptionalUrl(root.publicURL, 'publicURL');
      if (config.publicURL) {
        const publicUrl = new URL(config.publicURL);
        if (publicUrl.search || publicUrl.hash) {
          throw new Error('publicURL must not contain a query string or fragment');
        }
      }
    }
  }

  return config;
}

function preserveSecret(next: string, current: string | undefined): string {
  return next || current || '';
}

function mergeSecrets(next: WebConfig, current: WebConfig): WebConfig {
  next.openai.apiKey = preserveSecret(next.openai.apiKey, current.openai.apiKey);
  next.webSearch.apiKey = preserveSecret(next.webSearch.apiKey, current.webSearch.apiKey);
  const currentById = new Map(current.speakers.map((speaker) => [speaker.id, speaker]));
  for (const speaker of next.speakers) {
    const existing = currentById.get(speaker.id);
    speaker.password = preserveSecret(speaker.password, existing?.password);
    speaker.passToken = preserveSecret(speaker.passToken, existing?.passToken);
  }

  if (next.tts) {
    if (!next.tts.edge) {
      next.tts.edge = {
        secretKey: current.tts?.edge?.secretKey ?? '',
        trustedToken: current.tts?.edge?.trustedToken ?? '',
      };
    } else {
      next.tts.edge.secretKey = preserveSecret(next.tts.edge.secretKey, current.tts?.edge?.secretKey);
      next.tts.edge.trustedToken = preserveSecret(next.tts.edge.trustedToken, current.tts?.edge?.trustedToken);
    }
    if (!next.tts.volcano) {
      next.tts.volcano = {
        apiKey: current.tts?.volcano?.apiKey ?? '',
        appId: '',
        accessToken: current.tts?.volcano?.accessToken ?? '',
        cluster: current.tts?.volcano?.cluster ?? 'volcano_tts',
      };
    } else {
      next.tts.volcano.apiKey = preserveSecret(next.tts.volcano.apiKey, current.tts?.volcano?.apiKey);
      next.tts.volcano.accessToken = preserveSecret(next.tts.volcano.accessToken, current.tts?.volcano?.accessToken);
      next.tts.volcano.cluster = next.tts.volcano.cluster || 'volcano_tts';
    }
    if (!next.tts.openai) {
      next.tts.openai = { apiKey: current.tts?.openai?.apiKey ?? '', model: 'tts-1' };
    } else {
      next.tts.openai.apiKey = preserveSecret(next.tts.openai.apiKey, current.tts?.openai?.apiKey);
    }
  }

  return next;
}

function writeConfig(configPath: string, config: WebConfig): void {
  const directory = dirname(configPath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try {
    chmodSync(directory, 0o700);
  } catch {
    // Some mounted filesystems do not expose POSIX permissions.
  }

  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, YAML.stringify(config), { encoding: 'utf8', mode: 0o600 });
  try {
    renameSync(temporaryPath, configPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch {
      // Ignore cleanup errors.
    }
    throw error;
  }
  try {
    chmodSync(configPath, 0o600);
  } catch {
    // Some mounted filesystems do not expose POSIX permissions.
  }
}

export function loadConfig(configPath: string): WebConfig {
  if (!existsSync(configPath)) {
    const config = defaultConfig();
    writeConfig(configPath, config);
    return config;
  }
  const content = readFileSync(configPath, 'utf8');
  return normalizeConfig(YAML.parse(content, { maxAliasCount: 100 }));
}

export function saveConfig(configPath: string, input: unknown): WebConfig {
  const current = loadConfig(configPath);
  const next = mergeSecrets(normalizeConfig(input), current);
  writeConfig(configPath, next);
  return next;
}

export function saveSpeakerSelection(
  configPath: string,
  speakerId: string,
  patch: { model?: string; thinkingLevel?: ThinkingLevel },
): WebConfig {
  const current = loadConfig(configPath);
  const speaker = current.speakers.find((item) => item.id === speakerId);
  if (!speaker) throw new Error(`speaker not found: ${speakerId}`);
  if (patch.model) {
    const model = readString(patch.model, 'model', MAX_SHORT, true);
    speaker.model = model;
    if (!current.models.includes(model)) current.models.push(model);
  }
  if (patch.thinkingLevel) {
    speaker.thinkingLevel = readThinkingLevel(patch.thinkingLevel);
  }
  writeConfig(configPath, current);
  return current;
}

export function publicConfig(config: WebConfig): {
  config: WebConfig;
  secretsConfigured: SecretStatus;
} {
  const clone = structuredClone(config);
  const speakerSecrets: Record<string, { password: boolean; passToken: boolean }> = {};
  for (const speaker of clone.speakers) {
    speakerSecrets[speaker.id] = {
      password: Boolean(speaker.password),
      passToken: Boolean(speaker.passToken),
    };
    speaker.password = '';
    speaker.passToken = '';
  }

  const secretsConfigured: SecretStatus = {
    openaiApiKey: Boolean(clone.openai.apiKey),
    webSearchApiKey: Boolean(clone.webSearch.apiKey),
    ttsEdgeSecretKey: Boolean(clone.tts?.edge?.secretKey),
    ttsEdgeTrustedToken: Boolean(clone.tts?.edge?.trustedToken),
    ttsVolcanoAccessToken: Boolean(clone.tts?.volcano?.accessToken),
    ttsVolcanoApiKey: Boolean(clone.tts?.volcano?.apiKey),
    ttsOpenaiApiKey: Boolean(clone.tts?.openai?.apiKey),
    speakers: speakerSecrets,
  };

  clone.openai.apiKey = '';
  clone.webSearch.apiKey = '';
  if (clone.tts?.edge) {
    clone.tts.edge.secretKey = '';
    clone.tts.edge.trustedToken = '';
  }
  if (clone.tts?.volcano) {
    clone.tts.volcano.accessToken = '';
    clone.tts.volcano.apiKey = '';
  }
  if (clone.tts?.openai) clone.tts.openai.apiKey = '';

  return { config: clone, secretsConfigured };
}
