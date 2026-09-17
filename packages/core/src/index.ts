import { MiGPT, type MiGPTConfig } from '@mi-gpt/next';
import { ChatBot } from '@mi-gpt/chat';
import { readFileSync, statSync } from 'node:fs';
import YAML from 'yaml';

export interface PluginContext {
  text: string;
  timestamp: number;
}

export interface PluginResult {
  text?: string;
  handled?: boolean;
}

export interface Plugin {
  name: string;
  description: string;
  keywords?: string[];
  execute(ctx: PluginContext): Promise<PluginResult | null>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) return;
    this.plugins.set(plugin.name, plugin);
  }

  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  async execute(ctx: PluginContext): Promise<PluginResult | null> {
    for (const plugin of this.plugins.values()) {
      if (this.shouldTrigger(plugin, ctx.text)) {
        try {
          const result = await plugin.execute(ctx);
          if (result) return result;
        } catch (error) {
          console.error(`Plugin ${plugin.name} error:`, error);
        }
      }
    }
    return null;
  }

  private shouldTrigger(plugin: Plugin, text: string): boolean {
    if (!plugin.keywords || plugin.keywords.length === 0) return true;
    return plugin.keywords.some((keyword) => text.includes(keyword));
  }
}

export interface MemoryRecord {
  id: string;
  content: string;
  timestamp: number;
}

export class MemorySystem {
  private records: MemoryRecord[] = [];
  private maxRecords: number;

  constructor(maxRecords = 100) {
    this.maxRecords = maxRecords;
  }

  async remember(content: string): Promise<string> {
    const id = `mem_${Date.now()}`;
    this.records.push({ id, content, timestamp: Date.now() });
    if (this.records.length > this.maxRecords) this.records.shift();
    return id;
  }

  async recall(query: string, limit = 3): Promise<MemoryRecord[]> {
    return this.records
      .filter(r => r.content.includes(query) || query.includes(r.content))
      .slice(-limit);
  }

  buildContext(records: MemoryRecord[]): string {
    if (records.length === 0) return '';
    return records.map(r => r.content).join('\n');
  }

  getStats() {
    return { total: this.records.length, max: this.maxRecords };
  }

  async clear(): Promise<void> {
    this.records = [];
  }
}

export interface UltimateConfig extends MiGPTConfig {
  plugins?: Plugin[];
  memory?: { enabled: boolean; maxRecords?: number };
  ttsCommand?: [number, number];
}

export class ConfigLoader {
  static load(configPath: string): UltimateConfig {
    const stats = statSync(configPath);
    if (!stats.isFile() || stats.size > 1024 * 1024) {
      throw new Error('Config file must be a regular file no larger than 1 MiB');
    }
    const content = readFileSync(configPath, 'utf-8');
    if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      return YAML.parse(content, { maxAliasCount: 100 }) as UltimateConfig;
    } else if (configPath.endsWith('.json')) {
      return JSON.parse(content) as UltimateConfig;
    }
    throw new Error('Config file must be .yaml, .yml, or .json');
  }
  
  static getDefaults(): Partial<UltimateConfig> {
    return { callAIKeywords: ['请', '你'], debug: false };
  }
}

const kBanner = `
  __  __ _    _  _____    _____ _____ ____   ___  ____  
 |  \\/  | |  | |/ /   \\  |_   _|_   _/ __ \\ / _ \\/ ___| 
 | |\\/| | |  | ' /| |_) |   | |   | || |  | | | | \\___ \\ 
 | |  | | |__| . \\|  _ <    | |   | || |  | | |_| |___) |
 |_|  |_|_____|_|\\_\\_| \\_\\   |_|   |_| \\___/ \\___/|____/ 
                                                        
  Ultimate - 小爱音箱终极解决方案 v0.1.0
`;

const kSuppressPatterns = [
  'del.wang',
  'mi-paiai v',
  '/ $$',
  '/$$$$',
  '| $$$',
  '| $$ ',
  '|__/',
];

let suppressActive = false;
const originalConsoleLog = console.log;

function filteredLog(...args: any[]) {
  const str = args.join(' ');
  if (suppressActive && kSuppressPatterns.some(p => str.includes(p))) {
    return;
  }
  originalConsoleLog.apply(console, args);
}

export class MiGPTUltimate {
  private plugins = new PluginManager();
  private memory: MemorySystem | null = null;
  private config: UltimateConfig | null = null;
  private isRunning = false;
  private runPromise: Promise<void> | null = null;

  constructor() {
    console.log = filteredLog;
  }

  async start(configOrPath: string | UltimateConfig): Promise<void> {
    console.log(kBanner);
    
    let config: UltimateConfig;
    if (typeof configOrPath === 'string') {
      config = ConfigLoader.load(configOrPath);
    } else {
      config = configOrPath;
    }
    
    this.config = config;

    if (config.memory?.enabled) {
      this.memory = new MemorySystem(config.memory.maxRecords ?? 100);
      console.log('📚 Memory system enabled');
    }

    for (const plugin of config.plugins ?? []) {
      this.plugins.register(plugin);
      console.log(`✅ Plugin loaded: ${plugin.name}`);
    }

    this.isRunning = true;
    
    const ttsCommand = config.ttsCommand;
    const keywords = config.callAIKeywords || ['请', '你'];
    
    const finalConfig: MiGPTConfig = {
      ...config,
      onMessage: async (engine, msg) => {
        if (!keywords.some((e) => msg.text.startsWith(e))) {
          return undefined;
        }
        
        try {
          await engine.speaker.abortXiaoAI();
          
          const text = await ChatBot.chat(msg);
          
          if (!text) {
            return undefined;
          }
          
          console.log(`🔊 ${text}`);
          
          if (ttsCommand) {
            await engine.MiOT.doAction(ttsCommand[0], ttsCommand[1], text);
          } else {
            await engine.speaker.play({ text });
          }
          
          return { handled: true };
        } catch (e) {
          console.error('AI 回复错误:', e);
          return undefined;
        }
      },
    };

    suppressActive = true;
    const basePromise = MiGPT.start(finalConfig);
    this.runPromise = basePromise
      .catch((error) => {
        if (this.isRunning) console.error('MiGPT service failed:', error);
      })
      .finally(() => {
        this.runPromise = null;
        this.isRunning = false;
      });
    console.log('✅ 服务已启动');
    console.log('📢 提示: 不刷机无法打断小爱回复，AI语音可能会与小爱声音重叠');
    console.log('📢 若无声音，请在高级选项填写正确的 TTS Command (如 5,1)');
  }

  async stop(): Promise<void> {
    await MiGPT.stop();
    if (this.runPromise) await this.runPromise;
    this.isRunning = false;
    suppressActive = false;
    console.log = originalConsoleLog;
    console.log('🛑 已停止');
  }

  getStatus() {
    return {
      running: this.isRunning,
      memory: this.memory?.getStats() ?? { total: 0, max: 0 },
      plugins: this.plugins.list().map(p => p.name),
    };
  }

  getPluginManager(): PluginManager { return this.plugins; }
  getMemory(): MemorySystem | null { return this.memory; }
  getConfig(): UltimateConfig | null { return this.config; }
}

export { MiGPT };
