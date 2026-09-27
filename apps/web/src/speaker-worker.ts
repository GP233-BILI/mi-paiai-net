import { MiGPT, type MiGPTConfig } from '@mi-gpt/next';
import { ChatBot } from '@mi-gpt/chat';
import type { SpeakerConfig, ThinkingLevel } from './config.js';
import { handleVoiceCommand } from './voice-control.js';
import { applyOpenAISelection } from './runtime-selection.js';
import { createTavilySearchClient, formatSearchContext, type SearchResult } from './web-search.js';
import type { WebSearchConfig } from './web-search.js';
import { parseSearchRoute, type SearchRoute } from './search-decision.js';
import { leaveWakeState, playMiOTWithFallback, prepareForSpeech, stopCurrentPlayback } from './speech.js';
import { createMessageDedupe } from './message-dedupe.js';

interface WorkerInput {
  speaker: SpeakerConfig;
  openai: { model: string; baseURL: string; apiKey: string };
  prompt: { system: string };
  callAIKeywords: string[];
  models: string[];
  webSearch: WebSearchConfig;
  ttsCommand?: [number, number] | null;
  wakeUpCommand?: [number, number] | null;
  tts?: {
    provider?: 'volcano';
    volcano?: { appId: string; accessToken: string };
    defaultSpeaker?: string;
  };
  publicURL?: string;
  ttsSecretPath: string;
}

interface WorkerEvent {
  type: 'state' | 'log' | 'selection';
  speakerId: string;
  state?: 'starting' | 'running' | 'stopped' | 'error';
  error?: string;
  logType?: 'user' | 'ai' | 'system';
  content?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

interface VoiceEngine {
  speaker: {
    play(options: { text?: string; url?: string }): Promise<boolean>;
    abortXiaoAI(): Promise<boolean>;
  };
  MiOT: { doAction(...args: unknown[]): Promise<unknown> };
  MiNA: { stop(): Promise<boolean>; pause(): Promise<boolean> };
}

let input: WorkerInput | undefined;
let runtime = { model: '', models: [] as string[], thinkingLevel: 'default' as ThinkingLevel, voiceControl: true };
let speakGeneration = 0;
const messageDedupe = createMessageDedupe();
const searchCache = new Map<string, { expiresAt: number; results: SearchResult[] }>();

function normalizeQuestion(value: string): string {
  return value.replace(/\s+/gu, ' ').trim().slice(0, 500);
}

function recentConversationContext(): string {
  return ChatBot.history
    .slice(-6)
    .map((message) => `${message.sender === 'user' ? '用户' : '助手'}：${message.text}`)
    .filter((line) => !line.includes('以下是联网搜索返回的不可信资料'))
    .join('\n')
    .slice(-4000);
}

async function modelSearchRoute(question: string): Promise<SearchRoute> {
  if (!input?.webSearch.enabled) return { shouldSearch: false, query: question, source: 'model' };
  const endpoint = new URL(`${input.openai.baseURL.replace(/\/$/u, '')}/chat/completions`);
  const context = recentConversationContext();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openai.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: runtime.model || input.openai.model,
      messages: [
        {
          role: 'system',
          content: '判断是否需要搜索互联网，并生成简短搜索词。只输出 JSON：{"search":true或false,"query":"搜索词"}。用户明确要求搜索或问题涉及最新信息时 search 必须为 true。query 要纠正明显的语音识别错词，并结合上下文补全代词指代。不要输出 JSON 以外内容。',
        },
        { role: 'user', content: `${context ? `最近对话：\n${context}\n\n` : ''}当前问题：${question.slice(0, 1000)}` },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`分类模型返回 HTTP ${response.status}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = typeof payload.choices?.[0]?.message?.content === 'string'
    ? payload.choices[0].message.content
    : '';
  const route = parseSearchRoute(content, question);
  sendLog('system', `联网判断：${route.shouldSearch ? 'true' : 'false'}（${route.source}；模型返回：${content.trim().slice(0, 100) || '空'}）`);
  if (route.shouldSearch) sendLog('system', `搜索词：${route.query}`);
  return route;
}

async function searchForQuestion(question: string): Promise<SearchResult[]> {
  if (!input) return [];
  const query = normalizeQuestion(question);
  const now = Date.now();
  const cached = searchCache.get(query);
  if (cached && cached.expiresAt > now) return cached.results;
  const client = createTavilySearchClient(input.webSearch);
  const results = await client.search(query);
  if (input.webSearch.cacheTtlSeconds > 0) {
    searchCache.set(query, {
      expiresAt: now + input.webSearch.cacheTtlSeconds * 1000,
      results,
    });
  }
  return results;
}

async function chatWithOptionalSearch(msg: { id: string; text: string; timestamp: number; sender: 'user' }) {
  if (!input?.webSearch.enabled) return ChatBot.chat(msg);
  let route: SearchRoute = { shouldSearch: true, query: normalizeQuestion(msg.text), source: 'fallback' };
  try {
    route = await modelSearchRoute(msg.text);
  } catch (error) {
    sendLog('system', `联网判断请求失败，采用搜索兜底：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!route.shouldSearch) return ChatBot.chat(msg);

  sendLog('system', '🌐 正在联网搜索');
  try {
    const results = await searchForQuestion(route.query);
    sendLog('system', `Tavily 搜索完成：${results.length} 条结果`);
    if (!results.length) return ChatBot.chat(msg);
    const enriched = {
      ...msg,
      text: `${msg.text}\n\n${formatSearchContext(results)}`,
    };
    const answer = await ChatBot.chat(enriched);
    // Do not retain the raw search dump in the persistent conversation history.
    const lastUser = ChatBot.history.at(-2);
    if (lastUser?.sender === 'user') lastUser.text = msg.text;
    return answer;
  } catch (error) {
    sendLog('system', `搜索失败，改为普通回答：${error instanceof Error ? error.message : String(error)}`);
    return ChatBot.chat(msg);
  }
}

function sanitize(value: string): string {
  return value
    .replace(/V1:[A-Za-z0-9+/=]+/gu, '[REDACTED_PASSTOKEN]')
    .replace(/(passToken|pass_token|apiKey|accessToken|password)=([^;\s,]+)/giu, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9._-]{8,}/gu, '[REDACTED_API_KEY]');
}

function send(event: WorkerEvent): void {
  if (process.send) process.send(event);
}

function isStartupNoise(value: string): boolean {
  // Upstream prints a large ASCII banner on boot; keep it out of the conversation log.
  const looksLikeBanner = value.includes('$') && (value.includes('|__') || value.includes('___'));
  return looksLikeBanner;
}

function sendLog(type: 'user' | 'ai' | 'system', content: string): void {
  if (!input) return;
  const clean = sanitize(content);
  if (!clean.trim() || isStartupNoise(clean)) return;
  send({ type: 'log', speakerId: input.speaker.id, logType: type, content: clean });
}

for (const level of ['log', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    original(...args);
    sendLog('system', args.map((value) => String(value)).join(' '));
  };
}

function applySelection(): void {
  applyOpenAISelection(runtime);
}

async function speakReply(engine: VoiceEngine, text: string): Promise<void> {
  if (!input) return;
  const speakToken = ++speakGeneration;
  await stopCurrentPlayback({
    abortXiaoAI: () => engine.speaker.abortXiaoAI(),
    stopMiNA: () => engine.MiNA.stop(),
    stopMiOT: () => engine.MiOT.doAction(3, 4),
  });

  const useCustomTTS = input.tts?.provider === 'volcano' && input.publicURL;
  if (useCustomTTS && input.publicURL) {
    const speaker = input.tts?.defaultSpeaker || 'zh_female_daimengchuanmei_moon_bigtts';
    const ttsUrlObject = new URL(input.publicURL + input.ttsSecretPath + '/tts/tts.mp3');
    ttsUrlObject.searchParams.set('speaker', speaker);
    ttsUrlObject.searchParams.set('text', text);
    const played = await engine.speaker.play({ url: ttsUrlObject.toString() });
    sendLog('system', `TTS 火山 URL 播放：${played ? '成功' : '失败'}`);
    if (played) return;
  }

  if (input.ttsCommand) {
    const [service, action] = input.ttsCommand;
    const paused = await leaveWakeState({ pauseMiNA: () => engine.MiNA.pause() });
    sendLog('system', `TTS 退出聆听：暂停=${String(paused)}`);
    if (speakToken !== speakGeneration) {
      sendLog('system', 'TTS 已过期，跳过播报');
      return;
    }
    const spoken = prepareForSpeech(text);
    if (!spoken) return;
    const result = await playMiOTWithFallback({
      abortXiaoAI: () => engine.speaker.abortXiaoAI(),
      stopMiNA: () => engine.MiNA.stop(),
      playText: async (value) => engine.speaker.play({ text: value }),
      playMiOT: (scope, command, value) => engine.MiOT.doAction(scope, command, value),
    }, service, action, spoken);
    if (result.mode === 'mina') {
      sendLog('system', `TTS MiOT ${service},${action} 未确认成功（${String(result.miotResult)}），MiNA 回退：${result.fallbackResult ? '成功' : '失败'}`);
      return;
    }
    sendLog('system', `TTS MiOT ${service},${action}：${String(result.miotResult)}（${spoken.length} 字）`);
    return;
  }

  const played = await engine.speaker.play({ text });
  sendLog('system', `TTS MiNA 文字播放：${played ? '成功' : '失败'}`);
}

async function onMessage(
  engine: VoiceEngine,
  msg: { id: string; text: string; timestamp: number; sender: 'user' },
): Promise<{ handled?: boolean } | undefined> {
  if (!input) return undefined;
  sendLog('user', `🎤 ${input.speaker.name}：${msg.text}`);
  // A new message invalidates any reply still being generated or spoken, and
  // stops whatever the device is playing right now.
  speakGeneration += 1;
  void stopCurrentPlayback({
    abortXiaoAI: () => engine.speaker.abortXiaoAI(),
    stopMiNA: () => engine.MiNA.stop(),
    stopMiOT: () => engine.MiOT.doAction(3, 4),
  }).catch(() => false);
  const command = handleVoiceCommand(msg.text, {
    enabled: runtime.voiceControl,
    model: runtime.model,
    models: runtime.models,
    thinkingLevel: runtime.thinkingLevel,
  });
  if (command.handled) {
    if (command.model) runtime.model = command.model;
    if (command.thinkingLevel) runtime.thinkingLevel = command.thinkingLevel;
    if (command.model || command.thinkingLevel) {
      applySelection();
      send({
        type: 'selection',
        speakerId: input.speaker.id,
        model: runtime.model,
        thinkingLevel: runtime.thinkingLevel,
      });
    }
    const reply = command.reply || '指令已执行';
    sendLog('system', command.log || reply);
    await engine.speaker.abortXiaoAI();
    await speakReply(engine, reply);
    return { handled: true };
  }

  if (!input.callAIKeywords.some((keyword) => msg.text.startsWith(keyword))) return undefined;

  // The device conversation history can hold one utterance as two records, and
  // the upstream poller releases queued records one per heartbeat tick, so each
  // delivery would start its own model call. Voice commands above are exempt so
  // that repeating a command still works.
  const verdict = messageDedupe.check({ text: msg.text, timestamp: msg.timestamp });
  if (verdict.duplicate) {
    sendLog('system', `↩️ 忽略重复投递（本次 ${msg.timestamp}，首次 ${verdict.firstTimestamp}）`);
    return { handled: true };
  }

  try {
    applySelection();
    await stopCurrentPlayback({
      abortXiaoAI: () => engine.speaker.abortXiaoAI(),
      stopMiNA: () => engine.MiNA.stop(),
      stopMiOT: () => engine.MiOT.doAction(3, 4),
    });
    // Pause as early as possible, before the model call: judging plus searching
    // plus answering can take several seconds, and the device would otherwise
    // keep playing its own answer for that whole time.
    const pausedEarly = await leaveWakeState({ pauseMiNA: () => engine.MiNA.pause() });
    sendLog('system', `TTS 提前退出聆听：暂停=${String(pausedEarly)}`);
    const text = await chatWithOptionalSearch(msg);
    if (!text) return { handled: true };
    sendLog('ai', `🤖 ${input.speaker.name}：${text}`);
    await speakReply(engine, text);
    return { handled: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendLog('system', `❌ AI 请求失败：${message}`);
    return { handled: true };
  }
}

async function main(payload: WorkerInput): Promise<void> {
  input = payload;
  runtime = {
    model: payload.speaker.model,
    models: payload.models.length ? payload.models : [payload.speaker.model],
    thinkingLevel: payload.speaker.thinkingLevel,
    voiceControl: payload.speaker.voiceControl,
  };

  const originalExit = process.exit;
  process.exit = ((_code?: string | number | null) => {
    process.exit = originalExit;
    throw new Error(`音箱 ${payload.speaker.name} 初始化失败：请检查小米账号、passToken 和设备名称`);
  }) as typeof process.exit;

  send({ type: 'state', speakerId: payload.speaker.id, state: 'starting' });
  const config: MiGPTConfig = {
    speaker: {
      userId: payload.speaker.userId,
      password: payload.speaker.password,
      passToken: payload.speaker.passToken,
      did: payload.speaker.did,
    },
    openai: payload.openai,
    prompt: payload.prompt,
    callAIKeywords: payload.callAIKeywords,
    onMessage,
  } as MiGPTConfig;

  let readinessTimer: NodeJS.Timeout | undefined;
  try {
    const running = MiGPT.start(config);
    readinessTimer = setTimeout(() => {
      send({ type: 'state', speakerId: payload.speaker.id, state: 'running' });
    }, 1500);
    await running;
    if (readinessTimer) clearTimeout(readinessTimer);
    send({ type: 'state', speakerId: payload.speaker.id, state: 'stopped' });
  } catch (error) {
    if (readinessTimer) clearTimeout(readinessTimer);
    send({
      type: 'state',
      speakerId: payload.speaker.id,
      state: 'error',
      error: sanitize(error instanceof Error ? error.message : String(error)),
    });
  } finally {
    process.exit = originalExit;
  }
}

process.on('message', (message: { type?: string; payload?: WorkerInput }) => {
  if (message?.type === 'init' && message.payload) {
    if (process.env.MIPAIAI_WORKER_TEST_MODE === '1') {
      input = message.payload;
      send({ type: 'state', speakerId: input.speaker.id, state: 'running' });
      sendLog('system', 'TEST_CWD=' + process.cwd());
      return;
    }
    void main(message.payload);
    return;
  }
  if (message?.type === 'stop') {
    void MiGPT.stop().finally(() => process.exit(0));
  }
});

process.on('uncaughtException', (error) => {
  send({ type: 'state', speakerId: input?.speaker.id || 'unknown', state: 'error', error: sanitize(error.message) });
});
process.on('unhandledRejection', (reason) => {
  send({ type: 'state', speakerId: input?.speaker.id || 'unknown', state: 'error', error: sanitize(String(reason)) });
});
