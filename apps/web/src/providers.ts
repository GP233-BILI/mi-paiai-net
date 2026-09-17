export interface ProviderPreset {
  id: string;
  label: string;
  group: string;
  baseURL: string;
  /** Default model suggested when this provider is selected (may be empty). */
  model?: string;
  /** Placeholder for the API key field. */
  keyHint?: string;
  /** true when the endpoint is user-hosted and needs a custom address. */
  selfHosted?: boolean;
}

export const DEFAULT_PROVIDER_ID = 'openai';

export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ---------- 聚合 / 中转 ----------
  {
    id: 'sub2api',
    label: 'Sub2API（默认）',
    group: '聚合 / 中转',
    baseURL: 'https://your-sub2api.example.com/v1',
    keyHint: '输入 Sub2API Key',
    selfHosted: true,
  },
  {
    id: 'newapi',
    label: 'New API（自建中转）',
    group: '聚合 / 中转',
    baseURL: 'https://your-newapi-domain/v1',
    keyHint: '输入 New API 令牌',
    selfHosted: true,
  },
  {
    id: 'oneapi',
    label: 'One API（自建中转）',
    group: '聚合 / 中转',
    baseURL: 'https://your-oneapi-domain/v1',
    keyHint: '输入 One API 令牌',
    selfHosted: true,
  },
  {
    id: 'opencode',
    label: 'OpenCode Zen',
    group: '聚合 / 中转',
    baseURL: 'https://opencode.ai/zen/v1',
    keyHint: '输入 OpenCode 密钥',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    group: '聚合 / 中转',
    baseURL: 'https://openrouter.ai/api/v1',
    keyHint: '输入 OpenRouter Key',
  },
  {
    id: 'aihubmix',
    label: 'AiHubMix',
    group: '聚合 / 中转',
    baseURL: 'https://aihubmix.com/v1',
    keyHint: '输入 AiHubMix Key',
  },
  // ---------- 国际主流 ----------
  {
    id: 'openai',
    label: 'OpenAI',
    group: '国际主流',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-5.6',
    keyHint: '输入 OpenAI Key（sk-...）',
  },
  {
    id: 'anthropic',
    label: 'Anthropic（Claude）',
    group: '国际主流',
    baseURL: 'https://api.anthropic.com/v1',
    keyHint: '输入 Anthropic Key（sk-ant-...）',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    group: '国际主流',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.8-flash-high',
    keyHint: '输入 Google AI Studio Key',
  },
  {
    id: 'grok',
    label: 'xAI（Grok）',
    group: '国际主流',
    baseURL: 'https://api.x.ai/v1',
    model: 'grok-4.6',
    keyHint: '输入 xAI Key（xai-...）',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    group: '国际主流',
    baseURL: 'https://api.mistral.ai/v1',
    keyHint: '输入 Mistral Key',
  },
  {
    id: 'groq',
    label: 'Groq',
    group: '国际主流',
    baseURL: 'https://api.groq.com/openai/v1',
    keyHint: '输入 Groq Key（gsk_...）',
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    group: '国际主流',
    baseURL: 'https://api.perplexity.ai',
    keyHint: '输入 Perplexity Key',
  },
  {
    id: 'cohere',
    label: 'Cohere',
    group: '国际主流',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    keyHint: '输入 Cohere Key',
  },
  {
    id: 'together',
    label: 'Together AI',
    group: '国际主流',
    baseURL: 'https://api.together.xyz/v1',
    keyHint: '输入 Together Key',
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    group: '国际主流',
    baseURL: 'https://api.cerebras.ai/v1',
    keyHint: '输入 Cerebras Key',
  },
  {
    id: 'deepinfra',
    label: 'DeepInfra',
    group: '国际主流',
    baseURL: 'https://api.deepinfra.com/v1/openai',
    keyHint: '输入 DeepInfra Key',
  },
  {
    id: 'fireworks',
    label: 'Fireworks AI',
    group: '国际主流',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    keyHint: '输入 Fireworks Key',
  },
  {
    id: 'github-models',
    label: 'GitHub Models',
    group: '国际主流',
    baseURL: 'https://models.github.ai/inference',
    keyHint: '输入 GitHub Token（github_pat_...）',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA NIM',
    group: '国际主流',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    keyHint: '输入 NVIDIA API Key（nvapi-...）',
  },
  // ---------- 国内主流 ----------
  {
    id: 'deepseek',
    label: 'DeepSeek（深度求索）',
    group: '国内主流',
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyHint: '输入 DeepSeek Key（sk-...）',
  },
  {
    id: 'glm',
    label: '智谱 GLM / 清言',
    group: '国内主流',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.3',
    keyHint: '输入智谱 API Key',
  },
  {
    id: 'qwen',
    label: '通义千问（阿里云百炼）',
    group: '国内主流',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.8-max',
    keyHint: '输入 DashScope Key（sk-...）',
  },
  {
    id: 'moonshot',
    label: '月之暗面 Kimi',
    group: '国内主流',
    baseURL: 'https://api.moonshot.cn/v1',
    model: 'kimi-k3',
    keyHint: '输入 Moonshot Key（sk-...）',
  },
  {
    id: 'minimax',
    label: 'MiniMax 海螺',
    group: '国内主流',
    baseURL: 'https://api.minimax.chat/v1',
    keyHint: '输入 MiniMax Key',
  },
  {
    id: 'doubao',
    label: '火山方舟（豆包）',
    group: '国内主流',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    keyHint: '输入火山方舟 API Key',
  },
  {
    id: 'hunyuan',
    label: '腾讯混元',
    group: '国内主流',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    keyHint: '输入混元 API Key',
  },
  {
    id: 'stepfun',
    label: '阶跃星辰 StepFun',
    group: '国内主流',
    baseURL: 'https://api.stepfun.com/v1',
    keyHint: '输入 StepFun Key',
  },
  {
    id: 'lingyiwanwu',
    label: '零一万物 Yi',
    group: '国内主流',
    baseURL: 'https://api.lingyiwanwu.com/v1',
    keyHint: '输入零一万物 Key',
  },
  {
    id: 'siliconflow',
    label: '硅基流动 SiliconFlow',
    group: '国内主流',
    baseURL: 'https://api.siliconflow.cn/v1',
    keyHint: '输入 SiliconFlow Key（sk-...）',
  },
  {
    id: 'modelscope',
    label: '魔搭 ModelScope',
    group: '国内主流',
    baseURL: 'https://api-inference.modelscope.cn/v1',
    keyHint: '输入 ModelScope Token',
  },
  // ---------- 本地 / 自建 ----------
  {
    id: 'ollama',
    label: 'Ollama（本机）',
    group: '本地 / 自建',
    baseURL: 'http://127.0.0.1:11434/v1',
    keyHint: '本地服务通常随便填，例如 ollama',
    selfHosted: true,
  },
  {
    id: 'lmstudio',
    label: 'LM Studio（本机）',
    group: '本地 / 自建',
    baseURL: 'http://127.0.0.1:1234/v1',
    keyHint: '本地服务通常随便填，例如 lmstudio',
    selfHosted: true,
  },
  {
    id: 'vllm',
    label: 'vLLM / SGLang（自建）',
    group: '本地 / 自建',
    baseURL: 'http://127.0.0.1:8000/v1',
    keyHint: '自建服务通常随便填',
    selfHosted: true,
  },
  {
    id: 'azure-openai',
    label: 'Azure OpenAI',
    group: '本地 / 自建',
    baseURL: 'https://your-resource.openai.azure.com/openai/v1',
    keyHint: '输入 Azure API Key',
    selfHosted: true,
  },
  // ---------- 其他 ----------
  {
    id: 'custom',
    label: '自定义（任意 OpenAI 兼容接口）',
    group: '其他',
    baseURL: '',
    keyHint: '输入 API Key',
    selfHosted: true,
  },
];

const PRESET_BY_ID = new Map(PROVIDER_PRESETS.map((preset) => [preset.id, preset]));

export function getProviderPreset(id: string): ProviderPreset | undefined {
  return PRESET_BY_ID.get(id);
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** Any slug is accepted so newly released providers keep working without a code change. */
export function isKnownProviderId(id: string): boolean {
  return PRESET_BY_ID.has(id) || PROVIDER_ID_PATTERN.test(id);
}

export const PROVIDER_GROUPS: string[] = [
  ...new Set(PROVIDER_PRESETS.map((preset) => preset.group)),
];
