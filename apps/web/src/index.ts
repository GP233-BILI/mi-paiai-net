import express from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHmac, timingSafeEqual } from 'node:crypto';
import https from 'node:https';
import { nanoid } from 'nanoid';
import cookieSession from 'cookie-session';
import {
  loadConfig,
  publicConfig,
  saveConfig,
  saveSpeakerSelection,
  type SpeakerConfig,
  type WebConfig,
} from './config.js';
import { SpeakerManager, type SpeakerRuntimeEvent, type SpeakerRuntimeStatus } from './speaker-manager.js';
import { HTML, LOGIN_HTML, APP_VERSION } from './ui.js';
import { buildVolcanoTtsRequest } from './volcano-tts.js';

console.log('Starting mi-paiai...');

const DEFAULT_PORT = 36592;
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CONFIG_DIR = process.env.MIPAIAI_CONFIG_DIR
  ? resolve(process.env.MIPAIAI_CONFIG_DIR)
  : join(ROOT_DIR, 'config');
const CONFIG_PATH = join(CONFIG_DIR, 'default.yaml');

function readEnvironmentSecret(name: string): string {
  const fileValue = process.env[`${name}_FILE`];
  if (fileValue) return readFileSync(fileValue, 'utf8').trim();
  return process.env[name]?.trim() ?? '';
}

function requireEnvironmentSecret(name: string, minimumLength: number): string {
  const value = readEnvironmentSecret(name);
  if (value.length < minimumLength) {
    throw new Error(`${name} must be set and at least ${minimumLength} characters long`);
  }
  return value;
}

const AUTH_USERNAME = requireEnvironmentSecret('AUTH_USERNAME', 3);
const AUTH_PASSWORD = requireEnvironmentSecret('AUTH_PASSWORD', 12);
const AUTH_SECRET = requireEnvironmentSecret('AUTH_SECRET', 32);

function secureEqual(left: string, right: string): boolean {
  const leftDigest = createHmac('sha256', AUTH_SECRET).update(left).digest();
  const rightDigest = createHmac('sha256', AUTH_SECRET).update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

const kBanner = [
  '',
  '  mi-paiai v' + APP_VERSION,
  '  多账号 · 多音箱 · 独立上下文',
  '',
].join(String.fromCharCode(10));

const ttsSecret = nanoid(32);
const ttsSecretPath = '/' + ttsSecret;
const ttsPath = ttsSecretPath + '/tts/tts.mp3';
const ttsSpeakersPath = ttsSecretPath + '/tts/speakers';

const logs: { id: number; time: string; type: string; content: string; speaker?: string }[] = [];
const MAX_LOGS = 100;
const recentLogSignatures = new Map<string, number>();
let nextLogId = 1;

function logSignature(content: string, speaker?: string): string {
  const normalized = content
    .replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/gu, '')
    .replace(/^音箱[^：:]{0,30}[：:]\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
  return `${speaker || ''}|${normalized}`;
}

function addLog(type: string, content: string, speaker?: string): void {
  if (!content.trim()) return;
  const now = Date.now();
  const signature = logSignature(content, speaker);
  const previous = recentLogSignatures.get(signature);
  // 上游可能在极短时间内从多个钩子重复打印同一句话，避免日志刷屏。
  if (previous !== undefined && now - previous < 2500) return;
  recentLogSignatures.set(signature, now);
  if (recentLogSignatures.size > 200) {
    for (const [key, timestamp] of recentLogSignatures) {
      if (now - timestamp > 60_000) recentLogSignatures.delete(key);
    }
  }
  const time = new Date(now).toLocaleTimeString('zh-CN', { hour12: false });
  logs.push({ id: nextLogId++, time, type, content, speaker });
  if (logs.length > MAX_LOGS) logs.shift();
}

export interface RuntimeController {
  start(config: WebConfig): Promise<void>;
  stop(): Promise<void>;
  getStatuses(): SpeakerRuntimeStatus[];
}

export interface CreateAppOptions {
  configPath?: string;
  runtimeController?: RuntimeController;
}

type ServiceState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

function validateSpeaker(speaker: SpeakerConfig): void {
  if (!speaker.userId) throw new Error(`音箱“${speaker.name}”未填写小米 ID`);
  if (!speaker.password && !speaker.passToken) {
    throw new Error(`音箱“${speaker.name}”未填写密码或 passToken`);
  }
  if (!speaker.did) throw new Error(`音箱“${speaker.name}”未填写设备名称`);
}

async function fetchUpstreamModels(config: WebConfig): Promise<string[]> {
  if (!config.openai.apiKey) throw new Error('请先保存 Sub2API Key');
  const url = new URL(config.openai.baseURL.replace(/\/$/, '') + '/models');
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`上游返回 HTTP ${response.status}`);
  const contentLength = Number(response.headers.get('content-length') || '0');
  if (contentLength > 2 * 1024 * 1024) throw new Error('上游模型列表过大');
  const body = await response.json() as { data?: unknown } | unknown[];
  const entries = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : null;
  if (!entries) throw new Error('上游返回的模型列表格式不支持');
  const models = entries
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string') {
        return (entry as { id: string }).id;
      }
      return '';
    })
    .map((model) => model.trim())
    .filter((model) => model && model.length <= 200);
  return [...new Set(models)].sort((left, right) => left.localeCompare(right));
}

function inputText(value: unknown, maxLength = 200): string {
  return typeof value === 'string' && value.length <= maxLength ? value : '';
}

function clientError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  return message && message.length <= 300 ? message : fallback;
}

function createFixedWindowLimiter(limit: number, windowMs: number) {
  const entries = new Map<string, { count: number; resetAt: number }>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const current = entries.get(key);
    if (!current || current.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    current.count += 1;
    if (current.count > limit) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
      res.status(429).json({ error: '请求过于频繁，请稍后再试' });
      return;
    }
    if (entries.size >= 1000) {
      for (const [entryKey, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(entryKey);
      }
      if (entries.size >= 1000) entries.delete(entries.keys().next().value as string);
    }
    next();
  };
}

function requestVolcanoTts(config: WebConfig, text: string, speaker: string): Promise<Buffer> {
  const volcano = config.tts && config.tts.provider === 'volcano' ? config.tts.volcano : undefined;

  let built: { headers: Record<string, string>; body: string };
  try {
    built = buildVolcanoTtsRequest({
      credential: volcano,
      text,
      speaker,
      uid: config.speakers.find((entry) => entry.enabled)?.userId,
      requestId: nanoid(),
    });
  } catch (error) {
    return Promise.reject(error);
  }

  const postData = built.body;
  const headers: Record<string, string | number> = {
    ...built.headers,
    'Content-Length': Buffer.byteLength(postData),
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: Error | null, audio?: Buffer) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(audio ?? Buffer.alloc(0));
    };

    const request = https.request(
      {
        hostname: 'openspeech.bytedance.com',
        path: '/api/v1/tts',
        method: 'POST',
        timeout: 20_000,
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > 10 * 1024 * 1024) {
            response.destroy();
            finish(new Error('TTS response is too large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          if (settled) return;
          if (response.statusCode !== 200) {
            finish(new Error('TTS upstream returned HTTP ' + response.statusCode));
            return;
          }
          try {
            const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
              code?: number;
              data?: unknown;
              message?: unknown;
            };
            if (typeof payload.data === 'string') {
              finish(null, Buffer.from(payload.data, 'base64'));
              return;
            }
            const message = typeof payload.message === 'string' ? payload.message : 'TTS 请求失败';
            finish(new Error(message));
          } catch {
            finish(new Error('TTS response is invalid JSON'));
          }
        });
        response.on('error', (error) => finish(error));
      },
    );

    request.on('timeout', () => request.destroy(new Error('TTS request timed out')));
    request.on('error', (error) => finish(error));
    request.write(postData);
    request.end();
  });
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const configPath = options.configPath ?? CONFIG_PATH;
  const app = express();
  let state: ServiceState = 'stopped';
  let lastError = '';
  let configLoaded = false;
  let cachedConfig: WebConfig;
  const speakerStatuses = new Map<string, SpeakerRuntimeStatus>();

  const loadWebConfig = (): WebConfig => {
    if (!configLoaded) {
      cachedConfig = loadConfig(configPath);
      configLoaded = true;
    }
    return cachedConfig;
  };
  const setWebConfig = (config: WebConfig): void => {
    cachedConfig = config;
    configLoaded = true;
  };
  const refreshState = (): void => {
    const statuses = [...speakerStatuses.values()];
    const runningCount = statuses.filter((item) => item.state === 'running').length;
    const startingCount = statuses.filter((item) => item.state === 'starting').length;
    const errorCount = statuses.filter((item) => item.state === 'error').length;
    state = runningCount > 0
      ? 'running'
      : startingCount > 0
        ? 'starting'
        : errorCount > 0
          ? 'error'
          : 'stopped';
    lastError = statuses.find((item) => item.error)?.error || '';
  };
  const refreshStatuses = (): void => {
    speakerStatuses.clear();
    for (const status of runtimeController.getStatuses()) {
      speakerStatuses.set(status.id, { ...status });
    }
    refreshState();
  };
  const handleRuntimeEvent = (event: SpeakerRuntimeEvent): void => {
    if (event.type === 'log') {
      if (event.content) {
        let speakerName: string | undefined;
        try {
          speakerName = loadWebConfig().speakers.find((item) => item.id === event.speakerId)?.name;
        } catch {
          speakerName = undefined;
        }
        addLog(event.logType || 'system', event.content, speakerName);
      }
      return;
    }
    if (event.type === 'selection') {
      try {
        const saved = saveSpeakerSelection(configPath, event.speakerId, {
          model: event.model,
          thinkingLevel: event.thinkingLevel,
        });
        setWebConfig(saved);
      } catch (error) {
        console.error('Failed to persist speaker selection:', error);
      }
    }
    refreshStatuses();
  };
  const runtimeController: RuntimeController =
    options.runtimeController || new SpeakerManager({ onEvent: handleRuntimeEvent, ttsSecretPath });

  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    if (_req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(
    cookieSession({
      name: 'session',
      keys: [AUTH_SECRET],
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
    }),
  );
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const fetchSite = req.get('sec-fetch-site');
    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      res.status(403).json({ error: '跨站请求被拒绝' });
      return;
    }
    const origin = req.get('origin');
    if (origin) {
      try {
        if (new URL(origin).host !== req.get('host')) {
          res.status(403).json({ error: '跨站请求被拒绝' });
          return;
        }
      } catch {
        res.status(403).json({ error: '跨站请求被拒绝' });
        return;
      }
    }
    next();
  });

  const failedLogins = new Map<string, { count: number; resetAt: number }>();
  const activeSessions = new Set<string>();

  app.post('/api/login', (req, res) => {
    const key = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const failures = failedLogins.get(key);
    if (failures && failures.resetAt > now && failures.count >= 5) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((failures.resetAt - now) / 1000))));
      res.status(429).json({ success: false, error: '登录失败次数过多，请稍后再试' });
      return;
    }

    const username = inputText(req.body?.username);
    const password = inputText(req.body?.password, 4096);
    const usernameValid = secureEqual(username, AUTH_USERNAME);
    const passwordValid = secureEqual(password, AUTH_PASSWORD);
    if (!usernameValid || !passwordValid) {
      if (!failures || failures.resetAt <= now) {
        if (failedLogins.size >= 1000) failedLogins.delete(failedLogins.keys().next().value as string);
        failedLogins.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
      } else {
        failures.count += 1;
      }
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    failedLogins.delete(key);
    const sessionId = nanoid(32);
    if (activeSessions.size >= 100) activeSessions.delete(activeSessions.values().next().value as string);
    activeSessions.add(sessionId);
    req.session = { authenticated: true, sessionId };
    res.json({ success: true });
  });

  app.use('/api', (req, res, next) => {
    const sessionId = req.session?.sessionId;
    if (req.session?.authenticated === true && typeof sessionId === 'string' && activeSessions.has(sessionId)) {
      next();
      return;
    }
    res.status(401).json({ error: '未登录' });
  });

  app.get('/api/status', (_req, res) => {
    refreshStatuses();
    const speakers = [...speakerStatuses.values()];
    const primary = speakers[0];
    res.json({
      running: speakers.some((speaker) => speaker.state === 'running'),
      state,
      error: lastError || undefined,
      speakers,
      model: primary?.model || '',
      thinkingLevel: primary?.thinkingLevel || 'default',
      voiceControl: primary?.voiceControl ?? true,
    });
  });

  app.get('/api/logs', (_req, res) => res.json({ logs }));

  app.get('/api/config', (_req, res) => {
    try {
      res.json(publicConfig(loadWebConfig()));
    } catch (error) {
      console.error('Failed to load configuration:', error);
      res.status(500).json({ error: '读取配置失败' });
    }
  });

  app.put('/api/config', async (req, res) => {
    try {
      const wasRunning = state === 'running' || state === 'starting';
      const saved = saveConfig(configPath, req.body);
      setWebConfig(saved);
      // 保存即在正在运行时热重启，让新配置立刻生效，无需手动重启容器。
      if (wasRunning) {
        try {
          await runtimeController.stop();
          await launchSpeakers(false);
          addLog('system', '♻️ 配置已更新并即时生效');
        } catch (error) {
          state = 'error';
          lastError = clientError(error, '配置已保存，但重新加载失败');
          addLog('system', '❌ ' + lastError);
        }
      }
      res.json({ ...publicConfig(saved), applied: wasRunning });
    } catch (error) {
      const message = clientError(error, '配置无效');
      res.status(400).json({ error: message });
    }
  });

  app.post('/api/models', async (req, res) => {
    try {
      const config = loadWebConfig();
      const inputBaseURL = inputText(req.body?.baseURL, 2048);
      const inputApiKey = inputText(req.body?.apiKey, 8192);
      const nextConfig = {
        ...config,
        openai: {
          ...config.openai,
          baseURL: inputBaseURL || config.openai.baseURL,
          apiKey: inputApiKey || config.openai.apiKey,
        },
      };
      const endpoint = new URL(nextConfig.openai.baseURL);
      if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
        throw new Error('API Base URL 必须使用 http 或 https');
      }
      if (endpoint.username || endpoint.password) throw new Error('API Base URL 不能包含账号密码');
      const models = await fetchUpstreamModels(nextConfig);
      const merged = [...new Set(config.models.concat(models))];
      const saved = saveConfig(configPath, { ...config, models: merged });
      setWebConfig(saved);
      res.json({ models: merged });
    } catch (error) {
      const message = clientError(error, '获取模型列表失败');
      res.status(502).json({ error: message });
    }
  });

  const launchSpeakers = async (announce: boolean): Promise<void> => {
    const config = loadWebConfig();
    const enabled = config.speakers.filter((speaker) => speaker.enabled);
    if (enabled.length === 0) throw new Error('没有启用任何音箱');
    for (const speaker of enabled) validateSpeaker(speaker);
    speakerStatuses.clear();
    for (const speaker of enabled) {
      speakerStatuses.set(speaker.id, {
        id: speaker.id,
        name: speaker.name,
        enabled: true,
        state: 'starting',
        model: speaker.model,
        thinkingLevel: speaker.thinkingLevel,
        voiceControl: speaker.voiceControl,
      });
    }
    state = 'starting';
    lastError = '';
    if (announce) addLog('system', '🚀 正在启动 ' + enabled.length + ' 个音箱...');
    await runtimeController.start(config);
    refreshStatuses();
  };

  app.post('/api/start', async (_req, res) => {
    if (state === 'running' || state === 'starting') {
      res.json({ success: true, state, speakers: [...speakerStatuses.values()] });
      return;
    }
    if (state === 'stopping') {
      res.status(409).json({ error: '服务正在停止，请稍后重试' });
      return;
    }

    try {
      setWebConfig(loadWebConfig());
      await launchSpeakers(true);
      res.status(202).json({ success: true, state, speakers: [...speakerStatuses.values()] });
    } catch (error) {
      state = 'error';
      lastError = clientError(error, '启动失败，请检查配置');
      addLog('system', '❌ ' + lastError);
      console.error('Failed to start speakers:', error);
      res.status(500).json({ error: lastError });
    }
  });

  app.post('/api/stop', async (_req, res) => {
    if (state === 'stopped') {
      res.json({ success: true, state });
      return;
    }
    state = 'stopping';
    try {
      await runtimeController.stop();
      refreshStatuses();
      state = 'stopped';
      addLog('system', '🛑 所有音箱服务已停止');
      res.json({ success: true, state });
    } catch (error) {
      state = 'error';
      lastError = clientError(error, '停止失败，请查看容器日志');
      addLog('system', '❌ ' + lastError);
      console.error('Failed to stop speakers:', error);
      res.status(500).json({ error: lastError });
    }
  });

  app.post('/api/logout', (req, res) => {
    const sessionId = req.session?.sessionId;
    if (typeof sessionId === 'string') activeSessions.delete(sessionId);
    req.session = null;
    res.json({ success: true });
  });

  app.get('/api/tts-speakers', (_req, res) => {
    res.json([
      { name: '湾区大叔', gender: '男', speaker: 'zh_male_wanqudashu_moon_bigtts' },
      { name: '呆萌川妹', gender: '女', speaker: 'zh_female_daimengchuanmei_moon_bigtts' },
      { name: '广州德哥', gender: '男', speaker: 'zh_male_guozhoudege_moon_bigtts' },
      { name: '北京小爷', gender: '男', speaker: 'zh_male_beijingxiaoye_moon_bigtts' },
      { name: '少年梓辛', gender: '男', speaker: 'zh_male_shaonianzixin_moon_bigtts' },
      { name: '魅力女友', gender: '女', speaker: 'zh_female_meilinvyou_moon_bigtts' },
      { name: '深夜播客', gender: '男', speaker: 'zh_male_shenyeboke_moon_bigtts' },
      { name: '柔美女友', gender: '女', speaker: 'zh_female_sajiaonvyou_moon_bigtts' },
      { name: '撒娇学妹', gender: '女', speaker: 'zh_female_yuanqinvyou_moon_bigtts' },
      { name: '浩宇小哥', gender: '男', speaker: 'zh_male_haoyuxiaoge_moon_bigtts' },
    ]);
  });

  app.get('/api/test-tts', createFixedWindowLimiter(10, 60 * 1000), async (req, res) => {
    const text = inputText(req.query.text, 500);
    if (!text) {
      res.status(400).json({ error: 'text 参数缺失或过长' });
      return;
    }
    try {
      const config = loadWebConfig();
      const speaker = config.tts?.defaultSpeaker || 'zh_female_daimengchuanmei_moon_bigtts';
      const audio = await requestVolcanoTts(config, text, speaker);
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'no-store');
      res.send(audio);
    } catch (error) {
      console.error('TTS test failed:', error);
      res.status(502).json({ error: clientError(error, 'TTS 请求失败') });
    }
  });

  app.get(ttsSpeakersPath, (_req, res) => {
    res.json([
      { name: '豆包通用（新版音色ID示例）', gender: '通用', speaker: 'BV001' },
      { name: '湾区大叔', gender: '男', speaker: 'zh_male_wanqudashu_moon_bigtts' },
      { name: '呆萌川妹', gender: '女', speaker: 'zh_female_daimengchuanmei_moon_bigtts' },
      { name: '广州德哥', gender: '男', speaker: 'zh_male_guozhoudege_moon_bigtts' },
      { name: '北京小爷', gender: '男', speaker: 'zh_male_beijingxiaoye_moon_bigtts' },
      { name: '少年梓辛', gender: '男', speaker: 'zh_male_shaonianzixin_moon_bigtts' },
      { name: '魅力女友', gender: '女', speaker: 'zh_female_meilinvyou_moon_bigtts' },
      { name: '深夜播客', gender: '男', speaker: 'zh_male_shenyeboke_moon_bigtts' },
      { name: '柔美女友', gender: '女', speaker: 'zh_female_sajiaonvyou_moon_bigtts' },
      { name: '撒娇学妹', gender: '女', speaker: 'zh_female_yuanqinvyou_moon_bigtts' },
      { name: '浩宇小哥', gender: '男', speaker: 'zh_male_haoyuxiaoge_moon_bigtts' },
    ]);
  });

  app.get(ttsPath, createFixedWindowLimiter(60, 60 * 1000), async (req, res) => {
    const text = inputText(req.query.text, 2000);
    const requestedSpeaker = inputText(req.query.speaker, 100);
    if (!text) {
      res.status(400).json({ error: 'text 参数缺失或过长' });
      return;
    }
    const config = loadWebConfig();
    if (!config?.tts?.provider) {
      res.status(503).json({ error: 'TTS 服务尚未配置' });
      return;
    }
    const defaultSpeaker = config.tts.defaultSpeaker || 'zh_female_daimengchuanmei_moon_bigtts';
    const speaker = /^[A-Za-z0-9_]+$/.test(requestedSpeaker) ? requestedSpeaker : defaultSpeaker;
    try {
      const audio = await requestVolcanoTts(config, text, speaker);
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'no-store');
      res.send(audio);
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      res.status(502).end();
    }
  });

  app.get('/', (req, res) => {
    const sessionId = req.session?.sessionId;
    if (req.session?.authenticated === true && typeof sessionId === 'string' && activeSessions.has(sessionId)) {
      res.send(HTML);
      return;
    }
    res.send(LOGIN_HTML);
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: '接口不存在' });
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (res.headersSent) return;
      if (error instanceof SyntaxError) {
        res.status(400).json({ error: '请求 JSON 格式错误' });
        return;
      }
      console.error('Unhandled request error:', error);
      res.status(500).json({ error: '服务器内部错误' });
    },
  );

  return app;
}

async function main(): Promise<void> {
  const app = createApp();
  const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  app.listen(port, () => {
    console.log('mi-paiai listening on port ' + port);
  });
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (entryPath && import.meta.url === entryPath) {
  main().catch((error) => {
    console.error('Failed to start mi-paiai:', error);
    process.exitCode = 1;
  });
}
