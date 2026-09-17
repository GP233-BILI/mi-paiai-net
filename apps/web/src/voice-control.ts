import type { ThinkingLevel } from './config.js';

export interface VoiceControlState {
  enabled: boolean;
  model: string;
  models: string[];
  thinkingLevel: ThinkingLevel;
}

export interface VoiceControlResult {
  handled: boolean;
  reply?: string;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  log?: string;
}

const LEVEL_LABELS: Record<ThinkingLevel, string> = {
  default: '默认',
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
};

function normalize(value: string): string {
  return value
    .trim()
    .replace(/^小爱同学\s*[，,：:]?\s*/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/[。！!？?，,：:；;]+$/gu, '')
    .trim();
}

function compact(value: string): string {
  return value.replace(/\s+/gu, '').replace(/[。！!？?，,：:；;]/gu, '').toLowerCase();
}

function modelsReply(models: string[]): string {
  if (models.length === 0) return '当前没有配置可切换的模型';
  const list = models.slice(0, 10).map((model, index) => `${index + 1} 号 ${model}`).join('，');
  return `可用模型：${list}。可以说“换模型 2”，也可以直接说模型名字。`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, '');
}

function matchModelName(target: string, models: string[]): string | undefined {
  const cleaned = compact(target).replace(/(?:这个|那个|个)?模型$/u, '').trim();
  if (!cleaned) return undefined;

  const direct = models.find((model) => compact(model) === cleaned);
  if (direct) return direct;

  const indexMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const indexText = cleaned.match(/^第?([一二两三四五六七八九十]|\d{1,2})(?:个|号)?$/u);
  if (indexText) {
    const index = Number.parseInt(indexText[1], 10) || indexMap[indexText[1]];
    if (index && index <= models.length) return models[index - 1];
    return undefined;
  }

  const slugTarget = slug(cleaned);
  if (!slugTarget) return undefined;

  const exactSlug = models.find((model) => slug(model) === slugTarget);
  if (exactSlug) return exactSlug;

  const partial = models.filter((model) => {
    const candidate = slug(model);
    return candidate.includes(slugTarget) || slugTarget.includes(candidate);
  });
  if (partial.length === 1) return partial[0];
  if (partial.length > 1) {
    const prefix = partial.find((model) => slug(model).startsWith(slugTarget));
    if (prefix) return prefix;
    return undefined;
  }
  return undefined;
}function matchThinkingLevel(value: string): ThinkingLevel | undefined {
  const level = compact(value);
  if (!level) return undefined;
  if (/(?:默认|无|关闭|关掉|禁用|取消)/u.test(level)) return 'default';
  if (/(?:最低|最小|最快|快速|minimal)/u.test(level)) return 'minimal';
  if (/(?:最高|高|深度|high)/u.test(level)) return 'high';
  if (/(?:中|标准|medium)/u.test(level)) return 'medium';
  if (/(?:低|low)/u.test(level)) return 'low';
  return undefined;
}

export function currentStatusReply(state: VoiceControlState): string {
  return `当前使用模型 ${state.model}，思考等级 ${LEVEL_LABELS[state.thinkingLevel]}`;
}

export function handleVoiceCommand(
  input: string,
  state: VoiceControlState,
): VoiceControlResult {
  if (!state.enabled) return { handled: false };
  const text = normalize(input);
  const command = compact(text.replace(/^(?:请|你)/u, ''));

  if (/^(?:当前|现在)(?:用的|使用的)?(?:是)?(?:什么|哪个)?模型/u.test(command)) {
    return {
      handled: true,
      reply: currentStatusReply(state),
      log: '当前模型与思考等级已播报',
    };
  }

  if (/^(?:当前|现在)(?:的)?(?:思考|推理)(?:等级|级别)?/u.test(command)) {
    return {
      handled: true,
      reply: currentStatusReply(state),
      log: '当前模型与思考等级已播报',
    };
  }

  if (/^(?:有哪些|可用|支持哪些|列出|看看).*(?:模型)/u.test(command)) {
    return { handled: true, reply: modelsReply(state.models), log: '已播报可用模型' };
  }

  if (/^(?:有哪些|可用|支持哪些|列出).*(?:思考|推理)/u.test(command)) {
    return {
      handled: true,
      reply: '可选思考等级：默认、最低、低、中、高',
      log: '已播报思考等级',
    };
  }

  const modelPatterns = [
    /^(?:切换|换|设置|使用|采用)(?:到|为|成)?模型(?:到|为|成)?(.+)$/u,
    /^(?:切换|换|设置|使用|采用|改)(?:到|为|成)?第(.+?)个模型$/u,
    /^(?:切换|换|设置|使用|采用|改)(?:到|为|成)?(.+?)(?:这个|那个)?模型$/u,
    /^模型(?:切换|换成|设置为|设为|改成)(.+)$/u,
    /^(?:使用|采用)(.+?)模型$/u,
  ];
  for (const pattern of modelPatterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      const target = match[1].replace(/(?:模型|吧|谢谢)$/u, '').trim();
      if (!target) break;
      const model = matchModelName(target, state.models);
      if (!model) {
        if (/(?:思考|推理|等级)/u.test(target)) break;
        return {
          handled: true,
          reply: `没有找到模型 ${target}。${modelsReply(state.models)}`,
          log: `未找到模型：${target}`,
        };
      }
      return {
        handled: true,
        model,
        reply: `已切换模型为 ${model}`,
        log: `模型已切换为 ${model}`,
      };
    }
  }

  if (/^(?:切换|换|设置|使用)?模型$/u.test(command)) {
    return { handled: true, reply: modelsReply(state.models), log: '已播报可用模型' };
  }

  if (/^(?:开启|打开|启用)(?:深度)?(?:思考|推理)$/u.test(command)) {
    return {
      handled: true,
      thinkingLevel: 'high',
      reply: '已开启高等级深度思考',
      log: '思考等级已切换为高',
    };
  }

  if (/^(?:关闭|关掉|禁用|取消)(?:深度)?(?:思考|推理)$/u.test(command)) {
    return {
      handled: true,
      thinkingLevel: 'default',
      reply: '已关闭额外思考参数',
      log: '思考等级已切换为默认',
    };
  }

  const thinkingPatterns = [
    /^(?:切换|换|设置|调整|修改|改)(?:到|为|成)?(?:思考|推理)(?:等级|级别)?(?:到|为|成)?(.+)$/u,
    /^(?:思考|推理)(?:等级|级别)?(?:切换为|切换到|设置为|设为|调整为|改成|换成|调到)(.+)$/u,
    /^(最低|最小|快速|低|中|标准|高|最高|深度)(?:思考|推理)(?:等级|级别)?$/u,
  ];
  for (const pattern of thinkingPatterns) {
    const match = command.match(pattern);
    if (match?.[1]) {
      const level = matchThinkingLevel(match[1]);
      if (!level) {
        return {
          handled: true,
          reply: '没有识别这个思考等级，可选默认、最低、低、中、高',
          log: `无法识别思考等级：${match[1]}`,
        };
      }
      return {
        handled: true,
        thinkingLevel: level,
        reply: `已切换思考等级为${LEVEL_LABELS[level]}`,
        log: `思考等级已切换为${LEVEL_LABELS[level]}`,
      };
    }
  }

  if (/^(?:切换|换|设置|调整|修改|改)?(?:思考|推理)(?:等级|级别)?$/u.test(command)) {
    return {
      handled: true,
      reply: '可选思考等级：默认、最低、低、中、高',
      log: '已播报思考等级',
    };
  }

  const stripped = text.replace(
    /^(?:切换到|切换为|切换|换到|换成|换|设置为|设为|设置|采用|使用|用|改到|改成|改)\s*/u,
    '',
  );
  const bareModel = matchModelName(text, state.models) || (stripped !== text ? matchModelName(stripped, state.models) : undefined);
  if (bareModel) {
    return {
      handled: true,
      model: bareModel,
      reply: `已切换模型为 ${bareModel}`,
      log: `模型已切换为 ${bareModel}`,
    };
  }

  return { handled: false };
}

export { LEVEL_LABELS };
