export interface SearchRoute {
  shouldSearch: boolean;
  query: string;
  source: 'model' | 'rule' | 'fallback';
}

const FRESH_INFORMATION_PATTERN = /最新|目前|现在|当前|今天|今日|昨天|本周|本月|今年|近期|最近|实时|新闻|天气|价格|股价|汇率|比分|比赛|政策|库存|发布了吗|更新了吗|联网|搜索|查一下|查查|查询|网上/iu;

export function needsFreshInformation(question: string): boolean {
  return FRESH_INFORMATION_PATTERN.test(question);
}

function fallbackRoute(query: string): SearchRoute {
  const normalized = query.trim().slice(0, 500);
  return {
    shouldSearch: needsFreshInformation(normalized),
    query: normalized,
    source: 'fallback',
  };
}

export function parseSearchRoute(response: string, fallbackQuery: string): SearchRoute {
  const trimmed = response
    .trim()
    .replace(/^```(?:json|text)?\s*/iu, '')
    .replace(/\s*```$/u, '');
  const defaultRoute = fallbackRoute(fallbackQuery);

  try {
    const value = JSON.parse(trimmed) as { search?: unknown; query?: unknown } | boolean;
    if (typeof value === 'boolean') {
      return value
        ? { shouldSearch: true, query: defaultRoute.query, source: 'model' }
        : needsFreshInformation(fallbackQuery)
          ? { shouldSearch: true, query: defaultRoute.query, source: 'rule' }
          : { shouldSearch: false, query: defaultRoute.query, source: 'model' };
    }
    if (typeof value.search === 'boolean') {
      const query = typeof value.query === 'string' ? value.query.trim().slice(0, 500) : '';
      if (!value.search && needsFreshInformation(fallbackQuery)) {
        return { shouldSearch: true, query: query || defaultRoute.query, source: 'rule' };
      }
      return {
        shouldSearch: value.search,
        query: query || defaultRoute.query,
        source: 'model',
      };
    }
  } catch {
    if (/^(true|yes|是)$/iu.test(trimmed)) {
      return { shouldSearch: true, query: defaultRoute.query, source: 'model' };
    }
    if (/^(false|no|否)$/iu.test(trimmed)) {
      return needsFreshInformation(fallbackQuery)
        ? { shouldSearch: true, query: defaultRoute.query, source: 'rule' }
        : { shouldSearch: false, query: defaultRoute.query, source: 'model' };
    }
  }

  return defaultRoute.shouldSearch
    ? { ...defaultRoute, source: 'rule' }
    : defaultRoute;
}
