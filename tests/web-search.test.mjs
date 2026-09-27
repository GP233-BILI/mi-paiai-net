import assert from 'node:assert/strict';
import test from 'node:test';

const { createTavilySearchClient, formatSearchContext } = await import('../apps/web/dist/web-search.js');

test('sends Tavily api_key in the request body and filters results', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      results: [
        { title: 'Valid', url: 'https://example.com/a', content: 'A useful summary' },
        { title: 'Local', url: 'http://127.0.0.1/admin', content: 'Do not include' },
        { title: 'Bad scheme', url: 'javascript:alert(1)', content: 'Do not include' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    const results = await createTavilySearchClient({
      enabled: true,
      decision: 'model',
      endpoint: 'https://api.tavily.com/search',
      apiKey: 'tvly-test-key',
      maxResults: 5,
      timeoutMs: 8000,
      cacheTtlSeconds: 600,
    }).search('latest model');
    const body = JSON.parse(request.options.body);
    assert.equal(String(request.url), 'https://api.tavily.com/search');
    assert.equal(body.api_key, 'tvly-test-key');
    assert.equal(body.search_depth, 'basic');
    assert.deepEqual(results.map((item) => item.title), ['Valid']);
    assert.doesNotMatch(formatSearchContext(results), /Do not include/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects a non-Tavily endpoint before making a request', async () => {
  await assert.rejects(
    createTavilySearchClient({
      enabled: true,
      decision: 'model',
      endpoint: 'http://127.0.0.1/search',
      apiKey: 'tvly-test-key',
      maxResults: 5,
      timeoutMs: 8000,
      cacheTtlSeconds: 600,
    }).search('test'),
    /Tavily 地址必须是 https:\/\/api\.tavily\.com/,
  );
});
