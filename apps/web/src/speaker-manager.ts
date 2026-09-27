import { fork, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpeakerConfig, ThinkingLevel, WebConfig } from './config.js';

export interface SpeakerRuntimeStatus {
  id: string;
  name: string;
  enabled: boolean;
  state: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  model: string;
  thinkingLevel: ThinkingLevel;
  voiceControl: boolean;
}

export interface SpeakerRuntimeEvent {
  type: 'state' | 'log' | 'selection';
  speakerId: string;
  state?: SpeakerRuntimeStatus['state'];
  error?: string;
  logType?: 'user' | 'ai' | 'system';
  content?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
}

export interface SpeakerManagerCallbacks {
  onEvent: (event: SpeakerRuntimeEvent) => void;
  ttsSecretPath: string;
}

export class SpeakerManager {
  private workers = new Map<string, ChildProcess>();
  private directories = new Map<string, string>();
  private statuses = new Map<string, SpeakerRuntimeStatus>();
  private stopping = false;
  private readonly callbacks: SpeakerManagerCallbacks;

  constructor(callbacks: SpeakerManagerCallbacks) {
    this.callbacks = callbacks;
  }

  getStatuses(): SpeakerRuntimeStatus[] {
    return [...this.statuses.values()];
  }

  async start(config: WebConfig): Promise<void> {
    await this.stop();
    this.stopping = false;
    const enabled = config.speakers.filter((speaker) => speaker.enabled);
    if (enabled.length === 0) throw new Error('没有启用任何音箱');

    for (const speaker of enabled) {
      this.statuses.set(speaker.id, {
        id: speaker.id,
        name: speaker.name,
        enabled: true,
        state: 'starting',
        model: speaker.model,
        thinkingLevel: speaker.thinkingLevel,
        voiceControl: speaker.voiceControl,
      });
      this.spawn(speaker, config);
    }
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const workers = [...this.workers.values()];
    for (const worker of workers) {
      if (worker.connected) worker.send({ type: 'stop' });
      else worker.kill('SIGTERM');
    }
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            if (worker.exitCode !== null || worker.signalCode !== null) {
              resolve();
              return;
            }
            const timer = setTimeout(() => {
              worker.kill('SIGKILL');
              resolve();
            }, 3000);
            worker.once('exit', () => {
              clearTimeout(timer);
              resolve();
            });
          }),
      ),
    );
    this.workers.clear();
    for (const directory of this.directories.values()) {
      rmSync(directory, { recursive: true, force: true });
    }
    this.directories.clear();
    for (const status of this.statuses.values()) {
      status.state = 'stopped';
      status.error = undefined;
    }
    this.callbacks.onEvent({ type: 'state', speakerId: '*', state: 'stopped' });
  }

  private spawn(speaker: SpeakerConfig, config: WebConfig): void {
    const runtimeDirectory = join(tmpdir(), `mi-paiai-${process.pid}`, speaker.id);
    mkdirSync(runtimeDirectory, { recursive: true, mode: 0o700 });
    this.directories.set(speaker.id, runtimeDirectory);

    const worker = fork(fileURLToPath(new URL('./speaker-worker.js', import.meta.url)), [], {
      cwd: runtimeDirectory,
      detached: false,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    this.workers.set(speaker.id, worker);
    worker.send({
      type: 'init',
      payload: {
        speaker,
        openai: config.openai,
        prompt: config.prompt,
        callAIKeywords: config.callAIKeywords,
        models: config.models,
        webSearch: config.webSearch,
        ttsCommand: config.ttsCommand,
        wakeUpCommand: config.wakeUpCommand,
        tts: config.tts,
        publicURL: config.publicURL,
        ttsSecretPath: this.callbacks.ttsSecretPath,
      },
    });

    worker.on('message', (event: SpeakerRuntimeEvent) => {
      const status = this.statuses.get(event.speakerId);
      if (status && event.type === 'state' && event.state) {
        status.state = event.state;
        status.error = event.error;
      }
      if (status && event.type === 'selection') {
        if (event.model) status.model = event.model;
        if (event.thinkingLevel) status.thinkingLevel = event.thinkingLevel;
      }
      this.callbacks.onEvent(event);
    });

    worker.on('error', (error) => {
      const status = this.statuses.get(speaker.id);
      if (status) {
        status.state = 'error';
        status.error = error.message;
      }
      this.callbacks.onEvent({ type: 'state', speakerId: speaker.id, state: 'error', error: error.message });
    });

    worker.on('exit', (code) => {
      this.workers.delete(speaker.id);
      const status = this.statuses.get(speaker.id);
      if (!status) return;
      if (!this.stopping && code !== 0 && status.state !== 'error') {
        status.state = 'error';
        status.error = `worker exited with code ${code}`;
      } else if (status.state !== 'error') {
        status.state = 'stopped';
      }
      this.callbacks.onEvent({ type: 'state', speakerId: speaker.id, state: status.state });
    });
  }
}
