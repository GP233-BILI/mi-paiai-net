import { OpenAI } from '@mi-gpt/openai';
import type { ThinkingLevel } from './config.js';

export interface RuntimeSelection {
  model: string;
  thinkingLevel: ThinkingLevel;
}

export function applyOpenAISelection(selection: RuntimeSelection): void {
  const config = OpenAI.config as {
    model?: string;
    extra?: { createParams?: Record<string, unknown> };
  };
  config.model = selection.model;
  config.extra ??= {};
  config.extra.createParams ??= {};
  if (selection.thinkingLevel === 'default') {
    delete config.extra.createParams.reasoning_effort;
  } else {
    config.extra.createParams.reasoning_effort = selection.thinkingLevel;
  }
}
