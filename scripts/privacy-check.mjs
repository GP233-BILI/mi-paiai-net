#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', '.turbo', 'coverage', 'data']);
const ignoredFiles = new Set(['scripts/privacy-check.mjs']);
const textExtensions = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.md', '.txt', '.html', '.css',
  '.toml', '.env', '.example', '.gitignore', '.dockerignore', 'Dockerfile',
]);

const blockedLiterals = [
  ['309', '6666.xyz'].join(''),
  ['375', '527526'].join(''),
  ['192', '168', '3', '216'].join('.'),
  ['pai', 'jishult'].join(''),
  ['BE9', 'L6F3'].join(''),
];

const patterns = [
  { name: 'GitHub token', regex: /gh[pousr]_[A-Za-z0-9_]{20,}/gu },
  { name: 'credential embedded in URL', regex: /https?:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gu },
  { name: 'OpenAI-style API key', regex: /\bsk-[A-Za-z0-9_-]{24,}\b/gu },
  { name: 'xAI API key', regex: /\bxai-[A-Za-z0-9_-]{20,}\b/gu },
  { name: 'Google API key', regex: /\bAIza[A-Za-z0-9_-]{30,}\b/gu },
  { name: 'Xiaomi PassToken', regex: /\bV1:[A-Za-z0-9+/=]{40,}\b/gu },
  { name: 'private IPv4 address', regex: /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/gu },
];

function extensionOf(path) {
  const name = path.split(/[\\/]/u).at(-1) || '';
  if (textExtensions.has(name)) return name;
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot) : '';
}

function walk(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const full = join(directory, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

const findings = [];
for (const file of walk(root)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (ignoredFiles.has(rel) || !textExtensions.has(extensionOf(file))) continue;
  if (statSync(file).size > 2_000_000) continue;
  const content = readFileSync(file, 'utf8');
  for (const literal of blockedLiterals) {
    if (content.toLowerCase().includes(literal.toLowerCase())) {
      findings.push(`${rel}: contains blocked personal marker (${literal.slice(0, 4)}…)`);
    }
  }
  for (const { name, regex } of patterns) {
    regex.lastIndex = 0;
    const match = regex.exec(content);
    if (match) findings.push(`${rel}: possible ${name} at character ${match.index}`);
  }
  if (/(^|\/)\.mi\.json$/u.test(rel)) findings.push(`${rel}: Xiaomi login cache must never be committed`);
}

if (findings.length) {
  console.error('Privacy check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Privacy check passed: no tokens, credentials, private IPs, or known personal markers found.');