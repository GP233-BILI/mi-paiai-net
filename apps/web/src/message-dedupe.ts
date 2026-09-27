export interface DedupeCandidate {
  text: string;
  timestamp: number;
}

export interface DedupeVerdict {
  duplicate: boolean;
  /** Device timestamp of the first delivery, when this is a duplicate. */
  firstTimestamp?: number;
}

/**
 * Guard against one utterance being answered more than once.
 *
 * The device conversation history can hold the same utterance as two records,
 * and the upstream poller releases queued records one per heartbeat tick. Each
 * delivery then starts its own model call, which surfaces as two different
 * answers to a single question.
 *
 * Identity is the normalized utterance text, so the two deliveries match even
 * though their timestamps differ. The window is deliberately short: it only has
 * to cover the handful of seconds between duplicate deliveries, while still
 * letting the user deliberately repeat a question shortly after.
 */
export function createMessageDedupe(windowMs = 10_000) {
  const seen = new Map<string, { at: number; timestamp: number }>();

  const normalize = (text: string): string => text.replace(/\s+/gu, ' ').trim();

  return {
    check(candidate: DedupeCandidate): DedupeVerdict {
      const now = Date.now();
      for (const [key, record] of seen) {
        if (now - record.at > windowMs) seen.delete(key);
      }
      const key = normalize(candidate.text);
      if (!key) return { duplicate: false };

      const previous = seen.get(key);
      if (previous) return { duplicate: true, firstTimestamp: previous.timestamp };

      seen.set(key, { at: now, timestamp: candidate.timestamp });
      return { duplicate: false };
    },
    size(): number {
      return seen.size;
    },
  };
}
