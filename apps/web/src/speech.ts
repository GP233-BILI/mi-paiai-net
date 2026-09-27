export interface SpeechAdapter {
  abortXiaoAI(): Promise<boolean>;
  stopMiNA(): Promise<boolean>;
  playText(text: string): Promise<boolean>;
  playMiOT(service: number, action: number, text: string): Promise<unknown>;
}

/**
 * Clean a reply for spoken output.
 *
 * The device executes service 5 action 3 (play-text) with one text argument.
 * The reply is intentionally sent as a single payload: splitting it produced
 * long audible gaps because each segment restarts the device TTS pipeline.
 */
export function prepareForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/https?:\/\/\S+/gu, '')
    .replace(/\[(\d+)\]/gu, '')
    .replace(/[*_`#>]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Stop whatever the speaker is currently playing before a new reply starts.
 * MiGPT-Next's abortXiaoAI is a no-op, so MiNA plus the device play-control
 * stop action (L05C service 3 action 4) are the effective calls.
 */
export async function stopCurrentPlayback(
  adapter: Pick<SpeechAdapter, 'abortXiaoAI' | 'stopMiNA'> & { stopMiOT?: () => Promise<unknown> },
): Promise<boolean> {
  try {
    if (await adapter.abortXiaoAI()) return true;
  } catch {
    // Fall through to the direct stop operations.
  }
  let stopped = false;
  try {
    stopped = await adapter.stopMiNA();
  } catch {
    stopped = false;
  }
  try {
    await adapter.stopMiOT?.();
  } catch {
    // Device-level stop is best effort.
  }
  return stopped;
}

/** Leave the listening state so the reply is not recognised as a user command. */
export async function leaveWakeState(
  adapter: { pauseMiNA(): Promise<boolean> },
): Promise<boolean> {
  try {
    return await adapter.pauseMiNA();
  } catch {
    return false;
  }
}

export async function playMiOTWithFallback(
  adapter: SpeechAdapter,
  service: number,
  action: number,
  text: string,
): Promise<{ mode: 'miot' | 'mina'; miotResult: unknown; fallbackResult?: boolean }> {
  let miotResult: unknown;
  try {
    miotResult = await adapter.playMiOT(service, action, text);
    if (miotResult === true) return { mode: 'miot', miotResult };
  } catch (error) {
    miotResult = error instanceof Error ? error.message : String(error);
  }
  const fallbackResult = await adapter.playText(text);
  return { mode: 'mina', miotResult, fallbackResult };
}
