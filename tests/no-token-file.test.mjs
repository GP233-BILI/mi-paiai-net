import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('the working tree does not contain Xiaomi token dumps', () => {
  assert.equal(existsSync(new URL('../apps/web/.mi.json', import.meta.url)), false);
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /\.mi\.json/);
});
