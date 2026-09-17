import { MiGPT, type MiGPTConfig } from '@mi-gpt/next';
import { ChatBot } from '@mi-gpt/chat';
import type { SpeakerConfig, ThinkingLevel } from './config.js';
import { handleVoiceCommand } from './voice-control.js';
import { applyOpenAISelection } from './runtime-selection.js';

interface WorkerInput {
  speaker: SpeakerConfig;
  openai: { model: string; baseURL: string; apiKey: string };
  prompt: { system: string };
  callAIKeywords: string[];
  models: string[];
  ttsCommand?: [number, number];
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
}

let input: WorkerInput | undefined;
let runtime = { model: '', models: [] as string[], thinkingLevel: 'default' as ThinkingLevel, voiceControl: true };

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
  const useCustomTTS = input.tts?.provider === 'volcano' && input.publicURL;
  if (useCustomTTS && input.publicURL) {
    const speaker = input.tts?.defaultSpeaker || 'zh_female_daimengchuanmei_moon_bigtts';
    const ttsUrlObject = new URL(input.publicURL + input.ttsSecretPath + '/tts/tts.mp3');
    ttsUrlObject.searchParams.set('speaker', speaker);
    ttsUrlObject.searchParams.set('text', text);
    await engine.speaker.play({ url: ttsUrlObject.toString() });
    return;
  }
  if (input.ttsCommand) {
    await engine.MiOT.doAction(input.ttsCommand[0], input.ttsCommand[1], text);
    return;
  }
  await engine.speaker.play({ text });
}

async function onMessage(
  engine: VoiceEngine,
  msg: { id: string; text: string; timestamp: number; sender: 'user' },
): Promise<{ handled?: boolean } | undefined> {
  if (!input) return undefined;
  sendLog('user', `🎤 ${input.speaker.name}：${msg.text}`);
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

  try {
    applySelection();
    await engine.speaker.abortXiaoAI();
    const text = await ChatBot.chat(msg);
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
